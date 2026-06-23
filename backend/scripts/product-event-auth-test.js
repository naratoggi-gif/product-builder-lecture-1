#!/usr/bin/env node
const assert = require('node:assert/strict');
const { EventsController } = require('../dist/events/events.controller');

const event = {
  eventName: 'app_opened',
  anonymousUserId: 'anon-1',
  sessionId: 'session-1',
};

async function run() {
  const calls = [];
  const eventsService = {
    track: async (input, userId) => {
      calls.push({ input, userId });
      return { ok: true };
    },
  };
  const jwtService = {
    verifyAsync: async (token) => {
      if (token === 'good') return { sub: 42 };
      throw new Error('bad token');
    },
  };
  const controller = new EventsController(eventsService, jwtService);

  await controller.track({ headers: { authorization: 'Bearer good' } }, event);
  assert.equal(calls.at(-1).userId, 42, 'valid optional event token must populate account user id');

  await controller.track({ headers: { authorization: 'Bearer bad' } }, event);
  assert.equal(calls.at(-1).userId, null, 'invalid optional event token must fall back to anonymous tracking');

  await controller.track({ headers: {} }, event);
  assert.equal(calls.at(-1).userId, null, 'missing optional event token must stay anonymous');

  await controller.track({ headers: {}, user: { sub: 7 } }, event);
  assert.equal(calls.at(-1).userId, 7, 'existing request user should be preserved when present');

  console.log(JSON.stringify({ ok: true, checked: 'product-event-auth' }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
