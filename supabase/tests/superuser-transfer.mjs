// PGLITE_MODULE may point to an external @electric-sql/pglite installation.
// Runs exclusively in an isolated in-memory database, never production.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
create role authenticated; create role anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now());
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, email text, name text);
create table public.groups(id uuid primary key, name text, school text, owner_id uuid references public.profiles(id));
-- unique(group_id, user_id) mirrors production (0001); the transfer upsert
-- depends on it, so a harness without it would pass tests prod would fail.
create table public.memberships(
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text, is_admin boolean default false, status text, requested_role text,
  unique (group_id, user_id)
);
`);
for (const file of ['0020_superusers.sql', '0024_superuser_transfer_organization.sql']) {
  const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // reapplying must be safe
}

const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const SUPER = id(1), OLD_OWNER = id(2), MEMBER = id(3), OUTSIDER = id(4), UNVERIFIED = id(5), NOBODY = id(6);
const ORG = id(100);
const people = [
  [SUPER, 'super@example.com', true],
  [OLD_OWNER, 'owner@example.com', true],
  [MEMBER, 'member@example.com', true],
  [OUTSIDER, 'Outsider@Example.com', true],
  [UNVERIFIED, 'unverified@example.com', false],
  [NOBODY, 'noprofile@example.com', true],
];
for (const [uid, email, verified] of people) {
  await db.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,$3)', [uid, email, verified ? '2026-01-01' : null]);
  // NOBODY deliberately has no profile row — an account that never finished setup.
  if (uid !== NOBODY) await db.query('insert into profiles values ($1,$2,$3)', [uid, email, `Name ${email}`]);
}
// Bootstrap the superuser the way production does — a direct insert as the
// table owner. is_superuser() reads superuser_grants and nothing else.
await db.query('insert into superuser_grants(user_id) values ($1)', [SUPER]);
await db.query("insert into groups values ($1,'Chapter','School',$2)", [ORG, OLD_OWNER]);
await db.query("insert into memberships(group_id,user_id,role,is_admin,status) values ($1,$2,'admin',true,'approved')", [ORG, OLD_OWNER]);
await db.query("insert into memberships(group_id,user_id,role,is_admin,status) values ($1,$2,'little',false,'approved')", [ORG, MEMBER]);

const asUser = async uid => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec('set role authenticated');
};
const transfer = (group, email) => db.query('select superuser_transfer_organization($1,$2) as data', [group, email]);
// Assertions read as the table owner, not through whatever restricted role
// the last authorization check left active — the harness grants no direct
// table SELECT to authenticated/anon, so these would fail on ACL, not on
// the thing under test.
const ownerOf = async group => {
  await db.exec('reset role');
  return (await db.query('select owner_id from groups where id=$1', [group])).rows[0].owner_id;
};
const membershipOf = async (group, uid) => {
  await db.exec('reset role');
  return (await db.query('select role,is_admin,status from memberships where group_id=$1 and user_id=$2', [group, uid])).rows[0];
};
const countRows = async (sql, params) => {
  await db.exec('reset role');
  return (await db.query(sql, params)).rows[0].n;
};

// --- authorization -------------------------------------------------------
await asUser(OLD_OWNER);
await assert.rejects(transfer(ORG, 'member@example.com'), /Only a superuser/, 'a chapter owner is not a superuser');
await asUser(MEMBER);
await assert.rejects(transfer(ORG, 'member@example.com'), /Only a superuser/);
await db.exec('reset role'); await db.exec('set role anon');
await assert.rejects(transfer(ORG, 'member@example.com'), /permission denied/, 'anon cannot execute it at all');

// --- validation ----------------------------------------------------------
await asUser(SUPER);
await assert.rejects(transfer(id(999), 'member@example.com'), /no longer exists/);
await assert.rejects(transfer(ORG, 'ghost@example.com'), /No account with a verified email/);
await assert.rejects(transfer(ORG, 'unverified@example.com'), /No account with a verified email/, 'unverified email is not proof of inbox control');
await assert.rejects(transfer(ORG, '   '), /No account with a verified email/);
await assert.rejects(transfer(ORG, null), /No account with a verified email/);
await assert.rejects(transfer(ORG, 'noprofile@example.com'), /has not finished setting up/);
assert.equal(await ownerOf(ORG), OLD_OWNER, 'no failed attempt moved ownership');

// --- transfer to an existing member --------------------------------------
await asUser(SUPER);
const first = (await transfer(ORG, 'member@example.com')).rows[0].data;
assert.equal(first.owner_id, MEMBER);
assert.equal(first.group_name, 'Chapter');
assert.equal(first.previous_owner_email, 'owner@example.com');
assert.equal(await ownerOf(ORG), MEMBER);
const promoted = await membershipOf(ORG, MEMBER);
assert.equal(promoted.is_admin, true, 'new owner gains admin — owner_id alone grants nothing');
assert.equal(promoted.status, 'approved');
assert.equal(promoted.role, 'little', 'an existing big/little keeps their matching role');
const outgoing = await membershipOf(ORG, OLD_OWNER);
assert.equal(outgoing.is_admin, true, 'previous owner keeps admin');

// --- transfer to someone with no membership at all -----------------------
// Case-insensitive: the stored address is mixed-case, the caller types lower.
await asUser(SUPER);
const second = (await transfer(ORG, 'outsider@example.com')).rows[0].data;
assert.equal(second.owner_id, OUTSIDER);
assert.equal(second.previous_owner_email, 'member@example.com');
assert.equal(await ownerOf(ORG), OUTSIDER);
const created = await membershipOf(ORG, OUTSIDER);
assert.equal(created.is_admin, true);
assert.equal(created.status, 'approved');
assert.equal(created.role, 'admin', 'a brand-new membership is created as admin');

// --- idempotence ---------------------------------------------------------
await asUser(SUPER);
await transfer(ORG, 'outsider@example.com');
assert.equal(await ownerOf(ORG), OUTSIDER, 'transferring to the current owner is a no-op, not an error');
assert.equal(
  await countRows('select count(*)::int as n from memberships where group_id=$1 and user_id=$2', [ORG, OUTSIDER]),
  1, 'the upsert does not duplicate the membership row');

await db.close();
console.log('PASS: superuser organization transfer — authorization, validation, admin grant, and idempotence');
