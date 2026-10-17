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
await db.exec(`alter table groups add column max_littles_per_big integer default 3;
create function public.cycle_memberships(p_group_id uuid,p_cycle_id uuid) returns setof public.memberships language sql stable security definer set search_path='' as $$ select * from public.memberships where group_id=p_group_id $$;`);
await db.exec(await readFile(new URL('../migrations/0045_matching_requires_ranking_connection.sql',import.meta.url),'utf8'));
await db.exec(`create or replace function public.run_blind_matching(p_group_id uuid,p_cycle_id uuid) returns integer language sql security definer set search_path='' as $$ select public.run_blind_matching_unreviewed(p_group_id,p_cycle_id) $$;`);


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


// Guard both existing rows and new inserts with actual production policies.
await db.exec('reset role');
const initial = await readFile(new URL('../migrations/0001_groups_and_rankings.sql', import.meta.url), 'utf8');
const cycleSql = await readFile(new URL('../migrations/0016_rush_cycles.sql', import.meta.url), 'utf8');
await db.exec(initial.slice(initial.indexOf('drop policy if exists "rankings: submit own"'), initial.indexOf('-- pairings (admin only)')));
await db.exec(cycleSql.slice(cycleSql.indexOf('create or replace function public.check_cycle_group_match()'), cycleSql.indexOf('-- create_group (0007)')));
await db.exec('grant insert, update on rankings to authenticated;');
const writeMigration = await readFile(new URL('../migrations/0026_ranking_write_access.sql', import.meta.url), 'utf8');
await db.exec(writeMigration);
await db.exec(writeMigration);
await db.exec('alter table groups add column ranking_deadline date');
const deadlineMigration = await readFile(new URL('../migrations/0031_ranking_deadline.sql', import.meta.url), 'utf8');
await db.exec(deadlineMigration); await db.exec(deadlineMigration);
const updateOwn = async user => (await db.query('update rankings set ranked_ids=$1 where ranker_id=$2 returning ranker_id',[[id(201)],user])).rows.length;
await asUser(testBig);
assert.equal(await updateOwn(testBig),1,'approved Big can edit active rankings');
await asUser(id(200));
assert.equal(await updateOwn(id(200)),1,'approved Little can edit active rankings');
for (const roleUser of [testBig,id(200)]) {
 await db.exec('reset role');
 await db.query("update groups set ranking_deadline=(statement_timestamp() at time zone 'UTC')::date - 1 where id=$1",[group]);
 await asUser(roleUser);
 assert.equal(await updateOwn(roleUser),0,'expired deadline blocks updates');
 await assert.rejects(db.query('insert into rankings(group_id,cycle_id,ranker_id,ranked_ids) values($1,$2,$3,$4)',[group,cycle,roleUser,[testBig]]),/row-level security/);
 await db.exec('reset role');
 await db.query("update groups set ranking_deadline=(statement_timestamp() at time zone 'UTC')::date where id=$1",[group]);
 await asUser(roleUser);
 assert.equal(await updateOwn(roleUser),1,'selected UTC day remains open');
}
await db.exec('reset role');
await db.query('update groups set ranking_deadline=null where id=$1',[group]);
await asUser(id(200));
console.log('PASS: Big/Little deadline inserts and updates denied; selected UTC day remains open');

assert.equal(await updateOwn(testBig),0,'cannot edit another member');
await assert.rejects(db.query('update rankings set ranker_id=$1 where ranker_id=$2',[testBig,id(200)]),/row-level security/);
for (const status of ['pending','rejected']) {
 await db.exec('reset role');
 await db.query('update memberships set status=$1 where user_id=$2',[status,id(200)]);
 await asUser(id(200));
 assert.equal(await updateOwn(id(200)),0,`${status} member cannot edit`);
 await assert.rejects(db.query('insert into rankings(group_id,cycle_id,ranker_id,ranked_ids) values($1,$2,$3,$4)',[group,cycle,id(200),[testBig]]),/row-level security/);
}
await db.exec('reset role');
await db.query("update memberships set status='approved' where user_id=$1",[id(200)]);
await db.query('update cycles set ended_at=now() where id=$1',[cycle]);
await asUser(id(200));
assert.equal(await updateOwn(id(200)),0,'closed cycle cannot be edited');
await assert.rejects(db.query('insert into rankings(group_id,cycle_id,ranker_id,ranked_ids) values($1,$2,$3,$4)',[group,cycle,id(200),[testBig]]),/row-level security/);
await db.exec('reset role');
await db.query('update cycles set ended_at=null where id=$1',[cycle]);
await db.query('update groups set active_cycle_id=null where id=$1',[group]);
await asUser(id(200));
assert.equal(await updateOwn(id(200)),0,'inactive cycle cannot be edited even without ended_at');
await db.exec('reset role');
await db.query('update groups set active_cycle_id=$1 where id=$2',[cycle,group]);
await db.query('delete from memberships where user_id=$1',[id(200)]);
await asUser(id(200));
assert.equal(await updateOwn(id(200)),0,'removed member cannot edit retained ranking');
assert.equal((await db.query('select * from rankings where ranker_id=$1',[id(200)])).rows.length,1,'retained ranking stays readable');
await db.exec('reset role');
await db.query("update memberships set role='admin' where user_id=$1",[testBig]);
await asUser(testBig);
assert.equal(await updateOwn(testBig),0,'admin-only role cannot edit former Big ranking');
console.log('PASS: ranking writes require approved eligible membership and active open cycle; historical reads remain intact');

await db.exec('reset role');
await db.exec(await readFile(new URL('../migrations/0018_pairing_reveal.sql', import.meta.url), 'utf8'));
const revealMigration = await readFile(new URL('../migrations/0027_reveal_failure_status.sql', import.meta.url), 'utf8');
await db.exec(revealMigration);
await db.exec(revealMigration);
await db.query('update cycles set reveal_completed_at=now(), reveal_failure_message=$1 where id=$2',['Some reveal emails failed. No automatic retry will be made.',cycle]);
await asUser(admin);
const failure=(await db.query('select * from get_pairing_reveal_status($1,$2)',[group,cycle])).rows[0];
assert.match(failure.failure_message,/No automatic retry/);
await asUser(outsider);
await assert.rejects(db.query('select * from get_pairing_reveal_status($1,$2)',[group,cycle]),/Only a chapter admin/);
await db.exec('reset role; set role anon');
await assert.rejects(db.query('select * from get_pairing_reveal_status($1,$2)',[group,cycle]),/permission denied/);
console.log('PASS: persistent reveal failure status remains admin-only; migrations are rerunnable');

await db.exec('reset role');
const countsMigration=await readFile(new URL('../migrations/0032_reveal_recipient_counts.sql',import.meta.url),'utf8');
await db.exec(countsMigration); await db.exec(countsMigration);
await db.exec('delete from pairings');
await db.query('insert into pairings(group_id,cycle_id,big_id,little_id,reveal_sent_at) values ($1,$2,$3,$4,null),($1,$2,$3,$5,now()),($1,$2,$6,$7,now())',[group,cycle,testBig,id(200),id(201),id(101),id(202)]);
await asUser(admin);
const counts=(await db.query('select * from get_pairing_reveal_status($1,$2)',[group,cycle])).rows[0];
assert.equal(counts.total,3); assert.equal(counts.sent,2); assert.equal(counts.unnotified_bigs,1,'partially notified twins count as one outstanding recipient');
await asUser(outsider);
await assert.rejects(db.query('select * from get_pairing_reveal_status($1,$2)',[group,cycle]),/Only a chapter admin/);
console.log('PASS: distinct outstanding recipients including partially notified twins; status remains admin-only');
await db.close();
