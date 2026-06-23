#!/usr/bin/env node
const assert = require('node:assert/strict');

const rawBaseUrl = (process.env.STAGING_URL || process.argv[2] || '').trim();
const baseUrl = rawBaseUrl.replace(/\/$/, '');
const expectedVersion = process.env.EXPECTED_APP_VERSION || '0.1.1-alpha';
const requestTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15_000);

if (!baseUrl) {
  console.error('STAGING_URL is required. Example: STAGING_URL=https://stepquest-staging.onrender.com npm run smoke:staging');
  process.exit(1);
}

try {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && process.env.ALLOW_INSECURE_STAGING_SMOKE !== 'true') {
    throw new Error('STAGING_URL must use HTTPS. Set ALLOW_INSECURE_STAGING_SMOKE=true only for a local dry run.');
  }
} catch (error) {
  console.error(`Invalid STAGING_URL: ${error.message}`);
  process.exit(1);
}

function snippet(text) {
  return (text || '').replace(/\s+/g, ' ').slice(0, 240);
}

function assertStatus(result, statuses, message) {
  const allowed = Array.isArray(statuses) ? statuses : [statuses];
  assert.ok(
    allowed.includes(result.response.status),
    `${message}; received HTTP ${result.response.status}: ${snippet(result.text)}`,
  );
}

async function read(path, options = {}) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    throw new Error(`${path} request failed: ${error.message}`);
  }
}

async function readJson(path, options = {}) {
  const { response, text } = await read(path, options);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${path} did not return JSON over HTTP ${response.status}: ${snippet(text)}`);
  }
  return { response, text, data };
}

function jsonOptions(method, body, token) {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  };
}

async function postJson(path, body, token) {
  return readJson(path, jsonOptions('POST', body, token));
}

async function getJson(path, token) {
  return readJson(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

async function signupSmokeUser(prefix) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${prefix}+${unique}@example.com`;
  const signup = await postJson('/auth/signup', {
    email,
    password: `Smoke-${unique}-password-12345`,
    nickname: `${prefix.slice(0, 16)}-${unique.slice(-8)}`,
  });
  assertStatus(signup, [200, 201], `${prefix} signup must succeed`);
  assert.ok(signup.data.accessToken, `${prefix} signup must return an access token`);
  return { email, token: signup.data.accessToken };
}

async function main() {
  const health = await readJson('/health');
  assertStatus(health, 200, '/health must return HTTP 200');
  assert.equal(health.data.status, 'ok', '/health status must be ok');
  assert.equal(health.data.database, 'connected', '/health database must be connected');
  assert.equal(health.data.version, expectedVersion, '/health must report the deployed app version');
  assert.ok(health.data.commit && health.data.commit !== 'local', '/health must expose the deployed commit SHA');

  const goals = await read('/goals.html');
  assertStatus(goals, 200, '/goals.html must load');
  assert.ok(goals.text.includes('v=0.1.1-alpha'), 'goals shell must reference versioned assets');
  assert.ok(!goals.text.includes('super@stepquest.local'), 'production shell must not expose super credentials');
  assert.ok(!goals.text.includes('stepquest-super-1234'), 'production shell must not expose super password');
  assert.ok(!goals.text.includes('one_punch_hero'), 'production shell must not expose QA hero IDs');

  const csp = goals.response.headers.get('content-security-policy') || '';
  assert.ok(csp.includes("default-src 'self'"), 'Helmet CSP must be present');
  assert.ok(csp.includes('fonts.googleapis.com'), 'CSP must allow Google Fonts styles');

  const superScript = await read('/dev/super-mode.js?v=0.1.1-alpha');
  assertStatus(superScript, 200, 'super hook should return a disabled stub in production');
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
  assertStatus(qaCostume, [401, 403, 404], 'direct QA costume access must be rejected');

  const serviceWorker = await read('/sw.js');
  assertStatus(serviceWorker, 200, '/sw.js must load');
  assert.ok(serviceWorker.text.includes("const CACHE_VERSION = 'stepquest-v0.1.1-alpha'"), 'service worker cache version must match the app version');
  assert.ok(serviceWorker.text.includes('self.skipWaiting()'), 'service worker must activate updated deploys promptly');
  assert.ok(serviceWorker.text.includes('self.clients.claim()'), 'service worker must claim open clients after activation');
  assert.ok(serviceWorker.text.includes('caches.delete(key)'), 'service worker must delete old cache versions');

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
  assertStatus(event, [200, 201], 'product event endpoint must accept smoke events');
  assert.deepEqual(event.data, { ok: true }, 'product event endpoint must return ok');

  const account = await signupSmokeUser('staging-smoke');
  const settings = await getJson('/stepquest/settings', account.token);
  assertStatus(settings, 200, 'authenticated settings must load');
  assert.equal(settings.data.timezone, 'Asia/Seoul', 'new staging users must default to Asia/Seoul');

  const goal = await postJson('/stepquest/goals', {
    title: 'staging smoke tiny action',
    category: 'study',
    burdenLevel: 2,
    energyLevel: 'low',
    availableMinutes: 5,
    obstacle: 'too_big',
  }, account.token);
  assertStatus(goal, [200, 201], 'authenticated goal creation must succeed');
  assert.ok(goal.data.firstStep?.id, 'created goal must return the first micro step');

  const currentBefore = await getJson('/stepquest/current', account.token);
  assertStatus(currentBefore, 200, 'current StepQuest state must load');
  assert.equal(currentBefore.data.currentStep?.stepId, goal.data.firstStep.id, 'current state must expose the first step');
  const beforeXp = currentBefore.data.user?.xp ?? 0;
  const beforeGoalCoin = currentBefore.data.user?.goalCoin ?? 0;
  const completeKey = `staging-smoke-${Date.now()}-complete`;

  const completed = await postJson(`/stepquest/steps/${goal.data.firstStep.id}/complete?idempotencyKey=${encodeURIComponent(completeKey)}`, {}, account.token);
  assertStatus(completed, [200, 201], 'step completion must succeed');
  assert.ok(completed.data.reward?.xp > 0, 'step completion must grant XP');

  const afterComplete = await getJson('/stepquest/current', account.token);
  assert.ok((afterComplete.data.user?.xp ?? 0) > beforeXp, 'completion must increase XP');
  assert.ok((afterComplete.data.user?.goalCoin ?? 0) > beforeGoalCoin, 'completion must increase goal coins');

  const duplicateComplete = await postJson(`/stepquest/steps/${goal.data.firstStep.id}/complete?idempotencyKey=${encodeURIComponent(completeKey)}`, {}, account.token);
  assertStatus(duplicateComplete, [200, 201], 'duplicate completion request must return a stable response');
  assert.equal(duplicateComplete.data.duplicate, true, 'duplicate completion must be marked as duplicate');

  const afterDuplicate = await getJson('/stepquest/current', account.token);
  assert.equal(afterDuplicate.data.user?.xp, afterComplete.data.user?.xp, 'duplicate completion must not grant extra XP');
  assert.equal(afterDuplicate.data.user?.goalCoin, afterComplete.data.user?.goalCoin, 'duplicate completion must not grant extra goal coins');

  const undone = await postJson(`/stepquest/steps/${goal.data.firstStep.id}/undo`, {}, account.token);
  assertStatus(undone, [200, 201], 'completion undo must succeed');
  assert.ok(undone.data.reversedReward?.xp > 0, 'undo must report reversed XP');

  const afterUndo = await getJson('/stepquest/current', account.token);
  assert.equal(afterUndo.data.currentStep?.stepId, goal.data.firstStep.id, 'undo must restore the completed step as current');
  assert.equal(afterUndo.data.user?.xp, beforeXp, 'undo must restore XP');
  assert.equal(afterUndo.data.user?.goalCoin, beforeGoalCoin, 'undo must restore goal coins');

  const importAccount = await signupSmokeUser('staging-smoke-import');
  const migrationId = `staging-smoke-migration-${Date.now()}`;
  const guestState = {
    weekly: [{
      id: 'guest-goal-1',
      title: 'guest smoke goal',
      category: 'study',
      burdenLevel: 2,
      status: 'active',
    }],
    micro: [{
      id: 'guest-step-1',
      weeklyMissionId: 'guest-goal-1',
      title: 'read one line',
      successCriterion: 'read one line complete',
      category: 'study',
      phase: 'start',
      orderIndex: 0,
      estimatedSeconds: 10,
      grade: 'F',
      status: 'completed',
      completedAt: new Date().toISOString(),
    }],
    attempts: [{ stepId: 'guest-step-1', action: 'complete' }],
    equippedCostumeId: 'one_punch_hero',
  };

  const imported = await postJson('/stepquest/guest/import', { migrationId, guestState }, importAccount.token);
  assertStatus(imported, [200, 201], 'guest import must succeed for an empty account');
  assert.equal(imported.data.status, 'imported', 'guest import must report imported status');
  assert.equal(imported.data.importedStepCount, 1, 'guest import must import the completed step');

  const duplicateImport = await postJson('/stepquest/guest/import', { migrationId, guestState }, importAccount.token);
  assertStatus(duplicateImport, [200, 201], 'duplicate guest import request must return a stable response');
  assert.equal(duplicateImport.data.duplicate, true, 'duplicate guest import must be marked duplicate');
  assert.equal(duplicateImport.data.importedStepCount, imported.data.importedStepCount, 'duplicate guest import must not import extra steps');

  console.log(JSON.stringify({
    ok: true,
    checked: 'stepquest-staging-smoke',
    url: baseUrl,
    version: health.data.version,
    commit: health.data.commit,
    accountFlow: 'goal-complete-duplicate-undo',
    guestImport: 'idempotent',
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
