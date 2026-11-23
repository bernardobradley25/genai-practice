// Start scripts/revision-test-server.mjs before running this suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialWeek} from '../lib/reflow-plan/src/index.ts';
async function request(content) {
 const response=await fetch('http://127.0.0.1:20368/api/reflow/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content}],week:initialWeek})});
 const text=await response.text();
 return {response,text,events:text.split('\n\n').filter(x=>x.startsWith('data:')).map(x=>JSON.parse(x.slice(5)))};
}
test('API permits a valid explicit change',async()=>{
 const {events}=await request('Move Tuesday to Thursday and replace the steady run.');
 assert.ok(events.some(e=>e.type==='reflow_ready')); assert.ok(events.some(e=>e.type==='done'));
});
test('API blocks strength and soccer overlap before a card is sent',async()=>{
 const {events}=await request('Move Friday strength to Wednesday at 7:15 PM.');
 assert.ok(events.some(e=>e.type==='error'&&/overlap/.test(e.message))); assert.ok(!events.some(e=>e.type==='reflow_ready'));
});
test('API blocks an invalid time',async()=>{
 const {events}=await request('Set an invalid start time.');
 assert.ok(events.some(e=>e.type==='error'&&/valid start time/.test(e.message))); assert.ok(!events.some(e=>e.type==='reflow_ready'));
});
test('API blocks a zero duration',async()=>{
 const {events}=await request('Set a zero duration.');
 assert.ok(events.some(e=>e.type==='error'&&/positive duration/.test(e.message))); assert.ok(!events.some(e=>e.type==='reflow_ready'));
});
test('API keeps exploration read only',async()=>{
 const {events}=await request('What if I move Tuesday?');
 assert.ok(!events.some(e=>e.type==='reflow_ready')); assert.ok(events.some(e=>e.type==='delta'));
});
test('API rejects empty input',async()=>{
 const {response}=await request(''); assert.equal(response.status,400);
});
test('API preserves the failure contract when AI is unavailable',async()=>{
 const {response,text}=await request('Explain service failure.'); assert.equal(response.status,503); assert.match(text,/plan has not changed/);
});

test('API rejects whitespace-only messages before using AI',async()=>{
 const {response}=await request('   '); assert.equal(response.status,400);
});

test('API rejects duplicate sessions in the supplied week',async()=>{
 const response=await fetch('http://127.0.0.1:20368/api/reflow/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Move Friday.'}],week:[initialWeek[0],initialWeek[0]]})});
 assert.equal(response.status,400);
});

test('API accepts a nonoverlapping strength move with its stable session ID',async()=>{
 const {events}=await request('Move Friday strength after soccer on Wednesday.');
 const proposal=events.find(e=>e.type==='reflow_ready'); assert.ok(proposal);
 assert.equal(proposal.update.changes[0].sessionId,'fri');
 assert.equal(proposal.update.changes[0].day,'Wednesday');
});


test('API caps concurrent calls and releases capacity when visitors stop',async()=>{
 const controllers=Array.from({length:3},()=>new AbortController());
 const pending=controllers.map(controller=>fetch('http://127.0.0.1:20368/api/reflow/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Explain a slow reply.'}],week:initialWeek}),signal:controller.signal}).catch(()=>null));
 try {
  await new Promise(resolve=>setTimeout(resolve,250));
  const {response,text}=await request('Explain the week.');
  assert.equal(response.status,429); assert.equal(response.headers.get('retry-after'),'15'); assert.match(text,/at capacity/);
 } finally {
  controllers.forEach(controller=>controller.abort()); await Promise.all(pending);
 }
 let recovered;
 for(let attempt=0;attempt<20;attempt++) {
  await new Promise(resolve=>setTimeout(resolve,50)); recovered=await request('Explain the week.');
  if(recovered.response.status!==429) break;
 }
 assert.equal(recovered.response.status,200);
});
