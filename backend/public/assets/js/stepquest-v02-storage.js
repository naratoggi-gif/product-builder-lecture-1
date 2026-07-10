(function exposeStorage(root) {
  const DB_NAME = 'stepquest';
  const DB_VERSION = 2;
  const ACTIVE_KEY = 'stepquest_v02_active';
  const FALLBACK_STATE_KEY = 'stepquest_v02_fallback_state';
  const FALLBACK_BACKUPS_KEY = 'stepquest_v02_fallback_backups';
  const FALLBACK_META_PREFIX = 'stepquest_v02_meta_';
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
  const SIGNIFICANT_OPERATIONS = new Set(['reportOutcome', 'routeObstacle', 'importGoal']);

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
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('INDEXED_DB_OPEN_FAILED'));
      request.onblocked = () => reject(new Error('INDEXED_DB_OPEN_BLOCKED'));
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
      transaction.objectStore('meta').put({ key, value: clone(value) });
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
        const { state, invalid } = partitionRecords(await readRecords(transaction));
        putQuarantine(transaction, invalid, command.now || new Date().toISOString());
        const outcome = transition(state, command);
        if (!outcome.duplicate) {
          writeState(transaction, outcome.state);
          if (SIGNIFICANT_OPERATIONS.has(operation)) {
            await rotateBackups(transaction, state, operation, command.now || new Date().toISOString());
          }
        }
        await done;
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
        const records = await readRecords(transaction);
        const { state: existing } = partitionRecords(records);
        if (existing.goals.length) {
          await done;
          return { migrated: false, reason: 'LOCAL_STATE_EXISTS' };
        }
        const next = buildLegacyState(legacy, command, Domain);
        writeState(transaction, next);
        transaction.objectStore('meta').put({ key: 'legacySnapshot', value: clone(legacy) });
        transaction.objectStore('meta').put({
          key: 'migrationComplete',
          value: { idempotencyKey: command.idempotencyKey, completedAt: command.now },
        });
        await done;
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
      const transaction = database.transaction(ALL_STORES, 'readonly');
      const done = transactionDone(transaction);
      const entries = await Promise.all(ALL_STORES.map(async (storeName) => [
        storeName,
        await requestResult(transaction.objectStore(storeName).getAll()),
      ]));
      await done;
      return Object.fromEntries(entries);
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

  function createFallbackRepository(Domain) {
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
        root.localStorage.setItem(FALLBACK_STATE_KEY, JSON.stringify(state));
      }
      return state;
    }

    function saveState(state) {
      root.localStorage.setItem(FALLBACK_STATE_KEY, JSON.stringify(state));
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
      const transition = Domain[operation];
      if (typeof transition !== 'function') throw new Error(`UNKNOWN_DOMAIN_OPERATION:${operation}`);
      const state = await getSnapshot();
      const outcome = transition(state, command);
      if (!outcome.duplicate) {
        if (SIGNIFICANT_OPERATIONS.has(operation)) {
          rotateFallbackBackups(state, operation, command.now || new Date().toISOString());
        }
        saveState(outcome.state);
      }
      return { ...outcome, state: clone(outcome.state) };
    }

    async function importGoal(made, command) {
      return execute('importGoal', { ...command, made });
    }

    async function migrateLegacy(legacy, command) {
      try {
        const existing = await getSnapshot();
        if (existing.goals.length) return { migrated: false, reason: 'LOCAL_STATE_EXISTS' };
        const next = buildLegacyState(legacy, command, Domain);
        saveState(next);
        await setMeta('legacySnapshot', clone(legacy));
        await setMeta('migrationComplete', {
          idempotencyKey: command.idempotencyKey,
          completedAt: command.now,
        });
        root.localStorage.setItem(ACTIVE_KEY, '1');
        return { migrated: true, snapshot: clone(next) };
      } catch (error) {
        await setMeta('migrationError', { message: error.message, failedAt: command.now });
        return { migrated: false, reason: 'MIGRATION_FAILED', error: error.message };
      }
    }

    async function exportRecords() {
      return {
        snapshot: await getSnapshot(),
        backups: readFallbackBackups(),
      };
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
      return createIndexedDbRepository(database, Domain);
    } catch (_error) {
      return createFallbackRepository(Domain);
    }
  }

  root.StepQuestV02Storage = { openRepository };
})(typeof globalThis !== 'undefined' ? globalThis : window);
