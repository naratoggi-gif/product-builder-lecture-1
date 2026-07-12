#!/usr/bin/env node
const assert = require('node:assert/strict');
const Media = require('../public/assets/js/stepquest-v02-media.js');

function writeUint24LE(buffer, offset, value) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
}

function riffChunk(type, payload) {
  const header = Buffer.alloc(8);
  header.write(type, 0, 4, 'ascii');
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([
    header,
    payload,
    payload.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0),
  ]);
}

function makeAnimatedWebP(durations, options = {}) {
  const width = options.width || 8;
  const height = options.height || 8;
  const vp8x = Buffer.alloc(10);
  vp8x[0] = options.animationFlag === false ? 0 : 0x02;
  writeUint24LE(vp8x, 4, width - 1);
  writeUint24LE(vp8x, 7, height - 1);
  const anim = Buffer.alloc(6);
  const frames = durations.map((duration) => {
    const payload = Buffer.alloc(16);
    writeUint24LE(payload, 6, width - 1);
    writeUint24LE(payload, 9, height - 1);
    writeUint24LE(payload, 12, duration);
    return riffChunk('ANMF', payload);
  });
  const vp8xChunk = riffChunk('VP8X', vp8x);
  const animChunk = riffChunk('ANIM', anim);
  let chunks;
  if (options.vp8xAfterAnim) chunks = [animChunk, vp8xChunk, ...frames];
  else if (options.animAfterFrames) chunks = [vp8xChunk, ...frames, animChunk];
  else {
    chunks = [vp8xChunk];
    if (options.includeAnim !== false) chunks.push(animChunk);
    chunks.push(...frames);
  }
  const body = Buffer.concat([Buffer.from('WEBP'), ...chunks]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

function assertCode(error, code) {
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  return true;
}

function assertThrowsCode(callback, code) {
  assert.throws(callback, (error) => assertCode(error, code));
}

async function assertRejectsCode(callback, code) {
  await assert.rejects(callback, (error) => assertCode(error, code));
}

function makeVideoFactory(metadata, observations) {
  return () => ({
    muted: false,
    playsInline: false,
    preload: '',
    setAttribute(name, value) {
      observations.attributes.push([name, value]);
    },
    set src(value) {
      observations.src = value;
      observations.muted = this.muted;
      observations.playsInline = this.playsInline;
      observations.preload = this.preload;
      queueMicrotask(() => {
        if (metadata.error) this.onerror(metadata.error);
        else this.onloadedmetadata();
      });
    },
    duration: metadata.duration,
    videoWidth: metadata.width,
    videoHeight: metadata.height,
  });
}

async function run() {
  assert.deepEqual(Media.MOVING_TYPES, ['image/webp', 'video/webm']);
  assert.equal(Object.isFrozen(Media.MOVING_TYPES), true);
  assert.equal(Media.MAX_CLIP_BYTES, 6 * 1024 * 1024);
  assert.equal(Media.MAX_TOTAL_BYTES, 12 * 1024 * 1024);
  assert.equal(Media.MAX_EDGE, 1024);
  assert.equal(Media.MAX_DURATION_MS, 3000);
  assert.equal(Object.isFrozen(Media.ERROR_CODES), true);

  const webp = makeAnimatedWebP([600, 700, 800], { width: 320, height: 240 });
  assert.equal(Media.parseAnimatedWebPDuration(webp), 2100);
  assert.deepEqual(Media.validateMovingMetadata({
    mimeType: 'image/webp',
    size: Media.MAX_CLIP_BYTES,
    width: Media.MAX_EDGE,
    height: Media.MAX_EDGE,
    durationMs: Media.MAX_DURATION_MS,
  }), {
    mimeType: 'image/webp',
    byteLength: Media.MAX_CLIP_BYTES,
    width: Media.MAX_EDGE,
    height: Media.MAX_EDGE,
    durationMs: Media.MAX_DURATION_MS,
  });

  assertThrowsCode(
    () => Media.validateMovingMetadata({
      mimeType: 'image/webp',
      size: Media.MAX_CLIP_BYTES + 1,
      width: 512,
      height: 512,
      durationMs: 1000,
    }),
    'CHARACTER_MEDIA_TOO_LARGE',
  );
  assertThrowsCode(
    () => Media.validateMovingMetadata({
      mimeType: 'video/webm',
      size: 100,
      width: 512,
      height: 512,
      durationMs: Media.MAX_DURATION_MS + 1,
    }),
    'CHARACTER_MEDIA_TOO_LONG',
  );
  assertThrowsCode(
    () => Media.validateMovingMetadata({
      mimeType: 'image/gif',
      size: 100,
      width: 512,
      height: 512,
      durationMs: 1000,
    }),
    'CHARACTER_MEDIA_TYPE_UNSUPPORTED',
  );
  assertThrowsCode(
    () => Media.validateMovingMetadata({
      mimeType: 'audio/webm',
      size: 100,
      width: 512,
      height: 512,
      durationMs: 1000,
    }),
    'CHARACTER_MEDIA_TYPE_UNSUPPORTED',
  );
  assertThrowsCode(
    () => Media.validateMovingMetadata({
      mimeType: 'image/webp',
      size: 100,
      width: Media.MAX_EDGE + 1,
      height: 512,
      durationMs: 1000,
    }),
    'CHARACTER_MEDIA_DIMENSIONS_TOO_LARGE',
  );
  assertThrowsCode(
    () => Media.validateMovingMetadata({
      mimeType: 'video/webm',
      size: 100,
      width: 0,
      height: 512,
      durationMs: 1000,
    }),
    'CHARACTER_MEDIA_DIMENSIONS_INVALID',
  );
  assertThrowsCode(
    () => Media.validateMovingMetadata({
      mimeType: 'video/webm',
      size: 100,
      width: 512,
      height: 512,
      durationMs: Number.NaN,
    }),
    'CHARACTER_MEDIA_DURATION_INVALID',
  );

  assertThrowsCode(
    () => Media.parseAnimatedWebPDuration(webp.subarray(0, webp.length - 1)),
    'CHARACTER_MEDIA_WEBP_INVALID',
  );
  const outOfBoundsChunk = Buffer.from(webp);
  const frameOffset = outOfBoundsChunk.indexOf('ANMF', 0, 'ascii');
  outOfBoundsChunk.writeUInt32LE(0x7fffffff, frameOffset + 4);
  assertThrowsCode(
    () => Media.parseAnimatedWebPDuration(outOfBoundsChunk),
    'CHARACTER_MEDIA_WEBP_INVALID',
  );
  assertThrowsCode(
    () => Media.parseAnimatedWebPDuration(makeAnimatedWebP([100], { animationFlag: false })),
    'CHARACTER_MEDIA_WEBP_NOT_ANIMATED',
  );
  assertThrowsCode(
    () => Media.parseAnimatedWebPDuration(makeAnimatedWebP([100], { includeAnim: false })),
    'CHARACTER_MEDIA_WEBP_NOT_ANIMATED',
  );
  assertThrowsCode(
    () => Media.parseAnimatedWebPDuration(makeAnimatedWebP([])),
    'CHARACTER_MEDIA_WEBP_NOT_ANIMATED',
  );
  assertThrowsCode(
    () => Media.parseAnimatedWebPDuration(makeAnimatedWebP([100], { animAfterFrames: true })),
    'CHARACTER_MEDIA_WEBP_INVALID',
  );
  assertThrowsCode(
    () => Media.parseAnimatedWebPDuration(makeAnimatedWebP([100], { vp8xAfterAnim: true })),
    'CHARACTER_MEDIA_WEBP_INVALID',
  );

  const inspectedWebP = await Media.inspectMovingMedia(new Blob([webp], { type: 'image/webp' }));
  assert.deepEqual(inspectedWebP, {
    mimeType: 'image/webp',
    byteLength: webp.length,
    width: 320,
    height: 240,
    durationMs: 2100,
  });

  const webmBytes = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]);
  await assertRejectsCode(
    () => Media.inspectMovingMedia(new Blob([webmBytes], { type: 'image/webp' })),
    'CHARACTER_MEDIA_MAGIC_MISMATCH',
  );
  await assertRejectsCode(
    () => Media.inspectMovingMedia(new Blob([webp], { type: 'video/webm' })),
    'CHARACTER_MEDIA_MAGIC_MISMATCH',
  );

  const observations = { attributes: [], revoked: [] };
  const inspectedWebM = await Media.inspectMovingMedia(
    new Blob([webmBytes], { type: 'video/webm' }),
    {
      createVideo: makeVideoFactory({ duration: 1.25, width: 640, height: 360 }, observations),
      urlApi: {
        createObjectURL: () => 'blob:valid-webm',
        revokeObjectURL: (url) => observations.revoked.push(url),
      },
    },
  );
  assert.deepEqual(inspectedWebM, {
    mimeType: 'video/webm',
    byteLength: webmBytes.length,
    width: 640,
    height: 360,
    durationMs: 1250,
  });
  assert.equal(observations.src, 'blob:valid-webm');
  assert.equal(observations.muted, true);
  assert.equal(observations.playsInline, true);
  assert.equal(observations.preload, 'metadata');
  assert.deepEqual(observations.attributes, [['playsinline', '']]);
  assert.deepEqual(observations.revoked, ['blob:valid-webm']);

  const failedObservations = { attributes: [], revoked: [] };
  await assertRejectsCode(
    () => Media.inspectMovingMedia(
      new Blob([webmBytes], { type: 'video/webm' }),
      {
        createVideo: makeVideoFactory({ error: new Error('decode failed') }, failedObservations),
        urlApi: {
          createObjectURL: () => 'blob:failed-webm',
          revokeObjectURL: (url) => failedObservations.revoked.push(url),
        },
      },
    ),
    'CHARACTER_MEDIA_DECODE_FAILED',
  );
  assert.deepEqual(failedObservations.revoked, ['blob:failed-webm']);

  console.log(JSON.stringify({ ok: true, checked: 'stepquest-v02-media' }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
