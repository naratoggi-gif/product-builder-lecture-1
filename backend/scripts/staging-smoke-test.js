#!/usr/bin/env node
const assert = require('node:assert/strict');

const baseUrl = (process.env.STAGING_URL || process.argv[2] || '').replace(/\/$/, '');
const expectedVersion = process.env.EXPECTED_APP_VERSION || '0.1.1-alpha';

if (!baseUrl) {
  console.error('STAGING_URL is required. Example: STAGING_URL=https://stepquest-staging.onrender.com npm run smoke:staging');
  process.exit(1);
}

async function read(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  return { response, text };
}

async function readJson(path, options = {}) {
  const { response, text } = await read(path, options);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${path} did not return JSON: ${text.slice(0, 160)}`);
  }
  return { response, data };
}

async function main() {
  const health = await readJson('/health');
  assert.equal(health.response.status, 200, '/health must return HTTP 200');
  assert.equal(health.data.status, 'ok', '/health status must be ok');
  assert.equal(health.data.database, 'connected', '/health database must be connected');
  assert.equal(health.data.version, expectedVersion, '/health must report the deployed app version');
  assert.ok(health.data.commit && health.data.commit !== 'local', '/health must expose the deployed commit SHA');

  const goals = await read('/goals.html');
  assert.equal(goals.response.status, 200, '/goals.html must load');
  assert.ok(goals.text.includes('v=0.1.1-alpha'), 'goals shell must reference versioned assets');
  assert.ok(!goals.text.includes('super@stepquest.local'), 'production shell must not expose super credentials');
  assert.ok(!goals.text.includes('stepquest-super-1234'), 'production shell must not expose super password');
  assert.ok(!goals.text.includes('one_punch_hero'), 'production shell must not expose QA hero IDs');

  const csp = goals.response.headers.get('content-security-policy') || '';
  assert.ok(csp.includes("default-src 'self'"), 'Helmet CSP must be present');
  assert.ok(csp.includes('fonts.googleapis.com'), 'CSP must allow Google Fonts styles');

  const superScript = await read('/dev/super-mode.js?v=0.1.1-alpha');
  assert.equal(superScript.response.status, 200, 'super hook should return a disabled stub in production');
  assert.ok(superScript.text.includes('window.StepQuestSuperMode=undefined'), 'production super hook must be disabled');
  assert.ok(!superScript.text.includes('stepquest-super-1234'), 'disabled super hook must not expose credentials');

  const login = await readJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'super@stepquest.local', password: 'stepquest-super-1234' }),
  });
  assert.notEqual(login.response.status, 200, 'production super login must not succeed');
  assert.notEqual(login.response.status, 201, 'production super login must not create a session');

  const qaCostume = await read('/stepquest/costumes/one_punch_hero/equip', { method: 'POST' });
  assert.ok([401, 403, 404].includes(qaCostume.response.status), 'direct QA costume access must be rejected');

  const serviceWorker = await read('/sw.js');
  assert.equal(serviceWorker.response.status, 200, '/sw.js must load');
  assert.ok(serviceWorker.text.includes("const CACHE_VERSION = 'stepquest-v0.1.1-alpha'"), 'service worker cache version must match the app version');

  const event = await readJson('/events/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventName: 'app_opened',
      anonymousUserId: 'staging-smoke-anon',
      sessionId: `staging-smoke-${Date.now()}`,
      category: 'study',
      estimatedSeconds: 5,
    }),
  });
  assert.ok([200, 201].includes(event.response.status), 'product event endpoint must accept smoke events');
  assert.deepEqual(event.data, { ok: true }, 'product event endpoint must return ok');

  console.log(JSON.stringify({
    ok: true,
    checked: 'stepquest-staging-smoke',
    url: baseUrl,
    version: health.data.version,
    commit: health.data.commit,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
