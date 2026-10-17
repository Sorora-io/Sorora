import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;
create table profiles(id uuid primary key, bio text);
create table memberships(group_id uuid,user_id uuid,role text,status text);
alter table profiles enable row level security; alter table memberships enable row level security;
grant select on profiles,memberships to authenticated;`);
const sql = await readFile(new URL('../migrations/0001_groups_and_rankings.sql',import.meta.url),'utf8');
for (const name of ['is_group_admin','is_approved_group_member']) {
 const fn = sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`));
 assert.ok(fn, name); await db.exec(fn[0]);
}
for (const name of ['profiles: view own','profiles: admins view group members','profiles: group peers view each other','memberships: view own','memberships: admins view group memberships','memberships: peers view approved group members']) {
 const policy = sql.match(new RegExp(`create policy "${name}"[\\s\\S]*?;`));
 assert.ok(policy, name); await db.exec(policy[0]);
}
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
for (let n=1;n<=6;n++) await db.query('insert into profiles values($1,$2)',[id(n),`Bio ${n}`]);
for (const [user,group,role,status] of [[1,10,'big','approved'],[2,10,'little','approved'],[3,10,'little','pending'],[4,10,'little','rejected'],[5,20,'big','approved'],[6,10,'admin','approved']]) {
 await db.query('insert into memberships values($1,$2,$3,$4)',[id(group),id(user),role,status]);
}
const login = async n => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n ? id(n) : '']); await db.exec('set role authenticated'); };
const read = async (target=2, group=10) => (await db.query(`select p.bio from memberships m join profiles p on p.id=m.user_id where m.group_id=$1 and m.user_id=$2 and m.status='approved'`,[id(group),id(target)])).rows;
for (const viewer of [1,6]) { await login(viewer); assert.deepEqual(await read(),[{bio:'Bio 2'}]); }
for (const viewer of [0,3,4,5]) { await login(viewer); assert.deepEqual(await read(),[],`viewer ${viewer} denied`); }
await login(1); assert.deepEqual(await read(5,20),[],'other chapter denied'); assert.deepEqual(await read(3),[],'pending target denied');
await login(6); assert.deepEqual(await read(3),[],'admin cannot open a non-roster target');
await db.exec('reset role'); await db.query("update memberships set status='rejected' where user_id=$1",[id(1)]);
await login(1); assert.deepEqual(await read(),[],'revoked member denied');
await db.close(); console.log('Roster profile RLS checks passed (approved peers/admins, anonymous, pending, rejected, cross-chapter, revocation).');
