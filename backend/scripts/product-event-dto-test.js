#!/usr/bin/env node
const assert = require('node:assert/strict');
const { validateSync } = require('class-validator');
const { TrackProductEventDto } = require('../dist/events/dto/track-product-event.dto');

function dto(values) {
  return Object.assign(new TrackProductEventDto(), values);
}

function errorsFor(values) {
  return validateSync(dto(values), { whitelist: true });
}

const valid = {
  eventName: 'step_completed',
  anonymousUserId: 'anon-1234_abcd',
  sessionId: 'session:1234-abcd',
  goalId: 'goal_1',
  stepId: 'step-1',
  category: 'study',
  estimatedSeconds: 30,
};

assert.equal(errorsFor(valid).length, 0, 'safe product event payload should validate');
assert.ok(errorsFor({ ...valid, eventName: 'goal_title_leaked' }).length > 0, 'unknown product events must be rejected');
assert.ok(errorsFor({ ...valid, anonymousUserId: 'anon user@example.com' }).length > 0, 'anonymousUserId must not accept emails or free text');
assert.ok(errorsFor({ ...valid, sessionId: 'session with spaces' }).length > 0, 'sessionId must not accept free text');
assert.ok(errorsFor({ ...valid, goalId: 'study for exam' }).length > 0, 'goalId must not accept goal text');
assert.ok(errorsFor({ ...valid, stepId: 'read page 1' }).length > 0, 'stepId must not accept step text');
assert.ok(errorsFor({ ...valid, category: 'medical_note' }).length > 0, 'category must stay in the approved taxonomy');
assert.ok(errorsFor({ ...valid, estimatedSeconds: 0 }).length > 0, 'estimatedSeconds must stay positive');

console.log(JSON.stringify({ ok: true, checked: 'product-event-dto' }, null, 2));
