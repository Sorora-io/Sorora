import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`create role authenticated; create role anon; create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.groups(id uuid primary key, name text, blind_rankings boolean);
create table public.cycles(id uuid primary key, group_id uuid, label text);
create table public.profiles(id uuid primary key, name text, email text);
create table public.memberships(group_id uuid, user_id uuid, role text, status text, is_admin boolean);
create table public.rankings(group_id uuid, cycle_id uuid, ranker_id uuid, ranked_ids uuid[], updated_at timestamptz);
create function public.is_group_admin(g uuid) returns boolean language sql as $$ select exists(select 1 from public.memberships where group_id=g and user_id=auth.uid() and is_admin and status='approved') $$;`);
await db.exec(await readFile(new URL('../migrations/0033_ranking_exports.sql', import.meta.url),'utf8'));
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const group=id(1), cycle=id(2), admin=id(3), little=id(4), waiting=id(5);
await db.query('insert into groups values ($1,\'Test\',true)',[group]);
await db.query('insert into cycles values ($1,$2,\'Fall\')',[cycle,group]);
for (const [user,role,isAdmin] of [[admin,'big',true],[little,'little',false],[waiting,'little',false]]) {
 await db.query('insert into profiles values ($1,$2,$3)',[user,`Member ${user}`,`${user}@example.test`]);
 await db.query("insert into memberships values ($1,$2,$3,'approved',$4)",[group,user,role,isAdmin]);
}
await db.query('insert into rankings values ($1,$2,$3,$4,now())',[group,cycle,admin,[waiting,little]]);
const login=async user=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');};
const run=async (preferences,g=group,c=cycle)=>(await db.query('select public.export_chapter_rankings($1,$2,$3) as result',[g,c,preferences])).rows[0].result;
await login(admin);
let data=await run(false);assert.equal(data.members.length,3);assert.equal(data.members.filter(m=>m.submitted).length,1);assert.ok(data.members.every(m=>m.preferences===null));
await assert.rejects(()=>run(true),/Blind rankings/);
await assert.rejects(()=>run(false,group,id(999)),/cycle does not belong/);
await db.exec('reset role');await db.query('update groups set blind_rankings=false where id=$1',[group]);await login(admin);
data=await run(true);assert.deepEqual(data.members[0].preferences.map(p=>p.userId),[waiting,little]);assert.deepEqual(data.members[0].preferences.map(p=>p.rank),[1,2]);
for(const user of [little,waiting,id(999),'']) {await login(user);await assert.rejects(()=>run(true),/Only a chapter admin/);await assert.rejects(()=>run(false),/Only a chapter admin/);}
console.log('Ranking exports: privacy, admin access, cycle scope, waiting members, and preference order pass.');
await db.close();
