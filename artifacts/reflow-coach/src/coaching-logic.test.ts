import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPlanProposal, initialWeek } from './coaching-logic.ts';

const discussedMove = {
  impact: 'The easy run replaces the steady run, so the week does not stack two runs on Thursday.',
  changes: [
    { sessionId: 'tue', day: 'Tuesday', time: 'Not completed', title: 'Easy run', detail: 'Missed', status: 'missed' },
    { sessionId: 'thu', day: 'Thursday', time: '6:30 PM', title: 'Easy run (moved)', detail: '35 min · conversational', status: 'moved' },
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

test('rejects an overlapping run/field schedule proposal', () => {
  const proposal = {
    impact: 'Move Tuesday to Thursday.',
    changes: [
      { sessionId: 'tue', day: 'Thursday', time: '6:30 PM', title: 'Easy run (moved)', detail: '35 min', status: 'moved' },
    ],
  };

  assert.equal(applyPlanProposal(initialWeek, proposal), null);
});

test('rejects unknown sessions and attempts to change a completed workout', () => {
  const unknownSession = {
    impact: 'Unknown session.',
    changes: [
      { sessionId: 'next-week', day: 'Monday', time: '7:00 PM', title: 'Run', detail: 'Easy', status: 'planned' },
    ],
  };
  const completedSession = {
    impact: 'Move completed strength.',
    changes: [
      { sessionId: 'mon', day: 'Tuesday', time: '7:00 PM', title: 'Strength', detail: 'Done', status: 'planned' },
    ],
  };

  assert.equal(applyPlanProposal(initialWeek, unknownSession), null);
  assert.equal(applyPlanProposal(initialWeek, completedSession), null);
});
