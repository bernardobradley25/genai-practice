import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPlanProposal, initialWeek, validatePlanProposal, isSameWeek, parseStartTime, parseDuration, summarizeWeek, groupWeekByDay, proposalHistory } from './coaching-logic.ts';
import { hasClearReflowIntent, proposalFromTool } from '../../api-server/src/lib/reflow-contract.ts';
import { ChatBudget } from '../../api-server/src/lib/chat-budget.ts';

const discussedMove = {
  impact: 'The easy run replaces the steady run, so the week does not stack two runs on Thursday.',
  changes: [
    { sessionId: 'tue', sport: 'Run', day: 'Tuesday', time: 'Not completed', title: 'Easy run', detail: 'Missed', status: 'missed' },
    { sessionId: 'thu', sport: 'Run', day: 'Thursday', time: '6:30 PM', title: 'Easy run (moved)', detail: '35 min · conversational', status: 'moved' },
  ],
};

test('commits a staged Reflow while preserving the original plan object', () => {
  const updatedWeek = applyPlanProposal(initialWeek, discussedMove);

  assert.ok(updatedWeek);
  assert.equal(updatedWeek.find((session) => session.id === 'tue')?.status, 'missed');
  assert.equal(updatedWeek.find((session) => session.id === 'thu')?.title, 'Easy run (moved)');
  assert.equal(updatedWeek.find((session) => session.id === 'thu')?.time, '6:30 PM');
  assert.equal(initialWeek.find((session) => session.id === 'thu')?.title, 'Steady run');
});

test('rejects an overlapping run/sport schedule proposal', () => {
  const proposal = {
    impact: 'Move Tuesday to Thursday.',
    changes: [
      { sessionId: 'tue', sport: 'Run', day: 'Thursday', time: '6:30 PM', title: 'Easy run (moved)', detail: '35 min', status: 'moved' },
    ],
  };

  assert.equal(applyPlanProposal(initialWeek, proposal), null);
});

test('rejects unknown sessions and attempts to change a completed workout', () => {
  const unknownSession = {
    impact: 'Unknown session.',
    changes: [
      { sessionId: 'next-week', sport: 'Run', day: 'Monday', time: '7:00 PM', title: 'Run', detail: 'Easy', status: 'planned' },
    ],
  };
  const completedSession = {
    impact: 'Move completed strength.',
    changes: [
      { sessionId: 'mon', sport: 'Strength', day: 'Tuesday', time: '7:00 PM', title: 'Strength', detail: 'Done', status: 'planned' },
    ],
  };

  assert.equal(applyPlanProposal(initialWeek, unknownSession), null);
  assert.equal(applyPlanProposal(initialWeek, completedSession), null);
});

test('commits a travel-week Reflow with more than three changes and a Surf session', () => {
  const travelReflow = {
    impact: 'Keep the key run sessions and treat surfing as its own sport day.',
    changes: [
      { sessionId: 'wed', sport: 'Surf', day: 'Wednesday', time: '7:15 PM', title: 'Surf', detail: '60–75 min · variable full-body effort', status: 'planned' },
      { sessionId: 'thu', sport: 'Run', day: 'Thursday', time: '6:45 AM', title: 'Steady run', detail: '30–40 min · controlled, easy if surfing was demanding', status: 'planned' },
      { sessionId: 'fri', sport: 'Strength', day: 'Friday', time: '5:30 PM', title: 'Bodyweight strength', detail: '15–25 min · push-ups, squats, split squats, calf raises, and planks', status: 'planned' },
      { sessionId: 'sat', sport: 'Run', day: 'Saturday', time: '9:00 AM', title: 'Long easy run', detail: '50–60 min · relaxed on a runnable surface', status: 'planned' },
    ],
  };

  const updatedWeek = applyPlanProposal(initialWeek, travelReflow);

  assert.ok(updatedWeek);
  assert.equal(updatedWeek.find((session) => session.id === 'wed')?.sport, 'Surf');
  assert.equal(updatedWeek.find((session) => session.id === 'fri')?.detail, travelReflow.changes[2]?.detail);
  assert.equal(updatedWeek.find((session) => session.id === 'sat')?.detail, '50–60 min · relaxed on a runnable surface');
  assert.equal(updatedWeek.find((session) => session.id === 'mon')?.status, 'done');
});

test('counts Surf toward the five-day run/sport limit', () => {
  const overLimit = {
    impact: 'This adds too many active sport days.',
    changes: [
      { sessionId: 'wed', sport: 'Surf', day: 'Wednesday', time: '7:15 PM', title: 'Surf', detail: '60 min', status: 'planned' },
      { sessionId: 'fri', sport: 'Surf', day: 'Friday', time: '5:30 PM', title: 'Surf', detail: '60 min', status: 'planned' },
      { sessionId: 'sun', sport: 'Surf', day: 'Sunday', time: '10:00 AM', title: 'Surf', detail: '60 min', status: 'planned' },
    ],
  };

  assert.equal(applyPlanProposal(initialWeek, overLimit), null);
});

const strengthMove = { sessionId: 'fri', sport: 'Strength', day: 'Wednesday', time: '7:15 PM', title: 'Strength + mobility', detail: '40 min · moderate', status: 'moved' };
const proposalFor = (changes: object[]) => ({ impact: 'Review this change.', changes });

test('blocks the reproduced soccer and strength overlap and explains it', () => {
  const before = structuredClone(initialWeek);
  const result = validatePlanProposal(initialWeek, proposalFor([strengthMove]));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Club training and Strength \+ mobility overlap on Wednesday/);
  assert.deepEqual(initialWeek, before);
});

test('detects partial overlap even when start times differ', () => {
  assert.equal(applyPlanProposal(initialWeek, proposalFor([{ ...strengthMove, time: '8:00 PM' }])), null);
});

test('allows back-to-back sessions at the exact end boundary', () => {
  assert.ok(applyPlanProposal(initialWeek, proposalFor([{ ...strengthMove, time: '8:30 PM' }])));
});

for (const time of ['25:99 PM', '', 'Open', '13:00 PM', '6:60 PM']) {
  test(`rejects invalid active start time ${JSON.stringify(time)}`, () => {
    assert.equal(applyPlanProposal(initialWeek, proposalFor([{ ...strengthMove, day: 'Friday', time }])), null);
  });
}

for (const detail of ['0 min', '-5 min', 'moderate', '75–60 min', '0–30 min']) {
  test(`rejects invalid active duration ${JSON.stringify(detail)}`, () => {
    assert.equal(applyPlanProposal(initialWeek, proposalFor([{ ...strengthMove, day: 'Friday', detail }])), null);
  });
}

test('uses the upper duration bound when checking overlaps', () => {
  const rangeWeek = initialWeek.map((session) => session.id === 'wed' ? { ...session, detail: '60–90 min · variable' } : session);
  assert.equal(applyPlanProposal(rangeWeek, proposalFor([{ ...strengthMove, time: '8:30 PM' }])), null);
});

test('rejects sessions crossing midnight', () => {
  assert.equal(applyPlanProposal(initialWeek, proposalFor([{ ...strengthMove, day: 'Friday', time: '11:45 PM' }])), null);
});

test('allows missed and rest entries without an active time or duration', () => {
  assert.ok(applyPlanProposal(initialWeek, proposalFor([{ ...strengthMove, day: 'Friday', time: 'Open', detail: 'Rest', status: 'rest' }])));
});

test('rejects duplicate edits to the same session', () => {
  assert.equal(applyPlanProposal(initialWeek, proposalFor([strengthMove, strengthMove])), null);
});

test('detects stale proposals even when the new week is independently valid', () => {
  const changed = applyPlanProposal(initialWeek, discussedMove)!;
  assert.equal(isSameWeek(structuredClone(initialWeek), initialWeek), true);
  assert.equal(isSameWeek(initialWeek, changed), false);
});

test('parses noon, midnight, 24-hour times, and minute ranges', () => {
  assert.equal(parseStartTime('12:00 AM'), 0);
  assert.equal(parseStartTime('12:00 PM'), 720);
  assert.equal(parseStartTime('18:30'), 1110);
  assert.equal(parseDuration('60–75 min · variable'), 75);
});

test('calculates three actual sport days after a missed run without counting strength', () => {
  const updated = applyPlanProposal(initialWeek, discussedMove)!;
  assert.deepEqual(summarizeWeek(updated).sportDays, ['Wednesday', 'Thursday', 'Saturday']);
  assert.equal(summarizeWeek(updated).dayCount, 3);
  assert.equal(summarizeWeek(updated).strengthCount, 2);
});

test('groups a moved session on its new day while preserving every day and stable ID', () => {
  const updated = applyPlanProposal(initialWeek, proposalFor([{ ...strengthMove, time: '8:30 PM' }]))!;
  const groups = groupWeekByDay(updated);
  assert.equal(groups.length, 7);
  assert.deepEqual(groups[2].sessions.map((session) => session.id), ['wed', 'fri']);
  assert.equal(groups[4].sessions.length, 0);
  assert.deepEqual(groupWeekByDay([...updated].reverse()), groups);
});

test('proposal history includes the exact changes and dismissal state within the message budget', () => {
  const text = proposalHistory(discussedMove, 'dismissed; not applied');
  assert.match(text, /dismissed; not applied/);
  assert.match(text, /thu: Thursday 6:30 PM/);
  const longest = proposalHistory({ impact: 'x'.repeat(700), changes: initialWeek.map((session) => ({ sessionId: session.id, day: session.day, sport: session.sport, time: 'x'.repeat(40), title: 'x'.repeat(80), detail: 'x'.repeat(300), status: 'planned' })) }, 'applied earlier; current calendar is authoritative');
  assert.ok(longest.length + 601 <= 3000);
});

test('demo capacity limits concurrency and releases exactly once', () => {
  const budget = new ChatBudget(10, 1000, 1);
  const first = budget.acquire(1000); assert.ok(first.ok);
  assert.equal(budget.acquire(1001).ok, false);
  first.release(); first.release();
  const second = budget.acquire(1002); assert.ok(second.ok);
  assert.equal(budget.acquire(1003).ok, false);
});

test('demo request budget does not refill on release and resets after its time window', () => {
  const budget = new ChatBudget(1, 1000, 1);
  const first = budget.acquire(1000); assert.ok(first.ok); first.release();
  assert.deepEqual(budget.acquire(1001), { ok: false, retryAfter: 1 });
  assert.equal(budget.acquire(2000).ok, true);
});


const recommendedPlan = { role: 'assistant', content: 'I recommend marking Tuesday missed and keeping Thursday and Saturday as planned. Do you like this plan?' };
for (const content of [
  'That sounds good. Please prepare the plan you recommended.',
  'Yes, prepare that plan for review.',
  'I’m good with that.',
  'Reschedule Saturday to 9:30 AM.',
  'Could you please move Saturday to 9:30 AM?',
  "Prepare the plan for review, but do not apply it yet.",
]) {
  test(`stages clear review intent: ${content}`, () => assert.equal(hasClearReflowIntent([recommendedPlan,{role:'user',content}]),true));
}
for (const content of [
  "Yes, but don't change Thursday yet. I am still deciding; no proposal please.",
  'What if I moved Thursday to Sunday?',
  'Maybe, prepare it only after I decide.',
  'Do not prepare any changes.',
  'Yes, except I am worried about Thursday.',
]) {
  test(`keeps uncertainty or refusal read-only: ${content}`, () => assert.equal(hasClearReflowIntent([recommendedPlan,{role:'user',content}]),false));
}
test('agreement to a greeting is not agreement to a specific plan',()=>{
 assert.equal(hasClearReflowIntent([{role:'assistant',content:'How can I help?'},{role:'user',content:'Sounds good.'}]),false);
});
test('clear agreement still works if the model forgot its closing question',()=>{
 assert.equal(hasClearReflowIntent([{role:'assistant',content:'I recommend marking Tuesday missed; keep Thursday and Saturday unchanged.'},{role:'user',content:'That sounds good.'}]),true);
});
test('keyed travel replacement has one final edit per session and preserves completed Monday',()=>{
 const {sessionId,...strength}=strengthMove;
 const keyed={mon:null,tue:{...strength,sport:'Run',day:'Tuesday',status:'rest'},wed:{...strength,sport:'Surf',day:'Wednesday',time:'9:00 AM',title:'Easy surf',detail:'60 min · easy'},thu:{...strength,sport:'Run',day:'Thursday',status:'rest'},fri:{...strength,day:'Friday',time:'5:30 PM',detail:'30 min · bodyweight'},sat:{...strength,sport:'Surf',day:'Saturday',time:'9:00 AM',title:'Easy surf',detail:'60 min · easy'},sun:null};
 const result=validatePlanProposal(initialWeek,proposalFromTool({impact:'Travel week',changes:keyed}));
 assert.ok(result.ok);assert.equal(result.proposal.changes.length,5);assert.equal(summarizeWeek(result.week).surfCount,2);assert.deepEqual(result.week[0],initialWeek[0]);
});
test('tool parser refuses array edits and unknown IDs rather than hiding conflicts',()=>{
 assert.throws(()=>proposalFromTool({impact:'test',changes:[strengthMove,strengthMove]}));
 assert.throws(()=>proposalFromTool({impact:'test',changes:{other:strengthMove}}));
});
test('swimming stays Swim in the calendar and counts as sport rather than running',()=>{
 const result=validatePlanProposal(initialWeek,proposalFor([{sessionId:'thu',sport:'Swim',day:'Thursday',time:'6:30 PM',title:'Easy swim',detail:'30 min · easy',status:'moved'}]));
 assert.ok(result.ok);assert.equal(summarizeWeek(result.week).swimCount,1);assert.equal(summarizeWeek(result.week).runCount,2);assert.equal(summarizeWeek(result.week).dayCount,4);
});
test('recorded replacement soccer counts as completed and is protected from subsequent edits',()=>{
 const replacement={sessionId:'tue',sport:'Soccer',day:'Tuesday',time:'7:00 PM',title:'Soccer instead of missed run',detail:'90 min elapsed · 60 active · hard',status:'done'};
 const result=validatePlanProposal(initialWeek,proposalFor([replacement]));assert.ok(result.ok);
 assert.equal(summarizeWeek(result.week).dayCount,4);assert.equal(summarizeWeek(result.week).soccerCount,2);
 assert.equal(result.week.find(s=>s.id==='tue')?.status,'done');
 assert.equal(validatePlanProposal(result.week,proposalFor([{...replacement,time:'8:00 PM'}])).ok,false);
});


test('approval recognizes the abbreviated weekdays used in a live travel recommendation',()=>{
 const recommendation={role:'assistant',content:'Mon: completed strength unchanged. Tue: rest. Wed: Surf 60 min. Fri: strength 30 min. Sat: Surf 60 min. Do you like this plan?'};
 for(const content of ['Yes, prepare that plan for review.', 'Perfect.', 'That’s good.', 'Works for me.'])assert.equal(hasClearReflowIntent([recommendation,{role:'user',content}]),true);
});
test('short weekday names do not bypass qualified-agreement protection',()=>{
 const recommendation={role:'assistant',content:'Keep Mon strength, replace Wed soccer with Surf and rest Thu.'};
 assert.equal(hasClearReflowIntent([recommendation,{role:'user',content:"Perfect, but do not prepare it yet."}]),false);
});
