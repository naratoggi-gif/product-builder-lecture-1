import { expect, test } from '@playwright/test';

async function resetV02(page) {
  await page.goto('/goals.html');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('stepquest');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(page.locator('#v02-goal-title')).toBeVisible();
}

async function createGoal(page, title) {
  await page.locator('#v02-goal-title').fill(title);
  await page.locator('#v02-create-goal').click();
  await expect(page.locator('#v02-start-step')).toBeVisible();
}

async function createAndStart(page, title) {
  await createGoal(page, title);
  await page.locator('#v02-start-step').click();
  await expect(page.locator('#v02-expedition-active')).toContainText('앱을 닫아도 됩니다.');
}

test('partial progress restores a Resume Anchor after reload', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, '기획서 이어 쓰기');
  await page.reload();
  await expect(page.locator('#v02-return-report')).toBeVisible();
  await page.locator('[data-v02-outcome="partial"]').click();
  await page.locator('#v02-last-action').fill('첫 문장을 썼음');
  await page.locator('#v02-next-action').fill('둘째 문장 첫 단어 쓰기');
  await page.reload();
  await expect(page.locator('#v02-next-action')).toHaveValue('둘째 문장 첫 단어 쓰기');
  await expect(page.locator('#v02-last-action')).toHaveValue('첫 문장을 썼음');
  await page.locator('#v02-save-outcome').click();
  await expect(page.locator('#v02-resume-anchor')).toContainText('둘째 문장 첫 단어 쓰기');
  await page.reload();
  await expect(page.locator('#v02-resume-anchor')).toContainText('둘째 문장 첫 단어 쓰기');
  await page.locator('#v02-resume-step').click();
  await expect(page.locator('#v02-start-step')).toBeVisible();
});

test('completed advances exactly one step', async ({ page }) => {
  await resetV02(page);
  await createGoal(page, '공부 시작하기');
  const before = await page.locator('[data-v02-current-step]').innerText();
  await page.locator('#v02-start-step').click();
  await expect(page.locator('#v02-expedition-active')).toBeVisible();
  await page.reload();
  await page.locator('[data-v02-outcome="completed"]').click();
  await expect(page.locator('[data-v02-current-step]')).not.toHaveText(before);
});

test('interrupted requires and restores a Resume Anchor', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, '글쓰기 시작하기');
  await page.reload();
  await page.locator('[data-v02-outcome="interrupted"]').click();
  await page.locator('#v02-save-outcome').click();
  await expect(page.locator('#v02-next-action')).toBeFocused();
  await page.locator('#v02-next-action').fill('마지막 문장 아래 이름 쓰기');
  await page.locator('#v02-save-outcome').click();
  await expect(page.locator('#v02-resume-anchor')).toContainText('마지막 문장 아래 이름 쓰기');
  await page.reload();
  await expect(page.locator('#v02-resume-anchor')).toContainText('마지막 문장 아래 이름 쓰기');
});

test('manual shrink twice preserves reward lineage and wallet balance', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, '방 청소하기');
  const wallet = await page.locator('#v02-wallet').innerText();

  await page.reload();
  await page.locator('[data-v02-outcome="not_started"]').click();
  await page.locator('[data-v02-reason="too_big"]').click();
  await page.locator('#v02-smaller-action').fill('바닥 한 칸 보기');
  await page.locator('#v02-manual-shrink').click();
  await expect(page.locator('[data-v02-current-step]')).toHaveText('바닥 한 칸 보기');
  await page.reload();
  await expect(page.locator('[data-v02-current-step]')).toHaveText('바닥 한 칸 보기');
  await page.locator('#v02-start-step').click();
  await expect(page.locator('#v02-expedition-active')).toBeVisible();
  await expect(page.locator('#v02-wallet')).toHaveText(wallet);

  await page.reload();
  await page.locator('[data-v02-outcome="not_started"]').click();
  await page.locator('[data-v02-reason="too_big"]').click();
  await page.locator('#v02-smaller-action').fill('바닥 먼지 한 점 보기');
  await page.locator('#v02-manual-shrink').click();
  await expect(page.locator('[data-v02-current-step]')).toHaveText('바닥 먼지 한 점 보기');
  await page.reload();
  await page.locator('#v02-start-step').click();
  await expect(page.locator('#v02-expedition-active')).toBeVisible();
  await expect(page.locator('#v02-wallet')).toHaveText(wallet);
});

test('not started can defer and undefer with no wallet change', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, '서류 정리하기');
  const wallet = await page.locator('#v02-wallet').innerText();
  await page.reload();
  await page.locator('[data-v02-outcome="not_started"]').click();
  await expect(page.locator('[data-v02-reason="not_now"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-v02-reason="not_now"]')).toBeVisible();
  await page.locator('[data-v02-reason="not_now"]').click();
  await page.locator('#v02-defer').click();
  await expect(page.locator('#v02-deferred-step')).toBeVisible();
  await page.reload();
  await expect(page.locator('#v02-deferred-step')).toBeVisible();
  await expect(page.locator('#v02-wallet')).toHaveText(wallet);
  await page.locator('#v02-undefer-step').click();
  await expect(page.locator('#v02-start-step')).toBeVisible();
  await expect(page.locator('#v02-wallet')).toHaveText(wallet);
});

test('mis-tap retry returns to start repeatedly without wallet changes', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, 'Retry the same step');
  const wallet = await page.locator('#v02-wallet').innerText();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt === 0) await page.reload();
    else await page.locator('#v02-open-report').click();
    await expect(page.locator('#v02-return-report')).toBeVisible();
    await page.locator('[data-v02-outcome="not_started"]').click();
    await page.locator('#v02-retry-step').click();
    await expect(page.locator('#v02-start-step')).toBeVisible();
    await expect(page.locator('#v02-wallet')).toHaveText(wallet);
    await page.locator('#v02-start-step').click();
    await expect(page.locator('#v02-expedition-active')).toBeVisible();
    await expect(page.locator('#v02-wallet')).toHaveText(wallet);
  }

  const obstacleEvents = await page.evaluate(() => (
    (window as any).StepQuestV02App.getSnapshot().events
      .filter((item) => item.type === 'obstacle_reported')
  ));
  expect(obstacleEvents).toEqual([]);
});

test('return report can go back before committing', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, 'Keep expedition active');
  await page.reload();
  await expect(page.locator('#v02-return-report')).toBeVisible();
  const eventsBefore = await page.evaluate(() => (
    (window as any).StepQuestV02App.getSnapshot().events.length
  ));

  await page.locator('#v02-cancel-report').click();
  await expect(page.locator('#v02-expedition-active')).toBeVisible();
  const eventsAfter = await page.evaluate(() => (
    (window as any).StepQuestV02App.getSnapshot().events.length
  ));
  expect(eventsAfter).toBe(eventsBefore);

  await page.reload();
  await expect(page.locator('#v02-return-report')).toBeVisible();
});

test('legacy direct-retry history reopens its active return report', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, 'Legacy retry compatibility');
  await page.reload();
  await page.locator('[data-v02-outcome="not_started"]').click();
  await expect(page.locator('[data-v02-reason="too_big"]')).toBeVisible();

  await page.evaluate(async () => {
    const state = (window as any).StepQuestV02App.getSnapshot();
    const step = state.steps.find((item) => item.status === 'active');
    if (!step) throw new Error('Expected an active step for the legacy retry fixture');
    const report = state.events.find((item) => (
      item.type === 'expedition_reported'
      && item.outcome === 'not_started'
      && item.stepId === step.id
    ));
    if (!report) throw new Error('Expected a not-started report for the legacy retry fixture');
    const retryAt = new Date(new Date(report.createdAt).getTime() + 1).toISOString();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('stepquest', 2);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['steps', 'expeditions', 'events'], 'readwrite');
        transaction.objectStore('steps').put({
          ...step,
          status: 'started',
          updatedAt: retryAt,
        });
        transaction.objectStore('expeditions').put({
          id: 'legacy-retry-expedition',
          stepId: step.id,
          status: 'active',
          startedAt: retryAt,
          goldCap: 2,
          goldGranted: 0,
        });
        transaction.objectStore('events').put({
          idempotencyKey: 'legacy-direct-retry-start',
          type: 'step_started',
          stepId: step.id,
          expeditionId: 'legacy-retry-expedition',
          createdAt: retryAt,
          result: {
            stepId: step.id,
            expeditionId: 'legacy-retry-expedition',
            stepCoinGranted: 0,
          },
        });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  });

  await page.reload();
  await expect(page.locator('#v02-return-report')).toBeVisible();
  await expect(page.locator('.v02-obstacle')).toHaveCount(0);
});

test('double click and elapsed time do not multiply rewards', async ({ page }) => {
  await resetV02(page);
  await createGoal(page, '문서 열기');
  await page.locator('#v02-start-step').dblclick();
  await expect(page.locator('#v02-expedition-active')).toBeVisible();
  const before = await page.evaluate(() => {
    const state = (window as any).StepQuestV02App.getSnapshot();
    return {
      wallet: state.wallet,
      rewards: state.rewards.length,
      activeExpeditions: state.expeditions.filter((item) => item.status === 'active').length,
    };
  });
  await page.evaluate(() => {
    const original = Date.now;
    Date.now = () => original() + 1000 * 60 * 60 * 24 * 30;
  });
  const after = await page.evaluate(() => {
    const state = (window as any).StepQuestV02App.getSnapshot();
    return {
      wallet: state.wallet,
      rewards: state.rewards.length,
      activeExpeditions: state.expeditions.filter((item) => item.status === 'active').length,
    };
  });
  expect(after).toEqual(before);
  expect(after.rewards).toBe(1);
  expect(after.activeExpeditions).toBe(1);
});

test('exports valid JSON and rotates five recovery snapshots', async ({ page }) => {
  await resetV02(page);
  await createGoal(page, '백업 확인');
  for (let index = 0; index < 5; index += 1) {
    await page.locator('#v02-start-step').click();
    await page.locator('#v02-open-report').click();
    await page.locator('[data-v02-outcome="completed"]').click();
  }
  const exported = await page.evaluate(() => (window as any).StepQuestV02App.exportJson());
  expect(JSON.parse(exported).schemaVersion).toBe(2);
  const backupCount = await page.evaluate(async () => (
    await (await (window as any).StepQuestV02Storage.openRepository()).exportRecords()
  ).backups.length);
  expect(backupCount).toBe(5);
});

test('writes the latest state to an authorized external file', async ({ page }) => {
  await resetV02(page);
  const supported = await page.evaluate(() => Boolean(navigator.storage?.getDirectory));
  test.skip(!supported, 'OPFS file handles are unavailable in this browser');
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('stepquest-e2e-backup.json', { create: true });
    (window as any).showSaveFilePicker = async () => handle;
  });
  await page.locator('#v02-enable-backup').click();
  await expect.poll(() => page.evaluate(() => (
    (window as any).StepQuestV02App.getStatus().lastExternalBackupAt
  ))).not.toBeNull();
  await createGoal(page, '외부 백업 확인');
  const text = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const file = await (await root.getFileHandle('stepquest-e2e-backup.json')).getFile();
    return file.text();
  });
  expect(JSON.parse(text).goals[0].title).toBe('외부 백업 확인');
});

test('storage persistence denial keeps the app usable and shows backup controls', async ({ page }) => {
  await page.addInitScript(() => {
    const getDirectory = navigator.storage?.getDirectory?.bind(navigator.storage);
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persisted: async () => false,
        persist: async () => false,
        getDirectory,
      },
    });
  });
  await resetV02(page);
  await createGoal(page, '거부 상태 확인');
  await expect(page.locator('.v02-storage-warning')).toBeVisible();
  await expect(page.locator('#v02-export')).toBeVisible();
  await expect(page.locator('#v02-start-step')).toBeVisible();
});

test('mobile actions keep accessible target sizes', async ({ page }) => {
  await resetV02(page);
  await createGoal(page, '모바일 시작 확인');
  const viewport = page.viewportSize();
  if (viewport && viewport.width <= 720) {
    const startBox = await page.locator('#v02-start-step').boundingBox();
    const walletBoxes = await page.locator('#v02-wallet span').evaluateAll((items) => (
      items.map((item) => item.getBoundingClientRect().toJSON())
    ));
    expect(startBox.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(walletBoxes[0].x - walletBoxes[1].x)).toBeLessThan(2);
  }
});
