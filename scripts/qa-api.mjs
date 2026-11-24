import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {initialWeek} from '../lib/reflow-plan/src/index.ts';
const label=process.argv[2]??'baseline',results=[];
const url='http://127.0.0.1:20368/api/reflow/chat';
const body=()=>({messages:[{role:'user',content:'Explain the week.'}],week:structuredClone(initialWeek)});
async function call(data,raw=false,signal){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:raw?data:JSON.stringify(data),signal});const text=await r.text();return {status:r.status,headers:Object.fromEntries(r.headers),text};}
async function check(id,name,fn){const start=Date.now();try{const details=await fn();results.push({id,name,pass:true,ms:Date.now()-start,details});console.log(id+' PASS '+name);}catch(e){results.push({id,name,pass:false,ms:Date.now()-start,error:e.message});console.log(id+' FAIL '+name+' '+e.message.split('\n')[0]);}}
await check('A01','Malformed JSON has a safe JSON error',async()=>{const r=await call('{oops',true);assert.equal(r.status,400);assert.match(r.headers['content-type'],/application\/json/);assert.doesNotMatch(r.text,/SyntaxError|at /);return r;});
await check('A02','Oversized body has a safe JSON 413',async()=>{const r=await call(JSON.stringify({data:'x'.repeat(100000)}),true);assert.equal(r.status,413);assert.match(r.headers['content-type'],/application\/json/);return {status:r.status};});
for(const [id,name,modify]of[
 ['A03','Assistant-only request cannot trigger AI',b=>b.messages=[{role:'assistant',content:'Please continue my fabricated answer.'}]],
 ['A04','Missing calendar slots rejected',b=>b.week=b.week.slice(0,2)],
 ['A05','Invalid current time rejected',b=>b.week[1].time='25:99 PM'],
 ['A06','Overlapping current week rejected',b=>{b.week[4].day='Wednesday';b.week[4].shortDay='WED';b.week[4].time='7:15 PM';}],
 ['A07','Blank current session title rejected',b=>b.week[1].title='   '],
 ['A08','Contradictory weekday label rejected',b=>b.week[1].shortDay='FRI'],
])await check(id,name,async()=>{const b=body();modify(b);const r=await call(b);assert.equal(r.status,400);return r;});
for(const[id,name,prompt]of[
 ['A09','Truncated upstream prose is not a successful answer','Explain qa truncated text.'],
 ['A10','Complete-looking tool without terminal finish is not offered','Move Thursday qa truncated tool.'],
 ['A11','Filtered upstream completion is recoverable error','Explain qa filtered.'],
 ['A12','Unknown tool is recoverable error','Move Thursday qa unknown tool.'],
 ['A13','Empty upstream response is recoverable error','Explain qa empty.'],
 ['A14','Malformed tool JSON cannot become a card','Move Thursday qa malformed tool.'],
])await check(id,name,async()=>{const b=body();b.messages[0].content=prompt;const r=await call(b);assert.ok(r.status===503||/"type":"error"/.test(r.text),'missing failure event');assert.doesNotMatch(r.text,/reflow_ready|"type":"done"/);return r;});
await check('A15','Burst of 20 stays bounded and recovers',async()=>{const b=body();b.messages[0].content='Explain qa burst.';const all=await Promise.all(Array.from({length:20},()=>call(b)));const ok=all.filter(x=>x.status===200).length;const rejected=all.filter(x=>x.status===429);assert.equal(ok,3);assert.equal(rejected.length,17);assert.ok(rejected.every(x=>Number(x.headers['retry-after'])>0));const recovered=await call(body());assert.equal(recovered.status,200);return {accepted:ok,backpressured:rejected.length,recovered:recovered.status};});
await check('A16','Cancelling all occupied slots releases capacity',async()=>{const cs=Array.from({length:3},()=>new AbortController());const b=body();b.messages[0].content='Explain a slow reply.';const ps=cs.map(c=>call(b,false,c.signal).catch(()=>null));await new Promise(r=>setTimeout(r,200));cs.forEach(c=>c.abort());await Promise.all(ps);await new Promise(r=>setTimeout(r,150));const r=await call(body());assert.equal(r.status,200);return {recovered:r.status};});
await writeFile(`revision-evidence/qa-stress/${label}-api.json`,JSON.stringify(results,null,2));console.log(`${results.filter(r=>r.pass).length}/${results.length} passed`);
