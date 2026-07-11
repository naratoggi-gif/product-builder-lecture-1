(function exposeCharacter(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepQuestV02Character = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (root) => {
  const CHARACTER_ID = 'local-primary';
  const IMAGE_BLOB_KEY = 'character:local-primary:image';
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
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(contractError('CHARACTER_IMAGE_ENCODE_FAILED'));
            return;
          }
          resolve({ blob, ...dimensions });
        }, 'image/png');
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
    PRESETS,
    PALETTE,
    IMAGE_TYPES,
    fitWithin,
    normalizeMetadata,
    prepareImage,
    blobToBase64,
  };
});
