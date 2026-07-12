#!/usr/bin/env node
const assert = require('node:assert/strict');
const Backup = require('../public/assets/js/stepquest-v02-backup');

async function run() {
  const now = '2026-07-11T02:00:00.000Z';
  const records = {
    goals: [{ id: 'goal-1', category: 'writing' }],
    steps: [{ id: 'step-1', category: 'writing' }],
    expeditions: [
      {
        id: 'expedition-1',
        plannedMinutes: 25,
        expiresAt: '2026-07-12T00:25:00.000Z',
      },
      { id: 'expedition-legacy' },
      { id: 'expedition-mixed', plannedMinutes: 10 },
      { id: 'expedition-invalid', plannedMinutes: '25', expiresAt: 'not-a-time' },
    ],
    resumeAnchors: [{ id: 'anchor-1' }],
    events: [{
      idempotencyKey: 'event-1',
      result: {
        rewardLineage: 'step-1',
        category: 'writing',
        reportVersion: 1,
        goalMilestone: true,
        goldGranted: 2,
      },
    }],
    rewards: [{ idempotencyKey: 'reward-1' }],
    wallet: { stepCoin: 12, gold: 2 },
    camp: { level: 2 },
    characters: [{
      id: 'local-primary',
      name: '나의 모험가',
      imageBlobKey: 'character:local-primary:image',
      media: {
        portraitKey: 'character:local-primary:portrait',
        idleKey: 'character:local-primary:idle',
        skillKey: 'character:local-primary:skill',
      },
      mediaMetadata: {
        portrait: {
          mimeType: 'image/png', byteLength: 8, width: 512, height: 512,
        },
        idle: {
          mimeType: 'image/webp', byteLength: 9, width: 512, height: 512, durationMs: 900,
        },
        skill: {
          mimeType: 'video/webm', byteLength: 10, width: 512, height: 512, durationMs: 700,
        },
      },
      skillPreset: 'impact',
      skillName: '첫걸음',
      accentColor: '#65d9ff',
      createdAt: now,
      updatedAt: now,
    }],
    assets: [{
      id: 'character:local-primary:portrait',
      blob: new Blob(['must-not-leak']),
      base64: 'must-not-leak',
    }],
    backups: [{ id: 'internal-only' }],
  };
  const exported = Backup.buildExport(records, now);
  assert.deepEqual(exported, {
    schemaVersion: 3,
    exportedAt: now,
    goals: records.goals,
    steps: records.steps,
    expeditions: records.expeditions,
    resumeAnchors: records.resumeAnchors,
    events: records.events,
    rewards: records.rewards,
    wallet: records.wallet,
    camp: records.camp,
    characters: records.characters,
  });
  assert.equal('assets' in exported, false);
  assert.equal(exported.expeditions[0].plannedMinutes, 25);
  assert.equal(exported.expeditions[0].expiresAt, '2026-07-12T00:25:00.000Z');
  assert.deepEqual(exported.expeditions.slice(1), records.expeditions.slice(1));
  assert.deepEqual(exported.events[0].result, records.events[0].result);
  assert.equal(JSON.stringify(exported).includes('must-not-leak'), false);
  assert.equal(JSON.stringify(exported).includes('base64'), false);
  assert.equal(JSON.stringify(exported).includes('"blob"'), false);
  assert.deepEqual(JSON.parse(Backup.serializeExport(exported)), exported);
  assert.deepEqual(Backup.buildExport({ ...records, camp: undefined }, now).camp, { level: 0 });
  assert.deepEqual(Backup.buildExport({ ...records, characters: undefined }, now).characters, []);

  const encodedAssets = [
    {
      id: 'character:local-primary:portrait',
      mimeType: 'image/png',
      base64: 'cG9ydHJhaXQ=',
    },
    {
      id: 'character:local-primary:idle',
      mimeType: 'image/webp',
      base64: 'aWRsZQ==',
    },
    {
      id: 'character:local-primary:skill',
      mimeType: 'video/webm',
      base64: 'c2tpbGw=',
    },
    {
      id: 'character:local-primary:orphan',
      mimeType: 'image/png',
      base64: 'b3JwaGFu',
    },
  ];
  const full = Backup.buildFullExport(records, encodedAssets, now);
  assert.equal(full.schemaVersion, 3);
  assert.equal(full.exportType, 'full-with-images');
  assert.deepEqual(full.characters, records.characters);
  assert.deepEqual(full.assets, encodedAssets.slice(0, 3));
  assert.deepEqual(full.assets.map((asset) => asset.id), [
    'character:local-primary:portrait',
    'character:local-primary:idle',
    'character:local-primary:skill',
  ]);
  const corruptReference = Backup.buildFullExport({
    ...records,
    characters: records.characters.map((character) => ({
      ...character,
      media: {
        ...character.media,
        idleKey: 'character:local-primary:orphan',
      },
    })),
  }, encodedAssets, now);
  assert.deepEqual(corruptReference.assets.map((asset) => asset.id), [
    'character:local-primary:portrait',
    'character:local-primary:skill',
  ]);

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
  assert.equal(anchor.download, 'stepquest-backup.json');
  downloadEvents.length = 0;
  Backup.downloadJson('{}', documentValue, urlApi, 'stepquest-full-backup-with-images.json');
  assert.equal(anchor.href, 'blob:test');
  assert.equal(anchor.download, 'stepquest-full-backup-with-images.json');
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
