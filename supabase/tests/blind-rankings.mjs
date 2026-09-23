// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite module.
// Uses an isolated in-memory database, never production records.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const require = createRequire(import.meta.url);
const ts = require('../../sorority-matcher/node_modules/typescript');
const matchingSource = await readFile(new URL('../../sorority-matcher/src/lib/matching.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(matchingSource, { compilerOptions: { module: ts.ModuleKind.ES2020 } }).outputText;
const { runDeferredAcceptance } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
await db.exec(`
create role authenticated; create role anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
create table profiles (id uuid primary key, name text, email text);
create table groups (id uuid primary key default gen_random_uuid(), name text, school text, join_code text, created_by uuid, owner_id uuid, active_cycle_id uuid);
create table cycles (id uuid primary key default gen_random_uuid(), group_id uuid, label text, created_by uuid, ended_at timestamptz);
create table memberships (id uuid primary key default gen_random_uuid(), group_id uuid, user_id uuid, role text, status text, is_admin boolean default false, willing_to_take_twins boolean default false, created_at timestamptz default now());
create table rankings (id uuid default gen_random_uuid(), group_id uuid, cycle_id uuid, ranker_id uuid, ranked_ids uuid[]);
create table pairings (group_id uuid, cycle_id uuid, big_id uuid, little_id uuid);
create function is_group_admin(p_group_id uuid) returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from memberships where group_id = p_group_id and user_id = auth.uid() and is_admin and status = 'approved') $$;
grant select on groups, memberships, profiles, cycles, rankings, pairings to authenticated;
alter table groups enable row level security;
create policy group_read on groups for select to authenticated using (exists(select 1 from memberships where group_id = groups.id and user_id = auth.uid()));
create policy group_update on groups for update to authenticated using (is_group_admin(id));
alter table rankings enable row level security;
create policy "rankings: view own" on rankings for select using (ranker_id = auth.uid());
create policy "rankings: admins view group rankings" on rankings for select using (is_group_admin(group_id));
`);
await db.exec(await readFile(new URL('../migrations/0017_blind_rankings.sql', import.meta.url), 'utf8'));
// Verify reapplying the migration is safe.
await db.exec(await readFile(new URL('../migrations/0017_blind_rankings.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../migrations/0021_little_preferences.sql', import.meta.url), 'utf8'));
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const group = id(1), cycle = id(2), admin = id(10), big2 = id(11), little1 = id(20), little2 = id(21), outsider = id(90);
await db.query('insert into groups(id, owner_id, active_cycle_id) values ($1,$2,$3)', [group, admin, cycle]);
await db.query('insert into cycles(id,group_id) values ($1,$2)', [cycle,group]);
for (const [user,role,isAdmin] of [[admin,'big',true],[big2,'big',false],[little1,'little',false],[little2,'little',false]]) {
 await db.query('insert into profiles values ($1,$2,$3)',[user,`Test ${user}`, 'test@example.invalid']);
 await db.query('insert into memberships(group_id,user_id,role,status,is_admin) values ($1,$2,$3,\'approved\',$4)',[group,user,role,isAdmin]);
 await db.query('insert into rankings(group_id,cycle_id,ranker_id,ranked_ids) values ($1,$2,$3,$4)', [group,cycle,user,role==='big'?[little2,little1]:[admin,big2]]);
}
const asUser = async user => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]); await db.exec('set role authenticated'); };
await asUser(admin);
assert.equal((await db.query('select * from rankings')).rows.length,1,'blind admins read only their own rankings');
const status = (await db.query('select * from get_blind_submission_status($1,$2)',[group,cycle])).rows;
assert.equal(status.length,4); assert.deepEqual(Object.keys(status[0]).sort(),['email','name','role','submitted','user_id']);
assert.equal((await db.query('select run_blind_matching($1,$2) as count',[group,cycle])).rows[0].count,2);
await db.query('update groups set blind_rankings = false where id = $1',[group]);
assert.equal((await db.query('select * from rankings')).rows.length,4,'unblinded admins read chapter rankings');
await asUser(big2);
assert.equal((await db.query('select * from rankings')).rows.length,1,'members stay private from other members with toggle off');
assert.equal((await db.query('update groups set blind_rankings = true where id = $1 returning id',[group])).rows.length,0,'non-admin cannot toggle');
await assert.rejects(db.query('select run_blind_matching($1,$2)',[group,cycle]),/Only a chapter admin/);
await asUser(outsider);
assert.equal((await db.query('select * from rankings')).rows.length,0);
await assert.rejects(db.query('select * from get_blind_submission_status($1,$2)',[group,cycle]),/Only a chapter admin/);
await asUser(admin);
await db.query('update groups set blind_rankings = true where id = $1',[group]);
assert.equal((await db.query('select * from rankings')).rows.length,1,'re-enabling immediately blocks admin reads');
await assert.rejects(db.query('select run_blind_matching($1,$2)',[group,id(999)]),/active cycle/);
// Deterministic random fixtures: compare SQL to the existing TypeScript algorithm.
await db.exec('reset role');
let seed = 12345;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const shuffle = items => { const out=[...items]; for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; };
for (let test=0;test<40;test++) {
 await db.exec('delete from rankings; delete from memberships; delete from pairings');
 const bigs = Array.from({length:1+test%4},(_,i)=>id(100+i));
 const littles = Array.from({length:1+test%7},(_,i)=>id(200+i));
 const twins=new Set(bigs.filter(()=>random()<0.5)); const bp={},lp={},wanted={};
 for (const big of bigs) if (test >= 10 && random() < 0.6) wanted[big] = random() < 0.5 ? 2 : 3;
 await db.query("insert into memberships(group_id,user_id,role,status,is_admin) values ($1,$2,'admin','approved',true)",[group,admin]);
 for(const [users,role,targets,map] of [[bigs,'big',littles,bp],[littles,'little',bigs,lp]]) {
  for(const user of users) {
   await db.query("insert into memberships(group_id,user_id,role,status,willing_to_take_twins,created_at) values ($1,$2,$3,'approved',$4,'2026-01-01')",[group,user,role,twins.has(user)]);
   if (wanted[user]) await db.query('update memberships set wanted_little_count = $1 where user_id = $2', [wanted[user],user]);
   map[user]=shuffle(targets).slice(0,Math.floor(random()*(targets.length+1)));
   await db.query('insert into rankings(group_id,cycle_id,ranker_id,ranked_ids) values ($1,$2,$3,$4)',[group,cycle,user,map[user]]);
  }
 }
 await asUser(admin);
 await db.query('select run_blind_matching($1,$2)',[group,cycle]);
 const actual=(await db.query('select big_id,little_id from pairings')).rows.map(r=>`${r.big_id}:${r.little_id}`).sort();
 const expected=runDeferredAcceptance(bigs,littles,bp,lp,twins,wanted).flatMap(r=>r.littles.map(l=>`${r.big}:${l}`)).sort();
 assert.deepEqual(actual,expected,`matching parity fixture ${test}`);
 await db.exec('reset role');
}
// Self-service saves, reloads, clears, and rejects invalid/unauthorized updates.
const testBig = id(100);
await asUser(testBig);
await db.query('select set_my_little_preference($1,false,3)',[group]);
let preference = (await db.query('select willing_to_take_twins,wanted_little_count from memberships where user_id=$1',[testBig])).rows[0];
assert.deepEqual(preference,{willing_to_take_twins:false,wanted_little_count:3});
await db.query('select set_my_little_preference($1,true,null)',[group]);
preference = (await db.query('select willing_to_take_twins,wanted_little_count from memberships where user_id=$1',[testBig])).rows[0];
assert.deepEqual(preference,{willing_to_take_twins:true,wanted_little_count:null});
await assert.rejects(db.query('select set_my_little_preference($1,true,4)',[group]),/Choose 2 or 3/);
await asUser(id(200));
await assert.rejects(db.query('select set_my_little_preference($1,true,2)',[group]),/Only an approved Big/);
await asUser(outsider);
await assert.rejects(db.query('select set_my_little_preference($1,true,2)',[group]),/Only an approved Big/);
// New chapters retain admin access and get their initial cycle.
await asUser(admin);
const created=(await db.query("select (create_group('Test chapter','Test school','TESTCODE')).id")).rows[0].id;
assert.equal((await db.query('select is_group_admin($1) as allowed',[created])).rows[0].allowed,true);
console.log('PASS: privacy toggle, authorization, status-only responses, 40 matching fixtures, and chapter creation');
await db.close();
