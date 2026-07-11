(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepQuestV02Backup = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function buildExport(records, now = new Date().toISOString()) {
    return {
      schemaVersion: 3,
      exportedAt: now,
      goals: records.goals || [],
      steps: records.steps || [],
      expeditions: records.expeditions || [],
      resumeAnchors: records.resumeAnchors || [],
      events: records.events || [],
      rewards: records.rewards || [],
      wallet: records.wallet || { stepCoin: 0, gold: 0 },
      camp: records.camp || { level: 0 },
      characters: records.characters || [],
    };
  }

  function buildFullExport(records, encodedAssets, now = new Date().toISOString()) {
    return {
      ...buildExport(records, now),
      exportType: 'full-with-images',
      assets: Array.isArray(encodedAssets) ? encodedAssets : [],
    };
  }

  function serializeExport(value) {
    return JSON.stringify(value, null, 2);
  }

  async function requestPersistentStorage(storage = globalThis.navigator?.storage) {
    if (!storage?.persisted || !storage?.persist) {
      return { supported: false, persisted: false };
    }
    try {
      if (await storage.persisted()) return { supported: true, persisted: true };
      return { supported: true, persisted: Boolean(await storage.persist()) };
    } catch (_error) {
      return { supported: true, persisted: false };
    }
  }

  async function chooseExternalFile(picker = globalThis.showSaveFilePicker) {
    if (typeof picker !== 'function') return null;
    return picker({
      suggestedName: 'stepquest-backup.json',
      types: [{
        description: 'StepQuest JSON',
        accept: { 'application/json': ['.json'] },
      }],
    });
  }

  async function writeExternalFile(handle, json) {
    if (!handle?.createWritable) throw new Error('EXTERNAL_BACKUP_HANDLE_INVALID');
    if (typeof handle.requestPermission === 'function') {
      const permission = await handle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') throw new Error('EXTERNAL_BACKUP_PERMISSION_DENIED');
    }
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
  }

  function downloadJson(json, documentValue = document, urlApi = URL) {
    const url = urlApi.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
    const anchor = documentValue.createElement('a');
    anchor.href = url;
    anchor.download = 'stepquest-backup.json';
    documentValue.body.append(anchor);
    anchor.click();
    anchor.remove();
    urlApi.revokeObjectURL(url);
  }

  return {
    buildExport,
    buildFullExport,
    serializeExport,
    requestPersistentStorage,
    chooseExternalFile,
    writeExternalFile,
    downloadJson,
  };
});
