// Checks observable API outcomes in saved live transcripts; coaching prose still needs review.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validatePlanProposal,summarizeWeek,parseDuration} from '../lib/reflow-plan/src/index.ts';
const label=process.argv[2]??'post-fix';
const ids=['missed-run-agreement','soccer-substitution','travel-surf','natural-reschedule','half-session','hypothetical','unsupported-swimming','unsupported-cycling','completed-protection','injury-boundary','negated-agreement','impossible-time'];
let passed=0;
for(const id of ids){
 const record=JSON.parse(await readFile(new URL(`../revision-evidence/ai-scenarios/${label}-${id}.json`,import.meta.url),'utf8'));
 for(const turn of record.results)assert.equal(turn.status,200,`${id}: HTTP response`);
 const final=record.results.at(-1);const proposal=final.proposal;
 if(['hypothetical','unsupported-cycling','completed-protection','injury-boundary','negated-agreement','impossible-time'].includes(id))assert.equal(proposal,undefined,`${id}: no applicable proposal`);
 else {
  assert.ok(proposal,`${id}: expected review card`);
  const validation=validatePlanProposal(record.initialWeek,proposal);assert.ok(validation.ok,`${id}: calendar rules`);
  const find=sid=>validation.week.find(s=>s.id===sid);
  if(id==='missed-run-agreement')assert.equal(find('tue').status,'missed');
  if(id==='soccer-substitution'){assert.equal(find('tue').sport,'Soccer');assert.equal(find('tue').status,'done');assert.ok(summarizeWeek(validation.week).sportDays.includes('Tuesday'));}
  if(id==='travel-surf'){assert.equal(summarizeWeek(validation.week).surfCount,2);assert.deepEqual(find('mon'),record.initialWeek[0]);assert.equal(find('wed').sport,'Surf');assert.equal(find('sat').sport,'Surf');}
  if(id==='half-session'){assert.ok([17,18].includes(parseDuration(find('thu').detail)));assert.equal(find('thu').time,'6:30 PM');assert.equal(find('tue').status,'missed');}
  if(id==='natural-reschedule'){assert.equal(find('sat').time,'9:30 AM');assert.equal(find('sat').detail.startsWith('60 min'),true);}
  if(id==='unsupported-swimming'){assert.equal(find('thu').sport,'Swim');assert.equal(summarizeWeek(validation.week).swimCount,1);}
 }
 console.log(`PASS ${id}`);passed++;
}
console.log(`${passed} live scenario outcome checks passed. Prose quality is reviewed separately; this does not validate training advice.`);
