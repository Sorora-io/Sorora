// Runs the real Edge Function offline. SMTP and database are in-memory fakes.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const ts = require('../../sorority-matcher/node_modules/typescript');
const source = fs.readFileSync('supabase/functions/send-pairing-reveal/index.ts', 'utf8').replace(/^import .*;\n/gm, '');
const code = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;

function fixture(mode) {
 let handler, attempts=0;
 const cycle={id:'cycle',group_id:'group',reveal_scheduled_at:'2026-01-01',reveal_completed_at:null,reveal_failure_message:null};
 const pairs=[1,2].map(i=>({id:`pair${i}`,big_id:`big${i}`,little_id:`little${i}`,reveal_sent_at:null}));
 const admin={
  rpc:async()=>{if(mode==='lock-error') return {error:{message:'Unavailable'}}; cycle.pairing_edits_locked_at='locked'; return {error:null};},
  auth:{getUser:async()=>({data:{user:{id:'admin'}}})},
  from(table){
   let update, ids, claiming=false;
   const result=()=>{
    if(update){
     if(table==='cycles'){
      if(claiming && mode==='claim-error') return {data:null,error:{message:'DB unavailable'}};
      if(claiming && (cycle.reveal_completed_at || mode==='cancelled')) return {data:null,error:null};
      Object.assign(cycle,update);return {data:{id:cycle.id},error:null};
     }
     if(mode==='stamp-error') return {data:null,error:{message:'DB unavailable'}};
     for(const p of pairs) if(ids.includes(p.id)) Object.assign(p,update);
     return {data:null,error:null};
    }
    if(table==='profiles' && mode==='profile-error') return {data:null,error:{message:'Failed to load profiles'}};
    if(table==='profiles' && mode==='throw') throw new Error('Unexpected DB failure');
    const rows={
     groups:{name:'Test'},memberships:{role:'admin',is_admin:true},
     cycles:cycle.reveal_completed_at?[]:[{...cycle}],pairings:pairs.map(p=>({...p})),
     profiles:pairs.flatMap((p,i)=>[{id:p.big_id,name:'Big',email:`big${i}@example.invalid`},{id:p.little_id,name:'Little',email:'little@example.invalid'}]),
    };
    return {data:rows[table],error:null};
   };
   const q={select(){return q},eq(){return q},in(_,values){ids=values;return q},lte(){return q},is(key){if(update && key==='reveal_completed_at') claiming=true;return q},not(){return q},update(value){update=value;return q},maybeSingle:async()=>result(),then(resolve,reject){return Promise.resolve().then(result).then(resolve,reject)}};
   return q;
  },
 };
 vm.runInNewContext(code,{
  Deno:{env:{get:key=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake-service',SUPABASE_ANON_KEY:'fake-anon',GMAIL_USER:'fake@example.invalid',GMAIL_APP_PASSWORD:'fake'})[key]}},
  serve:fn=>{handler=fn},createClient:()=>admin,
  SMTPClient:class{async send(){assert.ok(cycle.pairing_edits_locked_at,'lock must precede SMTP');attempts++;if(mode==='all-fail'||(mode==='partial'&&attempts===2)) throw new Error('Controlled SMTP failure')}async close(){}},
  Response,console,
 });
 const invoke=body=>handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer fake-service','Content-Type':'application/json'},body:JSON.stringify(body)}));
 return {cycle,pairs,invoke,attempts:()=>attempts};
}
(async()=>{
 for(const mode of ['all-fail','partial','profile-error','throw','stamp-error']){
  const f=fixture(mode);
  assert.equal((await f.invoke({sweep:true})).status,200,mode);
  assert.ok(f.cycle.reveal_completed_at,mode);
  assert.match(f.cycle.reveal_failure_message,/No automatic retry/,mode);
  const count=f.attempts();
  await f.invoke({sweep:true});
  assert.equal(f.attempts(),count,`${mode}: next sweep must not retry`);
 }
 const success=fixture('success');
 await success.invoke({sweep:true});
 assert.equal(success.attempts(),2);
 assert.equal(success.cycle.reveal_failure_message,null);
 assert.ok(success.pairs.every(p=>p.reveal_sent_at));
 await success.invoke({sweep:true});assert.equal(success.attempts(),2);
 const concurrent=fixture('success');
 await Promise.all([concurrent.invoke({sweep:true}),concurrent.invoke({sweep:true})]);
 assert.equal(concurrent.attempts(),2,'overlapping sweeps send each recipient only once');
 for(const mode of ['claim-error','cancelled']){
  const f=fixture(mode);await f.invoke({sweep:true});assert.equal(f.attempts(),0);
 }
 const lockFailure=fixture('lock-error');
 await lockFailure.invoke({groupId:'group',cycleId:'cycle'}); assert.equal(lockFailure.attempts(),0,'lock failure must prevent all emails');
 const manual=fixture('partial');
 const result=await (await manual.invoke({groupId:'group',cycleId:'cycle'})).json();
 assert.equal(result.bigs,1,'report successful recipients, not attempts');
 assert.equal(result.unsent,1);
 assert.match(manual.cycle.reveal_failure_message,/No automatic retry/);
 assert.equal(manual.cycle.reveal_completed_at,null,'manual attempt does not consume a future schedule');
 console.log('PASS: persistent failure warnings, successful counts, partial/total failures, thrown failures, overlapping sweeps, no automatic retries, and cancelled/unclaimed schedules');
})().catch(error=>{console.error(error);process.exitCode=1});
