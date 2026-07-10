import { expect, test } from '@playwright/test';

const NOW = '2026-07-11T00:00:00.000Z';

async function clearBrowserState(page) {
  await page.goto('/goals.html');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

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
    return { mode: repository.mode, snapshot: await repository.getSnapshot() };
  }, { now: NOW });
  expect(beforeReload.mode).toBe('localStorage');
  expect(beforeReload.snapshot.goals[0].title).toBe('대체 저장 테스트');

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
      const request = indexedDB.open('stepquest', 2);
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
    await repository.importGoal({
      weekly: { id: 700, title: '폴백에서 만든 목표', createdAt: now },
      micro: [{ id: 701, title: '폴백 행동', phase: 'start', createdAt: now }],
    }, {
      idempotencyKey: 'goal:700:import',
      now,
      idFactory: (prefix) => `${prefix}-fallback-recovery`,
    });
    return { mode: repository.mode, snapshot: await repository.getSnapshot() };
  }, { now: NOW });
  expect(fallback.mode).toBe('localStorage');
  expect(fallback.snapshot.goals[0].title).toBe('폴백에서 만든 목표');

  await page.evaluate(() => localStorage.setItem('stepquest_test_allow_indexeddb', '1'));
  await page.reload();
  const recovered = await page.evaluate(async () => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    return { mode: repository.mode, snapshot: await repository.getSnapshot() };
  });
  expect(recovered.mode).toBe('indexedDB');
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
