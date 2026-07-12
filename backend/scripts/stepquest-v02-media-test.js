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

function ebmlSize(value) {
  assert.equal(Number.isInteger(value) && value >= 0 && value < 0x7f, true);
  return Buffer.from([0x80 | value]);
}

function makeEbmlHeader(docType = 'webm') {
  const children = [];
  if (docType !== null) {
    const value = Buffer.isBuffer(docType) ? docType : Buffer.from(docType, 'ascii');
    children.push(Buffer.concat([Buffer.from([0x42, 0x82]), ebmlSize(value.length), value]));
  }
  const payload = Buffer.concat(children);
  return Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    ebmlSize(payload.length),
    payload,
  ]);
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

  const decodedWebPCalls = [];
  const inspectedWebP = await Media.inspectMovingMedia(
    new Blob([webp], { type: 'image/webp' }),
    {
      decodeImage: async (blob) => {
        decodedWebPCalls.push(blob);
        return { width: 320, height: 240 };
      },
    },
  );
  assert.deepEqual(inspectedWebP, {
    mimeType: 'image/webp',
    byteLength: webp.length,
    width: 320,
    height: 240,
    durationMs: 2100,
  });
  assert.equal(decodedWebPCalls.length, 1);

  const undecodableWebP = makeAnimatedWebP([500, 500], { width: 8, height: 8 });
  await assertRejectsCode(
    () => Media.inspectMovingMedia(
      new Blob([undecodableWebP], { type: 'image/webp' }),
      { decodeImage: async () => { throw new Error('no frame payload'); } },
    ),
    'CHARACTER_MEDIA_DECODE_FAILED',
  );

  let cappedWebPDecodeCalls = 0;
  for (const capped of [
    {
      bytes: makeAnimatedWebP([1_000], { width: Media.MAX_EDGE + 1, height: 8 }),
      code: 'CHARACTER_MEDIA_DIMENSIONS_TOO_LARGE',
      decoded: { width: Media.MAX_EDGE + 1, height: 8 },
    },
    {
      bytes: makeAnimatedWebP([Media.MAX_DURATION_MS + 1], { width: 8, height: 8 }),
      code: 'CHARACTER_MEDIA_TOO_LONG',
      decoded: { width: 8, height: 8 },
    },
  ]) {
    await assertRejectsCode(
      () => Media.inspectMovingMedia(
        new Blob([capped.bytes], { type: 'image/webp' }),
        {
          decodeImage: async () => {
            cappedWebPDecodeCalls += 1;
            return capped.decoded;
          },
        },
      ),
      capped.code,
    );
  }
  assert.equal(cappedWebPDecodeCalls, 0);

  await assertRejectsCode(
    () => Media.inspectMovingMedia(
      new Blob([webp], { type: 'image/webp' }),
      { decodeImage: async () => ({ width: 319, height: 240 }) },
    ),
    'CHARACTER_MEDIA_WEBP_INVALID',
  );

  for (const decoded of [
    null,
    { width: '320', height: 240 },
    { width: 320, height: 0 },
    Object.defineProperty({ height: 240 }, 'width', {
      get() { throw new Error('decoded width getter failed'); },
    }),
  ]) {
    await assertRejectsCode(
      () => Media.inspectMovingMedia(
        new Blob([webp], { type: 'image/webp' }),
        { decodeImage: async () => decoded },
      ),
      'CHARACTER_MEDIA_DECODE_FAILED',
    );
  }

  const imageObservations = { revoked: [] };
  const decodedImage = {
    naturalWidth: 320,
    naturalHeight: 240,
    set src(_value) {
      queueMicrotask(() => this.onload());
    },
  };
  await Media.inspectMovingMedia(
    new Blob([webp], { type: 'image/webp' }),
    {
      createImage: () => decodedImage,
      urlApi: {
        createObjectURL: () => 'blob:decoded-webp',
        revokeObjectURL: (url) => imageObservations.revoked.push(url),
      },
      decodeTimeoutMs: 25,
    },
  );
  assert.equal(decodedImage.onload, null);
  assert.equal(decodedImage.onerror, null);
  assert.deepEqual(imageObservations.revoked, ['blob:decoded-webp']);

  const failedImageObservations = { revoked: [], scheduled: [], cleared: [] };
  const failedImage = {
    set src(_value) {
      queueMicrotask(() => this.onerror(new Error('runtime decode failed')));
    },
  };
  const nativeSetTimeout = globalThis.setTimeout;
  const nativeClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => {
    const timer = nativeSetTimeout(callback, delay, ...args);
    failedImageObservations.scheduled.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => {
    failedImageObservations.cleared.push(timer);
    return nativeClearTimeout(timer);
  };
  try {
    await assertRejectsCode(
      () => Media.inspectMovingMedia(
        new Blob([webp], { type: 'image/webp' }),
        {
          createImage: () => failedImage,
          urlApi: {
            createObjectURL: () => 'blob:failed-webp',
            revokeObjectURL: (url) => failedImageObservations.revoked.push(url),
          },
          decodeTimeoutMs: 25,
        },
      ),
      'CHARACTER_MEDIA_DECODE_FAILED',
    );
  } finally {
    globalThis.setTimeout = nativeSetTimeout;
    globalThis.clearTimeout = nativeClearTimeout;
  }
  assert.equal(failedImage.onload, null);
  assert.equal(failedImage.onerror, null);
  assert.equal(failedImageObservations.scheduled.length, 1);
  assert.deepEqual(failedImageObservations.cleared, failedImageObservations.scheduled);
  assert.deepEqual(failedImageObservations.revoked, ['blob:failed-webp']);

  for (const failurePoint of ['setup', 'load']) {
    const throwObservations = { revoked: [] };
    const throwingImage = failurePoint === 'setup'
      ? Object.defineProperty({}, 'onload', {
        configurable: true,
        set() { throw new Error('image handler setup failed'); },
      })
      : {
        set src(_value) { throw new Error('image load failed'); },
      };
    await assertRejectsCode(
      () => Media.inspectMovingMedia(
        new Blob([webp], { type: 'image/webp' }),
        {
          createImage: () => throwingImage,
          urlApi: {
            createObjectURL: () => `blob:${failurePoint}-webp`,
            revokeObjectURL: (url) => throwObservations.revoked.push(url),
          },
          decodeTimeoutMs: 25,
        },
      ),
      'CHARACTER_MEDIA_DECODE_FAILED',
    );
    if (failurePoint === 'load') {
      assert.equal(throwingImage.onload, null);
      assert.equal(throwingImage.onerror, null);
    }
    assert.deepEqual(throwObservations.revoked, [`blob:${failurePoint}-webp`]);
  }

  const webmBytes = makeEbmlHeader('webm');
  await assertRejectsCode(
    () => Media.inspectMovingMedia(new Blob([webmBytes], { type: 'image/webp' })),
    'CHARACTER_MEDIA_MAGIC_MISMATCH',
  );
  await assertRejectsCode(
    () => Media.inspectMovingMedia(new Blob([webp], { type: 'video/webm' })),
    'CHARACTER_MEDIA_MAGIC_MISMATCH',
  );

  const invalidWebMHeaders = [
    makeEbmlHeader('matroska'),
    makeEbmlHeader(null),
    webmBytes.subarray(0, webmBytes.length - 1),
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]),
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x83, 0x42, 0x82, 0x84]),
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x81, 0x00]),
    makeEbmlHeader(Buffer.from([0x77, 0x65, 0x62, 0x00])),
  ];
  let invalidDecodeCalls = 0;
  for (const bytes of invalidWebMHeaders) {
    await assertRejectsCode(
      () => Media.inspectMovingMedia(
        new Blob([bytes], { type: 'video/webm' }),
        {
          createVideo() {
            invalidDecodeCalls += 1;
            throw new Error('invalid WebM must not reach decode');
          },
          urlApi: {
            createObjectURL: () => 'blob:invalid-webm',
            revokeObjectURL: () => {},
          },
        },
      ),
      'CHARACTER_MEDIA_MAGIC_MISMATCH',
    );
  }
  assert.equal(invalidDecodeCalls, 0);

  const oversizedCalls = [];
  class ObservedOversizedBlob extends Blob {
    async arrayBuffer() {
      oversizedCalls.push('arrayBuffer');
      return super.arrayBuffer();
    }
  }
  const oversizedBlob = new ObservedOversizedBlob(
    [new Uint8Array(Media.MAX_CLIP_BYTES + 1)],
    { type: 'video/webm' },
  );
  await assertRejectsCode(
    () => Media.inspectMovingMedia(oversizedBlob, {
      createVideo() {
        oversizedCalls.push('createVideo');
        return {};
      },
      urlApi: {
        createObjectURL() {
          oversizedCalls.push('createObjectURL');
          return 'blob:oversized-webm';
        },
        revokeObjectURL() {
          oversizedCalls.push('revokeObjectURL');
        },
      },
    }),
    'CHARACTER_MEDIA_TOO_LARGE',
  );
  assert.deepEqual(oversizedCalls, []);

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

  const retryObservations = { created: 0, urls: 0, revoked: [], videos: [] };
  const retriedWebM = await Media.inspectMovingMedia(
    new Blob([webmBytes], { type: 'video/webm' }),
    {
      createVideo() {
        retryObservations.created += 1;
        const videoObservations = { attributes: [] };
        const video = makeVideoFactory(
          retryObservations.created === 1
            ? { error: new Error('transient decoder failure') }
            : { duration: 1.5, width: 32, height: 32 },
          videoObservations,
        )();
        retryObservations.videos.push(video);
        return video;
      },
      urlApi: {
        createObjectURL() {
          retryObservations.urls += 1;
          return `blob:retry-webm-${retryObservations.urls}`;
        },
        revokeObjectURL: (url) => retryObservations.revoked.push(url),
      },
    },
  );
  assert.deepEqual(retriedWebM, {
    mimeType: 'video/webm',
    byteLength: webmBytes.length,
    width: 32,
    height: 32,
    durationMs: 1500,
  });
  assert.equal(retryObservations.created, 2);
  assert.equal(retryObservations.urls, 2);
  assert.deepEqual(retryObservations.revoked, ['blob:retry-webm-1', 'blob:retry-webm-2']);
  for (const retryVideo of retryObservations.videos) {
    assert.equal(retryVideo.onloadedmetadata, null);
    assert.equal(retryVideo.ontimeupdate, null);
    assert.equal(retryVideo.onerror, null);
  }

  const silentObservations = { currentTimes: [], revoked: [] };
  const silentVideo = {
    muted: false,
    playsInline: false,
    preload: '',
    setAttribute() {},
    set src(_value) {},
    duration: Number.POSITIVE_INFINITY,
    videoWidth: 16,
    videoHeight: 16,
    set currentTime(value) {
      silentObservations.currentTimes.push(value);
    },
  };
  let silentError = null;
  const silentResult = await Promise.race([
    Media.inspectMovingMedia(
      new Blob([webmBytes], { type: 'video/webm' }),
      {
        createVideo: () => silentVideo,
        urlApi: {
          createObjectURL: () => 'blob:silent-webm',
          revokeObjectURL: (url) => silentObservations.revoked.push(url),
        },
        decodeTimeoutMs: 5,
      },
    ).then(
      () => 'resolved',
      (error) => {
        silentError = error;
        return 'rejected';
      },
    ),
    new Promise((resolve) => setTimeout(() => resolve('pending'), 25)),
  ]);
  assert.equal(silentResult, 'rejected');
  assertCode(silentError, 'CHARACTER_MEDIA_DECODE_FAILED');
  assert.deepEqual(silentObservations.currentTimes, [0, 0]);
  assert.equal(silentVideo.onloadedmetadata, null);
  assert.equal(silentVideo.ontimeupdate, null);
  assert.equal(silentVideo.onerror, null);
  assert.deepEqual(silentObservations.revoked, ['blob:silent-webm', 'blob:silent-webm']);

  const seekObservations = { attributes: [], currentTimes: [], revoked: [] };
  let seekDuration = Number.POSITIVE_INFINITY;
  const seekVideo = {
    muted: false,
    playsInline: false,
    preload: '',
    setAttribute(name, value) {
      seekObservations.attributes.push([name, value]);
    },
    set src(_value) {
      queueMicrotask(() => this.onloadedmetadata());
    },
    get duration() { return seekDuration; },
    get videoWidth() { return 16; },
    get videoHeight() { return 16; },
    set currentTime(value) {
      seekObservations.currentTimes.push(value);
      if (value > 1_000_000) {
        seekDuration = 1.75;
        queueMicrotask(() => this.ontimeupdate());
      }
    },
  };
  const seekInspected = await Media.inspectMovingMedia(
    new Blob([webmBytes], { type: 'video/webm' }),
    {
      createVideo: () => seekVideo,
      urlApi: {
        createObjectURL: () => 'blob:seek-webm',
        revokeObjectURL: (url) => seekObservations.revoked.push(url),
      },
      decodeTimeoutMs: 25,
    },
  );
  assert.deepEqual(seekInspected, {
    mimeType: 'video/webm',
    byteLength: webmBytes.length,
    width: 16,
    height: 16,
    durationMs: 1750,
  });
  assert.equal(seekObservations.currentTimes[0] > 1_000_000, true);
  assert.equal(seekObservations.currentTimes.at(-1), 0);
  assert.equal(seekVideo.onloadedmetadata, null);
  assert.equal(seekVideo.ontimeupdate, null);
  assert.equal(seekVideo.onerror, null);
  assert.deepEqual(seekObservations.revoked, ['blob:seek-webm']);

  const seekTimeoutObservations = { currentTimes: [], revoked: [] };
  const seekTimeoutVideo = {
    muted: false,
    playsInline: false,
    preload: '',
    setAttribute() {},
    set src(_value) {
      queueMicrotask(() => this.onloadedmetadata());
    },
    duration: Number.POSITIVE_INFINITY,
    videoWidth: 16,
    videoHeight: 16,
    set currentTime(value) {
      seekTimeoutObservations.currentTimes.push(value);
    },
  };
  await assertRejectsCode(
    () => Media.inspectMovingMedia(
      new Blob([webmBytes], { type: 'video/webm' }),
      {
        createVideo: () => seekTimeoutVideo,
        urlApi: {
          createObjectURL: () => 'blob:seek-timeout-webm',
          revokeObjectURL: (url) => seekTimeoutObservations.revoked.push(url),
        },
        decodeTimeoutMs: 5,
      },
    ),
    'CHARACTER_MEDIA_DECODE_FAILED',
  );
  assert.equal(seekTimeoutObservations.currentTimes[0] > 1_000_000, true);
  assert.equal(seekTimeoutObservations.currentTimes.at(-1), 0);
  assert.equal(seekTimeoutVideo.onloadedmetadata, null);
  assert.equal(seekTimeoutVideo.ontimeupdate, null);
  assert.equal(seekTimeoutVideo.onerror, null);
  assert.deepEqual(seekTimeoutObservations.revoked, [
    'blob:seek-timeout-webm',
    'blob:seek-timeout-webm',
  ]);

  const exactLimitObservations = { attributes: [], revoked: [] };
  const exactLimit = await Media.inspectMovingMedia(
    new Blob([webmBytes], { type: 'video/webm' }),
    {
      createVideo: makeVideoFactory(
        { duration: 3, width: 640, height: 360 },
        exactLimitObservations,
      ),
      urlApi: {
        createObjectURL: () => 'blob:exact-limit-webm',
        revokeObjectURL: (url) => exactLimitObservations.revoked.push(url),
      },
    },
  );
  assert.equal(exactLimit.durationMs, 3000);
  assert.deepEqual(exactLimitObservations.revoked, ['blob:exact-limit-webm']);

  const overLimitObservations = { attributes: [], revoked: [] };
  await assertRejectsCode(
    () => Media.inspectMovingMedia(
      new Blob([webmBytes], { type: 'video/webm' }),
      {
        createVideo: makeVideoFactory(
          { duration: 3.0004, width: 640, height: 360 },
          overLimitObservations,
        ),
        urlApi: {
          createObjectURL: () => 'blob:over-limit-webm',
          revokeObjectURL: (url) => overLimitObservations.revoked.push(url),
        },
      },
    ),
    'CHARACTER_MEDIA_TOO_LONG',
  );
  assert.deepEqual(overLimitObservations.revoked, ['blob:over-limit-webm']);

  const failedObservations = { attributes: [], revoked: [], videos: [] };
  await assertRejectsCode(
    () => Media.inspectMovingMedia(
      new Blob([webmBytes], { type: 'video/webm' }),
      {
        createVideo() {
          const video = makeVideoFactory(
            { error: new Error('decode failed') },
            failedObservations,
          )();
          failedObservations.videos.push(video);
          return video;
        },
        urlApi: {
          createObjectURL: () => 'blob:failed-webm',
          revokeObjectURL: (url) => failedObservations.revoked.push(url),
        },
      },
    ),
    'CHARACTER_MEDIA_DECODE_FAILED',
  );
  assert.equal(failedObservations.videos.length, 2);
  for (const failedVideo of failedObservations.videos) {
    assert.equal(failedVideo.onloadedmetadata, null);
    assert.equal(failedVideo.ontimeupdate, null);
    assert.equal(failedVideo.onerror, null);
  }
  assert.deepEqual(failedObservations.revoked, ['blob:failed-webm', 'blob:failed-webm']);

  let unavailableVideoCalls = 0;
  let unavailableUrlCalls = 0;
  await assertRejectsCode(
    () => Media.inspectMovingMedia(
      new Blob([webmBytes], { type: 'video/webm' }),
      {
        createVideo() {
          unavailableVideoCalls += 1;
          return null;
        },
        urlApi: {
          createObjectURL() {
            unavailableUrlCalls += 1;
            return 'blob:unavailable-webm';
          },
          revokeObjectURL() {},
        },
      },
    ),
    'CHARACTER_MEDIA_DECODE_UNAVAILABLE',
  );
  assert.equal(unavailableVideoCalls, 1);
  assert.equal(unavailableUrlCalls, 0);

  const getterObservations = { revoked: [] };
  const getterVideo = {
    muted: false,
    playsInline: false,
    preload: '',
    setAttribute() {},
    set src(_value) {
      queueMicrotask(() => this.onloadedmetadata());
    },
    get duration() {
      throw new Error('metadata getter failed');
    },
    get videoWidth() { return 640; },
    get videoHeight() { return 360; },
  };
  await assertRejectsCode(
    () => Media.inspectMovingMedia(
      new Blob([webmBytes], { type: 'video/webm' }),
      {
        createVideo: () => getterVideo,
        urlApi: {
          createObjectURL: () => 'blob:getter-webm',
          revokeObjectURL: (url) => getterObservations.revoked.push(url),
        },
      },
    ),
    'CHARACTER_MEDIA_DECODE_FAILED',
  );
  assert.equal(getterVideo.onloadedmetadata, null);
  assert.equal(getterVideo.onerror, null);
  assert.deepEqual(getterObservations.revoked, ['blob:getter-webm', 'blob:getter-webm']);

  for (const failurePoint of ['setup', 'load']) {
    const throwObservations = { revoked: [] };
    const throwingVideo = {
      muted: false,
      playsInline: false,
      preload: '',
      setAttribute() {
        if (failurePoint === 'setup') throw new Error('setup failed');
      },
      set src(_value) {
        if (failurePoint === 'load') throw new Error('load failed');
      },
    };
    await assertRejectsCode(
      () => Media.inspectMovingMedia(
        new Blob([webmBytes], { type: 'video/webm' }),
        {
          createVideo: () => throwingVideo,
          urlApi: {
            createObjectURL: () => `blob:${failurePoint}-webm`,
            revokeObjectURL: (url) => throwObservations.revoked.push(url),
          },
        },
      ),
      'CHARACTER_MEDIA_DECODE_FAILED',
    );
    assert.equal(throwingVideo.onloadedmetadata, null);
    assert.equal(throwingVideo.onerror, null);
    assert.deepEqual(throwObservations.revoked, [
      `blob:${failurePoint}-webm`,
      `blob:${failurePoint}-webm`,
    ]);
  }

  console.log(JSON.stringify({ ok: true, checked: 'stepquest-v02-media' }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
