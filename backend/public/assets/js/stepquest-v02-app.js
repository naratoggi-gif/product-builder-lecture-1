(function exposeFacade(root) {
  let repository = null;
  let snapshot = null;
  let app = null;
  let characterMediaUrls = { portrait: null, idle: null, skill: null };
  let character = null;
  let legacyWriteBlockPending = false;
  let legacyWriteBlockRecorded = false;
  let foregroundSessionMutex = Promise.resolve();
  const status = {
    mode: 'unknown',
    persisted: false,
    pendingAccountImport: false,
    externalBackupStale: false,
    manualBackupDue: false,
    migrationError: null,
    lastExternalBackupAt: null,
    quarantinedRecords: 0,
    characterStorageSupported: false,
    characterImageMissing: false,
  };

  const now = () => new Date().toISOString();
  const makeId = (prefix) => (
    `${prefix}-${root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
  );
  const builtInCharacter = () => ({
    id: 'builtin-default',
    name: '나의 모험가',
    imageBlobKey: null,
    imageUrl: null,
    portraitUrl: null,
    idleUrl: null,
    skillUrl: null,
    skillPreset: 'impact',
    skillName: '첫걸음',
    accentColor: '#65d9ff',
    usingDefault: true,
    missingImage: false,
  });

  function requireRepository() {
    if (!repository || !snapshot || !app) throw new Error('STEPQUEST_V02_NOT_INITIALIZED');
  }

  function requireFun() {
    const Fun = root.StepQuestV02Fun;
    if (!Fun) throw new Error('FUN_MODULE_NOT_LOADED');
    return Fun;
  }

  function requireCharacter() {
    const Character = root.StepQuestV02Character;
    if (!Character) throw new Error('CHARACTER_MODULE_NOT_LOADED');
    return Character;
  }

  function requireMedia() {
    const Media = root.StepQuestV02Media;
    if (!Media) throw new Error('MEDIA_MODULE_NOT_LOADED');
    return Media;
  }

  function withForegroundSessionLock(callback) {
    if (root.navigator?.locks?.request) {
      return root.navigator.locks.request('stepquest-v02:foreground-session', callback);
    }
    const pending = foregroundSessionMutex.then(callback, callback);
    foregroundSessionMutex = pending.then(() => undefined, () => undefined);
    return pending;
  }

  function releaseCharacterMediaUrls(urls) {
    ['portrait', 'idle', 'skill'].forEach((slot) => {
      if (!urls?.[slot] || !root.URL?.revokeObjectURL) return;
      try {
        root.URL.revokeObjectURL(urls[slot]);
      } catch (_error) {
        // Revoke every owned URL even when one browser cleanup call fails.
      }
    });
  }

  async function refreshCharacter() {
    const media = await repository.getCharacterMedia();
    const nextUrls = { portrait: null, idle: null, skill: null };
    let nextCharacter;
    let imageMissing = false;
    if (!media.character) {
      nextCharacter = builtInCharacter();
    } else if (!media.portrait || !root.URL?.createObjectURL) {
      nextCharacter = { ...builtInCharacter(), missingImage: true };
      imageMissing = true;
    } else {
      try {
        ['portrait', 'idle', 'skill'].forEach((slot) => {
          if (media[slot]) nextUrls[slot] = root.URL.createObjectURL(media[slot]);
        });
      } catch (error) {
        releaseCharacterMediaUrls(nextUrls);
        throw error;
      }
      nextCharacter = {
        ...media.character,
        imageUrl: nextUrls.portrait,
        portraitUrl: nextUrls.portrait,
        idleUrl: nextUrls.idle,
        skillUrl: nextUrls.skill,
        usingDefault: false,
        missingImage: false,
      };
    }

    const previousUrls = characterMediaUrls;
    characterMediaUrls = nextUrls;
    character = nextCharacter;
    status.characterImageMissing = imageMissing;
    releaseCharacterMediaUrls(previousUrls);
    return character;
  }

  async function recordLegacyWriteBlock() {
    if (!repository) {
      legacyWriteBlockPending = true;
      return;
    }
    if (legacyWriteBlockRecorded) return;
    legacyWriteBlockRecorded = true;
    const existing = await repository.getMeta('lastLegacyWriteBlockedAt');
    if (!existing) await repository.setMeta('lastLegacyWriteBlockedAt', now());
    legacyWriteBlockPending = false;
  }

  root.addEventListener('stepquest:v02-legacy-write-blocked', () => {
    recordLegacyWriteBlock().catch(() => {
      legacyWriteBlockRecorded = false;
      legacyWriteBlockPending = true;
    });
  });

  async function init(options) {
    app = options.App;
    if (!app?.makeGuestGoal) throw new Error('STEPQUEST_TEMPLATE_FACTORY_MISSING');
    if (!repository || options.forceRefresh) {
      repository = await root.StepQuestV02Storage.openRepository();
    }
    snapshot = await repository.getSnapshot();
    status.migrationError = null;

    if (!snapshot.goals.length) {
      const raw = root.localStorage.getItem('stepquest_guest_state');
      if (raw) {
        try {
          const migrated = await repository.migrateLegacy(JSON.parse(raw), {
            idempotencyKey: 'legacy:v02:migration',
            now: now(),
            idFactory: makeId,
          });
          if (migrated.migrated || migrated.reason === 'LOCAL_STATE_EXISTS') {
            snapshot = await repository.getSnapshot();
          } else {
            status.migrationError = migrated.error || migrated.reason || 'LEGACY_MIGRATION_FAILED';
          }
        } catch (error) {
          status.migrationError = error.message;
          await repository.setMeta('migrationError', { message: error.message, occurredAt: now() });
        }
      }
    }

    status.mode = repository.mode;
    status.characterStorageSupported = repository.mode === 'indexedDB';
    status.lastExternalBackupAt = await repository.getMeta('lastExternalBackupAt') || null;
    status.externalBackupStale = Boolean(await repository.getMeta('externalBackupStale'));
    status.quarantinedRecords = Number(await repository.getMeta('lastQuarantineCount') || 0);
    const accountImportChoice = await repository.getMeta('accountImportChoice');
    status.pendingAccountImport = (
      !snapshot.goals.length
      && Boolean(app.state.token && app.state.weekly[0] && app.state.nextMicro)
      && !accountImportChoice
    );
    const commitCount = Number(await repository.getMeta('commitsSinceExternalBackup') || 0);
    status.manualBackupDue = commitCount >= 5;

    if (snapshot.goals.length && repository.mode === 'indexedDB') {
      const persistence = await root.StepQuestV02Backup.requestPersistentStorage();
      status.persisted = persistence.persisted;
      await repository.setMeta('storagePersistence', persistence);
    } else {
      status.persisted = false;
    }
    if (legacyWriteBlockPending) await recordLegacyWriteBlock();
    await refreshCharacter();
    return snapshot;
  }

  async function afterSignificantCommit() {
    requireRepository();
    if (!status.persisted && repository.mode === 'indexedDB') {
      const persistence = await root.StepQuestV02Backup.requestPersistentStorage();
      status.persisted = persistence.persisted;
      await repository.setMeta('storagePersistence', persistence);
    }
    const handle = repository.mode === 'indexedDB'
      ? await repository.getMeta('externalBackupHandle')
      : null;
    if (!handle) {
      const count = Number(await repository.getMeta('commitsSinceExternalBackup') || 0) + 1;
      await repository.setMeta('commitsSinceExternalBackup', count);
      status.manualBackupDue = count >= 5;
      return;
    }
    try {
      await root.StepQuestV02Backup.writeExternalFile(handle, await exportJson());
      status.lastExternalBackupAt = now();
      await repository.setMeta('lastExternalBackupAt', status.lastExternalBackupAt);
      await repository.setMeta('commitsSinceExternalBackup', 0);
      await repository.setMeta('externalBackupStale', false);
      status.externalBackupStale = false;
      status.manualBackupDue = false;
    } catch (_error) {
      status.externalBackupStale = true;
      await repository.setMeta('externalBackupStale', true);
    }
  }

  async function createGoal(input) {
    requireRepository();
    const made = app.makeGuestGoal(input);
    const transition = await repository.importGoal(made, {
      idempotencyKey: `goal:${made.weekly.id}:import`,
      now: now(),
      idFactory: makeId,
    });
    snapshot = transition.state;
    status.pendingAccountImport = false;
    await afterSignificantCommit();
    return transition.result;
  }

  async function importAccountProgress() {
    requireRepository();
    if (!status.pendingAccountImport) throw new Error('ACCOUNT_IMPORT_NOT_PENDING');
    const weekly = {
      ...app.state.weekly[0],
      createdAt: app.state.weekly[0].createdAt || now(),
    };
    const micro = [{
      ...app.state.nextMicro,
      createdAt: app.state.nextMicro.createdAt || now(),
    }];
    const transition = await repository.importGoal({ weekly, micro }, {
      idempotencyKey: `account:${weekly.id}:import`,
      now: now(),
      idFactory: makeId,
    });
    await repository.setMeta('accountImportChoice', 'import');
    status.pendingAccountImport = false;
    snapshot = transition.state;
    await afterSignificantCommit();
    return transition.result;
  }

  async function keepLocalProfileEmpty() {
    requireRepository();
    await repository.setMeta('accountImportChoice', 'empty');
    status.pendingAccountImport = false;
    return true;
  }

  async function startCurrentStep(idempotencyKey, plannedMinutes = 5) {
    requireRepository();
    if (![5, 10, 25].includes(plannedMinutes)) {
      const error = new Error('EXPEDITION_DURATION_INVALID');
      error.code = 'EXPEDITION_DURATION_INVALID';
      throw error;
    }
    const replayed = snapshot.events.find((item) => (
      item.type === 'step_started' && item.idempotencyKey === idempotencyKey
    ));
    const step = snapshot.steps.find((item) => item.status === 'active')
      || snapshot.steps.find((item) => item.id === replayed?.stepId);
    if (!step) throw new Error('ACTIVE_STEP_NOT_FOUND');
    const transition = await repository.execute('startStep', {
      stepId: step.id,
      plannedMinutes,
      idempotencyKey,
      now: now(),
      idFactory: makeId,
    });
    snapshot = transition.state;
    if (transition.duplicate) return transition.result;
    try {
      await repository.setMeta('lastExpeditionMinutes', plannedMinutes);
    } catch (_error) {
      // Preference persistence is best-effort after the domain commit.
    }
    await afterSignificantCommit();
    return transition.result;
  }

  async function refreshSnapshot() {
    requireRepository();
    snapshot = await repository.getSnapshot();
    await refreshCharacter();
    return snapshot;
  }

  async function getLastExpeditionMinutes() {
    requireRepository();
    const stored = await repository.getMeta('lastExpeditionMinutes');
    return [5, 10, 25].includes(stored) ? stored : 5;
  }

  function getTimerView(observedAt) {
    requireRepository();
    const expedition = snapshot.expeditions.find((item) => item.status === 'active');
    if (!expedition) return null;
    return requireFun().deriveTimer(expedition, observedAt);
  }

  function getEncounterView() {
    requireRepository();
    const expedition = snapshot.expeditions.find((item) => item.status === 'active');
    const step = expedition
      ? snapshot.steps.find((item) => item.id === expedition.stepId)
      : snapshot.steps.find((item) => item.status === 'active')
        || snapshot.steps.find((item) => item.status === 'interrupted');
    if (!step) return null;
    const Domain = root.StepQuestV02Domain;
    if (!Domain?.isGoalMilestone) throw new Error('DOMAIN_MODULE_NOT_LOADED');
    return requireFun().selectEncounter({
      rewardLineage: step.rewardLineage || step.id,
      category: step.category || 'generic',
      boss: Domain.isGoalMilestone(step, snapshot.steps),
    });
  }

  function latestV1ReportEvent(reportVersion) {
    const events = snapshot.events
      .filter((event) => (
        event.type === 'expedition_reported'
        && event.result?.reportVersion === reportVersion
      ))
      .sort((left, right) => (
        String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
        || String(left.idempotencyKey || '').localeCompare(String(right.idempotencyKey || ''))
      ));
    return events[events.length - 1] || null;
  }

  async function getPendingBattleReport() {
    requireRepository();
    const Fun = requireFun();
    const event = latestV1ReportEvent(Fun.REPORT_VERSION);
    if (!event) return null;
    const acknowledgedKey = await repository.getMeta('acknowledgedBattleReportKey');
    if (acknowledgedKey === event.idempotencyKey) return null;
    const expedition = snapshot.expeditions.find((item) => item.id === event.expeditionId);
    return {
      key: event.idempotencyKey,
      ...Fun.buildBattleReport({ event, expedition, events: snapshot.events }),
    };
  }

  async function acknowledgeBattleReport(key) {
    requireRepository();
    snapshot = await repository.getSnapshot();
    const pending = await getPendingBattleReport();
    if (!pending || pending.key !== key) return false;
    await repository.setMeta('acknowledgedBattleReportKey', key);
    snapshot = await repository.getSnapshot();
    return (await getPendingBattleReport()) === null;
  }

  async function beginForegroundSession(localDate) {
    requireRepository();
    return withForegroundSessionLock(async () => {
      const combined = await repository.getMeta('foregroundSession');
      let previousLocalDate = combined?.lastForegroundLocalDate;
      let previousForegroundAt = combined?.lastForegroundAt;
      if (!combined || typeof combined !== 'object') {
        [previousLocalDate, previousForegroundAt] = await Promise.all([
          repository.getMeta('lastForegroundLocalDate'),
          repository.getMeta('lastForegroundAt'),
        ]);
      }
      const observedAt = now();
      const elapsed = Date.parse(observedAt) - Date.parse(previousForegroundAt);
      const result = {
        firstLocalDate: previousLocalDate !== localDate,
        longAbsence: Number.isFinite(elapsed) && elapsed >= 48 * 60 * 60 * 1000,
      };
      await repository.setMeta('foregroundSession', {
        lastForegroundAt: observedAt,
        lastForegroundLocalDate: localDate,
      });
      return result;
    });
  }

  async function chooseDialogue(input = {}) {
    requireRepository();
    const context = String(input.context || 'idle');
    const triggerKey = String(input.triggerKey || (
      `${context}:${input.entityId || 'none'}:${input.localDate || 'none'}`
    ));
    const metaKey = `dialogueCursor:${context}`;
    const previous = await repository.getMeta(metaKey);
    if (previous?.triggerKey === triggerKey && typeof previous.text === 'string') {
      return previous.text;
    }
    const text = requireFun().selectDialogue({
      ...input,
      context,
      previousText: typeof previous?.text === 'string' ? previous.text : null,
    });
    await repository.setMeta(metaKey, { triggerKey, text });
    return text;
  }

  async function reportCurrentExpedition(command) {
    requireRepository();
    const expedition = snapshot.expeditions.find((item) => item.status === 'active');
    if (!expedition) throw new Error('ACTIVE_EXPEDITION_NOT_FOUND');
    const step = snapshot.steps.find((item) => item.id === expedition.stepId);
    const wasComplete = snapshot.goals.find((item) => item.id === step?.goalId)?.status === 'completed';
    const transition = await repository.execute('reportOutcome', {
      ...command,
      expeditionId: expedition.id,
      now: now(),
      idFactory: makeId,
    });
    snapshot = transition.state;
    const isComplete = snapshot.goals.find((item) => item.id === step?.goalId)?.status === 'completed';
    await afterSignificantCommit();
    return { ...transition.result, goalMilestone: !wasComplete && isComplete };
  }

  async function resumeCurrentStep(stepId, idempotencyKey) {
    requireRepository();
    const transition = await repository.execute('resumeStep', {
      stepId,
      idempotencyKey,
      now: now(),
    });
    snapshot = transition.state;
    return transition.result;
  }

  async function undeferCurrentStep(stepId, idempotencyKey) {
    requireRepository();
    const transition = await repository.execute('undeferStep', {
      stepId,
      idempotencyKey,
      now: now(),
    });
    snapshot = transition.state;
    return transition.result;
  }

  async function unblockCurrentStep(stepId, idempotencyKey) {
    requireRepository();
    const transition = await repository.execute('unblockStep', {
      stepId,
      idempotencyKey,
      now: now(),
    });
    snapshot = transition.state;
    return transition.result;
  }

  async function routeCurrentObstacle(command) {
    requireRepository();
    const step = snapshot.steps.find((item) => item.status === 'active');
    if (!step) throw new Error('ACTIVE_STEP_NOT_FOUND');
    const transition = await repository.execute('routeObstacle', {
      ...command,
      stepId: step.id,
      now: now(),
      idFactory: makeId,
    });
    snapshot = transition.state;
    await afterSignificantCommit();
    return transition.result;
  }

  async function upgradeCamp(idempotencyKey) {
    requireRepository();
    const transition = await repository.execute('upgradeCamp', {
      idempotencyKey,
      now: now(),
    });
    snapshot = transition.state;
    await afterSignificantCommit();
    return transition.result;
  }

  async function importCharacter(input) {
    requireRepository();
    if (repository.mode !== 'indexedDB') throw new Error('CHARACTER_IMAGE_STORAGE_UNAVAILABLE');
    const Character = root.StepQuestV02Character;
    if (!Character?.prepareImage || !Character?.normalizeMetadata || !Character?.withMediaSlot) {
      throw new Error('CHARACTER_MODULE_NOT_LOADED');
    }
    const prepared = await Character.prepareImage(input?.file);
    const saved = await repository.getCharacter();
    const timestamp = now();
    const profile = Character.normalizeMetadata({
      ...(saved || {}),
      ...input,
      createdAt: saved?.createdAt || timestamp,
      imageBlobKey: Character.MEDIA_KEYS.portrait,
    }, timestamp);
    const metadata = Character.withMediaSlot({
      ...(saved || {}),
      ...profile,
    }, 'portrait', {
      key: Character.MEDIA_KEYS.portrait,
      mimeType: prepared.blob.type,
      byteLength: prepared.blob.size,
      width: prepared.width,
      height: prepared.height,
    });
    await repository.saveCharacterMediaSlot(metadata, 'portrait', prepared.blob);
    await refreshCharacter();
    await afterSignificantCommit();
    return { ...metadata, width: prepared.width, height: prepared.height };
  }

  async function importCharacterMedia(slot, file) {
    requireRepository();
    if (repository.mode !== 'indexedDB') throw new Error('CHARACTER_IMAGE_STORAGE_UNAVAILABLE');
    const Character = requireCharacter();
    if (!Character.prepareImage || !Character.withMediaSlot || !Character.normalizeMetadata) {
      throw new Error('CHARACTER_MODULE_NOT_LOADED');
    }
    if (!Object.prototype.hasOwnProperty.call(Character.MEDIA_KEYS || {}, slot)) {
      throw new Error('CHARACTER_MEDIA_SLOT_INVALID');
    }

    const current = await repository.getCharacterMedia();
    const timestamp = now();
    let blob = file;
    let inspected;
    if (slot === 'portrait') {
      const prepared = await Character.prepareImage(file);
      blob = prepared.blob;
      inspected = {
        mimeType: blob.type,
        byteLength: blob.size,
        width: prepared.width,
        height: prepared.height,
      };
    } else {
      const Media = requireMedia();
      if (!Media.inspectMovingMedia) throw new Error('MEDIA_MODULE_NOT_LOADED');
      inspected = await Media.inspectMovingMedia(file);
    }

    const base = current.character || Character.normalizeMetadata({
      imageBlobKey: Character.MEDIA_KEYS.portrait,
    }, timestamp);
    const metadata = Character.withMediaSlot({
      ...base,
      updatedAt: timestamp,
    }, slot, {
      key: Character.MEDIA_KEYS[slot],
      ...inspected,
    });
    const committed = await repository.saveCharacterMediaSlot(metadata, slot, blob);
    let refreshed = null;
    try {
      refreshed = await refreshCharacter();
    } catch (_error) {
      // Persistence is authoritative; a later refresh can recover presentation URLs.
    }
    await afterSignificantCommit();
    return { ...(refreshed || committed) };
  }

  async function exportJson() {
    requireRepository();
    const value = root.StepQuestV02Backup.buildExport(await repository.exportRecords(), now());
    return root.StepQuestV02Backup.serializeExport(value);
  }

  async function exportFullJson() {
    requireRepository();
    if (repository.mode !== 'indexedDB') throw new Error('CHARACTER_IMAGE_STORAGE_UNAVAILABLE');
    const Character = root.StepQuestV02Character;
    if (!Character?.blobToBase64) throw new Error('CHARACTER_MODULE_NOT_LOADED');
    const records = await repository.exportCharacterAssets();
    const encodedAssets = await Promise.all(records.assets.map(async (asset) => ({
      id: asset.id,
      mimeType: asset.mimeType || asset.blob?.type || 'image/png',
      base64: await Character.blobToBase64(asset.blob),
    })));
    const domainRecords = await repository.exportRecords();
    const value = root.StepQuestV02Backup.buildFullExport(
      { ...domainRecords, characters: records.characters },
      encodedAssets,
      now(),
    );
    return root.StepQuestV02Backup.serializeExport(value);
  }

  async function enableExternalBackup() {
    requireRepository();
    if (repository.mode !== 'indexedDB') return false;
    const handle = await root.StepQuestV02Backup.chooseExternalFile();
    if (!handle) return false;
    await repository.setMeta('externalBackupHandle', handle);
    await afterSignificantCommit();
    return true;
  }

  root.StepQuestV02App = {
    init,
    getSnapshot: () => snapshot,
    getStatus: () => ({ ...status }),
    getCharacter: () => ({ ...(character || builtInCharacter()) }),
    createGoal,
    importAccountProgress,
    keepLocalProfileEmpty,
    startCurrentStep,
    refreshSnapshot,
    getLastExpeditionMinutes,
    getTimerView,
    getEncounterView,
    getPendingBattleReport,
    acknowledgeBattleReport,
    beginForegroundSession,
    chooseDialogue,
    reportCurrentExpedition,
    resumeCurrentStep,
    undeferCurrentStep,
    unblockCurrentStep,
    routeCurrentObstacle,
    upgradeCamp,
    importCharacter,
    importCharacterMedia,
    exportJson,
    exportFullJson,
    enableExternalBackup,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
