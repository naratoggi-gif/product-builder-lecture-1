(function exposeStorage(root) {
  const DB_NAME = 'stepquest';
  const DB_VERSION = 2;
  const ACTIVE_KEY = 'stepquest_v02_active';
  const FALLBACK_STATE_KEY = 'stepquest_v02_fallback_state';
  const FALLBACK_BACKUPS_KEY = 'stepquest_v02_fallback_backups';
  const FALLBACK_META_PREFIX = 'stepquest_v02_meta_';
  const REPOSITORY_MODE_KEY = 'stepquest_v02_repository_mode';
  const HEAD_REVISION_KEY = 'stepquest_v02_head_revision';
  const FALLBACK_REVISION_KEY = 'stepquest_v02_fallback_revision';
  const STATE_STORES = [
    'goals',
    'steps',
    'expeditions',
    'resumeAnchors',
    'events',
    'rewards',
    'wallet',
  ];
  const ALL_STORES = [...STATE_STORES, 'meta', 'backups'];
  const SIGNIFICANT_OPERATIONS = new Set([
    'reportOutcome',
    'routeObstacle',
    'importGoal',
    'upgradeCamp',
  ]);
  const FALLBACK_RECOVERY_META_KEYS = [
    'legacySnapshot',
    'migrationComplete',
    'migrationError',
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('INDEXED_DB_REQUEST_FAILED'));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error('INDEXED_DB_TRANSACTION_ABORTED'));
      transaction.onerror = () => reject(transaction.error || new Error('INDEXED_DB_TRANSACTION_FAILED'));
    });
  }

  function createStore(database, name, options) {
    return database.objectStoreNames.contains(name)
      ? null
      : database.createObjectStore(name, options);
  }

  function ensureIndex(store, name, keyPath) {
    if (store && !store.indexNames.contains(name)) store.createIndex(name, keyPath, { unique: false });
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      let request;
      try {
        request = root.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        reject(error);
        return;
      }
      request.onupgradeneeded = () => {
        const database = request.result;
        createStore(database, 'meta', { keyPath: 'key' });
        createStore(database, 'goals', { keyPath: 'id' });
        const steps = createStore(database, 'steps', { keyPath: 'id' })
          || request.transaction.objectStore('steps');
        ensureIndex(steps, 'goalId', 'goalId');
        ensureIndex(steps, 'status', 'status');
        const expeditions = createStore(database, 'expeditions', { keyPath: 'id' })
          || request.transaction.objectStore('expeditions');
        ensureIndex(expeditions, 'stepId', 'stepId');
        ensureIndex(expeditions, 'status', 'status');
        const anchors = createStore(database, 'resumeAnchors', { keyPath: 'id' })
          || request.transaction.objectStore('resumeAnchors');
        ensureIndex(anchors, 'stepId', 'stepId');
        createStore(database, 'events', { keyPath: 'idempotencyKey' });
        createStore(database, 'rewards', { keyPath: 'idempotencyKey' });
        createStore(database, 'wallet', { keyPath: 'id' });
        createStore(database, 'backups', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error || new Error('INDEXED_DB_OPEN_FAILED'));
      request.onblocked = () => {};
    });
  }

  function isText(value) {
    return typeof value === 'string' && value.length > 0;
  }

  const validators = {
    goals: (value) => isText(value?.id) && isText(value?.title) && isText(value?.status),
    steps: (value) => (
      isText(value?.id)
      && isText(value?.goalId)
      && isText(value?.title)
      && isText(value?.status)
      && isText(value?.phase)
      && isText(value?.rewardLineage)
      && Number.isFinite(value?.orderIndex)
    ),
    expeditions: (value) => isText(value?.id) && isText(value?.stepId) && isText(value?.status),
    resumeAnchors: (value) => (
      isText(value?.id) && isText(value?.stepId) && isText(value?.nextPhysicalAction)
    ),
    events: (value) => isText(value?.idempotencyKey) && isText(value?.type),
    rewards: (value) => (
      isText(value?.idempotencyKey)
      && (value?.currency === 'stepCoin' || value?.currency === 'gold')
      && Number.isFinite(value?.amount)
    ),
  };

  function normalizeWallet(value) {
    return {
      stepCoin: Number.isFinite(value?.stepCoin) ? value.stepCoin : 0,
      gold: Number.isFinite(value?.gold) ? value.gold : 0,
    };
  }

  function normalizeCamp(value) {
    const level = Number(value?.level);
    return {
      level: Number.isFinite(level) ? Math.max(0, Math.min(5, Math.trunc(level))) : 0,
    };
  }

  function hasDomainState(state) {
    return Boolean(
      state.goals?.length
      || state.steps?.length
      || state.expeditions?.length
      || state.resumeAnchors?.length
      || state.events?.length
      || state.rewards?.length
      || Number(state.wallet?.stepCoin || 0)
      || Number(state.wallet?.gold || 0)
      || Number(state.camp?.level || 0),
    );
  }

  function readLocalRevision(key) {
    const raw = root.localStorage.getItem(key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  function fallbackMirrorHealthy() {
    const headRevision = readLocalRevision(HEAD_REVISION_KEY);
    const fallbackRevision = readLocalRevision(FALLBACK_REVISION_KEY);
    return Boolean(
      root.localStorage.getItem(FALLBACK_STATE_KEY)
      && headRevision !== null
      && headRevision === fallbackRevision,
    );
  }

  function adoptRevisionlessFallback(authority) {
    if (
      authority !== 'localStorage'
      || !root.localStorage.getItem(FALLBACK_STATE_KEY)
      || readLocalRevision(HEAD_REVISION_KEY) !== null
      || readLocalRevision(FALLBACK_REVISION_KEY) !== null
    ) return false;
    try {
      root.localStorage.setItem(HEAD_REVISION_KEY, '0');
      root.localStorage.setItem(FALLBACK_REVISION_KEY, '0');
      return true;
    } catch (_error) {
      try { root.localStorage.removeItem(FALLBACK_REVISION_KEY); } catch (_removeError) { /* no-op */ }
      return false;
    }
  }

  function prepareMirrorRevision(revision) {
    try {
      root.localStorage.setItem(HEAD_REVISION_KEY, String(revision));
      return true;
    } catch (_error) {
      try { root.localStorage.removeItem(FALLBACK_REVISION_KEY); } catch (_removeError) { /* no-op */ }
      return false;
    }
  }

  function mirrorFallbackState(state, revision) {
    try {
      root.localStorage.setItem(HEAD_REVISION_KEY, String(revision));
      root.localStorage.setItem(FALLBACK_STATE_KEY, JSON.stringify(state));
      root.localStorage.setItem(FALLBACK_REVISION_KEY, String(revision));
      return true;
    } catch (_error) {
      try { root.localStorage.removeItem(FALLBACK_REVISION_KEY); } catch (_removeError) { /* no-op */ }
      return false;
    }
  }

  function partitionRecords(records) {
    const invalid = [];
    const state = {
      schemaVersion: 2,
      goals: [],
      steps: [],
      expeditions: [],
      resumeAnchors: [],
      events: [],
      rewards: [],
      wallet: normalizeWallet(records.wallet),
      camp: normalizeCamp(records.camp),
    };
    Object.keys(validators).forEach((storeName) => {
      (records[storeName] || []).forEach((value) => {
        if (validators[storeName](value)) state[storeName].push(value);
        else invalid.push({ storeName, key: value?.id || value?.idempotencyKey, value });
      });
    });
    return { state, invalid };
  }

  async function readRecords(transaction) {
    const requests = {
      goals: requestResult(transaction.objectStore('goals').getAll()),
      steps: requestResult(transaction.objectStore('steps').getAll()),
      expeditions: requestResult(transaction.objectStore('expeditions').getAll()),
      resumeAnchors: requestResult(transaction.objectStore('resumeAnchors').getAll()),
      events: requestResult(transaction.objectStore('events').getAll()),
      rewards: requestResult(transaction.objectStore('rewards').getAll()),
      wallet: requestResult(transaction.objectStore('wallet').get('main')),
      camp: requestResult(transaction.objectStore('wallet').get('camp')),
    };
    const values = await Promise.all(Object.values(requests));
    return Object.keys(requests).reduce((result, key, index) => {
      result[key] = values[index];
      return result;
    }, {});
  }

  function writeState(transaction, state) {
    ['goals', 'steps', 'expeditions', 'resumeAnchors'].forEach((storeName) => {
      const store = transaction.objectStore(storeName);
      store.clear();
      state[storeName].forEach((value) => store.put(clone(value)));
    });
    state.events.forEach((value) => transaction.objectStore('events').put(clone(value)));
    state.rewards.forEach((value) => transaction.objectStore('rewards').put(clone(value)));
    transaction.objectStore('wallet').put({ id: 'main', ...normalizeWallet(state.wallet) });
    transaction.objectStore('wallet').put({ id: 'camp', ...normalizeCamp(state.camp) });
  }

  function replaceState(transaction, state) {
    ['goals', 'steps', 'expeditions', 'resumeAnchors', 'events', 'rewards', 'wallet']
      .forEach((storeName) => transaction.objectStore(storeName).clear());
    writeState(transaction, state);
  }

  function putQuarantine(transaction, invalid, now) {
    if (!invalid.length) return;
    const meta = transaction.objectStore('meta');
    meta.put({ key: 'lastQuarantineCount', value: invalid.length });
    meta.put({
      key: `quarantine:${now}`,
      value: invalid.map((item) => ({ storeName: item.storeName, value: item.value })),
    });
    invalid.forEach((item) => {
      if (item.key !== undefined && transaction.objectStoreNames.contains(item.storeName)) {
        transaction.objectStore(item.storeName).delete(item.key);
      }
    });
  }

  async function rotateBackups(transaction, snapshot, operation, now) {
    const store = transaction.objectStore('backups');
    const existing = await requestResult(store.getAll());
    const id = `${now}:${operation}:${Math.random().toString(16).slice(2)}`;
    store.put({ id, operation, createdAt: now, snapshot: clone(snapshot) });
    existing
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .slice(4)
      .forEach((item) => store.delete(item.id));
  }

  function abortQuietly(transaction) {
    try {
      transaction.abort();
    } catch (_error) {
      // The transaction may already have completed or aborted.
    }
  }

  function phaseForLegacy(item, index, all) {
    if (item.phase) return item.phase;
    if (index === 0) return 'orient';
    if (index === 1) return 'open';
    if (index === all.length - 1) return 'close';
    return 'start';
  }

  function legacyStepStatus(status) {
    return {
      OPEN: 'active',
      PENDING: 'pending',
      DONE: 'completed',
      DEFERRED: 'deferred',
      SKIPPED: 'skipped',
      REPLACED: 'replaced',
    }[status] || 'pending';
  }

  function buildLegacyState(legacy, command, Domain) {
    const state = Domain.createInitialState();
    state.wallet = {
      stepCoin: Number(legacy?.player?.goalCoin || 0),
      gold: (legacy?.village || []).reduce((sum, item) => sum + Number(item?.material || 0), 0),
    };
    const weekly = Array.isArray(legacy?.weekly) ? legacy.weekly : [];
    const activeWeekly = weekly.find((item) => item.status === 'ACTIVE') || weekly[0];
    if (activeWeekly) {
      const goalId = String(activeWeekly.id);
      state.goals.push({
        id: goalId,
        title: String(activeWeekly.title || '이전 목표'),
        type: activeWeekly.category || 'project',
        status: activeWeekly.status === 'DONE' ? 'completed' : 'active',
        createdAt: activeWeekly.createdAt || command.now,
        updatedAt: command.now,
      });
      const micro = (Array.isArray(legacy?.micro) ? legacy.micro : [])
        .filter((item) => String(item.weeklyMissionId) === goalId);
      const rawSteps = micro.map((item, index, all) => ({
        id: String(item.id),
        goalId,
        title: String(item.title || '이전 스텝'),
        nextPhysicalAction: String(item.nextPhysicalAction || item.title || '다음 행동 확인'),
        phase: phaseForLegacy(item, index, all),
        rewardLineage: String(item.rewardLineage || item.id),
        status: legacyStepStatus(item.status),
        orderIndex: index,
        createdAt: item.createdAt || command.now,
        updatedAt: command.now,
      }));
      let activeSeen = false;
      rawSteps.forEach((step) => {
        if (step.status !== 'active') return;
        if (activeSeen) step.status = 'pending';
        activeSeen = true;
      });
      if (!activeSeen) {
        const next = rawSteps.find((step) => step.status === 'pending');
        if (next && state.goals[0].status === 'active') next.status = 'active';
      }
      state.steps.push(...Domain.assignEntrySegments(rawSteps, command.idFactory));
    }
    (Array.isArray(legacy?.attempts) ? legacy.attempts : []).forEach((attempt, index) => {
      const action = String(attempt.action || 'recorded');
      state.events.push({
        idempotencyKey: `legacy:attempt:${attempt.id ?? index}`,
        type: `legacy_${action}`,
        stepId: attempt.stepId === undefined ? undefined : String(attempt.stepId),
        reason: attempt.reason || undefined,
        createdAt: attempt.createdAt || command.now,
        result: { imported: true },
      });
    });
    return state;
  }

  function createIndexedDbRepository(database, Domain) {
    async function getSnapshot() {
      const transaction = database.transaction(STATE_STORES, 'readonly');
      const done = transactionDone(transaction);
      const records = await readRecords(transaction);
      await done;
      const { state, invalid } = partitionRecords(records);
      if (invalid.length) {
        const quarantine = database.transaction([...new Set(['meta', ...invalid.map((item) => item.storeName)])], 'readwrite');
        const quarantineDone = transactionDone(quarantine);
        putQuarantine(quarantine, invalid, new Date().toISOString());
        await quarantineDone;
      }
      return state;
    }

    async function setMeta(key, value) {
      const transaction = database.transaction('meta', 'readwrite');
      const done = transactionDone(transaction);
      transaction.objectStore('meta').put({ key, value });
      await done;
      return value;
    }

    async function getMeta(key) {
      const transaction = database.transaction('meta', 'readonly');
      const done = transactionDone(transaction);
      const record = await requestResult(transaction.objectStore('meta').get(key));
      await done;
      return record?.value;
    }

    async function execute(operation, command) {
      const transition = Domain[operation];
      if (typeof transition !== 'function') throw new Error(`UNKNOWN_DOMAIN_OPERATION:${operation}`);
      const transaction = database.transaction(ALL_STORES, 'readwrite');
      const done = transactionDone(transaction);
      try {
        const revisionRequest = requestResult(transaction.objectStore('meta').get('stateRevision'));
        const { state, invalid } = partitionRecords(await readRecords(transaction));
        const revisionRecord = await revisionRequest;
        const currentRevision = Number(revisionRecord?.value || 0);
        putQuarantine(transaction, invalid, command.now || new Date().toISOString());
        const outcome = transition(state, command);
        if (!outcome.duplicate) {
          const nextRevision = currentRevision + 1;
          prepareMirrorRevision(nextRevision);
          writeState(transaction, outcome.state);
          transaction.objectStore('meta').put({ key: 'stateRevision', value: nextRevision });
          if (SIGNIFICANT_OPERATIONS.has(operation)) {
            await rotateBackups(
              transaction,
              outcome.state,
              operation,
              command.now || new Date().toISOString(),
            );
          }
        }
        await done;
        mirrorFallbackState(outcome.state, outcome.duplicate ? currentRevision : currentRevision + 1);
        return { ...outcome, state: clone(outcome.state) };
      } catch (error) {
        abortQuietly(transaction);
        try { await done; } catch (_transactionError) { /* preserve the domain error */ }
        throw error;
      }
    }

    async function importGoal(made, command) {
      return execute('importGoal', { ...command, made });
    }

    async function migrateLegacy(legacy, command) {
      const transaction = database.transaction(ALL_STORES, 'readwrite');
      const done = transactionDone(transaction);
      try {
        const revisionRequest = requestResult(transaction.objectStore('meta').get('stateRevision'));
        const records = await readRecords(transaction);
        const revisionRecord = await revisionRequest;
        const { state: existing } = partitionRecords(records);
        if (existing.goals.length) {
          await done;
          return { migrated: false, reason: 'LOCAL_STATE_EXISTS' };
        }
        const next = buildLegacyState(legacy, command, Domain);
        const nextRevision = Number(revisionRecord?.value || 0) + 1;
        prepareMirrorRevision(nextRevision);
        writeState(transaction, next);
        transaction.objectStore('meta').put({ key: 'stateRevision', value: nextRevision });
        transaction.objectStore('meta').put({ key: 'legacySnapshot', value: clone(legacy) });
        transaction.objectStore('meta').put({
          key: 'migrationComplete',
          value: { idempotencyKey: command.idempotencyKey, completedAt: command.now },
        });
        await done;
        mirrorFallbackState(next, nextRevision);
        root.localStorage.setItem(ACTIVE_KEY, '1');
        return { migrated: true, snapshot: clone(next) };
      } catch (error) {
        abortQuietly(transaction);
        try { await done; } catch (_transactionError) { /* record the original error below */ }
        await setMeta('migrationError', { message: error.message, failedAt: command.now });
        return { migrated: false, reason: 'MIGRATION_FAILED', error: error.message };
      }
    }

    async function exportRecords() {
      const state = await getSnapshot();
      const transaction = database.transaction('backups', 'readonly');
      const done = transactionDone(transaction);
      const backups = await requestResult(transaction.objectStore('backups').getAll());
      await done;
      return { ...state, backups };
    }

    async function recoverFallback(state, backups = [], revision = 0, metadata = {}) {
      const transaction = database.transaction(ALL_STORES, 'readwrite');
      const done = transactionDone(transaction);
      try {
        const { state: previous } = partitionRecords(await readRecords(transaction));
        if (hasDomainState(previous)) {
          await rotateBackups(
            transaction,
            previous,
            'fallback_recovery_previous',
            new Date().toISOString(),
          );
        }
        replaceState(transaction, state);
        const backupStore = transaction.objectStore('backups');
        backups.forEach((backup) => backupStore.put(clone(backup)));
        const mergedBackups = await requestResult(backupStore.getAll());
        mergedBackups
          .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
          .slice(5)
          .forEach((backup) => backupStore.delete(backup.id));
        transaction.objectStore('meta').put({
          key: 'fallbackRecovery',
          value: { completedAt: new Date().toISOString() },
        });
        transaction.objectStore('meta').put({ key: 'stateRevision', value: revision });
        Object.entries(metadata).forEach(([key, value]) => {
          if (value !== undefined) transaction.objectStore('meta').put({ key, value: clone(value) });
        });
        await done;
        mirrorFallbackState(state, revision);
        return clone(state);
      } catch (error) {
        abortQuietly(transaction);
        try { await done; } catch (_transactionError) { /* preserve recovery error */ }
        throw error;
      }
    }

    return {
      mode: 'indexedDB',
      getSnapshot,
      execute,
      importGoal,
      migrateLegacy,
      getMeta,
      setMeta,
      exportRecords,
      recoverFallback,
    };
  }

  function readFallbackState(Domain) {
    const raw = root.localStorage.getItem(FALLBACK_STATE_KEY);
    if (!raw) return Domain.createInitialState();
    try {
      return JSON.parse(raw);
    } catch (error) {
      root.localStorage.setItem(
        `${FALLBACK_META_PREFIX}corruptState`,
        JSON.stringify({ raw, message: error.message, quarantinedAt: new Date().toISOString() }),
      );
      return Domain.createInitialState();
    }
  }

  function readFallbackBackups() {
    try {
      return JSON.parse(root.localStorage.getItem(FALLBACK_BACKUPS_KEY) || '[]');
    } catch (_error) {
      return [];
    }
  }

  function createFallbackRepository(Domain, options = {}) {
    function assertWritable() {
      if (options.writable === false) throw new Error('FALLBACK_STALE_READ_ONLY');
    }

    function setMeta(key, value) {
      root.localStorage.setItem(`${FALLBACK_META_PREFIX}${key}`, JSON.stringify(value));
      return Promise.resolve(value);
    }

    function getMeta(key) {
      const raw = root.localStorage.getItem(`${FALLBACK_META_PREFIX}${key}`);
      if (raw === null) return Promise.resolve(undefined);
      try {
        return Promise.resolve(JSON.parse(raw));
      } catch (_error) {
        return Promise.resolve(undefined);
      }
    }

    async function getSnapshot() {
      const { state, invalid } = partitionRecords(readFallbackState(Domain));
      if (invalid.length) {
        await setMeta('lastQuarantineCount', invalid.length);
        await setMeta(`quarantine:${new Date().toISOString()}`, invalid);
        if (options.writable !== false) saveState(state);
      }
      return state;
    }

    function saveState(state) {
      assertWritable();
      const revision = Math.max(
        readLocalRevision(HEAD_REVISION_KEY) || 0,
        readLocalRevision(FALLBACK_REVISION_KEY) || 0,
      ) + 1;
      root.localStorage.setItem(HEAD_REVISION_KEY, String(revision));
      root.localStorage.setItem(FALLBACK_STATE_KEY, JSON.stringify(state));
      root.localStorage.setItem(FALLBACK_REVISION_KEY, String(revision));
      if (options.markAuthorityOnWrite !== false) {
        root.localStorage.setItem(REPOSITORY_MODE_KEY, 'localStorage');
      }
    }

    function rotateFallbackBackups(snapshot, operation, now) {
      const backups = readFallbackBackups();
      backups.push({
        id: `${now}:${operation}:${Math.random().toString(16).slice(2)}`,
        operation,
        createdAt: now,
        snapshot: clone(snapshot),
      });
      backups.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
      root.localStorage.setItem(FALLBACK_BACKUPS_KEY, JSON.stringify(backups.slice(0, 5)));
    }

    async function execute(operation, command) {
      assertWritable();
      const transition = Domain[operation];
      if (typeof transition !== 'function') throw new Error(`UNKNOWN_DOMAIN_OPERATION:${operation}`);
      const state = await getSnapshot();
      const outcome = transition(state, command);
      if (!outcome.duplicate) {
        if (SIGNIFICANT_OPERATIONS.has(operation)) {
          rotateFallbackBackups(
            outcome.state,
            operation,
            command.now || new Date().toISOString(),
          );
        }
        saveState(outcome.state);
      }
      return { ...outcome, state: clone(outcome.state) };
    }

    async function importGoal(made, command) {
      return execute('importGoal', { ...command, made });
    }

    async function migrateLegacy(legacy, command) {
      assertWritable();
      try {
        const existing = await getSnapshot();
        if (existing.goals.length) return { migrated: false, reason: 'LOCAL_STATE_EXISTS' };
        const next = buildLegacyState(legacy, command, Domain);
        await setMeta('legacySnapshot', clone(legacy));
        await setMeta('migrationComplete', {
          idempotencyKey: command.idempotencyKey,
          completedAt: command.now,
        });
        root.localStorage.setItem(ACTIVE_KEY, '1');
        saveState(next);
        return { migrated: true, snapshot: clone(next) };
      } catch (error) {
        await setMeta('migrationError', { message: error.message, failedAt: command.now });
        return { migrated: false, reason: 'MIGRATION_FAILED', error: error.message };
      }
    }

    async function exportRecords() {
      return { ...await getSnapshot(), backups: readFallbackBackups() };
    }

    return {
      mode: 'localStorage',
      getSnapshot,
      execute,
      importGoal,
      migrateLegacy,
      getMeta,
      setMeta,
      exportRecords,
    };
  }

  async function openRepository() {
    const Domain = root.StepQuestV02Domain;
    if (!Domain) throw new Error('STEPQUEST_V02_DOMAIN_NOT_LOADED');
    try {
      const database = await openDatabase();
      const repository = createIndexedDbRepository(database, Domain);
      const authority = root.localStorage.getItem(REPOSITORY_MODE_KEY);
      adoptRevisionlessFallback(authority);
      const fallbackRepository = createFallbackRepository(Domain, {
        markAuthorityOnWrite: false,
        writable: fallbackMirrorHealthy() || !root.localStorage.getItem(FALLBACK_STATE_KEY),
      });
      const [indexedState, fallbackState, indexedRevisionValue] = await Promise.all([
        repository.getSnapshot(),
        fallbackRepository.getSnapshot(),
        repository.getMeta('stateRevision'),
      ]);
      const fallbackMetadataValues = await Promise.all(
        FALLBACK_RECOVERY_META_KEYS.map((key) => fallbackRepository.getMeta(key)),
      );
      const fallbackMetadata = FALLBACK_RECOVERY_META_KEYS.reduce((result, key, index) => {
        result[key] = fallbackMetadataValues[index];
        return result;
      }, {});
      const indexedRevision = Number(indexedRevisionValue || 0);
      const fallbackRevision = readLocalRevision(FALLBACK_REVISION_KEY) || 0;
      const fallbackAhead = fallbackRevision > indexedRevision;
      const fallbackHasMigration = fallbackMetadata.migrationComplete !== undefined;
      if (
        authority === 'localStorage'
        && hasDomainState(fallbackState)
        && !fallbackMirrorHealthy()
      ) {
        database.close();
        return createFallbackRepository(Domain, {
          markAuthorityOnWrite: false,
          writable: false,
        });
      }
      if (
        fallbackMirrorHealthy()
        && (hasDomainState(fallbackState) || fallbackHasMigration || fallbackAhead)
        && (
          authority === 'localStorage'
          || fallbackAhead
          || (!authority && !hasDomainState(indexedState))
        )
      ) {
        await repository.recoverFallback(
          fallbackState,
          readFallbackBackups(),
          fallbackRevision,
          fallbackMetadata,
        );
      } else {
        mirrorFallbackState(indexedState, indexedRevision);
      }
      root.localStorage.setItem(REPOSITORY_MODE_KEY, 'indexedDB');
      if (
        root.localStorage.getItem(ACTIVE_KEY) !== '1'
        && await repository.getMeta('migrationComplete')
      ) {
        root.localStorage.setItem(ACTIVE_KEY, '1');
      }
      return repository;
    } catch (_error) {
      const authority = root.localStorage.getItem(REPOSITORY_MODE_KEY);
      adoptRevisionlessFallback(authority);
      const hasFallback = Boolean(root.localStorage.getItem(FALLBACK_STATE_KEY));
      const fallbackRepository = createFallbackRepository(Domain, {
        markAuthorityOnWrite: true,
        writable: !hasFallback || !authority || fallbackMirrorHealthy(),
      });
      if (
        root.localStorage.getItem(ACTIVE_KEY) !== '1'
        && await fallbackRepository.getMeta('migrationComplete')
      ) {
        root.localStorage.setItem(ACTIVE_KEY, '1');
      }
      return fallbackRepository;
    }
  }

  root.StepQuestV02Storage = { openRepository };
})(typeof globalThis !== 'undefined' ? globalThis : window);
