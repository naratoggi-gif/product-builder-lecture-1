import { expect, test } from '@playwright/test';

const NOW = '2026-07-11T00:00:00.000Z';

async function clearBrowserState(page) {
  await page.goto('/goals.html');
  await expect(page.locator('#v02-goal-title')).toBeVisible();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

test('upgrades v2 character stores without changing existing records', async ({ page }) => {
  await clearBrowserState(page);
  await page.evaluate(async ({ now }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('stepquest');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('DELETE_BLOCKED'));
    });
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('stepquest', 2);
      request.onupgradeneeded = () => {
        const database = request.result;
        database.createObjectStore('meta', { keyPath: 'key' });
        database.createObjectStore('goals', { keyPath: 'id' });
        database.createObjectStore('steps', { keyPath: 'id' });
        database.createObjectStore('expeditions', { keyPath: 'id' });
        database.createObjectStore('resumeAnchors', { keyPath: 'id' });
        database.createObjectStore('events', { keyPath: 'idempotencyKey' });
        database.createObjectStore('rewards', { keyPath: 'idempotencyKey' });
        database.createObjectStore('wallet', { keyPath: 'id' });
        database.createObjectStore('backups', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['goals', 'steps', 'wallet', 'backups'], 'readwrite');
        transaction.objectStore('goals').put({
          id: 'goal-v2', title: 'v2 목표', status: 'active', createdAt: now, updatedAt: now,
        });
        transaction.objectStore('steps').put({
          id: 'step-v2',
          goalId: 'goal-v2',
          title: 'v2 행동',
          nextPhysicalAction: 'v2 행동',
          phase: 'start',
          rewardLineage: 'step-v2',
          status: 'active',
          orderIndex: 0,
          createdAt: now,
          updatedAt: now,
        });
        transaction.objectStore('wallet').put({ id: 'main', stepCoin: 9, gold: 2 });
        transaction.objectStore('backups').put({ id: 'backup-v2', createdAt: now, snapshot: {} });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, { now: NOW });

  await page.reload();
  const result = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('stepquest');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['goals', 'steps', 'wallet', 'backups'], 'readonly');
    const requestValue = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const [goal, step, wallet, backups] = await Promise.all([
      requestValue(transaction.objectStore('goals').get('goal-v2')),
      requestValue(transaction.objectStore('steps').get('step-v2')),
      requestValue(transaction.objectStore('wallet').get('main')),
      requestValue(transaction.objectStore('backups').getAll()),
    ]);
    const value = {
      version: database.version,
      stores: [...database.objectStoreNames],
      goal,
      step,
      wallet,
      backups,
    };
    database.close();
    return value;
  });

  expect(result.version).toBe(3);
  expect(result.stores).toEqual(expect.arrayContaining(['characters', 'assets']));
  expect(result.goal).toMatchObject({ id: 'goal-v2', title: 'v2 목표' });
  expect(result.step).toMatchObject({ id: 'step-v2', goalId: 'goal-v2' });
  expect(result.wallet).toEqual({ id: 'main', stepCoin: 9, gold: 2 });
  expect(result.backups).toEqual([expect.objectContaining({ id: 'backup-v2' })]);
});

test('persists local character blobs outside ordinary exports', async ({ page }) => {
  await clearBrowserState(page);
  const result = await page.evaluate(async ({ now }) => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    const metadata = {
      id: 'local-primary',
      name: '로컬 영웅',
      imageBlobKey: 'character:local-primary:image',
      skillPreset: 'slash',
      skillName: '첫 베기',
      accentColor: '#65d9ff',
      createdAt: now,
      updatedAt: now,
    };
    await repository.saveCharacter(metadata, new Blob(['local-image'], { type: 'image/png' }));
    const saved = await repository.getCharacter();
    const blob = await repository.getCharacterBlob(metadata.imageBlobKey);
    const ordinary = await repository.exportRecords();
    const fullRecords = await repository.exportCharacterAssets();
    return {
      saved,
      blobText: await blob.text(),
      ordinaryCharacters: ordinary.characters,
      ordinaryHasAssets: Object.prototype.hasOwnProperty.call(ordinary, 'assets'),
      rollingCharacters: ordinary.backups[0]?.snapshot?.characters,
      fullCharacterCount: fullRecords.characters.length,
      fullAssetCount: fullRecords.assets.length,
      fullAssetSize: fullRecords.assets[0]?.blob?.size,
    };
  }, { now: NOW });

  expect(result.saved).toMatchObject({ id: 'local-primary', name: '로컬 영웅' });
  expect(result.blobText).toBe('local-image');
  expect(result.ordinaryCharacters).toEqual([expect.objectContaining({ id: 'local-primary' })]);
  expect(result.ordinaryHasAssets).toBe(false);
  expect(result.rollingCharacters).toEqual([expect.objectContaining({ id: 'local-primary' })]);
  expect(result.fullCharacterCount).toBe(1);
  expect(result.fullAssetCount).toBe(1);
  expect(result.fullAssetSize).toBe(11);
});

test('migrates legacy state once and blocks legacy rewrites', async ({ page }) => {
  await clearBrowserState(page);
  const legacy = {
    player: { goalCoin: 9 },
    village: [{ facilityKey: 'archive', material: 3 }],
    weekly: [{
      id: 10,
      title: '기획서 쓰기',
      status: 'ACTIVE',
      category: 'writing',
      createdAt: NOW,
    }],
    micro: [{
      id: 11,
      weeklyMissionId: 10,
      title: '문서 열기',
      status: 'OPEN',
      category: 'writing',
      createdAt: NOW,
    }],
    attempts: [{ id: 1, stepId: 11, action: 'defer', reason: 'not_now', createdAt: NOW }],
  };
  await page.evaluate((value) => {
    localStorage.setItem('stepquest_guest_state', JSON.stringify(value));
  }, legacy);
  const originalBytes = await page.evaluate(() => localStorage.getItem('stepquest_guest_state'));

  const result = await page.evaluate(async ({ now }) => {
    const Storage = (window as any).StepQuestV02Storage;
    const repository = await Storage.openRepository();
    const first = await repository.migrateLegacy(
      JSON.parse(localStorage.getItem('stepquest_guest_state')),
      { idempotencyKey: 'legacy:v02:migration', now, idFactory: (prefix) => `${prefix}-migration` },
    );
    const second = await repository.migrateLegacy(
      JSON.parse(localStorage.getItem('stepquest_guest_state')),
      { idempotencyKey: 'legacy:v02:migration', now, idFactory: (prefix) => `${prefix}-migration` },
    );
    return { first, second, snapshot: await repository.getSnapshot() };
  }, { now: NOW });

  expect(result.first.migrated).toBe(true);
  expect(result.second.migrated).toBe(false);
  expect(result.snapshot.wallet).toEqual({ stepCoin: 9, gold: 3 });
  expect(result.snapshot.goals).toHaveLength(1);
  expect(result.snapshot.steps[0].rewardLineage).toBe('11');
  expect(result.snapshot.events.some((event) => event.type === 'legacy_defer')).toBe(true);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('stepquest_v02_active'))).toBe('1');

  await page.evaluate(() => {
    (window as any).StepQuestApp.__testSaveGuest({ weekly: [], micro: [] });
  });
  expect(await page.evaluate(() => localStorage.getItem('stepquest_guest_state'))).toBe(originalBytes);
});

test('keeps the same active expedition across reload', async ({ page }) => {
  await clearBrowserState(page);
  const expeditionId = await page.evaluate(async ({ now }) => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    await repository.importGoal({
      weekly: { id: 20, title: '원정 테스트', createdAt: now },
      micro: [
        { id: 21, title: '문서 열기', phase: 'open', createdAt: now },
        { id: 22, title: '한 문장 쓰기', phase: 'start', createdAt: now },
      ],
    }, {
      idempotencyKey: 'goal:20:import',
      now,
      idFactory: (prefix) => `${prefix}-20`,
    });
    const started = await repository.execute('startStep', {
      stepId: '21',
      idempotencyKey: 'step:21:start',
      now,
      idFactory: () => 'expedition-20',
    });
    return started.result.expeditionId;
  }, { now: NOW });

  await page.reload();
  const restoredId = await page.evaluate(async () => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    const snapshot = await repository.getSnapshot();
    return snapshot.expeditions.find((item) => item.status === 'active')?.id;
  });
  expect(restoredId).toBe(expeditionId);
});

test('falls back to localStorage when IndexedDB cannot open', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value() { throw new Error('INDEXED_DB_DISABLED_FOR_TEST'); },
    });
  });
  await clearBrowserState(page);

  const beforeReload = await page.evaluate(async ({ now }) => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    await repository.importGoal({
      weekly: { id: 30, title: '대체 저장 테스트', createdAt: now },
      micro: [{ id: 31, title: '파일 열기', phase: 'open', createdAt: now }],
    }, {
      idempotencyKey: 'goal:30:import',
      now,
      idFactory: (prefix) => `${prefix}-30`,
    });
    let saveError = null;
    try {
      await repository.saveCharacter({ id: 'local-primary' }, new Blob(['x']));
    } catch (error) {
      saveError = error.message;
    }
    return {
      mode: repository.mode,
      snapshot: await repository.getSnapshot(),
      character: await repository.getCharacter(),
      characterBlob: await repository.getCharacterBlob('missing'),
      characterRecords: await repository.exportCharacterAssets(),
      saveError,
    };
  }, { now: NOW });
  expect(beforeReload.mode).toBe('localStorage');
  expect(beforeReload.snapshot.goals[0].title).toBe('대체 저장 테스트');
  expect(beforeReload.character).toBeNull();
  expect(beforeReload.characterBlob).toBeNull();
  expect(beforeReload.characterRecords).toEqual({ characters: [], assets: [] });
  expect(beforeReload.saveError).toBe('CHARACTER_IMAGE_STORAGE_UNAVAILABLE');

  await page.reload();
  const afterReload = await page.evaluate(async () => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    return { mode: repository.mode, snapshot: await repository.getSnapshot() };
  });
  expect(afterReload.mode).toBe('localStorage');
  expect(afterReload.snapshot.goals[0].title).toBe('대체 저장 테스트');
});

test('quarantines malformed records and keeps readable state', async ({ page }) => {
  await clearBrowserState(page);
  const result = await page.evaluate(async () => {
    const Storage = (window as any).StepQuestV02Storage;
    const repository = await Storage.openRepository();
    await repository.getSnapshot();

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('stepquest', 3);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('steps', 'readwrite');
        transaction.objectStore('steps').put({ id: 'broken-step', title: '깨진 기록' });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });

    const snapshot = await repository.getSnapshot();
    return {
      containsBroken: snapshot.steps.some((step) => step.id === 'broken-step'),
      quarantinedRecords: await repository.getMeta('lastQuarantineCount'),
    };
  });
  expect(result.containsBroken).toBe(false);
  expect(result.quarantinedRecords).toBe(1);
});

test('exports normalized records and retains five committed snapshots', async ({ page }) => {
  await clearBrowserState(page);
  const records = await page.evaluate(async ({ now }) => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    for (let index = 1; index <= 6; index += 1) {
      await repository.importGoal({
        weekly: { id: `backup-goal-${index}`, title: `백업 목표 ${index}`, createdAt: now },
        micro: [{ id: `backup-step-${index}`, title: `백업 행동 ${index}`, phase: 'start', createdAt: now }],
      }, {
        idempotencyKey: `backup-goal-${index}:import`,
        now: `2026-07-11T00:00:0${index}.000Z`,
        idFactory: (prefix) => `${prefix}-backup-${index}`,
      });
    }
    return repository.exportRecords();
  }, { now: NOW });

  expect(records.wallet).toEqual({ stepCoin: 0, gold: 0 });
  expect(records.backups).toHaveLength(5);
  const latest = records.backups.sort((left, right) => (
    right.createdAt.localeCompare(left.createdAt)
  ))[0];
  expect(latest.snapshot.goals).toHaveLength(6);
});

for (const profile of ['guest', 'signed-in'] as const) {
  test(`creates a ${profile} goal locally without a server goal write`, async ({ page }) => {
    let serverGoalPosts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/stepquest/goals')) {
        serverGoalPosts += 1;
      }
    });
    await clearBrowserState(page);
    const result = await page.evaluate(async (profileValue) => {
      const App = (window as any).StepQuestApp;
      const Core = (window as any).StepQuestV02App;
      App.state.token = profileValue === 'signed-in' ? 'test-token' : '';
      await Core.init({ App, forceRefresh: true });
      await Core.createGoal({
        title: profileValue === 'signed-in' ? '로그인 로컬 목표' : '게스트 로컬 목표',
        category: 'writing',
        burdenLevel: 4,
        energyLevel: 'medium',
      });
      const snapshot = Core.getSnapshot();
      return {
        goals: snapshot.goals,
        activeSteps: snapshot.steps.filter((item) => item.status === 'active'),
      };
    }, profile);

    expect(result.goals).toHaveLength(1);
    expect(result.goals[0].status).toBe('active');
    expect(result.activeSteps).toHaveLength(1);
    expect(serverGoalPosts).toBe(0);
  });
}

test('imports account progress only after an explicit local choice', async ({ page }) => {
  let serverGoalPosts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/stepquest/goals')) {
      serverGoalPosts += 1;
    }
  });
  await clearBrowserState(page);
  const result = await page.evaluate(async ({ now }) => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    App.state.token = 'test-token';
    App.state.weekly = [{
      id: 90,
      title: '계정 목표',
      category: 'writing',
      status: 'ACTIVE',
      createdAt: now,
    }];
    App.state.nextMicro = {
      id: 91,
      weeklyMissionId: 90,
      title: '문서 열기',
      category: 'writing',
      status: 'OPEN',
      createdAt: now,
    };
    await Core.init({ App, forceRefresh: true });
    const before = Core.getStatus();
    const emptyBeforeChoice = Core.getSnapshot().goals.length;
    await Core.importAccountProgress();
    return {
      before,
      emptyBeforeChoice,
      after: Core.getSnapshot(),
    };
  }, { now: NOW });

  expect(result.before.pendingAccountImport).toBe(true);
  expect(result.emptyBeforeChoice).toBe(0);
  expect(result.after.goals[0].title).toBe('계정 목표');
  expect(result.after.steps[0].title).toBe('문서 열기');
  expect(serverGoalPosts).toBe(0);
});

test('does not enable external file handles in localStorage fallback mode', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value() { throw new Error('INDEXED_DB_DISABLED_FOR_TEST'); },
    });
  });
  await clearBrowserState(page);
  const result = await page.evaluate(async () => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    let pickerCalls = 0;
    (window as any).StepQuestV02Backup.chooseExternalFile = async () => {
      pickerCalls += 1;
      return { name: 'must-not-be-used.json' };
    };
    await Core.init({ App, forceRefresh: true });
    return {
      mode: Core.getStatus().mode,
      enabled: await Core.enableExternalBackup(),
      pickerCalls,
    };
  });

  expect(result).toEqual({ mode: 'localStorage', enabled: false, pickerCalls: 0 });
});

test('promotes fallback progress when IndexedDB becomes available again', async ({ page }) => {
  await page.addInitScript(() => {
    const originalOpen = IDBFactory.prototype.open;
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value(...args) {
        if (localStorage.getItem('stepquest_test_allow_indexeddb') !== '1') {
          throw new Error('INDEXED_DB_TRANSIENT_FAILURE');
        }
        return originalOpen.apply(this, args);
      },
    });
  });
  await clearBrowserState(page);

  const fallback = await page.evaluate(async ({ now }) => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    await repository.setMeta('migrationComplete', {
      idempotencyKey: 'legacy:v02:fallback-migration',
      completedAt: now,
    });
    await repository.importGoal({
      weekly: { id: 700, title: '폴백에서 만든 목표', createdAt: now },
      micro: [{ id: 701, title: '폴백 행동', phase: 'start', createdAt: now }],
    }, {
      idempotencyKey: 'goal:700:import',
      now,
      idFactory: (prefix) => `${prefix}-fallback-recovery`,
    });
    localStorage.removeItem('stepquest_v02_active');
    return { mode: repository.mode, snapshot: await repository.getSnapshot() };
  }, { now: NOW });
  expect(fallback.mode).toBe('localStorage');
  expect(fallback.snapshot.goals[0].title).toBe('폴백에서 만든 목표');

  await page.evaluate(() => localStorage.setItem('stepquest_test_allow_indexeddb', '1'));
  await page.reload();
  const recovered = await page.evaluate(async () => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    return {
      mode: repository.mode,
      snapshot: await repository.getSnapshot(),
      migrationComplete: await repository.getMeta('migrationComplete'),
    };
  });
  expect(recovered.mode).toBe('indexedDB');
  expect(recovered.migrationComplete.idempotencyKey).toBe('legacy:v02:fallback-migration');
  expect(await page.evaluate(() => localStorage.getItem('stepquest_v02_active'))).toBe('1');
  expect(recovered.snapshot.goals[0].title).toBe('폴백에서 만든 목표');
  expect(await page.evaluate(() => localStorage.getItem('stepquest_v02_repository_mode'))).toBe('indexedDB');
});

test('repairs a missing legacy write guard from committed migration metadata', async ({ page }) => {
  await clearBrowserState(page);
  await page.evaluate(async () => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    await repository.setMeta('migrationComplete', {
      idempotencyKey: 'legacy:v02:migration',
      completedAt: '2026-07-11T00:00:00.000Z',
    });
    localStorage.removeItem('stepquest_v02_active');
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('stepquest_v02_active'))).toBe('1');
});

test('repairs a missing legacy write guard while IndexedDB remains unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value() { throw new Error('INDEXED_DB_DISABLED_FOR_TEST'); },
    });
  });
  await clearBrowserState(page);
  await page.evaluate(async () => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    await repository.setMeta('migrationComplete', {
      idempotencyKey: 'legacy:v02:fallback-migration',
      completedAt: '2026-07-11T00:00:00.000Z',
    });
    localStorage.removeItem('stepquest_v02_active');
  });

  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('stepquest_v02_active'))).toBe('1');
});

test('keeps stale fallback read-only instead of overwriting newer IndexedDB state', async ({ page }) => {
  await clearBrowserState(page);
  const result = await page.evaluate(async ({ now }) => {
    const StorageApi = (window as any).StepQuestV02Storage;
    const repository = await StorageApi.openRepository();
    const command = (id) => ({
      idempotencyKey: `goal:${id}:import`,
      now,
      idFactory: (prefix) => `${prefix}-${id}`,
    });
    const made = (id, title) => ({
      weekly: { id, title, createdAt: now },
      micro: [{ id: id + 1, title: `${title} 행동`, phase: 'start', createdAt: now }],
    });
    await repository.importGoal(made(800, '미러 기준 목표'), command(800));

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItemWithMirrorFailure(key, value) {
      if (key === 'stepquest_v02_fallback_state') throw new Error('FALLBACK_QUOTA_EXCEEDED');
      return originalSetItem.call(this, key, value);
    };
    await repository.importGoal(made(810, 'IndexedDB 최신 목표'), command(810));
    Storage.prototype.setItem = originalSetItem;

    const originalOpen = IDBFactory.prototype.open;
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value() { throw new Error('INDEXED_DB_TRANSIENT_FAILURE'); },
    });
    const fallback = await StorageApi.openRepository();
    let fallbackWriteError = null;
    try {
      await fallback.importGoal(made(820, '쓰이면 안 되는 목표'), command(820));
    } catch (error) {
      fallbackWriteError = error.message;
    }
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value: originalOpen,
    });

    const recovered = await StorageApi.openRepository();
    return {
      fallbackMode: fallback.mode,
      fallbackWriteError,
      titles: (await recovered.getSnapshot()).goals.map((goal) => goal.title),
    };
  }, { now: NOW });

  expect(result.fallbackMode).toBe('localStorage');
  expect(result.fallbackWriteError).toContain('FALLBACK_STALE_READ_ONLY');
  expect(result.titles).toContain('미러 기준 목표');
  expect(result.titles).toContain('IndexedDB 최신 목표');
  expect(result.titles).not.toContain('쓰이면 안 되는 목표');
});

test('promotes revisionless fallback state created by the previous release', async ({ page }) => {
  await clearBrowserState(page);
  const result = await page.evaluate(async () => {
    const Domain = (window as any).StepQuestV02Domain;
    const state = Domain.createInitialState();
    state.goals.push({
      id: 'legacy-fallback-goal',
      title: 'Previous fallback goal',
      status: 'active',
      createdAt: '2026-07-11T00:00:00.000Z',
      updatedAt: '2026-07-11T00:00:00.000Z',
    });
    state.steps.push({
      id: 'legacy-fallback-step',
      goalId: 'legacy-fallback-goal',
      title: 'Previous fallback step',
      phase: 'start',
      rewardLineage: 'legacy-fallback-step',
      status: 'active',
      orderIndex: 0,
      createdAt: '2026-07-11T00:00:00.000Z',
      updatedAt: '2026-07-11T00:00:00.000Z',
    });
    localStorage.setItem('stepquest_v02_fallback_state', JSON.stringify(state));
    localStorage.setItem('stepquest_v02_repository_mode', 'localStorage');

    const repository = await (window as any).StepQuestV02Storage.openRepository();
    return {
      mode: repository.mode,
      snapshot: await repository.getSnapshot(),
      headRevision: localStorage.getItem('stepquest_v02_head_revision'),
      fallbackRevision: localStorage.getItem('stepquest_v02_fallback_revision'),
    };
  });

  expect(result.mode).toBe('indexedDB');
  expect(result.snapshot.goals[0].title).toBe('Previous fallback goal');
  expect(result.headRevision).toBe(result.fallbackRevision);
});

test('recovers a fallback commit when recording its authority fails', async ({ page }) => {
  await clearBrowserState(page);
  const result = await page.evaluate(async ({ now }) => {
    const StorageApi = (window as any).StepQuestV02Storage;
    const repository = await StorageApi.openRepository();
    const made = (id, title) => ({
      weekly: { id, title, createdAt: now },
      micro: [{ id: id + 1, title: `${title} step`, phase: 'start', createdAt: now }],
    });
    const command = (id) => ({
      idempotencyKey: `goal:${id}:import`,
      now,
      idFactory: (prefix) => `${prefix}-${id}`,
    });
    await repository.importGoal(made(830, 'IndexedDB base goal'), command(830));

    const originalOpen = IDBFactory.prototype.open;
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value() { throw new Error('INDEXED_DB_TRANSIENT_FAILURE'); },
    });
    const fallback = await StorageApi.openRepository();
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItemWithAuthorityFailure(key, value) {
      if (key === 'stepquest_v02_repository_mode') throw new Error('AUTHORITY_WRITE_FAILED');
      return originalSetItem.call(this, key, value);
    };
    try {
      await fallback.importGoal(made(840, 'Fallback committed goal'), command(840));
    } catch (_error) {
      // The state and revision were committed before the authority marker failed.
    }
    Storage.prototype.setItem = originalSetItem;
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value: originalOpen,
    });

    const recovered = await StorageApi.openRepository();
    return (await recovered.getSnapshot()).goals.map((goal) => goal.title);
  }, { now: NOW });

  expect(result).toContain('IndexedDB base goal');
  expect(result).toContain('Fallback committed goal');
});

test('promotes migration metadata even when fallback domain state is empty', async ({ page }) => {
  await page.addInitScript(() => {
    const originalOpen = IDBFactory.prototype.open;
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value(...args) {
        if (localStorage.getItem('stepquest_test_allow_indexeddb') !== '1') {
          throw new Error('INDEXED_DB_TRANSIENT_FAILURE');
        }
        return originalOpen.apply(this, args);
      },
    });
  });
  await clearBrowserState(page);
  const fallbackResult = await page.evaluate(async ({ now }) => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    const migrated = await repository.migrateLegacy({}, {
      idempotencyKey: 'legacy:v02:empty-migration',
      now,
      idFactory: (prefix) => `${prefix}-empty-migration`,
    });
    localStorage.removeItem('stepquest_v02_active');
    return { mode: repository.mode, migrated };
  }, { now: NOW });
  expect(fallbackResult.mode).toBe('localStorage');
  expect(fallbackResult.migrated.migrated).toBe(true);

  await page.evaluate(() => localStorage.setItem('stepquest_test_allow_indexeddb', '1'));
  await page.reload();
  const recovered = await page.evaluate(async () => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    return {
      mode: repository.mode,
      migrationComplete: await repository.getMeta('migrationComplete'),
      active: localStorage.getItem('stepquest_v02_active'),
    };
  });
  expect(recovered.mode).toBe('indexedDB');
  expect(recovered.migrationComplete.idempotencyKey).toBe('legacy:v02:empty-migration');
  expect(recovered.active).toBe('1');
});

for (const failedKey of ['stepquest_v02_meta_migrationComplete', 'stepquest_v02_active']) {
  test(`does not partially commit fallback migration when ${failedKey} cannot be written`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(IDBFactory.prototype, 'open', {
        configurable: true,
        value() { throw new Error('INDEXED_DB_DISABLED_FOR_TEST'); },
      });
    });
    await clearBrowserState(page);
    const result = await page.evaluate(async ({ now, keyToFail }) => {
      const repository = await (window as any).StepQuestV02Storage.openRepository();
      const legacy = {
        weekly: [{ id: 950, title: 'Legacy migration goal', status: 'ACTIVE', createdAt: now }],
        micro: [{
          id: 951,
          weeklyMissionId: 950,
          title: 'Legacy migration step',
          status: 'OPEN',
          createdAt: now,
        }],
      };
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItemWithMigrationFailure(key, value) {
        if (key === keyToFail) throw new Error('MIGRATION_WRITE_FAILED');
        return originalSetItem.call(this, key, value);
      };
      const migrated = await repository.migrateLegacy(legacy, {
        idempotencyKey: `legacy:v02:failed:${keyToFail}`,
        now,
        idFactory: (prefix) => `${prefix}-failed-migration`,
      });
      Storage.prototype.setItem = originalSetItem;
      return {
        migrated,
        snapshot: await repository.getSnapshot(),
        active: localStorage.getItem('stepquest_v02_active'),
      };
    }, { now: NOW, keyToFail: failedKey });

    expect(result.migrated.migrated).toBe(false);
    expect(result.snapshot.goals).toHaveLength(0);
    expect(result.active).toBeNull();
  });
}
