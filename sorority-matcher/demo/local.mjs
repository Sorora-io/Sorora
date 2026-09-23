import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, mkdirSync, readdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../..');
const work=path.join(root,'.demo');
const command=process.argv[2];
const cli=(args, options={})=>execFileSync('npx',['--yes','supabase@2.117.0',...args,'--workdir',work],{cwd:root,...options});
if(command==='setup') {
  mkdirSync(path.join(work,'supabase/migrations'),{recursive:true});
  copyFileSync(path.join(dir,'config.toml'),path.join(work,'supabase/config.toml'));
  for(const name of readdirSync(path.join(root,'supabase/migrations'))) {
    let sql=readFileSync(path.join(root,'supabase/migrations',name),'utf8');
    // 0025 protects existing production superusers. A fresh demo has none yet.
    // Only the generated local copy omits this guard; production stays intact.
    if(name==='0025_superuser_remove_allowlist.sql') sql=sql.replace(/do \$\$[\s\S]*?end \$\$;/,'-- Fresh isolated demo database.');
    writeFileSync(path.join(work,'supabase/migrations',name),sql);
  }
  cli(['start'],{stdio:'inherit'});
  process.exit(0);
}
const settings=JSON.parse(cli(['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const url=settings.API_URL;
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname)) throw Error('Demo refuses non-local database');
if(command==='start') {
 const child=spawn('npm',['start'],{cwd:path.join(root,'sorority-matcher'),stdio:'inherit',env:{...process.env,HOST:'127.0.0.1',PORT:'3001',BROWSER:'none',REACT_APP_SUPABASE_URL:url,REACT_APP_SUPABASE_ANON_KEY:settings.ANON_KEY}});
 child.on('exit',code=>process.exit(code??1));
} else {
 const service=createClient(url,settings.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const client=()=>createClient(url,settings.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const ok=({data,error})=>{if(error)throw error;return data};
 const password='SororaDemo2026!';
 const dataset=JSON.parse(readFileSync(path.join(dir,'participants.json'),'utf8'));
 const emailFor=p=>p.name==='Adeline Bennett'?'big@demo.sorora.test':p.name==='Estelle Sullivan'?'little@demo.sorora.test':`${p.name.toLowerCase().replace(/[^a-z]+/g,'.')}@demo.sorora.test`;
 const admin=client();
 if(command==='seed') {
  const existing=ok(await service.auth.admin.listUsers({perPage:1000})).users;
  async function user(email,name) {
   const prior=existing.find(u=>u.email===email);
   if(prior)return ok(await service.auth.admin.updateUserById(prior.id,{password,email_confirm:true,user_metadata:{name}})).user;
   return ok(await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name}})).user;
  }
  const owner=await user('admin@demo.sorora.test','Demo Admin');
  ok(await admin.auth.signInWithPassword({email:owner.email,password}));
  let group=ok(await service.from('groups').select('*').eq('join_code','SORORA-DEMO').maybeSingle());
  if(!group)group=ok(await admin.rpc('create_group',{p_name:'Sorora Demo Chapter',p_school:'Demo University',p_join_code:'SORORA-DEMO'}));
  ok(await service.from('groups').update({blind_rankings:true,min_big_rankings:1,min_little_rankings:1,description:'Local demo using anonymized spreadsheet preferences.'}).eq('id',group.id));
  ok(await service.from('memberships').update({is_admin:true}).eq('group_id',group.id).eq('user_id',owner.id));
  ok(await service.from('cycles').update({label:'Spreadsheet Demo',ended_at:null}).eq('id',group.active_cycle_id));
  const ids=new Map();
  for(const p of dataset.people){const u=await user(emailFor(p),p.name);ids.set(p.name,u.id);}
  ok(await service.from('memberships').upsert(dataset.people.map(p=>({group_id:group.id,user_id:ids.get(p.name),role:p.role,status:'approved',is_admin:false,willing_to_take_twins:p.willing,wanted_little_count:p.wanted})),{onConflict:'group_id,user_id'}));
  ok(await service.from('rankings').delete().eq('group_id',group.id));
  ok(await service.from('rankings').insert(dataset.people.filter(p=>p.rankings.length).map(p=>({group_id:group.id,cycle_id:group.active_cycle_id,ranker_id:ids.get(p.name),ranked_ids:p.rankings.map(n=>{if(!ids.has(n))throw Error('Missing '+n);return ids.get(n)})}))));
  ok(await service.from('pairings').delete().eq('group_id',group.id));
  console.log(`Seeded ${dataset.people.length} participants. Admin, Big, Little password: ${password}`);
 } else if(command==='verify') {
  ok(await admin.auth.signInWithPassword({email:'admin@demo.sorora.test',password}));
  const group=ok(await admin.from('groups').select('*').eq('join_code','SORORA-DEMO').single());
  const params={p_group_id:group.id,p_cycle_id:group.active_cycle_id};
  for(const role of ['big','little']) {
   const c=client();const auth=ok(await c.auth.signInWithPassword({email:`${role}@demo.sorora.test`,password}));
   const rows=ok(await c.from('rankings').select('ranker_id').eq('group_id',group.id));
   if(rows.some(r=>r.ranker_id!==auth.user.id))throw Error('Other rankings exposed');
   const denied=await c.rpc('run_blind_matching',params);if(!denied.error)throw Error('Non-admin ran matching');
   console.log(`${role}: login, own rankings, and matching access checks passed`);
  }
  const hidden=ok(await admin.from('rankings').select('*').eq('group_id',group.id));
  if(hidden.length)throw Error('Blind rankings exposed to admin');
  ok(await admin.rpc('run_blind_matching',params));
  const pairs=ok(await service.from('pairings').select('*').eq('group_id',group.id));
  const members=ok(await service.from('memberships').select('*').eq('group_id',group.id));
  if(pairs.length!==dataset.people.filter(p=>p.role==='little').length)throw Error('Unmatched littles');
  if(new Set(pairs.map(p=>p.little_id)).size!==pairs.length)throw Error('Duplicate little');
  for(const m of members.filter(m=>m.role==='big'))if(pairs.filter(p=>p.big_id===m.user_id).length>(m.wanted_little_count??(m.willing_to_take_twins?2:1)))throw Error('Capacity exceeded');
  console.log(`SQL matching verified: ${pairs.length} unique Littles matched; capacities respected; admin cannot read private rankings.`);
  ok(await service.from('pairings').delete().eq('group_id',group.id));
  console.log('Cleared test results: ready for a live matching demonstration.');
 } else throw Error('Use setup, seed, verify, or start');
}
