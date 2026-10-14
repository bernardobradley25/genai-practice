import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMissedRunMove,
  classifyRequest,
  initialWeek,
  validateSoccerDetails,
} from './coaching-logic.ts';

test('typical missed-run request proposes a moved run and keeps the missed slot visible', () => {
  const request = 'I missed Tuesday’s easy run. I have a free recovery slot Thursday evening.';
  const updatedWeek = applyMissedRunMove(initialWeek);

  assert.equal(classifyRequest(request), 'missed');
  assert.equal(updatedWeek.find((session) => session.id === 'tue')?.status, 'missed');
  assert.equal(updatedWeek.find((session) => session.id === 'thu')?.title, 'Easy run (moved)');
  assert.equal(updatedWeek.find((session) => session.id === 'thu')?.time, '6:30 PM');
  assert.equal(initialWeek.find((session) => session.id === 'thu')?.title, 'Steady run');
});

test('soccer challenge asks for duration and effort instead of treating it as a run', () => {
  assert.equal(classifyRequest('Soccer replaced my Thursday run.'), 'soccer');
  assert.match(validateSoccerDetails('', '' ) ?? '', /time on the field/i);
  assert.match(validateSoccerDetails('75', '') ?? '', /choose how hard/i);
  assert.equal(validateSoccerDetails('75', 'hard'), null);
});

test('empty and unsupported input do not get mistaken for a supported schedule change', () => {
  assert.equal(classifyRequest('   '), 'empty');
  assert.equal(classifyRequest('Tell me a joke.'), 'unknown');
  assert.match(validateSoccerDetails('0', 'moderate') ?? '', /between 1 and 240/i);
});

test('make-up-everything request routes to the explicit schedule-constraint pushback', () => {
  assert.equal(
    classifyRequest('I missed two sessions and want to make up every one this week.'),
    'makeup',
  );
});
