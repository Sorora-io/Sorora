// PGLITE_MODULE may point to an external @electric-sql/pglite installation.
// Runs exclusively in an isolated database.
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
create table public.memberships(group_id uuid references public.groups(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade, role text, is_admin boolean, status text, requested_role text);
`);
const migration = await readFile(new URL('../migrations/0020_superusers.sql', import.meta.url), 'utf8');
await db.exec(migration);
await db.exec(migration);
const removeAllowlist = await readFile(new URL('../migrations/0025_superuser_remove_allowlist.sql', import.meta.url), 'utf8');
// 0025 must refuse to run while nobody is granted — applying it then would
// leave an installation with no superuser and no way to create one. The
// guard aborts inside the migration's own transaction, so roll back before
// continuing or every later statement fails with 25P02.
await assert.rejects(db.exec(removeAllowlist), /Refusing to drop the bootstrap allowlist/);
await db.exec('rollback');

const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
// Users 1-3 are superusers, 4 and 5 ordinary, 6 unverified.
const emails = ['super-one@example.com', 'super-two@example.com', 'Super-Three@example.com', 'member@example.com', 'admin@example.com', 'unverified@example.com'];
for (let i=0;i<emails.length;i++) {
  await db.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,$3)', [id(i+1),emails[i],i===5 ? null : '2026-01-01']);
  // A spoofed profile email must never grant privileges — profile email is
  // user-editable, so authorization reads auth.users and nothing else.
  await db.query('insert into profiles values ($1,$2,$3)',[id(i+1),'super-one@example.com',`User ${i+1}`]);
}
// Bootstrap the way production now does: a direct insert as the table
// owner, since grant_superuser() needs a superuser to already exist.
for (const n of [1,2,3]) await db.query('insert into superuser_grants(user_id) values ($1)',[id(n)]);
// Granted but unverified is still refused — a grant row is not sufficient.
await db.query('insert into superuser_grants(user_id) values ($1)',[id(6)]);

// With someone granted, dropping the allowlist is safe. Reapplying is too.
await db.exec(removeAllowlist);
await db.exec(removeAllowlist);
await db.query("insert into groups values ($1,'Chapter','School',$2)",[id(100),id(5)]);
await db.query("insert into memberships values ($1,$2,'big',true,'approved','little')",[id(100),id(5)]);
const asUser = async n => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);
  await db.exec('set role authenticated');
};
const access = async () => (await db.query('select is_superuser() as allowed')).rows[0].allowed;
for (const n of [1,2,3]) { await asUser(n); assert.equal(await access(),true); }
for (const n of [4,5,6]) {
  await asUser(n); assert.equal(await access(),false);
  await assert.rejects(db.query('select superuser_accounts()'), /Only a superuser/);
  await assert.rejects(db.query('select grant_superuser($1)',[id(n)]), /Only a superuser/);
  await assert.rejects(db.query('insert into superuser_grants(user_id) values ($1)',[id(n)]), /permission denied/);
}
await asUser(1);
let directory = (await db.query('select superuser_accounts() as data')).rows[0].data;
assert.equal(directory.total,6);
assert.equal(directory.accounts.find(a=>a.id===id(4)).memberships.length,0);
assert.equal(directory.accounts.find(a=>a.id===id(5)).memberships[0].is_admin,true);
assert.equal(directory.accounts.find(a=>a.id===id(5)).memberships[0].role,'big');
assert.equal((await db.query("select superuser_accounts('member@',0) as data")).rows[0].data.total,1);
assert.equal((await db.query("select superuser_accounts('',50) as data")).rows[0].data.accounts.length,0);
await assert.rejects(db.query("select superuser_accounts('',-1)"),/Invalid page/);
await assert.rejects(db.query('select grant_superuser($1)',[id(6)]),/verified email/);
await assert.rejects(db.query('select grant_superuser($1)',[id(99)]),/existing account/);
await db.query('select grant_superuser($1)',[id(4)]);
await db.query('select grant_superuser($1)',[id(4)]);
await asUser(4);
assert.equal(await access(),true);
await db.query('select grant_superuser($1)',[id(5)]);
await asUser(5); assert.equal(await access(),true);
await db.exec('reset role');
assert.equal((await db.query('select granted_by from superuser_grants where user_id=$1',[id(5)])).rows[0].granted_by,id(4));
await db.exec('set role anon');
await assert.rejects(db.query('select is_superuser()'),/permission denied/);
await assert.rejects(db.query('select superuser_accounts()'),/permission denied/);
await assert.rejects(db.query('select grant_superuser($1)',[id(6)]),/permission denied/);
await db.exec('reset role');
await db.exec(await readFile(new URL('../migrations/0022_superuser_delete_account.sql', import.meta.url), 'utf8'));
await db.exec("alter table public.groups add column join_code text default 'TESTCODE'");
await db.exec(await readFile(new URL('../migrations/0023_superuser_join_codes.sql', import.meta.url), 'utf8'));
await asUser(6);
await assert.rejects(db.query('select superuser_delete_account($1,$2)',[id(4),'delete']),/Only a superuser/);
await assert.rejects(db.query('select superuser_delete_organization($1,$2)',[id(100),'delete']),/Only a superuser/);
await assert.rejects(db.query('select superuser_organizations()'),/Only a superuser/);
await asUser(1);
for (const confirmation of [null, '', 'DELETE', ' delete']) {
 await assert.rejects(db.query('select superuser_delete_account($1,$2)',[id(4),confirmation]),/Type delete/);
 await assert.rejects(db.query('select superuser_delete_organization($1,$2)',[id(100),confirmation]),/Type delete/);
}
await assert.rejects(db.query('select superuser_delete_account($1,$2)',[id(1),'delete']),/own account/);
await assert.rejects(db.query('select superuser_delete_account($1,$2)',[id(5),'delete']),/ownership/);
await assert.rejects(db.query('select superuser_delete_account($1,$2)',[id(999),'delete']),/no longer exists/);
const orgs=(await db.query("select superuser_organizations('School',0) as data")).rows[0].data;
assert.equal(orgs.total,1); assert.equal(orgs.organizations[0].member_count,1);
assert.equal(orgs.organizations[0].owner_email,'admin@example.com');
assert.equal(orgs.organizations[0].join_code,'TESTCODE');
await db.query('select superuser_delete_organization($1,$2)',[id(100),'delete']);
await assert.rejects(db.query('select superuser_delete_organization($1,$2)',[id(100),'delete']),/no longer exists/);
assert.equal((await db.query('select superuser_accounts() as data')).rows[0].data.total,6,'org deletion keeps accounts');
await db.query('select superuser_delete_account($1,$2)',[id(5),'delete']);
await db.exec('reset role');
assert.equal((await db.query('select * from memberships')).rows.length,0);
assert.equal((await db.query('select * from profiles where id=$1',[id(5)])).rows.length,0);
assert.equal((await db.query('select * from superuser_grants where user_id=$1',[id(5)])).rows.length,0);
await db.exec('set role anon');
await assert.rejects(db.query('select superuser_delete_account($1,$2)',[id(4),'delete']),/permission denied/);
await assert.rejects(db.query('select superuser_delete_organization($1,$2)',[id(100),'delete']),/permission denied/);
await db.close();
console.log('Superuser authorization, directory, and promotion checks passed.');
