(function exposeFacade(root) {
  let repository = null;
  let snapshot = null;
  let app = null;
  let legacyWriteBlockPending = false;
  let legacyWriteBlockRecorded = false;
  const status = {
    mode: 'unknown',
    persisted: false,
    recoveredExpedition: false,
    pendingAccountImport: false,
    externalBackupStale: false,
    manualBackupDue: false,
    migrationError: null,
    lastExternalBackupAt: null,
    quarantinedRecords: 0,
  };

  const now = () => new Date().toISOString();
  const makeId = (prefix) => (
    `${prefix}-${root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
  );

  function requireRepository() {
    if (!repository || !snapshot || !app) throw new Error('STEPQUEST_V02_NOT_INITIALIZED');
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
    status.lastExternalBackupAt = await repository.getMeta('lastExternalBackupAt') || null;
    status.externalBackupStale = Boolean(await repository.getMeta('externalBackupStale'));
    status.quarantinedRecords = Number(await repository.getMeta('lastQuarantineCount') || 0);
    status.recoveredExpedition = snapshot.expeditions.some((item) => item.status === 'active');
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

  async function startCurrentStep(idempotencyKey) {
    requireRepository();
    const step = snapshot.steps.find((item) => item.status === 'active');
    if (!step) throw new Error('ACTIVE_STEP_NOT_FOUND');
    const transition = await repository.execute('startStep', {
      stepId: step.id,
      idempotencyKey,
      now: now(),
      idFactory: makeId,
    });
    snapshot = transition.state;
    status.recoveredExpedition = false;
    return transition.result;
  }

  async function reportCurrentExpedition(command) {
    requireRepository();
    const expedition = snapshot.expeditions.find((item) => item.status === 'active');
    if (!expedition) throw new Error('ACTIVE_EXPEDITION_NOT_FOUND');
    const transition = await repository.execute('reportOutcome', {
      ...command,
      expeditionId: expedition.id,
      now: now(),
      idFactory: makeId,
    });
    snapshot = transition.state;
    await afterSignificantCommit();
    return transition.result;
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

  async function exportJson() {
    requireRepository();
    const value = root.StepQuestV02Backup.buildExport(await repository.exportRecords(), now());
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
    createGoal,
    importAccountProgress,
    keepLocalProfileEmpty,
    startCurrentStep,
    reportCurrentExpedition,
    resumeCurrentStep,
    undeferCurrentStep,
    routeCurrentObstacle,
    exportJson,
    enableExternalBackup,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
