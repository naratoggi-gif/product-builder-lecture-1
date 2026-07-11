#!/usr/bin/env node
const assert = require('node:assert/strict');
const Backup = require('../public/assets/js/stepquest-v02-backup');

async function run() {
  const now = '2026-07-11T02:00:00.000Z';
  const records = {
    goals: [{ id: 'goal-1' }],
    steps: [{ id: 'step-1' }],
    expeditions: [{ id: 'expedition-1' }],
    resumeAnchors: [{ id: 'anchor-1' }],
    events: [{ idempotencyKey: 'event-1' }],
    rewards: [{ idempotencyKey: 'reward-1' }],
    wallet: { stepCoin: 12, gold: 2 },
    camp: { level: 2 },
    backups: [{ id: 'internal-only' }],
  };
  const exported = Backup.buildExport(records, now);
  assert.deepEqual(exported, {
    schemaVersion: 2,
    exportedAt: now,
    goals: records.goals,
    steps: records.steps,
    expeditions: records.expeditions,
    resumeAnchors: records.resumeAnchors,
    events: records.events,
    rewards: records.rewards,
    wallet: records.wallet,
    camp: records.camp,
  });
  assert.deepEqual(JSON.parse(Backup.serializeExport(exported)), exported);
  assert.deepEqual(Backup.buildExport({ ...records, camp: undefined }, now).camp, { level: 0 });

  assert.deepEqual(await Backup.requestPersistentStorage(undefined), {
    supported: false,
    persisted: false,
  });
  let persistCalls = 0;
  assert.deepEqual(await Backup.requestPersistentStorage({
    async persisted() { return true; },
    async persist() { persistCalls += 1; return false; },
  }), { supported: true, persisted: true });
  assert.equal(persistCalls, 0, 'already-persistent storage must not request again');
  assert.deepEqual(await Backup.requestPersistentStorage({
    async persisted() { return false; },
    async persist() { persistCalls += 1; return true; },
  }), { supported: true, persisted: true });
  assert.equal(persistCalls, 1);

  let pickerOptions = null;
  const picked = { name: 'backup.json' };
  assert.equal(await Backup.chooseExternalFile(async (options) => {
    pickerOptions = options;
    return picked;
  }), picked);
  assert.equal(pickerOptions.suggestedName, 'stepquest-backup.json');
  assert.deepEqual(pickerOptions.types[0].accept, { 'application/json': ['.json'] });
  assert.equal(await Backup.chooseExternalFile(undefined), null);

  const writes = [];
  const handle = {
    async requestPermission(options) {
      writes.push(`permission:${options.mode}`);
      return 'granted';
    },
    async createWritable() {
      return {
        async write(value) { writes.push(value); },
        async close() { writes.push('closed'); },
      };
    },
  };
  await Backup.writeExternalFile(handle, '{"schemaVersion":2}');
  assert.deepEqual(writes, [
    'permission:readwrite',
    '{"schemaVersion":2}',
    'closed',
  ]);
  await assert.rejects(
    () => Backup.writeExternalFile({
      async requestPermission() { return 'denied'; },
      async createWritable() { throw new Error('must not write'); },
    }, '{}'),
    /EXTERNAL_BACKUP_PERMISSION_DENIED/,
  );

  const downloadEvents = [];
  const anchor = {
    click() { downloadEvents.push('clicked'); },
    remove() { downloadEvents.push('removed'); },
  };
  const documentValue = {
    createElement(name) { downloadEvents.push(`created:${name}`); return anchor; },
    body: { append(value) { assert.equal(value, anchor); downloadEvents.push('appended'); } },
  };
  const urlApi = {
    createObjectURL(value) { assert.ok(value instanceof Blob); downloadEvents.push('url-created'); return 'blob:test'; },
    revokeObjectURL(value) { assert.equal(value, 'blob:test'); downloadEvents.push('url-revoked'); },
  };
  Backup.downloadJson('{}', documentValue, urlApi);
  assert.equal(anchor.href, 'blob:test');
  assert.equal(anchor.download, 'stepquest-backup.json');
  assert.deepEqual(downloadEvents, [
    'url-created',
    'created:a',
    'appended',
    'clicked',
    'removed',
    'url-revoked',
  ]);

  console.log(JSON.stringify({ ok: true, checked: 'stepquest-v02-backup' }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
