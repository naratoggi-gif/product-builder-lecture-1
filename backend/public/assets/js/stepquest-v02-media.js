(function exposeMedia(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepQuestV02Media = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (root) => {
  const MOVING_TYPES = Object.freeze(['image/webp', 'video/webm']);
  const MAX_CLIP_BYTES = 6 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
  const MAX_EDGE = 1024;
  const MAX_DURATION_MS = 3000;
  const ERROR_CODES = Object.freeze({
    BLOB_INVALID: 'CHARACTER_MEDIA_BLOB_INVALID',
    TYPE_UNSUPPORTED: 'CHARACTER_MEDIA_TYPE_UNSUPPORTED',
    TOO_LARGE: 'CHARACTER_MEDIA_TOO_LARGE',
    DIMENSIONS_INVALID: 'CHARACTER_MEDIA_DIMENSIONS_INVALID',
    DIMENSIONS_TOO_LARGE: 'CHARACTER_MEDIA_DIMENSIONS_TOO_LARGE',
    DURATION_INVALID: 'CHARACTER_MEDIA_DURATION_INVALID',
    TOO_LONG: 'CHARACTER_MEDIA_TOO_LONG',
    MAGIC_MISMATCH: 'CHARACTER_MEDIA_MAGIC_MISMATCH',
    WEBP_INVALID: 'CHARACTER_MEDIA_WEBP_INVALID',
    WEBP_NOT_ANIMATED: 'CHARACTER_MEDIA_WEBP_NOT_ANIMATED',
    DECODE_UNAVAILABLE: 'CHARACTER_MEDIA_DECODE_UNAVAILABLE',
    DECODE_FAILED: 'CHARACTER_MEDIA_DECODE_FAILED',
  });

  function contractError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function ascii(bytes, offset, length) {
    let result = '';
    for (let index = 0; index < length; index += 1) {
      result += String.fromCharCode(bytes[offset + index]);
    }
    return result;
  }

  function uint24LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
  }

  function uint32LE(bytes, offset) {
    return (
      bytes[offset]
      + (bytes[offset + 1] * 0x100)
      + (bytes[offset + 2] * 0x10000)
      + (bytes[offset + 3] * 0x1000000)
    );
  }

  function toBytes(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    throw contractError(ERROR_CODES.WEBP_INVALID);
  }

  function parseAnimatedWebP(input) {
    const bytes = toBytes(input);
    if (
      bytes.length < 12
      || ascii(bytes, 0, 4) !== 'RIFF'
      || ascii(bytes, 8, 4) !== 'WEBP'
    ) {
      throw contractError(ERROR_CODES.WEBP_INVALID);
    }

    const riffEnd = 8 + uint32LE(bytes, 4);
    if (riffEnd !== bytes.length || riffEnd < 12) {
      throw contractError(ERROR_CODES.WEBP_INVALID);
    }

    let offset = 12;
    let width = 0;
    let height = 0;
    let durationMs = 0;
    let hasAnimationFlag = false;
    let hasAnimationChunk = false;
    let frameCount = 0;
    let hasExtendedHeader = false;

    while (offset < riffEnd) {
      if (offset + 8 > riffEnd) throw contractError(ERROR_CODES.WEBP_INVALID);
      const type = ascii(bytes, offset, 4);
      const chunkSize = uint32LE(bytes, offset + 4);
      const dataStart = offset + 8;
      const dataEnd = dataStart + chunkSize;
      const nextOffset = dataEnd + (chunkSize % 2);
      if (dataEnd > riffEnd || nextOffset > riffEnd) {
        throw contractError(ERROR_CODES.WEBP_INVALID);
      }

      if (type === 'VP8X') {
        if (offset !== 12 || hasExtendedHeader || chunkSize !== 10) {
          throw contractError(ERROR_CODES.WEBP_INVALID);
        }
        hasExtendedHeader = true;
        hasAnimationFlag = Boolean(bytes[dataStart] & 0x02);
        width = uint24LE(bytes, dataStart + 4) + 1;
        height = uint24LE(bytes, dataStart + 7) + 1;
      } else if (type === 'ANIM') {
        if (
          !hasExtendedHeader
          || hasAnimationChunk
          || frameCount > 0
          || chunkSize !== 6
        ) {
          throw contractError(ERROR_CODES.WEBP_INVALID);
        }
        hasAnimationChunk = true;
      } else if (type === 'ANMF') {
        if (chunkSize < 16) throw contractError(ERROR_CODES.WEBP_INVALID);
        durationMs += uint24LE(bytes, dataStart + 12);
        frameCount += 1;
      }

      offset = nextOffset;
    }

    if (
      !hasExtendedHeader
      || !hasAnimationFlag
      || !hasAnimationChunk
      || frameCount === 0
    ) {
      throw contractError(ERROR_CODES.WEBP_NOT_ANIMATED);
    }
    return { width, height, durationMs };
  }

  function parseAnimatedWebPDuration(input) {
    return parseAnimatedWebP(input).durationMs;
  }

  function validateMovingMetadata(metadata = {}) {
    const mimeType = metadata.mimeType;
    if (!MOVING_TYPES.includes(mimeType)) {
      throw contractError(ERROR_CODES.TYPE_UNSUPPORTED);
    }

    const hasSize = metadata.size !== undefined;
    const hasByteLength = metadata.byteLength !== undefined;
    if (hasSize && hasByteLength && metadata.size !== metadata.byteLength) {
      throw contractError(ERROR_CODES.BLOB_INVALID);
    }
    const byteLength = hasByteLength ? metadata.byteLength : metadata.size;
    if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
      throw contractError(ERROR_CODES.BLOB_INVALID);
    }
    if (byteLength > MAX_CLIP_BYTES) throw contractError(ERROR_CODES.TOO_LARGE);

    const { width, height, durationMs } = metadata;
    if (
      !Number.isSafeInteger(width)
      || !Number.isSafeInteger(height)
      || width <= 0
      || height <= 0
    ) {
      throw contractError(ERROR_CODES.DIMENSIONS_INVALID);
    }
    if (width > MAX_EDGE || height > MAX_EDGE) {
      throw contractError(ERROR_CODES.DIMENSIONS_TOO_LARGE);
    }
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw contractError(ERROR_CODES.DURATION_INVALID);
    }
    if (durationMs > MAX_DURATION_MS) throw contractError(ERROR_CODES.TOO_LONG);

    return { mimeType, byteLength, width, height, durationMs };
  }

  function detectMovingType(bytes) {
    if (
      bytes.length >= 12
      && ascii(bytes, 0, 4) === 'RIFF'
      && ascii(bytes, 8, 4) === 'WEBP'
    ) {
      return 'image/webp';
    }
    if (
      bytes.length >= 4
      && bytes[0] === 0x1a
      && bytes[1] === 0x45
      && bytes[2] === 0xdf
      && bytes[3] === 0xa3
    ) {
      return 'video/webm';
    }
    return null;
  }

  async function decodeWebM(blob, options) {
    const documentValue = options.documentValue || root?.document;
    const urlApi = options.urlApi || root?.URL;
    const createVideo = options.createVideo || (
      documentValue?.createElement ? () => documentValue.createElement('video') : null
    );
    if (
      typeof createVideo !== 'function'
      || typeof urlApi?.createObjectURL !== 'function'
      || typeof urlApi?.revokeObjectURL !== 'function'
    ) {
      throw contractError(ERROR_CODES.DECODE_UNAVAILABLE);
    }

    let video;
    try {
      video = createVideo();
    } catch (_error) {
      throw contractError(ERROR_CODES.DECODE_FAILED);
    }
    if (!video) throw contractError(ERROR_CODES.DECODE_UNAVAILABLE);

    let objectUrl;
    try {
      objectUrl = urlApi.createObjectURL(blob);
    } catch (_error) {
      throw contractError(ERROR_CODES.DECODE_FAILED);
    }

    try {
      return await new Promise((resolve, reject) => {
        const settle = (callback, value) => {
          video.onloadedmetadata = null;
          video.onerror = null;
          callback(value);
        };
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.setAttribute?.('playsinline', '');
        video.onloadedmetadata = () => settle(resolve, {
          width: video.videoWidth,
          height: video.videoHeight,
          durationMs: Math.round(video.duration * 1000),
        });
        video.onerror = () => settle(reject, contractError(ERROR_CODES.DECODE_FAILED));
        try {
          video.src = objectUrl;
        } catch (_error) {
          settle(reject, contractError(ERROR_CODES.DECODE_FAILED));
        }
      });
    } finally {
      try {
        urlApi.revokeObjectURL(objectUrl);
      } catch (_error) {
        // Revocation was attempted; preserve the inspection result or decode error.
      }
    }
  }

  async function inspectMovingMedia(blob, options = {}) {
    if (!blob || typeof blob !== 'object' || typeof blob.arrayBuffer !== 'function') {
      throw contractError(ERROR_CODES.BLOB_INVALID);
    }
    if (!MOVING_TYPES.includes(blob.type)) {
      throw contractError(ERROR_CODES.TYPE_UNSUPPORTED);
    }
    if (!Number.isSafeInteger(blob.size) || blob.size <= 0) {
      throw contractError(ERROR_CODES.BLOB_INVALID);
    }
    if (blob.size > MAX_CLIP_BYTES) throw contractError(ERROR_CODES.TOO_LARGE);

    let bytes;
    try {
      bytes = new Uint8Array(await blob.arrayBuffer());
    } catch (_error) {
      throw contractError(ERROR_CODES.BLOB_INVALID);
    }
    if (bytes.byteLength !== blob.size) throw contractError(ERROR_CODES.BLOB_INVALID);
    if (detectMovingType(bytes) !== blob.type) {
      throw contractError(ERROR_CODES.MAGIC_MISMATCH);
    }

    const decoded = blob.type === 'image/webp'
      ? parseAnimatedWebP(bytes)
      : await decodeWebM(blob, options);
    return validateMovingMetadata({
      mimeType: blob.type,
      byteLength: blob.size,
      ...decoded,
    });
  }

  return {
    MOVING_TYPES,
    MAX_CLIP_BYTES,
    MAX_TOTAL_BYTES,
    MAX_EDGE,
    MAX_DURATION_MS,
    ERROR_CODES,
    inspectMovingMedia,
    parseAnimatedWebPDuration,
    validateMovingMetadata,
  };
});
