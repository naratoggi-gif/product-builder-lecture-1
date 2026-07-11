#!/usr/bin/env node
const assert = require('node:assert/strict');
const Character = require('../public/assets/js/stepquest-v02-character');

async function run() {
  assert.equal(Character.PALETTE.length, 8);
  assert.equal(new Set(Character.PALETTE).size, 8);
  assert.deepEqual(Character.fitWithin(1024, 256, 512), { width: 512, height: 128 });
  assert.deepEqual(Character.fitWithin(240, 480, 512), { width: 240, height: 480 });
  assert.deepEqual(Character.fitWithin(1600, 1200, 512), { width: 512, height: 384 });
  assert.throws(() => Character.fitWithin(0, 120, 512), /CHARACTER_IMAGE_DIMENSIONS_INVALID/);

  const now = '2026-07-12T00:00:00.000Z';
  const metadata = Character.normalizeMetadata({
    name: '<b>용사</b>',
    skillPreset: 'dash',
    skillName: '벽력일섬',
    accentColor: Character.PALETTE[0],
  }, now);
  assert.deepEqual(metadata, {
    id: 'local-primary',
    name: '<b>용사</b>',
    imageBlobKey: 'character:local-primary:image',
    skillPreset: 'dash',
    skillName: '벽력일섬',
    accentColor: Character.PALETTE[0],
    createdAt: now,
    updatedAt: now,
  });
  const defaults = Character.normalizeMetadata({}, now);
  assert.equal(defaults.name, '나의 모험가');
  assert.equal(defaults.skillName, '첫걸음');
  assert.equal(defaults.skillPreset, 'impact');
  assert.equal(defaults.name.length <= 40, true);
  assert.equal(Character.normalizeMetadata({ name: '가'.repeat(60) }, now).name.length, 40);
  assert.throws(
    () => Character.normalizeMetadata({ skillPreset: 'unknown' }, now),
    /CHARACTER_PRESET_INVALID/,
  );
  assert.throws(
    () => Character.normalizeMetadata({ accentColor: '#123456' }, now),
    /CHARACTER_COLOR_INVALID/,
  );

  const encoded = await Character.blobToBase64(new Blob([
    Uint8Array.from([0, 1, 2, 253, 254, 255]),
  ], { type: 'image/png' }));
  assert.equal(encoded, 'AAEC/f7/');

  console.log(JSON.stringify({ ok: true, checked: 'stepquest-v02-character' }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
