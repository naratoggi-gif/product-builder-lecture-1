(function exposeCharacter(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepQuestV02Character = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (root) => {
  const CHARACTER_ID = 'local-primary';
  const IMAGE_BLOB_KEY = 'character:local-primary:image';
  const MEDIA_KEYS = Object.freeze({
    portrait: 'character:local-primary:portrait',
    idle: 'character:local-primary:idle',
    skill: 'character:local-primary:skill',
  });
  const PRESETS = Object.freeze(['impact', 'dash', 'slash', 'cast']);
  const PALETTE = Object.freeze([
    '#65d9ff',
    '#ffd166',
    '#ff6b8a',
    '#a78bfa',
    '#4ade80',
    '#38bdf8',
    '#fb923c',
    '#e2e8f0',
  ]);
  const IMAGE_TYPES = Object.freeze(['image/png', 'image/webp', 'image/jpeg']);

  function contractError(code) {
    return new Error(code);
  }

  function fitWithin(width, height, maxEdge = 512) {
    if (
      !Number.isFinite(width)
      || !Number.isFinite(height)
      || !Number.isFinite(maxEdge)
      || width <= 0
      || height <= 0
      || maxEdge <= 0
    ) {
      throw contractError('CHARACTER_IMAGE_DIMENSIONS_INVALID');
    }
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  function normalizeMetadata(input = {}, now = new Date().toISOString()) {
    const skillPreset = input.skillPreset || PRESETS[0];
    const accentColor = input.accentColor || PALETTE[0];
    if (!PRESETS.includes(skillPreset)) throw contractError('CHARACTER_PRESET_INVALID');
    if (!PALETTE.includes(accentColor)) throw contractError('CHARACTER_COLOR_INVALID');
    return {
      id: CHARACTER_ID,
      name: String(input.name || '').trim().slice(0, 40) || '나의 모험가',
      imageBlobKey: String(input.imageBlobKey || IMAGE_BLOB_KEY),
      skillPreset,
      skillName: String(input.skillName || '').trim().slice(0, 40) || '첫걸음',
      accentColor,
      createdAt: input.createdAt || now,
      updatedAt: now,
    };
  }

  function normalizeMediaKeys(input = {}) {
    const source = input.media && typeof input.media === 'object' ? input.media : {};
    const media = {};
    const portraitKey = source.portraitKey || input.imageBlobKey;
    if (portraitKey) media.portraitKey = String(portraitKey);
    if (source.idleKey) media.idleKey = String(source.idleKey);
    if (source.skillKey) media.skillKey = String(source.skillKey);
    return media;
  }

  function mediaApi() {
    if (root?.StepQuestV02Media) return root.StepQuestV02Media;
    if (typeof module === 'object' && module.exports && typeof require === 'function') {
      return require('./stepquest-v02-media');
    }
    throw contractError('CHARACTER_MEDIA_API_UNAVAILABLE');
  }

  function portraitMetadata(inspected) {
    if (!IMAGE_TYPES.includes(inspected?.mimeType)) {
      throw contractError('CHARACTER_IMAGE_TYPE_UNSUPPORTED');
    }
    if (!Number.isSafeInteger(inspected.byteLength) || inspected.byteLength <= 0) {
      throw contractError('CHARACTER_IMAGE_BLOB_INVALID');
    }
    if (
      !Number.isSafeInteger(inspected.width)
      || !Number.isSafeInteger(inspected.height)
      || inspected.width <= 0
      || inspected.height <= 0
      || inspected.width > 512
      || inspected.height > 512
    ) {
      throw contractError('CHARACTER_IMAGE_DIMENSIONS_INVALID');
    }
    return {
      mimeType: inspected.mimeType,
      byteLength: inspected.byteLength,
      width: inspected.width,
      height: inspected.height,
    };
  }

  function copySlotMetadata(metadata, moving) {
    if (!metadata || typeof metadata !== 'object') return null;
    const copy = {
      mimeType: metadata.mimeType,
      byteLength: metadata.byteLength,
      width: metadata.width,
      height: metadata.height,
    };
    if (moving) copy.durationMs = metadata.durationMs;
    return copy;
  }

  function withMediaSlot(character = {}, slot, inspected = {}) {
    if (character.id !== CHARACTER_ID) throw contractError('CHARACTER_ID_INVALID');
    if (!Object.prototype.hasOwnProperty.call(MEDIA_KEYS, slot)) {
      throw contractError('CHARACTER_MEDIA_SLOT_INVALID');
    }
    if (inspected.key !== MEDIA_KEYS[slot]) {
      throw contractError('CHARACTER_MEDIA_KEY_INVALID');
    }

    const media = normalizeMediaKeys(character);
    const hasPortrait = media.portraitKey === MEDIA_KEYS.portrait
      || media.portraitKey === IMAGE_BLOB_KEY;
    if (slot !== 'portrait' && !hasPortrait) {
      throw contractError('CHARACTER_PORTRAIT_REQUIRED');
    }

    const normalized = slot === 'portrait'
      ? portraitMetadata(inspected)
      : mediaApi().validateMovingMetadata(inspected);
    media[`${slot}Key`] = MEDIA_KEYS[slot];

    const mediaMetadata = {};
    ['portrait', 'idle', 'skill'].forEach((name) => {
      const existing = copySlotMetadata(character.mediaMetadata?.[name], name !== 'portrait');
      if (existing && media[`${name}Key`]) mediaMetadata[name] = existing;
    });
    mediaMetadata[slot] = normalized;

    const movingBytes = ['idle', 'skill'].reduce((total, name) => {
      const byteLength = mediaMetadata[name]?.byteLength || 0;
      if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
        throw contractError('CHARACTER_MEDIA_METADATA_INVALID');
      }
      return total + byteLength;
    }, 0);
    if (movingBytes > mediaApi().MAX_TOTAL_BYTES) {
      throw contractError('CHARACTER_MEDIA_TOTAL_TOO_LARGE');
    }

    return {
      ...character,
      imageBlobKey: media.portraitKey,
      media,
      mediaMetadata,
    };
  }

  function prepareImage(file, options = {}) {
    if (!file || !IMAGE_TYPES.includes(file.type)) {
      return Promise.reject(contractError('CHARACTER_IMAGE_TYPE_UNSUPPORTED'));
    }
    const documentValue = options.documentValue || root?.document;
    const urlApi = options.urlApi || root?.URL;
    const ImageValue = options.ImageValue || root?.Image;
    if (!documentValue?.createElement || !urlApi?.createObjectURL || !urlApi?.revokeObjectURL) {
      return Promise.reject(contractError('CHARACTER_IMAGE_API_UNAVAILABLE'));
    }

    let objectUrl;
    try {
      objectUrl = urlApi.createObjectURL(file);
    } catch (_error) {
      return Promise.reject(contractError('CHARACTER_IMAGE_DECODE_FAILED'));
    }

    return new Promise((resolve, reject) => {
      const image = ImageValue ? new ImageValue() : documentValue.createElement('img');
      let revoked = false;
      const revoke = () => {
        if (revoked) return;
        revoked = true;
        urlApi.revokeObjectURL(objectUrl);
      };
      const fail = (code) => {
        revoke();
        reject(contractError(code));
      };

      image.onerror = () => fail('CHARACTER_IMAGE_DECODE_FAILED');
      image.onload = () => {
        let dimensions;
        try {
          dimensions = fitWithin(image.naturalWidth || image.width, image.naturalHeight || image.height, 512);
        } catch (_error) {
          fail('CHARACTER_IMAGE_DECODE_FAILED');
          return;
        }
        const canvas = documentValue.createElement('canvas');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        const context = canvas.getContext?.('2d');
        if (!context || typeof canvas.toBlob !== 'function') {
          fail('CHARACTER_IMAGE_ENCODE_FAILED');
          return;
        }
        try {
          context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
        } catch (_error) {
          fail('CHARACTER_IMAGE_ENCODE_FAILED');
          return;
        }
        revoke();
        try {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(contractError('CHARACTER_IMAGE_ENCODE_FAILED'));
              return;
            }
            resolve({ blob, ...dimensions });
          }, 'image/png');
        } catch (_error) {
          fail('CHARACTER_IMAGE_ENCODE_FAILED');
        }
      };
      image.src = objectUrl;
    });
  }

  async function blobToBase64(blob) {
    if (!blob || typeof blob.arrayBuffer !== 'function') {
      throw contractError('CHARACTER_IMAGE_BLOB_INVALID');
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    if (typeof root?.btoa !== 'function') throw contractError('CHARACTER_BASE64_UNAVAILABLE');
    return root.btoa(binary);
  }

  return {
    CHARACTER_ID,
    IMAGE_BLOB_KEY,
    MEDIA_KEYS,
    PRESETS,
    PALETTE,
    IMAGE_TYPES,
    fitWithin,
    normalizeMetadata,
    normalizeMediaKeys,
    withMediaSlot,
    prepareImage,
    blobToBase64,
  };
});
