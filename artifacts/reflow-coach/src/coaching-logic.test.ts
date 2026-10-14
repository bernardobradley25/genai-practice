import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPlanProposal, initialWeek } from './coaching-logic.ts';

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
      { sessionId: 'sun', sport: 'Surf', day: 'Sunday', time: 'Open', title: 'Surf', detail: '60 min', status: 'planned' },
    ],
  };

  assert.equal(applyPlanProposal(initialWeek, overLimit), null);
});
