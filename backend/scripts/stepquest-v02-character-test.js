#!/usr/bin/env node
const assert = require('node:assert/strict');
const Character = require('../public/assets/js/stepquest-v02-character');
const Media = require('../public/assets/js/stepquest-v02-media');

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

  assert.deepEqual(Character.MEDIA_KEYS, {
    portrait: 'character:local-primary:portrait',
    idle: 'character:local-primary:idle',
    skill: 'character:local-primary:skill',
  });
  assert.deepEqual(Character.normalizeMediaKeys({
    imageBlobKey: Character.IMAGE_BLOB_KEY,
  }), {
    portraitKey: Character.IMAGE_BLOB_KEY,
  });
  assert.deepEqual(Character.normalizeMediaKeys({
    imageBlobKey: Character.IMAGE_BLOB_KEY,
    media: {
      portraitKey: Character.MEDIA_KEYS.portrait,
      idleKey: Character.MEDIA_KEYS.idle,
    },
  }), {
    portraitKey: Character.MEDIA_KEYS.portrait,
    idleKey: Character.MEDIA_KEYS.idle,
  });

  const portrait = {
    key: Character.MEDIA_KEYS.portrait,
    mimeType: 'image/png',
    byteLength: 2048,
    width: 512,
    height: 384,
  };
  const withPortrait = Character.withMediaSlot({
    id: Character.CHARACTER_ID,
    imageBlobKey: Character.IMAGE_BLOB_KEY,
  }, 'portrait', portrait);
  assert.deepEqual(withPortrait.media, {
    portraitKey: Character.MEDIA_KEYS.portrait,
  });
  assert.equal(withPortrait.imageBlobKey, Character.MEDIA_KEYS.portrait);
  assert.deepEqual(withPortrait.mediaMetadata.portrait, {
    mimeType: 'image/png',
    byteLength: 2048,
    width: 512,
    height: 384,
  });

  const inspected = {
    key: Character.MEDIA_KEYS.idle,
    mimeType: 'image/webp',
    byteLength: 1024,
    width: 512,
    height: 512,
    durationMs: 1200,
  };
  assert.throws(
    () => Character.withMediaSlot({ id: Character.CHARACTER_ID }, 'idle', inspected),
    /CHARACTER_PORTRAIT_REQUIRED/,
  );
  assert.throws(
    () => Character.withMediaSlot(withPortrait, 'idle', {
      ...inspected,
      key: 'character:local-primary:not-idle',
    }),
    /CHARACTER_MEDIA_KEY_INVALID/,
  );
  assert.throws(
    () => Character.withMediaSlot(withPortrait, 'idle', {
      ...inspected,
      byteLength: Media.MAX_CLIP_BYTES + 1,
    }),
    /CHARACTER_MEDIA_TOO_LARGE/,
  );

  const withIdle = Character.withMediaSlot(withPortrait, 'idle', inspected);
  assert.deepEqual(withIdle.media, {
    portraitKey: Character.MEDIA_KEYS.portrait,
    idleKey: Character.MEDIA_KEYS.idle,
  });
  assert.deepEqual(withIdle.mediaMetadata.idle, {
    mimeType: 'image/webp',
    byteLength: 1024,
    width: 512,
    height: 512,
    durationMs: 1200,
  });
  assert.throws(
    () => Character.withMediaSlot({
      ...withPortrait,
      media: {
        ...withPortrait.media,
        idleKey: Character.MEDIA_KEYS.idle,
      },
      mediaMetadata: {
        ...withPortrait.mediaMetadata,
        idle: {
          mimeType: 'image/webp',
          byteLength: Media.MAX_TOTAL_BYTES,
          width: 512,
          height: 512,
          durationMs: 1200,
        },
      },
    }, 'skill', {
      ...inspected,
      key: Character.MEDIA_KEYS.skill,
    }),
    /CHARACTER_MEDIA_TOTAL_TOO_LARGE/,
  );

  const encoded = await Character.blobToBase64(new Blob([
    Uint8Array.from([0, 1, 2, 253, 254, 255]),
  ], { type: 'image/png' }));
  assert.equal(encoded, 'AAEC/f7/');

  class LoadedImage {
    constructor() {
      this.naturalWidth = 20;
      this.naturalHeight = 20;
    }

    set src(_value) {
      queueMicrotask(() => this.onload());
    }
  }
  await assert.rejects(
    () => Character.prepareImage(
      { type: 'image/png' },
      {
        ImageValue: LoadedImage,
        urlApi: {
          createObjectURL: () => 'blob:test',
          revokeObjectURL: () => {},
        },
        documentValue: {
          createElement(name) {
            assert.equal(name, 'canvas');
            return {
              getContext: () => ({ drawImage() {} }),
              toBlob() { throw new DOMException('encoder unavailable'); },
            };
          },
        },
      },
    ),
    /CHARACTER_IMAGE_ENCODE_FAILED/,
  );

  console.log(JSON.stringify({ ok: true, checked: 'stepquest-v02-character' }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
