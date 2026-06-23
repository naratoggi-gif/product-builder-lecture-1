#!/usr/bin/env node
const assert = require('node:assert/strict');
const { addDaysToDateKey, dateKeyInTimezone, normalizeTimezone } = require('../dist/shared/timezone');

const koreaBeforeMidnight = new Date('2026-06-23T14:59:00.000Z'); // 2026-06-23 23:59 KST
const koreaAfterMidnight = new Date('2026-06-23T15:01:00.000Z'); // 2026-06-24 00:01 KST

assert.equal(dateKeyInTimezone(koreaBeforeMidnight, 'Asia/Seoul'), '2026-06-23');
assert.equal(dateKeyInTimezone(koreaAfterMidnight, 'Asia/Seoul'), '2026-06-24');
assert.equal(dateKeyInTimezone(koreaAfterMidnight, 'UTC'), '2026-06-23');

assert.equal(normalizeTimezone('Asia/Seoul'), 'Asia/Seoul');
assert.equal(normalizeTimezone('not-a-timezone'), 'Asia/Seoul');
assert.equal(addDaysToDateKey('2026-06-24', -13), '2026-06-11');
assert.equal(addDaysToDateKey('2026-06-30', 1), '2026-07-01');

console.log(JSON.stringify({ ok: true, checked: 'timezone' }, null, 2));
