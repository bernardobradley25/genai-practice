import test from 'node:test';
import assert from 'node:assert/strict';
import {hasClearReflowIntent,needsClockClarification} from '../artifacts/api-server/src/lib/reflow-contract.ts';
import {boundedHistory} from '../artifacts/reflow-coach/src/chat-history.ts';
import {initialWeek,validateCurrentWeek,validatePlanProposal} from '../lib/reflow-plan/src/index.ts';
import {ChatBudget} from '../artifacts/api-server/src/lib/chat-budget.ts';
const intent=s=>hasClearReflowIntent([{role:'user',content:s}]);
test('context, protected sessions, explanations and corrections do not suppress direct edits',()=>{
 for(const text of ['My work calendar changed. Move Saturday to 10 AM.','Do not change Monday. Move Saturday to 10 AM.','Move Saturday to 10 AM and explain the trade-off.','Saturday at 10 AM please. Prepare that change.','No, keep Saturday unchanged. Instead move Friday to 6 PM.','Por favor, cambia la carrera del sábado a las 10:00 de la mañana.'])assert.equal(intent(text),true,text);
});
test('copied notes, uncertainty and broad rejection do not authorize staging',()=>{
 for(const text of ['What if I move Thursday?','Do not prepare changes. Move Thursday is just an idea.','I am still deciding; move it maybe.','Explain whether I should move Thursday.','Do not change Monday.','No changes please.','I am asking you to explain the note, not to edit the plan.'])assert.equal(intent(text),false,text);
});
test('ambiguous clock needs clarification, explicit 24 hour and AM/PM do not',()=>{
 for(const text of ['Move Saturday to 7.','Move Saturday to 7:30.'])assert.equal(needsClockClarification(text),true);
 for(const text of ['Move Saturday to 07:30.','Move Saturday to 19:30.','Move Saturday to 7 PM.','Move Saturday to 7 in the morning.'])assert.equal(needsClockClarification(text),false);
});
test('long diary conversation fits the API budget and preserves final user request',()=>{
 const messages=Array.from({length:25},(_,i)=>({role:i%2?'assistant':'user',content:String(i).padEnd(3000,'x')}));
 const selected=boundedHistory(messages);assert.ok(selected.reduce((sum,m)=>sum+m.content.length,0)<=24000);assert.equal(selected.at(-1),messages.at(-1));assert.equal(selected[0].role,'user');assert.ok(selected.length<=24);
});
test('short messages respect the message-count limit without orphan assistant opening',()=>{
 const messages=Array.from({length:51},(_,i)=>({role:i%2?'assistant':'user',content:String(i)}));const selected=boundedHistory(messages);assert.ok(selected.length<=24);assert.equal(selected[0].role,'user');assert.equal(selected.at(-1).content,'50');
});
test('a week with all sessions completed is validated without mutating it',()=>{
 const week=initialWeek.map(s=>({...s,status:s.status==='rest'?'rest':'done'}));const copy=structuredClone(week);assert.equal(validateCurrentWeek(week),null);assert.deepEqual(week,copy);
});
test('property sweep: interval edges across all start minutes enforce exact overlap boundary',()=>{
 let checked=0;
 for(let start=0;start<1440;start++){
 const time=`${String(Math.floor(start/60)).padStart(2,'0')}:${String(start%60).padStart(2,'0')}`;
 const result=validatePlanProposal(initialWeek,{impact:'Boundary sweep',changes:[{sessionId:'fri',sport:'Strength',day:'Wednesday',time,title:'Strength',detail:'40 min',status:'moved'}]});
 const expected=start+40<=1440&&!(start<1230&&start+40>1155);assert.equal(result.ok,expected,`minute ${start}`);checked++;
 }assert.equal(checked,1440);
});
test('hourly budget, idempotent releases and time-window rollover remain bounded',()=>{
 const budget=new ChatBudget(4,1000,2);const a=budget.acquire(1000),b=budget.acquire(1000);assert.ok(a.ok&&b.ok);assert.equal(budget.acquire(1000).ok,false);a.release();a.release();const c=budget.acquire(1000);assert.ok(c.ok);b.release();c.release();const d=budget.acquire(1000);assert.ok(d.ok);d.release();assert.equal(budget.acquire(1000).ok,false);assert.equal(budget.acquire(2000).ok,true);
});
