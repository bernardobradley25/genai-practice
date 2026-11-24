import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {initialWeek,validatePlanProposal} from '../lib/reflow-plan/src/index.ts';
if(process.env.REFLOW_LIVE_TEST!=='1')throw Error('Explicit live opt-in required');
const label=process.argv[2]??'final';
const options='Option 1: Accept the missed Tuesday 35-minute easy run; keep Wednesday soccer, Thursday steady run and Saturday long easy run unchanged.\nOption 2: Mark Tuesday missed and shorten Thursday to 30 minutes, keeping its original time and other sessions unchanged.\nI recommend option 1: accept the missed easy run and preserve the remaining structure. Do you like this plan?';
const report=[];
async function ask(messages){
 const response=await fetch(process.env.REFLOW_TEST_URL??'https://reflow-training-coach.replit.app/api/reflow/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,week:initialWeek}),signal:AbortSignal.timeout(60000)});
 const raw=await response.text();const events=raw.split('\n\n').filter(s=>s.startsWith('data:')).map(s=>JSON.parse(s.slice(5)));
 return {status:response.status,text:events.filter(e=>e.type==='delta').map(e=>e.content).join(''),proposal:events.find(e=>e.type==='reflow_ready')?.update,errors:events.filter(e=>e.type==='error')};
}
const cases=label==='baseline'?[['option 1 then',1]]:[['option 1 then',1],['1',1],['the first one',1],['go with option 2',2],['maybe option 1',0],['option 3',0],['option 1 or 2',0]];
for(const [selection,expected] of cases){
 const messages=[{role:'user',content:'I missed Tuesday’s easy run. What are my options?'},{role:'assistant',content:options},{role:'user',content:selection}];
 const response=await ask(messages);let failure='';try{assert.equal(response.status,200);assert.deepEqual(response.errors,[]);if(!expected)assert.equal(response.proposal,undefined);else{assert.ok(response.proposal,'missing review card');const v=validatePlanProposal(initialWeek,response.proposal);assert.ok(v.ok);assert.equal(v.week.find(s=>s.id==='tue').status,'missed');if(expected===1)for(const s of initialWeek.filter(s=>s.id!=='tue'))assert.deepEqual(v.week.find(n=>n.id===s.id),s);else assert.equal(parseInt(v.week.find(s=>s.id==='thu').detail),30);}}catch(e){failure=e.message;}
 report.push({selection,expected,response,pass:!failure,failure});console.log(selection, failure?'FAIL '+failure:'PASS');
}
await writeFile(`revision-evidence/option-selection/${label}-live.json`,JSON.stringify(report,null,2));
if(report.some(r=>!r.pass))process.exitCode=1;
