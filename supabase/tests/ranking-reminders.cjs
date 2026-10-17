const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const ts=require('../../sorority-matcher/node_modules/typescript');
let handler;const sent=[];let cooldown=0;
const group={id:'g',name:'Test',active_cycle_id:'c',ranking_deadline:null,reminders_last_sent_at:null};
const data={memberships:[{user_id:'excluded',role:'little',profiles:{email:'excluded@test',name:'Excluded'}},{user_id:'active',role:'little',profiles:{email:'active@test',name:'Active'}}],rankings:[],cycle_exclusions:[{user_id:'excluded'}]};
function createClient(){return {auth:{getUser:async()=>({data:{user:{id:'admin'}}})},from(table){let isUpdate=false;const q={select(){return q;},eq(){return q;},in(){return q;},not(){return q;},or(){return q;},update(){isUpdate=true;cooldown++;return q;},single:async()=>({data:group}),maybeSingle:async()=>({data:{role:'admin'}}),then(resolve){return Promise.resolve({data:isUpdate?null:(table==='groups'?[group]:data[table]??[])}).then(resolve);}};return q;}};}
const source=fs.readFileSync('supabase/functions/send-ranking-reminders/index.ts','utf8').replace(/^import .*;$/gm,'');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{Deno:{env:{get:k=>({SUPABASE_URL:'test',SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_ANON_KEY:'anon',GMAIL_USER:'mail@test',GMAIL_APP_PASSWORD:'test'}[k])}},serve:f=>handler=f,createClient,SMTPClient:class{async send(m){sent.push(m);}async close(){}},Request,Response,Set,Date,console,fetch:()=>{throw Error('Unexpected network')}});
(async()=>{
 let r=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer anon'},body:JSON.stringify({all:true})}));assert.equal(r.status,403);assert.equal(sent.length,0);
 r=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer user'},body:JSON.stringify({groupId:'g'})}));assert.equal(r.status,200);assert.deepEqual(sent.map(m=>m.to),['active@test']);assert.equal(cooldown,1);
 group.ranking_deadline_at='2026-07-16T00:30:00Z';group.ranking_deadline_timezone='America/New_York';
 r=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer user'},body:JSON.stringify({groupId:'g'})}));assert.equal(r.status,200);assert.match(sent.at(-1).subject,/8:30 PM EDT \(America\/New_York\)/);
 r=await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer service'},body:JSON.stringify({all:true})}));assert.equal(r.status,200);assert.equal((await r.json()).groups,1);
 console.log('Reminder checks passed: scheduled authorization, Gmail delivery, excluded recipients and cooldown.');
})().catch(e=>{console.error(e);process.exitCode=1});
