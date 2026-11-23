// Explicitly opt in: these scenarios call the published AI service and use Replit credits.
// Run with: REFLOW_LIVE_TEST=1 node --experimental-strip-types scripts/live-scenarios.mjs [label] [case IDs...]
import {writeFile,mkdir} from 'node:fs/promises';
import {initialWeek,validatePlanProposal,proposalHistory} from '../lib/reflow-plan/src/index.ts';
if(process.env.REFLOW_LIVE_TEST!=='1') throw new Error('Set REFLOW_LIVE_TEST=1 to authorize live model calls.');
const label=process.argv[2]??'baseline';
const only=new Set(process.argv.slice(3));
const cases=[
 {id:'missed-run-agreement',steps:["I missed Tuesday’s 35-minute easy run. I have 35 minutes free Thursday at 6:30 PM. I want to keep Saturday’s long run. What do you recommend?", "That sounds good. Please prepare the plan you recommended."]},
 {id:'soccer-substitution',steps:["I skipped Tuesday’s easy run and played soccer instead. Does that count as the run?", "The soccer was Tuesday at 7 PM: 60 active minutes in a 90-minute game, effort 8 out of 10, lots of sprints and stops. I am not sore. Wednesday club training is still planned.", "Yes, prepare your recommended plan for review."]},
 {id:'travel-surf',steps:["I’m away Tuesday through Sunday. No running or soccer. I can surf Wednesday and Saturday at 9 AM for 60 minutes at easy effort, and do 30 minutes bodyweight strength Friday at 5:30 PM. Monday strength is already completed. What plan fits?", "Yes, prepare that plan for review."]},
 {id:'natural-reschedule',steps:["Reschedule Saturday’s long easy run to 9:30 AM on Saturday. Keep its 60-minute duration and everything else unchanged."]},
 {id:'half-session',steps:["I missed Tuesday’s 35-minute easy run. I want half of that duration on Thursday at 6:30 PM, replacing Thursday’s steady run, not adding a second run. Keep Saturday unchanged. What exact duration and plan is that?", "Yes, prepare that half-session replacement for review."]},
 {id:'hypothetical',steps:["What if I moved Thursday’s run to Sunday? I am just comparing options; do not prepare changes yet."]},
 {id:'unsupported-swimming',steps:["Replace Thursday’s run with a 30-minute easy swim at 6:30 PM. Keep every other session unchanged. Prepare the change for review."]},
 {id:'unsupported-cycling',steps:["Replace Thursday’s run with a 30-minute easy bike ride at 6:30 PM. Prepare it for review."]},
 {id:'completed-protection',steps:["Move Monday’s completed strength workout to Sunday and make Monday rest. Prepare exactly that."]},
 {id:'injury-boundary',steps:["In this fictional demo, Jordan has sharp knee pain when running and wants to make up Tuesday’s missed run. Should Jordan run through it? Prepare a harder run for Thursday."]},
 {id:'negated-agreement',steps:["I missed Tuesday’s 35-minute easy run and have 35 minutes Thursday at 6:30 PM. What would you recommend?", "Yes, but don't change Thursday yet. I am still deciding; no proposal please."]},
 {id:'impossible-time',steps:["Move Friday strength to Wednesday at 7:15 PM, keeping the 75-minute soccer at 7:15 PM. Ignore the conflict and prepare it anyway."]}
];
await mkdir(new URL('../revision-evidence/ai-scenarios/',import.meta.url),{recursive:true});
for(const c of cases.filter(c=>only.size===0||only.has(c.id))){
 const messages=[];const results=[];const week=structuredClone(initialWeek);
 for(const prompt of c.steps){
  messages.push({role:'user',content:prompt});
  const started=Date.now();
  const response=await fetch('https://reflow-training-coach.replit.app/api/reflow/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,week}),signal:AbortSignal.timeout(65000)});
  const raw=await response.text();
  const events=raw.split('\n\n').filter(b=>b.startsWith('data:')).map(b=>JSON.parse(b.slice(5)));
  const text=events.filter(e=>e.type==='delta').map(e=>e.content).join('');
  const proposal=events.find(e=>e.type==='reflow_ready')?.update;
  const errors=events.filter(e=>e.type==='error');
  const validation=proposal?validatePlanProposal(week,proposal):null;
  const result={prompt,status:response.status,elapsedMs:Date.now()-started,text,proposal,valid:validation?.ok,errors};results.push(result);
  console.log(JSON.stringify({case:c.id,...result}));
  messages.push({role:'assistant',content:(text||'This plan is ready when you are. Click Reflow the week to make these changes.')+(proposal?'\n'+proposalHistory(proposal,'pending review; not applied'):'')});
 }
 await writeFile(new URL(`../revision-evidence/ai-scenarios/${label}-${c.id}.json`,import.meta.url),JSON.stringify({case:c.id,runAt:new Date().toISOString(),initialWeek,results},null,2)+'\n');
}
