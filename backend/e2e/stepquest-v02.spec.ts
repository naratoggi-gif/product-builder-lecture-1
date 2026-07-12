import { expect, test } from '@playwright/test';
import path from 'node:path';

const funScriptPath = path.resolve('public/assets/js/stepquest-v02-fun.js');

function writeUint24LE(buffer: Buffer, offset: number, value: number) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
}

function riffChunk(type: string, payload: Buffer) {
  const header = Buffer.alloc(8);
  header.write(type, 0, 4, 'ascii');
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([
    header,
    payload,
    payload.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0),
  ]);
}

function makeAnimatedWebPBytes(durations: number[], width = 8, height = 8) {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0x02;
  writeUint24LE(vp8x, 4, width - 1);
  writeUint24LE(vp8x, 7, height - 1);
  const frames = durations.map((duration) => {
    const payload = Buffer.alloc(16);
    writeUint24LE(payload, 6, width - 1);
    writeUint24LE(payload, 9, height - 1);
    writeUint24LE(payload, 12, duration);
    return riffChunk('ANMF', payload);
  });
  const body = Buffer.concat([
    Buffer.from('WEBP'),
    riffChunk('VP8X', vp8x),
    riffChunk('ANIM', Buffer.alloc(6)),
    ...frames,
  ]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(body.length, 4);
  return Array.from(Buffer.concat([header, body]));
}

async function installTimerProbe(page) {
  await page.addInitScript(() => {
    const originalSetInterval = window.setInterval.bind(window);
    const originalClearInterval = window.clearInterval.bind(window);
    const activeIds = new Set();
    const probe = {
      created: 0,
      cleared: 0,
      active: 0,
      delays: [],
    };
    (window as any).__slice6TimerProbe = probe;
    (window as any).setInterval = (callback, delay, ...args) => {
      const intervalId = originalSetInterval(callback, delay, ...args);
      if (delay === 1000) {
        activeIds.add(intervalId);
        probe.created += 1;
        probe.active = activeIds.size;
        probe.delays.push(delay);
      }
      return intervalId;
    };
    (window as any).clearInterval = (intervalId) => {
      if (activeIds.delete(intervalId)) {
        probe.cleared += 1;
        probe.active = activeIds.size;
      }
      return originalClearInterval(intervalId);
    };
  });
}

async function installReadyMutationProbe(page) {
  await page.evaluate(() => {
    const seenReadyPanels = new WeakSet();
    const probe = {
      readyInsertions: 0,
      announcements: 0,
      lastAnnouncement: '',
    };
    (window as any).__slice6ReadyProbe = probe;
    const countReadyPanel = (panel) => {
      if (seenReadyPanels.has(panel)) return;
      seenReadyPanels.add(panel);
      probe.readyInsertions += 1;
    };
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.id === 'v02-expedition-ready') countReadyPanel(node);
          node.querySelectorAll('#v02-expedition-ready').forEach(countReadyPanel);
        });
      });
      const announcement = document.getElementById('v02-live')?.textContent || '';
      if (announcement && announcement !== probe.lastAnnouncement) {
        probe.lastAnnouncement = announcement;
        probe.announcements += 1;
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  });
}

async function resetV02(page) {
  await page.addInitScript({ path: funScriptPath });
  await page.goto('/goals.html');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('stepquest', 3);
      request.onsuccess = () => {
        const database = request.result;
        const storeNames = Array.from(database.objectStoreNames);
        if (!storeNames.length) {
          database.close();
          resolve();
          return;
        }
        const transaction = database.transaction(storeNames, 'readwrite');
        storeNames.forEach((name) => transaction.objectStore(name).clear());
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
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

async function openOutcomeChooser(page) {
  if (await page.locator('#v02-return-report').count()) return;
  await expect(page.locator('#v02-open-report')).toBeVisible();
  await page.locator('#v02-open-report').click();
  await expect(page.locator('#v02-return-report')).toBeVisible();
}

async function installLifecycleProbe(page) {
  await page.evaluate(() => {
    const Core = (window as any).StepQuestV02App;
    const refreshSnapshot = Core.refreshSnapshot.bind(Core);
    const probe = {
      started: 0,
      completed: 0,
      active: 0,
      maxActive: 0,
      startedOrder: [],
      completedOrder: [],
    };
    (window as any).__slice6LifecycleProbe = probe;
    Core.refreshSnapshot = async () => {
      const call = probe.started + 1;
      probe.started = call;
      probe.startedOrder.push(call);
      probe.active += 1;
      probe.maxActive = Math.max(probe.maxActive, probe.active);
      try {
        return await refreshSnapshot();
      } finally {
        probe.active -= 1;
        probe.completed += 1;
        probe.completedOrder.push(call);
      }
    };
  });
}

async function lifecycleProbe(page) {
  return page.evaluate(() => ({ ...(window as any).__slice6LifecycleProbe }));
}

async function dispatchLifecycleAndWait(page, target, type) {
  const before = await lifecycleProbe(page);
  await page.evaluate(({ eventTarget, eventType }) => {
    const recipient = eventTarget === 'document' ? document : window;
    recipient.dispatchEvent(new Event(eventType));
  }, { eventTarget: target, eventType: type });
  await expect.poll(async () => (await lifecycleProbe(page)).completed)
    .toBeGreaterThanOrEqual(before.completed + 1);
  const after = await lifecycleProbe(page);
  expect(after.started - before.started).toBe(1);
  expect(after.completed - before.completed).toBe(1);
  expect(after.active).toBe(0);
  expect(after.maxActive).toBe(1);
  expect(after.completedOrder).toEqual(after.startedOrder);
}

async function expectElementPreserved(handle, selector, focused = true) {
  if (!handle) throw new Error(`Expected an element handle for ${selector}`);
  expect(await handle.evaluate((node, input) => ({
    connected: node.isConnected,
    current: node === document.querySelector(input.selector),
    focused: node === document.activeElement,
  }), { selector, focused })).toEqual({
    connected: true,
    current: true,
    focused,
  });
}

async function installDelayedMount(page) {
  await page.addInitScript(() => {
    let ui;
    Object.defineProperty(window, 'StepQuestV02UI', {
      configurable: true,
      get: () => ui,
      set: (value) => {
        const mount = value.mount;
        value.mount = async (options) => {
          const Core = options.Core;
          const getLastExpeditionMinutes = Core.getLastExpeditionMinutes.bind(Core);
          const refreshSnapshot = Core.refreshSnapshot.bind(Core);
          const refreshProbe = { started: 0, completed: 0, active: 0, maxActive: 0 };
          (window as any).__slice6MountRefreshProbe = refreshProbe;
          Core.refreshSnapshot = async () => {
            refreshProbe.started += 1;
            refreshProbe.active += 1;
            refreshProbe.maxActive = Math.max(refreshProbe.maxActive, refreshProbe.active);
            try {
              return await refreshSnapshot();
            } finally {
              refreshProbe.active -= 1;
              refreshProbe.completed += 1;
            }
          };
          Core.getLastExpeditionMinutes = async () => {
            const minutes = await getLastExpeditionMinutes();
            (window as any).__slice6MountDelayed = true;
            await new Promise((resolve) => {
              (window as any).__releaseSlice6Mount = resolve;
            });
            return minutes;
          };
          return mount(options);
        };
        ui = value;
      },
    });
  });
}

async function cancelFx(page) {
  await page.evaluate(() => (window as any).StepQuestV02FX.cancel());
  await expect(page.locator('[data-v02-fx-overlay]')).toHaveCount(0);
}

async function expeditionObservation(page) {
  return page.evaluate(() => {
    const Core = (window as any).StepQuestV02App;
    const state = Core.getSnapshot();
    return {
      events: state.events,
      rewards: state.rewards,
      wallet: state.wallet,
      statuses: {
        goals: state.goals.map(({ id, status }) => ({ id, status })),
        steps: state.steps.map(({ id, status }) => ({ id, status })),
        expeditions: state.expeditions.map(({ id, status }) => ({ id, status })),
        facade: Core.getStatus(),
      },
    };
  });
}

test('expedition timer defaults invalid preferences to five minutes and keeps the teaser unknown', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-12T00:00:00.000Z') });
  await resetV02(page);
  await createGoal(page, '시간을 고르는 원정');

  const fiveMinutes = page.locator('[name="v02-expedition-minutes"][value="5"]');
  await expect(fiveMinutes).toBeChecked();
  await expect(page.locator('[data-v02-expedition-teaser]')).toHaveText('5분 · 캠프 외곽 · ???의 흔적');

  await page.locator('[name="v02-expedition-minutes"][value="10"]').check();
  await expect(page.locator('[data-v02-expedition-teaser]')).toHaveText('10분 · 오래된 숲길 · ???의 흔적');

  await installLifecycleProbe(page);
  const runnerPanel = await page.locator('.v02-runner').elementHandle();
  const durationRadio = await page.locator('[name="v02-expedition-minutes"][value="10"]').elementHandle();
  await page.locator('[name="v02-expedition-minutes"][value="10"]').focus();
  await expect(page.locator('[name="v02-expedition-minutes"][value="10"]')).toBeFocused();
  await dispatchLifecycleAndWait(page, 'document', 'visibilitychange');
  await expectElementPreserved(runnerPanel, '.v02-runner', false);
  await expectElementPreserved(durationRadio, '[name="v02-expedition-minutes"][value="10"]');

  const loginButton = await page.locator('#btn-login').elementHandle();
  await page.locator('#btn-login').focus();
  await expect(page.locator('#btn-login')).toBeFocused();
  await dispatchLifecycleAndWait(page, 'window', 'pageshow');
  await expectElementPreserved(runnerPanel, '.v02-runner', false);
  await expectElementPreserved(loginButton, '#btn-login');

  const navigationLink = await page.locator('.nav-link').first().elementHandle();
  await dispatchLifecycleAndWait(page, 'window', 'focus');
  await expectElementPreserved(runnerPanel, '.v02-runner', false);
  await expectElementPreserved(loginButton, '#btn-login');
  await expectElementPreserved(navigationLink, '.nav-link', false);

  await page.evaluate(async () => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    await repository.setMeta('lastExpeditionMinutes', 25);
  });
  await page.reload();
  await expect(page.locator('[name="v02-expedition-minutes"][value="25"]')).toBeChecked();
  await expect(page.locator('[data-v02-expedition-teaser]')).toHaveText('25분 · 깊은 유적 입구 · ???의 흔적');

  await page.evaluate(async () => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    await repository.setMeta('lastExpeditionMinutes', 15);
  });
  await page.reload();
  await expect(fiveMinutes).toBeChecked();
  await expect(page.locator('[data-v02-expedition-teaser]')).toHaveText('5분 · 캠프 외곽 · ???의 흔적');
});

test('expedition timer reaches harvest without writing events rewards wallet or status', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-12T00:00:00.000Z') });
  await installTimerProbe(page);
  await resetV02(page);
  await createGoal(page, '절대 시각으로 돌아오는 원정');
  await page.locator('[name="v02-expedition-minutes"][value="5"]').check();
  await page.locator('#v02-start-step').click();

  const countdown = page.locator('[data-v02-countdown]');
  await expect(countdown).toHaveText('05:00');
  await expect(countdown).not.toHaveAttribute('aria-live', 'assertive');
  await expect(page.locator('#v02-expedition-active')).toContainText('앱을 닫아도 됩니다.');
  await expect(page.locator('#v02-open-report')).toHaveText('일찍 돌아왔어요');
  await expect(page.locator('[data-v02-encounter]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({ ...(window as any).__slice6TimerProbe }))).toEqual({
    created: 1,
    cleared: 0,
    active: 1,
    delays: [1000],
  });
  const runningPanel = await page.locator('#v02-expedition-active').elementHandle();
  await installReadyMutationProbe(page);
  const before = await expeditionObservation(page);

  await page.clock.fastForward(1000);
  await expectElementPreserved(runningPanel, '#v02-expedition-active', false);
  await page.locator('#v02-open-report').focus();
  await page.clock.fastForward(5 * 60 * 1000);

  await expect(page.locator('#v02-expedition-ready')).toBeVisible();
  await expect(page.locator('#v02-open-report')).not.toBeFocused();
  await expect(page.locator('#v02-expedition-ready')).not.toContainText(/골드|보상/);
  await expect(page.locator('#v02-open-report')).toHaveText('전리품 확인');
  expect(await expeditionObservation(page)).toEqual(before);
  await expect.poll(() => page.evaluate(() => ({ ...(window as any).__slice6TimerProbe }))).toEqual({
    created: 1,
    cleared: 1,
    active: 0,
    delays: [1000],
  });
  await expect.poll(() => page.evaluate(() => ({ ...(window as any).__slice6ReadyProbe }))).toEqual({
    readyInsertions: 1,
    announcements: 1,
    lastAnnouncement: '원정 전리품을 확인할 준비가 되었습니다.',
  });
  const readyPanel = await page.locator('#v02-expedition-ready').elementHandle();
  await installLifecycleProbe(page);
  await page.clock.fastForward(60 * 1000);
  await dispatchLifecycleAndWait(page, 'window', 'focus');
  await expectElementPreserved(readyPanel, '#v02-expedition-ready', false);
  await expect(page.locator('#v02-live')).toHaveText('원정 전리품을 확인할 준비가 되었습니다.');
  expect(await page.evaluate(() => ({ ...(window as any).__slice6ReadyProbe }))).toEqual({
    readyInsertions: 1,
    announcements: 1,
    lastAnnouncement: '원정 전리품을 확인할 준비가 되었습니다.',
  });
  expect(await page.evaluate(() => ({ ...(window as any).__slice6TimerProbe }))).toEqual({
    created: 1,
    cleared: 1,
    active: 0,
    delays: [1000],
  });
});

test('expedition timer reloads an unexpired expedition into its absolute countdown', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-12T00:00:00.000Z') });
  await resetV02(page);
  await createGoal(page, '다시 열어도 이어지는 원정');
  await page.locator('[name="v02-expedition-minutes"][value="10"]').check();
  await page.locator('#v02-start-step').click();
  await expect(page.locator('#v02-expedition-active')).toBeVisible();
  const timing = await page.evaluate(() => {
    const expedition = (window as any).StepQuestV02App.getSnapshot().expeditions
      .find((item) => item.status === 'active');
    return {
      plannedMinutes: expedition.plannedMinutes,
      startedAt: expedition.startedAt,
      expiresAt: expedition.expiresAt,
    };
  });
  expect(timing.plannedMinutes).toBe(10);
  expect(Date.parse(timing.expiresAt) - Date.parse(timing.startedAt)).toBe(10 * 60 * 1000);
  await page.clock.setFixedTime(new Date(timing.startedAt));
  await expect(page.locator('[data-v02-countdown]')).toHaveText('10:00');
  await page.clock.setFixedTime(new Date(Date.parse(timing.expiresAt) - 6 * 60 * 1000));
  await expect(page.locator('[data-v02-countdown]')).toHaveText('06:00');

  await page.reload();

  await expect(page.locator('#v02-expedition-active')).toBeVisible();
  await expect(page.locator('[data-v02-countdown]')).toHaveText('06:00');
  await expect(page.locator('#v02-expedition-ready')).toHaveCount(0);
});

test('harvest state opens directly after an expired reload and never promises Gold', async ({ page }) => {
  const startedAt = new Date('2026-07-12T00:00:00.000Z');
  await page.clock.install({ time: startedAt });
  await resetV02(page);
  await createGoal(page, '닫아 둔 동안 끝나는 원정');
  await page.locator('#v02-start-step').click();
  await expect(page.locator('#v02-expedition-active')).toBeVisible();
  const expiresAt = await page.evaluate(() => (
    (window as any).StepQuestV02App.getSnapshot().expeditions
      .find((item) => item.status === 'active').expiresAt
  ));
  await page.clock.setFixedTime(new Date(expiresAt));

  await page.reload();

  await expect(page.locator('#v02-expedition-ready')).toBeVisible();
  await expect(page.locator('#v02-expedition-ready')).not.toContainText(/골드|보상/);
  await expect(page.locator('#v02-open-report')).toHaveText('전리품 확인');
});

test('harvest state gives legacy timing a distinct return panel', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.clock.install({ time: new Date('2026-07-12T00:00:00.000Z') });
  await resetV02(page);
  await createAndStart(page, '예전 기록으로 남은 원정');
  await page.evaluate(async () => {
    const expedition = (window as any).StepQuestV02App.getSnapshot().expeditions
      .find((item) => item.status === 'active');
    const legacy = { ...expedition, id: 'legacy:expedition["unsafe"]' };
    delete legacy.plannedMinutes;
    delete legacy.expiresAt;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('stepquest', 3);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('expeditions', 'readwrite');
        transaction.objectStore('expeditions').delete(expedition.id);
        transaction.objectStore('expeditions').put(legacy);
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  });

  await page.reload();

  await expect(page.locator('#v02-expedition-legacy-ready')).toBeVisible();
  await expect(page.locator('#v02-expedition-ready')).toHaveCount(0);
  await expect(page.locator('[data-v02-countdown]')).toHaveCount(0);
  await page.locator('#v02-open-report').click();
  await expect(page.locator('#v02-return-report')).toBeVisible();
  await expect(page.locator('#v02-return-report')).toContainText('이전 원정');
  expect(pageErrors).toEqual([]);
});

test('harvest state labels early return and cancel follows the current derived phase', async ({ page }) => {
  const startedAt = new Date('2026-07-12T00:00:00.000Z');
  await page.clock.install({ time: startedAt });
  await resetV02(page);
  await createAndStart(page, '조기 귀환을 고르는 원정');

  await page.locator('#v02-open-report').click();
  await expect(page.locator('#v02-return-report')).toContainText('조기 귀환');
  await page.locator('#v02-cancel-report').click();
  await expect(page.locator('#v02-expedition-active')).toBeVisible();

  await page.locator('#v02-open-report').click();
  const expiresAt = await page.evaluate(() => (
    (window as any).StepQuestV02App.getSnapshot().expeditions
      .find((item) => item.status === 'active').expiresAt
  ));
  await page.clock.setFixedTime(new Date(expiresAt));
  await page.locator('#v02-cancel-report').click();
  await expect(page.locator('#v02-expedition-ready')).toBeVisible();

  await page.locator('#v02-open-report').click();
  await expect(page.locator('#v02-return-report')).not.toContainText('조기 귀환');
  await page.locator('#v02-cancel-report').click();
  await expect(page.locator('#v02-expedition-ready')).toBeVisible();
});

test('harvest state latches ready when the system clock moves backward', async ({ page }) => {
  const startedAt = new Date('2026-07-12T00:00:00.000Z');
  await page.clock.install({ time: startedAt });
  await resetV02(page);
  await createAndStart(page, '뒤로 가지 않는 원정');
  await page.clock.fastForward(5 * 60 * 1000);
  await expect(page.locator('#v02-expedition-ready')).toBeVisible();

  await installLifecycleProbe(page);
  await page.clock.setFixedTime(new Date(startedAt.getTime() + 60 * 1000));
  await dispatchLifecycleAndWait(page, 'window', 'focus');

  await expect(page.locator('#v02-expedition-ready')).toBeVisible();
  await expect(page.locator('#v02-expedition-active')).toHaveCount(0);
});

test('harvest state refreshes on wake and replaces a stale expedition after another commit', async ({ page, context }) => {
  await page.clock.install({ time: new Date('2026-07-12T00:00:00.000Z') });
  await resetV02(page);
  await createAndStart(page, '다른 탭과 맞추는 원정');
  await installLifecycleProbe(page);
  const runningPanel = await page.locator('#v02-expedition-active').elementHandle();
  const earlyReturn = await page.locator('#v02-open-report').elementHandle();
  await page.locator('#v02-open-report').focus();
  for (const [target, type] of [
    ['document', 'visibilitychange'],
    ['window', 'pageshow'],
    ['window', 'focus'],
  ]) {
    await dispatchLifecycleAndWait(page, target, type);
    await expectElementPreserved(runningPanel, '#v02-expedition-active', false);
    await expectElementPreserved(earlyReturn, '#v02-open-report');
  }

  await page.locator('#v02-open-report').click();
  await page.locator('[data-v02-outcome="partial"]').click();
  await page.locator('#v02-next-action').fill('다른 탭 보고 뒤 이어갈 행동');
  const secondPage = await context.newPage();
  await secondPage.addInitScript({ path: funScriptPath });
  await secondPage.goto('/goals.html');
  await expect(secondPage.locator('#v02-expedition-active')).toBeVisible();
  await secondPage.evaluate(async () => {
    const Core = (window as any).StepQuestV02App;
    await Core.reportCurrentExpedition({
      outcome: 'partial',
      idempotencyKey: 'slice6:other-tab:report',
      anchor: { nextPhysicalAction: '다른 탭에서 저장한 다음 행동' },
    });
  });

  await dispatchLifecycleAndWait(page, 'window', 'focus');

  await expect(page.locator('#v02-resume-anchor')).toContainText('다른 탭에서 저장한 다음 행동');
  await expect(page.locator('#v02-return-report')).toHaveCount(0);
  await secondPage.close();
});

test('harvest state initial mount refreshes a commit made during async initialization', async ({ page, context }) => {
  await page.clock.install({ time: new Date('2026-07-12T00:00:00.000Z') });
  await resetV02(page);
  await createAndStart(page, '초기 마운트 중 바뀌는 원정');
  const secondPage = await context.newPage();
  await secondPage.addInitScript({ path: funScriptPath });
  await secondPage.goto('/goals.html');
  await expect(secondPage.locator('#v02-expedition-active')).toBeVisible();

  await installDelayedMount(page);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__slice6MountDelayed))).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await secondPage.evaluate(async () => {
    await (window as any).StepQuestV02App.reportCurrentExpedition({
      outcome: 'partial',
      idempotencyKey: 'slice6:mount-race:report',
      anchor: { nextPhysicalAction: '최신 저장 상태에서 이어가기' },
    });
  });
  await page.evaluate(() => (window as any).__releaseSlice6Mount());

  await expect(page.locator('#v02-resume-anchor')).toContainText('최신 저장 상태에서 이어가기');
  await expect(page.locator('#v02-expedition-active')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (
    (window as any).__slice6MountRefreshProbe.completed
  ))).toBeGreaterThanOrEqual(2);
  const refreshProbe = await page.evaluate(() => ({ ...(window as any).__slice6MountRefreshProbe }));
  expect(refreshProbe.started).toBe(refreshProbe.completed);
  expect(refreshProbe.active).toBe(0);
  expect(refreshProbe.maxActive).toBe(1);
  await secondPage.close();
});

test('harvest state preserves the open Resume Anchor draft and focus across expiry', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-12T00:00:00.000Z') });
  await resetV02(page);
  await createAndStart(page, '작성 중 화면을 지키는 원정');
  await page.locator('#v02-open-report').click();
  await page.locator('[data-v02-outcome="partial"]').click();
  await page.locator('#v02-last-action').fill('첫 줄을 적었음');
  await page.locator('#v02-next-action').fill('둘째 줄 첫 단어 적기');
  await page.locator('#v02-note').fill('만료 뒤에도 남아야 하는 메모');
  await page.locator('#v02-next-action').focus();

  await installLifecycleProbe(page);
  await page.clock.fastForward(5 * 60 * 1000);
  await dispatchLifecycleAndWait(page, 'window', 'focus');

  await expect(page.locator('#v02-return-report')).toBeVisible();
  await expect(page.locator('#v02-last-action')).toHaveValue('첫 줄을 적었음');
  await expect(page.locator('#v02-next-action')).toHaveValue('둘째 줄 첫 단어 적기');
  await expect(page.locator('#v02-note')).toHaveValue('만료 뒤에도 남아야 하는 메모');
  await expect(page.locator('#v02-next-action')).toBeFocused();

  await page.locator('#v02-cancel-report').click();
  await expect(page.locator('#v02-expedition-ready')).toBeVisible();
});

test('partial progress restores a Resume Anchor after reload', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, '기획서 이어 쓰기');
  await page.reload();
  await openOutcomeChooser(page);
  await page.locator('[data-v02-outcome="partial"]').click();
  await page.locator('#v02-last-action').fill('첫 문장을 썼음');
  await page.locator('#v02-next-action').fill('둘째 문장 첫 단어 쓰기');
  await page.reload();
  await openOutcomeChooser(page);
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
  await openOutcomeChooser(page);
  await page.locator('[data-v02-outcome="completed"]').click();
  await expect(page.locator('[data-v02-current-step]')).not.toHaveText(before);
});

test('facade marks only the final completed step as a Goal milestone', async ({ page }) => {
  await resetV02(page);
  const result = await page.evaluate(async () => {
    const now = '2026-07-12T00:00:00.000Z';
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    await repository.importGoal({
      weekly: { id: 'milestone-goal', title: '마일스톤 목표', createdAt: now },
      micro: [
        { id: 'milestone-step-1', title: '첫 행동', phase: 'start', createdAt: now },
        { id: 'milestone-step-2', title: '마지막 행동', phase: 'close', createdAt: now },
      ],
    }, {
      idempotencyKey: 'milestone-goal:import',
      now,
      idFactory: (prefix) => `${prefix}-milestone`,
    });
    const Core = (window as any).StepQuestV02App;
    await Core.init({ App: (window as any).StepQuestApp, forceRefresh: true });
    await Core.startCurrentStep('milestone:first:start');
    const first = await Core.reportCurrentExpedition({
      outcome: 'completed',
      idempotencyKey: 'milestone:first:report',
    });
    await Core.startCurrentStep('milestone:last:start');
    const last = await Core.reportCurrentExpedition({
      outcome: 'completed',
      idempotencyKey: 'milestone:last:report',
    });
    return { first, last };
  });

  expect(result.first.goalMilestone).toBe(false);
  expect(result.last.goalMilestone).toBe(true);
});

test('local character import renders, replaces, reloads, and exports safely', async ({ page }) => {
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  await resetV02(page);
  await createGoal(page, '캐릭터 원정 테스트');
  await page.locator('#v02-character-settings > summary').click();
  const characterNetworkWrites: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && ['fetch', 'xhr'].includes(request.resourceType())) {
      characterNetworkWrites.push(`${request.method()} ${request.url()}`);
    }
  });
  await page.locator('#v02-character-file').setInputFiles({
    name: 'hero.png', mimeType: 'image/png', buffer: tinyPng,
  });
  await page.locator('#v02-character-name').fill('<b>나의 영웅</b>');
  await page.locator('#v02-character-preset').selectOption('dash');
  await page.locator('#v02-character-skill-name').fill('벽력일섬');
  await page.locator('#v02-character-color').selectOption('#a78bfa');
  await page.locator('#v02-save-character').click();

  await expect(page.locator('#v02-character-image')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('[data-v02-character-name]')).toHaveText('<b>나의 영웅</b>');
  await expect(page.locator('[data-v02-character-name] b')).toHaveCount(0);
  expect(characterNetworkWrites).toEqual([]);

  await page.reload();
  await expect(page.locator('#v02-character-image')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('[data-v02-character-name]')).toHaveText('<b>나의 영웅</b>');

  await page.locator('#v02-character-settings > summary').click();
  await page.locator('#v02-character-file').setInputFiles({
    name: 'hero-replacement.png', mimeType: 'image/png', buffer: tinyPng,
  });
  await page.locator('#v02-character-name').fill('교체한 영웅');
  await page.locator('#v02-save-character').click();
  await expect(page.locator('[data-v02-character-name]')).toHaveText('교체한 영웅');

  const exported = await page.evaluate(async () => {
    const Core = (window as any).StepQuestV02App;
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    const rawStoreCounts = await new Promise<{ characters: number; assets: number }>((resolve, reject) => {
      const request = indexedDB.open('stepquest', 3);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['characters', 'assets'], 'readonly');
        const charactersRequest = transaction.objectStore('characters').count();
        const assetsRequest = transaction.objectStore('assets').count();
        transaction.oncomplete = () => {
          database.close();
          resolve({ characters: charactersRequest.result, assets: assetsRequest.result });
        };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
    return {
      ordinary: JSON.parse(await Core.exportJson()),
      full: JSON.parse(await Core.exportFullJson()),
      assets: await repository.exportCharacterAssets(),
      rawStoreCounts,
    };
  });
  expect(exported.ordinary.characters).toEqual([expect.objectContaining({ name: '교체한 영웅' })]);
  expect(JSON.stringify(exported.ordinary)).not.toContain('base64');
  expect(JSON.stringify(exported.ordinary)).not.toContain('data:image');
  expect(exported.full.exportType).toBe('full-with-images');
  expect(exported.full.assets).toEqual([
    expect.objectContaining({ mimeType: 'image/png', base64: expect.any(String) }),
  ]);
  expect(exported.assets.characters).toHaveLength(1);
  expect(exported.assets.assets).toHaveLength(1);
  expect(exported.rawStoreCounts).toEqual({ characters: 1, assets: 1 });

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#v02-export-character-full').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('stepquest-full-backup-with-images.json');

  await page.locator('#v02-start-step').click();
  await expect(page.locator('#v02-expedition-active #v02-character-image')).toHaveAttribute('src', /^blob:/);
});

test('skill FX previews all presets and remains skippable by tap and keyboard', async ({ page }) => {
  await resetV02(page);
  await createGoal(page, '연출 미리보기');
  await page.locator('#v02-character-settings > summary').click();

  const delayedBaseline = await page.evaluate(() => {
    (document.querySelector('[data-v02-fx-preview="dash"]') as HTMLButtonElement).click();
    const overlay = document.querySelector('[data-v02-fx-overlay]');
    const shockring = overlay.querySelector('[data-v02-fx-step="shockring"]');
    const afterimage = overlay.querySelector('[data-v02-fx-step="afterimage"]');
    const character = document.querySelector('.v02-default-character, #v02-character-image');
    return {
      shockringOpacity: getComputedStyle(shockring).opacity,
      afterimageOpacity: getComputedStyle(afterimage).opacity,
      characterTransform: getComputedStyle(character).transform,
    };
  });
  expect(delayedBaseline).toEqual({
    shockringOpacity: '0',
    afterimageOpacity: '0',
    characterTransform: 'none',
  });
  await cancelFx(page);

  for (const preset of ['impact', 'dash', 'slash', 'cast']) {
    await page.locator(`[data-v02-fx-preview="${preset}"]`).click();
    const overlay = page.locator(`[data-v02-fx-mode="preview"][data-v02-fx-preset="${preset}"]`);
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('[data-v02-fx-step="cutin"]')).toBeVisible();
    await expect(overlay.locator('[data-v02-fx-skip]')).toBeFocused();
    if (preset === 'dash') {
      const timeline = await overlay.locator('[data-v02-fx-step][data-v02-fx-delay]').evaluateAll((nodes) => (
        Object.fromEntries(nodes.map((node) => [
          node.getAttribute('data-v02-fx-step'),
          Number(node.getAttribute('data-v02-fx-delay')),
        ]))
      ));
      expect(timeline.flash).toBeLessThan(timeline.bolt);
      expect(timeline.bolt).toBeLessThan(timeline.afterimage);
      expect(timeline.afterimage).toBeLessThan(timeline.shockring);
    }
    await overlay.locator('[data-v02-fx-skip]').click({ force: true });
    await expect(page.locator('[data-v02-fx-overlay]')).toHaveCount(0);
    await expect(page.locator(`[data-v02-fx-preview="${preset}"]`)).toBeFocused();
  }

  await page.locator('[data-v02-fx-preview="impact"]').click();
  await page.locator('[data-v02-fx-overlay]').click({ position: { x: 8, y: 8 } });
  await expect(page.locator('[data-v02-fx-overlay]')).toHaveCount(0);
  await expect(page.locator('#v02-start-step')).toBeVisible();

  for (const keyName of ['Escape', 'Enter', 'Space']) {
    await page.locator('[data-v02-fx-preview="slash"]').click();
    await expect(page.locator('[data-v02-fx-overlay]')).toBeVisible();
    await page.keyboard.press(keyName);
    await expect(page.locator('[data-v02-fx-overlay]')).toHaveCount(0);
    await expect(page.locator('#v02-expedition-active')).toHaveCount(0);
  }
});

test('skill FX render replacement cancels the prior session before keyboard input', async ({ page }) => {
  await resetV02(page);
  await page.locator('#v02-character-settings > summary').click();
  await page.locator('[data-v02-fx-preview="impact"]').click();
  await expect(page.locator('[data-v02-fx-overlay]')).toBeVisible();
  await page.locator('#v02-goal-title').fill('렌더 취소 테스트');
  await page.locator('#v02-create-goal').click();
  await expect(page.locator('[data-v02-fx-overlay]')).toHaveCount(0);

  await page.locator('#v02-start-step').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#v02-expedition-active')).toBeVisible();
  await expect(page.locator('[data-v02-fx-mode="departure"]')).toBeVisible();
  await cancelFx(page);
  await expect(page.locator('#v02-open-report')).toBeFocused();
});

test('skill FX runs only after departure and completed state renders', async ({ page }) => {
  await resetV02(page);
  await createGoal(page, '완료 연출 테스트');
  await page.locator('#v02-start-step').click();
  await expect(page.locator('#v02-expedition-active')).toBeVisible();
  await expect(page.locator('[data-v02-fx-mode="departure"]')).toBeVisible();
  await cancelFx(page);
  await page.locator('#v02-open-report').click();
  await page.locator('#v02-character-settings > summary').click();
  await expect(page.locator('[data-v02-fx-preview]:not(:disabled)')).toHaveCount(0);
  await page.locator('#v02-character-settings > summary').click();
  await page.locator('[data-v02-outcome="completed"]').click();
  await expect(page.locator('[data-v02-current-step]')).toBeVisible();
  await expect(page.locator('[data-v02-fx-mode="completed"]')).toBeVisible();
  await expect(page.locator('[data-v02-fx-mode="milestone"]')).toHaveCount(0);
  await cancelFx(page);
  await expect(page.locator('#v02-start-step')).toBeFocused();
});

test('skill FX uses one milestone cut-in on final completion', async ({ page }) => {
  await resetV02(page);
  await page.evaluate(async () => {
    const now = '2026-07-12T00:00:00.000Z';
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    await repository.importGoal({
      weekly: { id: 'fx-milestone-goal', title: '한 단계 목표', createdAt: now },
      micro: [{ id: 'fx-milestone-step', title: '마지막 행동', phase: 'close', createdAt: now }],
    }, {
      idempotencyKey: 'fx-milestone:import',
      now,
      idFactory: (prefix) => `${prefix}-fx-milestone`,
    });
    await (window as any).StepQuestV02App.init({
      App: (window as any).StepQuestApp,
      forceRefresh: true,
    });
    (window as any).StepQuestV02UI.render();
  });
  await page.locator('#v02-start-step').click();
  await cancelFx(page);
  await page.locator('#v02-open-report').click();
  await page.locator('[data-v02-outcome="completed"]').click();
  const milestone = page.locator('[data-v02-fx-mode="milestone"]');
  await expect(milestone).toBeVisible();
  await expect(milestone.locator('[data-v02-fx-step="cutin"]')).toBeVisible();
  await expect(page.locator('[data-v02-fx-mode="completed"]')).toHaveCount(0);
});

for (const outcome of ['partial', 'interrupted', 'not_started']) {
  test(`skill FX stays absent for ${outcome} outcome`, async ({ page }) => {
    await resetV02(page);
    await createGoal(page, `연출 제외 ${outcome}`);
    await page.locator('#v02-start-step').click();
    await cancelFx(page);
    await page.locator('#v02-open-report').click();
    await page.locator(`[data-v02-outcome="${outcome}"]`).click();
    if (outcome === 'partial' || outcome === 'interrupted') {
      await page.locator('#v02-next-action').fill('다음 손동작');
      await page.locator('#v02-save-outcome').click();
    }
    await expect(page.locator('[data-v02-fx-overlay]')).toHaveCount(0);
  });
}

test('skill FX reduced motion uses only cut-in and a soft 120ms flash', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resetV02(page);
  await createGoal(page, '축소 모션 연출');
  await page.locator('#v02-character-settings > summary').click();
  await page.locator('[data-v02-fx-preview="cast"]').click();
  const overlay = page.locator('[data-v02-fx-overlay]');
  await expect(overlay).toHaveAttribute('data-v02-fx-duration', '120');
  const steps = await overlay.locator('[data-v02-fx-step]').evaluateAll((nodes) => (
    nodes.map((node) => node.getAttribute('data-v02-fx-step')).sort()
  ));
  expect(steps).toEqual(['cutin', 'flash']);
});

test('interrupted requires and restores a Resume Anchor', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, '글쓰기 시작하기');
  await page.reload();
  await openOutcomeChooser(page);
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
  await openOutcomeChooser(page);
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
  await openOutcomeChooser(page);
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
  await openOutcomeChooser(page);
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
    await openOutcomeChooser(page);
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
  await openOutcomeChooser(page);
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
  await expect(page.locator('#v02-expedition-active')).toBeVisible();
  await openOutcomeChooser(page);
});

test('missing material parks the step with context and restores it', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, 'Prepare a cable');
  const wallet = await page.locator('#v02-wallet').innerText();
  await page.reload();
  await openOutcomeChooser(page);
  await page.locator('[data-v02-outcome="not_started"]').click();
  await page.locator('[data-v02-reason="no_material"]').click();
  await page.locator('#v02-block-note').fill('USB cable');
  await page.locator('#v02-block-material').click();
  await expect(page.locator('#v02-blocked-step')).toContainText('USB cable');
  await page.reload();
  await expect(page.locator('#v02-blocked-step')).toContainText('USB cable');
  await expect(page.locator('#v02-wallet')).toHaveText(wallet);
  await page.locator('#v02-unblock-step').click();
  await expect(page.locator('#v02-start-step')).toBeVisible();
  await expect(page.locator('#v02-wallet')).toHaveText(wallet);
});

test('waiting for a person persists the response context', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, 'Wait for review');
  await page.reload();
  await openOutcomeChooser(page);
  await page.locator('[data-v02-outcome="not_started"]').click();
  await page.locator('[data-v02-reason="waiting_person"]').click();
  await page.locator('#v02-block-note').fill('designer approval');
  await page.locator('#v02-block-person').click();
  await expect(page.locator('#v02-waiting-step')).toContainText('designer approval');
  await page.reload();
  await expect(page.locator('#v02-waiting-step')).toContainText('designer approval');
});

test('tired route can defer and return in one tap', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, 'Tired route');
  await page.reload();
  await openOutcomeChooser(page);
  await page.locator('[data-v02-outcome="not_started"]').click();
  await page.locator('[data-v02-reason="tired"]').click();
  await expect(page.locator('#v02-tired-smaller')).toBeVisible();
  await page.locator('#v02-tired-defer').click();
  await expect(page.locator('#v02-deferred-step')).toBeVisible();
  await page.locator('#v02-undefer-step').click();
  await expect(page.locator('#v02-start-step')).toBeVisible();
});

test('anxious route offers a preview-sized replacement', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, 'Preview route');
  const wallet = await page.locator('#v02-wallet').innerText();
  await page.reload();
  await openOutcomeChooser(page);
  await page.locator('[data-v02-outcome="not_started"]').click();
  await page.locator('[data-v02-reason="anxious"]').click();
  await expect(page.locator('#v02-anxious-helper')).toBeVisible();
  await page.locator('#v02-smaller-action').fill('Open the file preview');
  await page.locator('#v02-manual-shrink').click();
  await expect(page.locator('[data-v02-current-step]')).toHaveText('Open the file preview');
  await expect(page.locator('#v02-wallet')).toHaveText(wallet);
});

test('legacy direct-retry history reopens its active return report', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, 'Legacy retry compatibility');
  await page.reload();
  await openOutcomeChooser(page);
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
      const request = indexedDB.open('stepquest', 3);
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
  await expect(page.locator('#v02-expedition-legacy-ready')).toBeVisible();
  await openOutcomeChooser(page);
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

test('completed expedition can upgrade and persist the base camp', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, 'Build the camp');
  await page.locator('#v02-open-report').click();
  await page.locator('[data-v02-outcome="completed"]').click();
  await expect(page.locator('#v02-upgrade-camp')).toBeVisible();
  await expect(page.locator('#v02-wallet')).toContainText('골드 2');

  await page.locator('#v02-upgrade-camp').click();
  await expect(page.locator('#v02-camp-badge')).toHaveAttribute('data-camp-level', '1');
  await expect(page.locator('#v02-wallet')).toContainText('골드 0');
  await expect(page.locator('#v02-upgrade-camp')).toHaveCount(0);
  await expect(page.locator('#v02-camp-message')).toBeVisible();

  const campState = await page.evaluate(async () => {
    const state = (window as any).StepQuestV02App.getSnapshot();
    const exported = JSON.parse(await (window as any).StepQuestV02App.exportJson());
    return {
      level: state.camp.level,
      walletGold: state.wallet.gold,
      ledgerGold: state.rewards
        .filter((item) => item.currency === 'gold')
        .reduce((sum, item) => sum + item.amount, 0),
      upgradeRows: state.rewards.filter((item) => item.stage === 'camp_upgrade'),
      exportedCamp: exported.camp,
    };
  });
  expect(campState).toEqual({
    level: 1,
    walletGold: 0,
    ledgerGold: 0,
    upgradeRows: [expect.objectContaining({ amount: -2, idempotencyKey: 'camp:level:1' })],
    exportedCamp: { level: 1 },
  });

  await page.reload();
  await expect(page.locator('#v02-camp-badge')).toHaveAttribute('data-camp-level', '1');
  await expect(page.locator('#v02-wallet')).toContainText('골드 0');

  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('stepquest', 3);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('wallet', 'readwrite');
        transaction.objectStore('wallet').put({ id: 'camp', level: 99 });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  await expect(page.locator('#v02-camp-badge')).toHaveAttribute('data-camp-level', '5');

  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('stepquest', 3);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('wallet', 'readwrite');
        transaction.objectStore('wallet').delete('camp');
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  await expect(page.locator('#v02-camp-badge')).toHaveAttribute('data-camp-level', '0');
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
  expect(JSON.parse(exported).schemaVersion).toBe(3);
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

test('Slice 6 facade commits only valid duration preferences and refreshes cross-tab state', async ({
  page,
  context,
}) => {
  await resetV02(page);
  await page.addScriptTag({ url: '/assets/js/stepquest-v02-fun.js' });

  const initial = await page.evaluate(async () => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    const Domain = (window as any).StepQuestV02Domain;
    const Fun = (window as any).StepQuestV02Fun;
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    const createdAt = '2026-07-12T00:00:00.000Z';
    await repository.importGoal({
      weekly: {
        id: 'slice6-duration-goal',
        title: 'Slice 6 duration goal',
        category: 'writing',
        createdAt,
      },
      micro: [
        {
          id: 'slice6-duration-step-1',
          title: 'Start the timer',
          category: 'writing',
          phase: 'start',
          createdAt,
        },
        {
          id: 'slice6-duration-step-2',
          title: 'Finish the timer',
          category: 'writing',
          phase: 'close',
          createdAt,
        },
      ],
    }, {
      idempotencyKey: 'slice6:duration:goal',
      now: createdAt,
      idFactory: (prefix) => `${prefix}-slice6-duration`,
    });
    await Core.init({ App, forceRefresh: true });
    await repository.setMeta('commitsSinceExternalBackup', 0);

    const defaultMinutes = await Core.getLastExpeditionMinutes();
    let invalidDurationError = null;
    try {
      await Core.startCurrentStep('slice6:duration:invalid', 15);
    } catch (error) {
      invalidDurationError = error.message;
    }
    const afterInvalidMinutes = await Core.getLastExpeditionMinutes();
    const rawAfterInvalid = await repository.getMeta('lastExpeditionMinutes');

    await Core.startCurrentStep('slice6:duration:valid', 10);
    const state = Core.getSnapshot();
    const expedition = state.expeditions.find((item) => item.status === 'active');
    const step = state.steps.find((item) => item.id === expedition.stepId);
    const beforeProjection = JSON.stringify(state);
    const backupCountBeforeProjection = await repository.getMeta('commitsSinceExternalBackup');
    const running = Core.getTimerView(expedition.startedAt);
    const ready = Core.getTimerView(expedition.expiresAt);
    const encounter = Core.getEncounterView();
    const expectedEncounter = Fun.selectEncounter({
      rewardLineage: step.rewardLineage,
      category: step.category,
      boss: Domain.isGoalMilestone(step, state.steps),
    });
    const afterProjection = JSON.stringify(Core.getSnapshot());
    const backupCountAfterProjection = await repository.getMeta('commitsSinceExternalBackup');

    let failedStartError = null;
    try {
      await Core.startCurrentStep('slice6:duration:no-active-step', 25);
    } catch (error) {
      failedStartError = error.message;
    }

    return {
      defaultMinutes,
      invalidDurationError,
      afterInvalidMinutes,
      rawAfterInvalid: rawAfterInvalid ?? null,
      storedMinutes: await Core.getLastExpeditionMinutes(),
      rawStoredMinutes: await repository.getMeta('lastExpeditionMinutes'),
      failedStartError,
      backupCountBeforeProjection,
      backupCountAfterProjection,
      pureProjection: beforeProjection === afterProjection,
      running,
      ready,
      encounter,
      expectedEncounter,
      expeditionId: expedition.id,
    };
  });

  expect(initial).toMatchObject({
    defaultMinutes: 5,
    invalidDurationError: 'EXPEDITION_DURATION_INVALID',
    afterInvalidMinutes: 5,
    rawAfterInvalid: null,
    storedMinutes: 10,
    rawStoredMinutes: 10,
    failedStartError: 'ACTIVE_STEP_NOT_FOUND',
    backupCountBeforeProjection: 1,
    backupCountAfterProjection: 1,
    pureProjection: true,
    running: { phase: 'running', remainingMs: 600_000, plannedMinutes: 10 },
    ready: { phase: 'ready', remainingMs: 0, plannedMinutes: 10 },
  });
  expect(initial.encounter).toEqual(initial.expectedEncounter);

  const secondPage = await context.newPage();
  await secondPage.goto('/goals.html');
  await secondPage.waitForFunction(() => Boolean((window as any).StepQuestV02Storage));
  await secondPage.evaluate(async ({ expeditionId }) => {
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    const snapshot = await repository.getSnapshot();
    const expedition = snapshot.expeditions.find((item) => item.id === expeditionId);
    await repository.execute('reportOutcome', {
      expeditionId,
      outcome: 'completed',
      idempotencyKey: 'slice6:cross-tab:report',
      now: new Date(Date.parse(expedition.startedAt) + 1_000).toISOString(),
      idFactory: (prefix) => `${prefix}-slice6-cross-tab`,
    });
  }, { expeditionId: initial.expeditionId });
  await secondPage.close();

  const stale = await page.evaluate(() => (
    (window as any).StepQuestV02App.getSnapshot().events
      .some((event) => event.idempotencyKey === 'slice6:cross-tab:report')
  ));
  expect(stale).toBe(false);

  const refreshed = await page.evaluate(async () => {
    const snapshot = await (window as any).StepQuestV02App.refreshSnapshot();
    return {
      sawRemoteReport: snapshot.events
        .some((event) => event.idempotencyKey === 'slice6:cross-tab:report'),
      activeStepId: snapshot.steps.find((item) => item.status === 'active')?.id,
    };
  });
  expect(refreshed).toEqual({
    sawRemoteReport: true,
    activeStepId: 'slice6-duration-step-2',
  });
});

test('Slice 6 facade derives the latest report and acknowledges only its matching key', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-12T12:00:00.000Z'));
  await resetV02(page);
  await page.addScriptTag({ url: '/assets/js/stepquest-v02-fun.js' });

  const committed = await page.evaluate(async () => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    const createdAt = new Date().toISOString();
    await repository.importGoal({
      weekly: {
        id: 'slice6-report-goal',
        title: 'Slice 6 report goal',
        category: 'study',
        createdAt,
      },
      micro: [
        {
          id: 'slice6-report-step-1',
          title: 'First encounter',
          category: 'study',
          phase: 'start',
          createdAt,
        },
        {
          id: 'slice6-report-step-2',
          title: 'Latest encounter',
          category: 'study',
          phase: 'close',
          createdAt,
        },
      ],
    }, {
      idempotencyKey: 'slice6:report:goal',
      now: createdAt,
      idFactory: (prefix) => `${prefix}-slice6-report`,
    });
    await Core.init({ App, forceRefresh: true });
    await Core.startCurrentStep('slice6:start:a', 5);
    await Core.reportCurrentExpedition({
      outcome: 'completed',
      idempotencyKey: 'slice6:report:a',
    });
    await Core.startCurrentStep('slice6:start:z', 25);
    await Core.reportCurrentExpedition({
      outcome: 'completed',
      idempotencyKey: 'slice6:report:z',
    });
    return {
      pending: await Core.getPendingBattleReport(),
      hasPendingMeta: (await repository.getMeta('pendingBattleReport')) !== undefined,
      acknowledged: await repository.getMeta('acknowledgedBattleReportKey') ?? null,
    };
  });

  expect(committed.hasPendingMeta).toBe(false);
  expect(committed.acknowledged).toBeNull();
  expect(committed.pending).toMatchObject({
    key: 'slice6:report:z',
    reportVersion: 1,
    route: { plannedMinutes: 25 },
  });

  await page.reload();
  await page.addScriptTag({ url: '/assets/js/stepquest-v02-fun.js' });
  await page.waitForFunction(() => Boolean((window as any).StepQuestV02App?.getSnapshot?.()));

  const acknowledged = await page.evaluate(async ({ expectedPending }) => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    const Storage = (window as any).StepQuestV02Storage;
    await Core.init({ App, forceRefresh: true });
    const afterReload = await Core.getPendingBattleReport();
    const mismatched = await Core.acknowledgeBattleReport('slice6:report:not-latest');
    const afterMismatch = await Core.getPendingBattleReport();

    const originalOpenRepository = Storage.openRepository;
    const repository = await originalOpenRepository();
    const originalSetMeta = repository.setMeta;
    repository.setMeta = async (key, value) => {
      if (key === 'acknowledgedBattleReportKey') throw new Error('ACK_WRITE_FAILED');
      return originalSetMeta(key, value);
    };
    Storage.openRepository = async () => repository;
    await Core.init({ App, forceRefresh: true });
    Storage.openRepository = originalOpenRepository;

    let failedError = null;
    try {
      await Core.acknowledgeBattleReport(expectedPending.key);
    } catch (error) {
      failedError = error.message;
    }
    const afterFailedWrite = await Core.getPendingBattleReport();
    repository.setMeta = originalSetMeta;
    const matched = await Core.acknowledgeBattleReport(expectedPending.key);
    const afterMatch = await Core.getPendingBattleReport();
    return {
      afterReload,
      mismatched,
      afterMismatch,
      failedError,
      afterFailedWrite,
      matched,
      afterMatch,
      storedKey: await repository.getMeta('acknowledgedBattleReportKey'),
    };
  }, { expectedPending: committed.pending });

  expect(acknowledged.afterReload).toEqual(committed.pending);
  expect(acknowledged.mismatched).toBe(false);
  expect(acknowledged.afterMismatch).toEqual(committed.pending);
  expect(acknowledged.failedError).toBe('ACK_WRITE_FAILED');
  expect(acknowledged.afterFailedWrite).toEqual(committed.pending);
  expect(acknowledged.matched).toBe(true);
  expect(acknowledged.afterMatch).toBeNull();
  expect(acknowledged.storedKey).toBe('slice6:report:z');
});

test('Slice 6 facade persists semantic dialogue and applies the exact 48-hour session threshold', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-12T12:00:00.000Z'));
  await resetV02(page);
  await page.addScriptTag({ url: '/assets/js/stepquest-v02-fun.js' });

  const firstPass = await page.evaluate(async () => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    await Core.init({ App, forceRefresh: true });
    const eventsBefore = JSON.stringify(Core.getSnapshot().events);
    const first = await Core.beginForegroundSession('2026-07-12');
    const repeated = await Core.beginForegroundSession('2026-07-12');

    await repository.setMeta('foregroundSession', {
      lastForegroundAt: '2026-07-10T12:00:00.001Z',
      lastForegroundLocalDate: '2026-07-11',
    });
    const belowThreshold = await Core.beginForegroundSession('2026-07-12');
    await repository.setMeta('foregroundSession', {
      lastForegroundAt: '2026-07-10T12:00:00.000Z',
      lastForegroundLocalDate: '2026-07-11',
    });
    const exactThreshold = await Core.beginForegroundSession('2026-07-12');

    const line = await Core.chooseDialogue({
      context: 'ready',
      triggerKey: 'ready:expedition-1:2026-07-12',
      entityId: 'expedition-1',
      localDate: '2026-07-12',
      subject: 'Ink slime',
    });
    return {
      first,
      repeated,
      belowThreshold,
      exactThreshold,
      line,
      noDomainEvent: eventsBefore === JSON.stringify(Core.getSnapshot().events),
      foregroundSession: await repository.getMeta('foregroundSession'),
    };
  });

  expect(firstPass).toMatchObject({
    first: { firstLocalDate: true, longAbsence: false },
    repeated: { firstLocalDate: false, longAbsence: false },
    belowThreshold: { firstLocalDate: true, longAbsence: false },
    exactThreshold: { firstLocalDate: true, longAbsence: true },
    noDomainEvent: true,
    foregroundSession: {
      lastForegroundAt: '2026-07-12T12:00:00.000Z',
      lastForegroundLocalDate: '2026-07-12',
    },
  });

  await page.reload();
  await page.addScriptTag({ url: '/assets/js/stepquest-v02-fun.js' });
  const afterReload = await page.evaluate(async () => {
    const Core = (window as any).StepQuestV02App;
    await Core.init({ App: (window as any).StepQuestApp, forceRefresh: true });
    const same = await Core.chooseDialogue({
      context: 'ready',
      triggerKey: 'ready:expedition-1:2026-07-12',
      entityId: 'expedition-1',
      localDate: '2026-07-12',
      subject: 'Ink slime',
    });
    const next = await Core.chooseDialogue({
      context: 'ready',
      triggerKey: 'ready:expedition-2:2026-07-12',
      entityId: 'expedition-2',
      localDate: '2026-07-12',
      subject: 'Ink slime',
    });
    return { same, next };
  });
  expect(afterReload.same).toBe(firstPass.line);
  expect(afterReload.next).not.toBe(firstPass.line);
});

test('Slice 6 facade imports synthetic media and revokes every replaced object URL without failure loss', async ({ page }) => {
  const portraitBytes = Array.from(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ));
  const movingBytes = makeAnimatedWebPBytes([400, 600]);
  await resetV02(page);
  await page.addScriptTag({ url: '/assets/js/stepquest-v02-media.js' });

  const result = await page.evaluate(async ({ portraitBytes: png, movingBytes: webp }) => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    const repository = await (window as any).StepQuestV02Storage.openRepository();
    await Core.init({ App, forceRefresh: true });
    await Core.importCharacterMedia(
      'portrait',
      new File([Uint8Array.from(png)], 'portrait.png', { type: 'image/png' }),
    );
    await Core.importCharacterMedia(
      'idle',
      new File([Uint8Array.from(webp)], 'idle.webp', { type: 'image/webp' }),
    );
    await Core.importCharacterMedia(
      'skill',
      new File([Uint8Array.from(webp)], 'skill.webp', { type: 'image/webp' }),
    );

    const beforeRefresh = Core.getCharacter();
    const beforeUrls = [
      beforeRefresh.portraitUrl,
      beforeRefresh.idleUrl,
      beforeRefresh.skillUrl,
    ];
    const beforeStored = await repository.getCharacterMedia();
    const beforeMetadata = JSON.stringify(beforeStored.character);
    const urlApi: any = URL;
    const originalCreateObjectURL = urlApi.createObjectURL.bind(urlApi);
    const originalRevokeObjectURL = urlApi.revokeObjectURL.bind(urlApi);
    const created: string[] = [];
    const revoked: string[] = [];
    urlApi.createObjectURL = (blob) => {
      const value = originalCreateObjectURL(blob);
      created.push(value);
      return value;
    };
    urlApi.revokeObjectURL = (value) => {
      revoked.push(value);
      originalRevokeObjectURL(value);
    };

    let movingError = null;
    let portraitError = null;
    let afterRefresh;
    let failedCreated: string[] = [];
    try {
      await Core.refreshSnapshot();
      afterRefresh = Core.getCharacter();
      const failedCreateStart = created.length;
      try {
        await Core.importCharacterMedia(
          'idle',
          new File([Uint8Array.from([1, 2, 3])], 'invalid.webp', { type: 'image/webp' }),
        );
      } catch (error) {
        movingError = error.message;
      }
      try {
        await Core.importCharacterMedia(
          'portrait',
          new File([Uint8Array.from([1, 2, 3])], 'invalid.png', { type: 'image/png' }),
        );
      } catch (error) {
        portraitError = error.message;
      }
      failedCreated = created.slice(failedCreateStart);
    } finally {
      urlApi.createObjectURL = originalCreateObjectURL;
      urlApi.revokeObjectURL = originalRevokeObjectURL;
    }

    const afterFailure = Core.getCharacter();
    const afterStored = await repository.getCharacterMedia();
    return {
      beforeUrls,
      afterRefreshUrls: [
        afterRefresh.portraitUrl,
        afterRefresh.idleUrl,
        afterRefresh.skillUrl,
      ],
      afterFailureUrls: [
        afterFailure.portraitUrl,
        afterFailure.idleUrl,
        afterFailure.skillUrl,
      ],
      imageUrlMatchesPortrait: afterFailure.imageUrl === afterFailure.portraitUrl,
      oldUrlsRevoked: beforeUrls.every((value) => revoked.includes(value)),
      currentUrlsPreserved: [
        afterFailure.portraitUrl,
        afterFailure.idleUrl,
        afterFailure.skillUrl,
      ].every((value) => !revoked.includes(value)),
      failedUrlsReleased: failedCreated.length > 0
        && failedCreated.every((value) => revoked.includes(value)),
      movingError,
      portraitError,
      metadataPreserved: beforeMetadata === JSON.stringify(afterStored.character),
      mediaMetadata: afterStored.character.mediaMetadata,
      blobsPresent: Boolean(afterStored.portrait && afterStored.idle && afterStored.skill),
    };
  }, { portraitBytes, movingBytes });

  expect(result.beforeUrls.every(Boolean)).toBe(true);
  expect(result.afterRefreshUrls.every(Boolean)).toBe(true);
  expect(result.afterRefreshUrls).not.toEqual(result.beforeUrls);
  expect(result.afterFailureUrls).toEqual(result.afterRefreshUrls);
  expect(result.imageUrlMatchesPortrait).toBe(true);
  expect(result.oldUrlsRevoked).toBe(true);
  expect(result.currentUrlsPreserved).toBe(true);
  expect(result.failedUrlsReleased).toBe(true);
  expect(result.movingError).toBe('CHARACTER_MEDIA_MAGIC_MISMATCH');
  expect(result.portraitError).toBe('CHARACTER_IMAGE_DECODE_FAILED');
  expect(result.metadataPreserved).toBe(true);
  expect(result.blobsPresent).toBe(true);
  expect(result.mediaMetadata).toMatchObject({
    portrait: { mimeType: 'image/png', width: 1, height: 1 },
    idle: { mimeType: 'image/webp', width: 8, height: 8, durationMs: 1_000 },
    skill: { mimeType: 'image/webp', width: 8, height: 8, durationMs: 1_000 },
  });
});

test('Slice 6 facade rejects character media when IndexedDB is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value() { throw new Error('INDEXED_DB_DISABLED_FOR_SLICE6_FACADE_TEST'); },
    });
  });
  await page.goto('/goals.html');
  await page.waitForFunction(() => (
    (window as any).StepQuestV02App?.getStatus?.().mode === 'localStorage'
  ));
  await page.addScriptTag({ url: '/assets/js/stepquest-v02-media.js' });

  const result = await page.evaluate(async () => {
    const Core = (window as any).StepQuestV02App;
    let error = null;
    try {
      await Core.importCharacterMedia(
        'portrait',
        new File([Uint8Array.from([1])], 'portrait.png', { type: 'image/png' }),
      );
    } catch (caught) {
      error = caught.message;
    }
    return {
      mode: Core.getStatus().mode,
      error,
      character: Core.getCharacter(),
    };
  });

  expect(result.mode).toBe('localStorage');
  expect(result.error).toBe('CHARACTER_IMAGE_STORAGE_UNAVAILABLE');
  expect(result.character.usingDefault).toBe(true);
});

test('Slice 6 facade keeps fresh-start side effects idempotent across preference failure and replay', async ({ page }) => {
  await resetV02(page);
  const result = await page.evaluate(async () => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    const Storage = (window as any).StepQuestV02Storage;
    const repository = await Storage.openRepository();
    const createdAt = '2026-07-12T00:00:00.000Z';
    await repository.importGoal({
      weekly: {
        id: 'slice6-replay-goal',
        title: 'Replay-safe start',
        category: 'writing',
        createdAt,
      },
      micro: [{
        id: 'slice6-replay-step',
        title: 'Start once',
        category: 'writing',
        phase: 'start',
        createdAt,
      }],
    }, {
      idempotencyKey: 'slice6:replay:goal',
      now: createdAt,
      idFactory: (prefix) => `${prefix}-slice6-replay`,
    });
    await repository.setMeta('lastExpeditionMinutes', 5);
    await repository.setMeta('commitsSinceExternalBackup', 0);

    const originalExecute = repository.execute;
    const originalSetMeta = repository.setMeta;
    let startExecuteCalls = 0;
    let preferenceAttempts = 0;
    repository.execute = async (operation, command) => {
      if (operation === 'startStep') startExecuteCalls += 1;
      return originalExecute(operation, command);
    };
    repository.setMeta = async (key, value) => {
      if (key === 'lastExpeditionMinutes') {
        preferenceAttempts += 1;
        throw new Error('PREFERENCE_WRITE_FAILED');
      }
      return originalSetMeta(key, value);
    };
    const originalOpenRepository = Storage.openRepository;
    Storage.openRepository = async () => repository;
    await Core.init({ App, forceRefresh: true });
    Storage.openRepository = originalOpenRepository;

    const capture = async (callback) => {
      try {
        return { value: await callback(), error: null };
      } catch (error) {
        return { value: null, error: error.message };
      }
    };
    const invalidType = await capture(() => (
      Core.startCurrentStep('slice6:replay:start', '10')
    ));
    const callsAfterInvalidType = startExecuteCalls;
    const fresh = await capture(() => (
      Core.startCurrentStep('slice6:replay:start', 10)
    ));
    const validReplay = await capture(() => (
      Core.startCurrentStep('slice6:replay:start', 25)
    ));
    const callsAfterValidReplay = startExecuteCalls;
    const invalidReplay = await capture(() => (
      Core.startCurrentStep('slice6:replay:start', 15)
    ));

    return {
      invalidType,
      callsAfterInvalidType,
      fresh,
      validReplay,
      invalidReplay,
      callsAfterValidReplay,
      finalExecuteCalls: startExecuteCalls,
      preferenceAttempts,
      storedMinutes: await repository.getMeta('lastExpeditionMinutes'),
      backupCount: await repository.getMeta('commitsSinceExternalBackup'),
      startEvents: Core.getSnapshot().events
        .filter((event) => event.type === 'step_started').length,
    };
  });

  expect(result.invalidType.error).toBe('EXPEDITION_DURATION_INVALID');
  expect(result.callsAfterInvalidType).toBe(0);
  expect(result.fresh.error).toBeNull();
  expect(result.fresh.value).toMatchObject({ stepId: 'slice6-replay-step' });
  expect(result.validReplay.error).toBeNull();
  expect(result.validReplay.value).toEqual(result.fresh.value);
  expect(result.invalidReplay.error).toBe('EXPEDITION_DURATION_INVALID');
  expect(result.callsAfterValidReplay).toBe(2);
  expect(result.finalExecuteCalls).toBe(2);
  expect(result.preferenceAttempts).toBe(1);
  expect(result.storedMinutes).toBe(5);
  expect(result.backupCount).toBe(1);
  expect(result.startEvents).toBe(1);
});

test('Slice 6 facade retries one-record foreground state after an atomic write failure', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-12T12:00:00.000Z'));
  await resetV02(page);
  const result = await page.evaluate(async () => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    const Storage = (window as any).StepQuestV02Storage;
    const repository = await Storage.openRepository();
    await repository.setMeta('lastForegroundLocalDate', '2026-07-11');
    await repository.setMeta('lastForegroundAt', '2026-07-10T12:00:00.000Z');
    const eventsBefore = JSON.stringify((await repository.getSnapshot()).events);

    const originalSetMeta = repository.setMeta;
    let foregroundWriteAttempts = 0;
    repository.setMeta = async (key, value) => {
      if (key === 'foregroundSession') {
        foregroundWriteAttempts += 1;
        if (foregroundWriteAttempts === 1) throw new Error('SESSION_WRITE_FAILED');
      }
      return originalSetMeta(key, value);
    };
    const originalOpenRepository = Storage.openRepository;
    Storage.openRepository = async () => repository;
    await Core.init({ App, forceRefresh: true });
    Storage.openRepository = originalOpenRepository;

    const capture = async () => {
      try {
        return { value: await Core.beginForegroundSession('2026-07-12'), error: null };
      } catch (error) {
        return { value: null, error: error.message };
      }
    };
    const failed = await capture();
    const afterFailure = {
      combined: await repository.getMeta('foregroundSession') ?? null,
      localDate: await repository.getMeta('lastForegroundLocalDate'),
      timestamp: await repository.getMeta('lastForegroundAt'),
    };
    const retry = await capture();
    const repeated = await capture();
    return {
      failed,
      afterFailure,
      retry,
      repeated,
      foregroundWriteAttempts,
      stored: await repository.getMeta('foregroundSession'),
      noDomainEvent: eventsBefore === JSON.stringify((await repository.getSnapshot()).events),
    };
  });

  expect(result.failed).toEqual({ value: null, error: 'SESSION_WRITE_FAILED' });
  expect(result.afterFailure).toEqual({
    combined: null,
    localDate: '2026-07-11',
    timestamp: '2026-07-10T12:00:00.000Z',
  });
  expect(result.retry).toEqual({
    value: { firstLocalDate: true, longAbsence: true },
    error: null,
  });
  expect(result.repeated).toEqual({
    value: { firstLocalDate: false, longAbsence: false },
    error: null,
  });
  expect(result.foregroundWriteAttempts).toBe(3);
  expect(result.stored).toEqual({
    lastForegroundAt: '2026-07-12T12:00:00.000Z',
    lastForegroundLocalDate: '2026-07-12',
  });
  expect(result.noDomainEvent).toBe(true);
});

test('Slice 6 facade serializes fallback foreground calls inside one document', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-12T12:00:00.000Z'));
  await resetV02(page);
  const result = await page.evaluate(async () => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    const Storage = (window as any).StepQuestV02Storage;
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    });
    const repository = await Storage.openRepository();
    const originalSetMeta = repository.setMeta;
    repository.setMeta = async (key, value) => {
      if (['foregroundSession', 'lastForegroundAt', 'lastForegroundLocalDate'].includes(key)) {
        await new Promise((resolve) => setTimeout(resolve, 75));
      }
      return originalSetMeta(key, value);
    };
    const originalOpenRepository = Storage.openRepository;
    Storage.openRepository = async () => repository;
    await Core.init({ App, forceRefresh: true });
    Storage.openRepository = originalOpenRepository;

    const eventsBefore = JSON.stringify(Core.getSnapshot().events);
    const sessions = await Promise.all([
      Core.beginForegroundSession('2026-07-12'),
      Core.beginForegroundSession('2026-07-12'),
    ]);
    return {
      locksDisabled: !navigator.locks,
      sessions,
      stored: await repository.getMeta('foregroundSession'),
      noDomainEvent: eventsBefore === JSON.stringify(Core.getSnapshot().events),
    };
  });

  expect(result.locksDisabled).toBe(true);
  expect(result.sessions.filter((session) => session.firstLocalDate)).toHaveLength(1);
  expect(result.sessions.filter((session) => !session.firstLocalDate)).toHaveLength(1);
  expect(result.stored).toEqual({
    lastForegroundAt: '2026-07-12T12:00:00.000Z',
    lastForegroundLocalDate: '2026-07-12',
  });
  expect(result.noDomainEvent).toBe(true);
});

test('Slice 6 facade serializes first-local-date across two tabs', async ({ page, context }) => {
  await page.clock.setFixedTime(new Date('2026-07-12T12:00:00.000Z'));
  await resetV02(page);
  const secondPage = await context.newPage();
  await secondPage.goto('/goals.html');
  await secondPage.clock.setFixedTime(new Date('2026-07-12T12:00:00.000Z'));

  const preparePage = async (target) => target.evaluate(async () => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    const Storage = (window as any).StepQuestV02Storage;
    const repository = await Storage.openRepository();
    const originalSetMeta = repository.setMeta;
    repository.setMeta = async (key, value) => {
      if (['foregroundSession', 'lastForegroundAt', 'lastForegroundLocalDate'].includes(key)) {
        await new Promise((resolve) => setTimeout(resolve, 75));
      }
      return originalSetMeta(key, value);
    };
    const originalOpenRepository = Storage.openRepository;
    Storage.openRepository = async () => repository;
    await Core.init({ App, forceRefresh: true });
    Storage.openRepository = originalOpenRepository;
    (window as any).__slice6ForegroundRepository = repository;
    return {
      supportsLocks: Boolean(navigator.locks?.request),
      events: JSON.stringify(Core.getSnapshot().events),
    };
  });
  const [firstPrepared, secondPrepared] = await Promise.all([
    preparePage(page),
    preparePage(secondPage),
  ]);
  const [first, second] = await Promise.all([
    page.evaluate(() => (
      (window as any).StepQuestV02App.beginForegroundSession('2026-07-12')
    )),
    secondPage.evaluate(() => (
      (window as any).StepQuestV02App.beginForegroundSession('2026-07-12')
    )),
  ]);
  const persisted = await page.evaluate(async () => {
    const Core = (window as any).StepQuestV02App;
    const repository = (window as any).__slice6ForegroundRepository;
    return {
      stored: await repository.getMeta('foregroundSession'),
      events: JSON.stringify(Core.getSnapshot().events),
    };
  });
  await secondPage.close();

  expect(firstPrepared.supportsLocks).toBe(true);
  expect(secondPrepared.supportsLocks).toBe(true);
  expect([first, second].filter((session) => session.firstLocalDate)).toHaveLength(1);
  expect([first, second].filter((session) => !session.firstLocalDate)).toHaveLength(1);
  expect(persisted.stored).toEqual({
    lastForegroundAt: '2026-07-12T12:00:00.000Z',
    lastForegroundLocalDate: '2026-07-12',
  });
  expect(persisted.events).toBe(firstPrepared.events);
});

test('Slice 6 facade swaps media URLs only after a complete refresh projection', async ({ page }) => {
  const portraitBytes = Array.from(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ));
  const movingBytes = makeAnimatedWebPBytes([400, 600]);
  await resetV02(page);
  await page.addScriptTag({ url: '/assets/js/stepquest-v02-media.js' });

  const result = await page.evaluate(async ({ portraitBytes: png, movingBytes: webp }) => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    const Storage = (window as any).StepQuestV02Storage;
    await Core.init({ App, forceRefresh: true });
    await Core.importCharacterMedia(
      'portrait',
      new File([Uint8Array.from(png)], 'portrait.png', { type: 'image/png' }),
    );
    await Core.importCharacterMedia(
      'idle',
      new File([Uint8Array.from(webp)], 'idle.webp', { type: 'image/webp' }),
    );
    await Core.importCharacterMedia(
      'skill',
      new File([Uint8Array.from(webp)], 'skill.webp', { type: 'image/webp' }),
    );

    const repository = await Storage.openRepository();
    const originalOpenRepository = Storage.openRepository;
    Storage.openRepository = async () => repository;
    await Core.init({ App, forceRefresh: true });
    Storage.openRepository = originalOpenRepository;
    const view = () => {
      const value = Core.getCharacter();
      return {
        urls: [value.portraitUrl, value.idleUrl, value.skillUrl],
        mediaMetadata: JSON.stringify(value.mediaMetadata),
      };
    };
    const capture = async (callback) => {
      try {
        await callback();
        return null;
      } catch (error) {
        return error.message;
      }
    };
    const urlApi: any = URL;
    const nativeCreate = urlApi.createObjectURL.bind(urlApi);
    const nativeRevoke = urlApi.revokeObjectURL.bind(urlApi);

    const beforeReadFailure = view();
    const readRevoked: string[] = [];
    const originalGetCharacterMedia = repository.getCharacterMedia;
    repository.getCharacterMedia = async () => { throw new Error('MEDIA_READ_FAILED'); };
    urlApi.revokeObjectURL = (value) => {
      readRevoked.push(value);
      nativeRevoke(value);
    };
    const readError = await capture(() => Core.refreshSnapshot());
    const afterReadFailure = view();
    repository.getCharacterMedia = originalGetCharacterMedia;
    urlApi.revokeObjectURL = nativeRevoke;

    await Core.init({ App, forceRefresh: true });
    const beforeCreateFailure = view();
    const createMade: string[] = [];
    const createRevoked: string[] = [];
    let createCalls = 0;
    urlApi.createObjectURL = (blob) => {
      createCalls += 1;
      if (createCalls === 2) throw new Error('URL_CREATE_FAILED');
      const value = nativeCreate(blob);
      createMade.push(value);
      return value;
    };
    urlApi.revokeObjectURL = (value) => {
      createRevoked.push(value);
      nativeRevoke(value);
    };
    const createError = await capture(() => Core.refreshSnapshot());
    const afterCreateFailure = view();
    urlApi.createObjectURL = nativeCreate;
    urlApi.revokeObjectURL = nativeRevoke;

    await Core.init({ App, forceRefresh: true });
    const beforeRevokeFailure = view();
    const revokeAttempts: string[] = [];
    urlApi.revokeObjectURL = (value) => {
      revokeAttempts.push(value);
      nativeRevoke(value);
      if (value === beforeRevokeFailure.urls[0]) throw new Error('URL_REVOKE_FAILED');
    };
    const revokeError = await capture(() => Core.refreshSnapshot());
    const afterRevokeFailure = view();
    urlApi.revokeObjectURL = nativeRevoke;

    return {
      beforeReadFailure,
      readError,
      afterReadFailure,
      readKeptOldUrls: beforeReadFailure.urls.every((value) => !readRevoked.includes(value)),
      beforeCreateFailure,
      createError,
      afterCreateFailure,
      createKeptOldUrls: beforeCreateFailure.urls
        .every((value) => !createRevoked.includes(value)),
      partialCreateReleased: createMade.length > 0
        && createMade.every((value) => createRevoked.includes(value)),
      beforeRevokeFailure,
      revokeError,
      afterRevokeFailure,
      allOldRevokesAttempted: beforeRevokeFailure.urls
        .every((value) => revokeAttempts.includes(value)),
    };
  }, { portraitBytes, movingBytes });

  expect(result.readError).toBe('MEDIA_READ_FAILED');
  expect(result.afterReadFailure).toEqual(result.beforeReadFailure);
  expect(result.readKeptOldUrls).toBe(true);
  expect(result.createError).toBe('URL_CREATE_FAILED');
  expect(result.afterCreateFailure).toEqual(result.beforeCreateFailure);
  expect(result.createKeptOldUrls).toBe(true);
  expect(result.partialCreateReleased).toBe(true);
  expect(result.revokeError).toBeNull();
  expect(result.afterRevokeFailure.mediaMetadata).toBe(
    result.beforeRevokeFailure.mediaMetadata,
  );
  expect(result.afterRevokeFailure.urls).not.toEqual(result.beforeRevokeFailure.urls);
  expect(result.allOldRevokesAttempted).toBe(true);
});

test('Slice 6 facade treats persisted media as committed when URL refresh fails', async ({ page }) => {
  const portraitBytes = Array.from(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ));
  const movingBytes = makeAnimatedWebPBytes([400, 600]);
  const replacementBytes = makeAnimatedWebPBytes([250, 350]);
  await resetV02(page);
  await page.addScriptTag({ url: '/assets/js/stepquest-v02-media.js' });

  const result = await page.evaluate(async ({
    portraitBytes: png,
    movingBytes: webp,
    replacementBytes: replacement,
  }) => {
    const App = (window as any).StepQuestApp;
    const Core = (window as any).StepQuestV02App;
    const Storage = (window as any).StepQuestV02Storage;
    await Core.init({ App, forceRefresh: true });
    await Core.importCharacterMedia(
      'portrait',
      new File([Uint8Array.from(png)], 'portrait.png', { type: 'image/png' }),
    );
    await Core.importCharacterMedia(
      'idle',
      new File([Uint8Array.from(webp)], 'idle.webp', { type: 'image/webp' }),
    );
    await Core.importCharacterMedia(
      'skill',
      new File([Uint8Array.from(webp)], 'skill.webp', { type: 'image/webp' }),
    );

    const repository = await Storage.openRepository();
    const originalOpenRepository = Storage.openRepository;
    Storage.openRepository = async () => repository;
    await Core.init({ App, forceRefresh: true });
    Storage.openRepository = originalOpenRepository;
    await repository.setMeta('commitsSinceExternalBackup', 0);
    const before = Core.getCharacter();
    const beforeUrls = [before.portraitUrl, before.idleUrl, before.skillUrl];
    const originalSave = repository.saveCharacterMediaSlot;
    repository.saveCharacterMediaSlot = async () => {
      throw new Error('MEDIA_PERSISTENCE_FAILED');
    };
    let persistenceError = null;
    try {
      await Core.importCharacterMedia(
        'skill',
        new File([Uint8Array.from(replacement)], 'skill-failed.webp', { type: 'image/webp' }),
      );
    } catch (error) {
      persistenceError = error.message;
    }
    repository.saveCharacterMediaSlot = originalSave;
    const afterPersistenceFailure = Core.getCharacter();
    const persistedAfterFailure = await repository.getCharacterMedia();
    const backupAfterPersistenceFailure = await repository.getMeta('commitsSinceExternalBackup');

    const urlApi: any = URL;
    const nativeCreate = urlApi.createObjectURL.bind(urlApi);
    const nativeRevoke = urlApi.revokeObjectURL.bind(urlApi);
    const revoked: string[] = [];
    urlApi.createObjectURL = () => { throw new Error('PRESENTATION_REFRESH_FAILED'); };
    urlApi.revokeObjectURL = (value) => {
      revoked.push(value);
      nativeRevoke(value);
    };
    let committedError = null;
    let committedResult = null;
    try {
      committedResult = await Core.importCharacterMedia(
        'skill',
        new File([Uint8Array.from(replacement)], 'skill-committed.webp', { type: 'image/webp' }),
      );
    } catch (error) {
      committedError = error.message;
    }
    const afterCommittedRefreshFailure = Core.getCharacter();
    const revokedBeforeRecovery = [...revoked];
    const persistedAfterCommit = await repository.getCharacterMedia();
    const backupAfterCommit = await repository.getMeta('commitsSinceExternalBackup');
    urlApi.createObjectURL = nativeCreate;
    urlApi.revokeObjectURL = nativeRevoke;
    await Core.refreshSnapshot();
    const afterRecovery = Core.getCharacter();

    return {
      persistenceError,
      persistenceKeptUrls: [
        afterPersistenceFailure.portraitUrl,
        afterPersistenceFailure.idleUrl,
        afterPersistenceFailure.skillUrl,
      ].every((value, index) => value === beforeUrls[index]),
      persistenceKeptData: persistedAfterFailure.character.mediaMetadata.skill.durationMs === 1000,
      backupAfterPersistenceFailure,
      committedError,
      committedResultDuration: committedResult?.mediaMetadata?.skill?.durationMs ?? null,
      committedOldProjectionDuration:
        afterCommittedRefreshFailure.mediaMetadata.skill.durationMs,
      committedKeptOldUrls: [
        afterCommittedRefreshFailure.portraitUrl,
        afterCommittedRefreshFailure.idleUrl,
        afterCommittedRefreshFailure.skillUrl,
      ].every((value, index) => value === beforeUrls[index]),
      committedKeptOldOwnership: beforeUrls
        .every((value) => !revokedBeforeRecovery.includes(value)),
      persistedDuration: persistedAfterCommit.character.mediaMetadata.skill.durationMs,
      backupAfterCommit,
      recoveredDuration: afterRecovery.mediaMetadata.skill.durationMs,
      recoveredUrlsChanged: [
        afterRecovery.portraitUrl,
        afterRecovery.idleUrl,
        afterRecovery.skillUrl,
      ].every((value, index) => value !== beforeUrls[index]),
    };
  }, { portraitBytes, movingBytes, replacementBytes });

  expect(result.persistenceError).toBe('MEDIA_PERSISTENCE_FAILED');
  expect(result.persistenceKeptUrls).toBe(true);
  expect(result.persistenceKeptData).toBe(true);
  expect(result.backupAfterPersistenceFailure).toBe(0);
  expect(result.committedError).toBeNull();
  expect(result.committedResultDuration).toBe(600);
  expect(result.committedOldProjectionDuration).toBe(1000);
  expect(result.committedKeptOldUrls).toBe(true);
  expect(result.committedKeptOldOwnership).toBe(true);
  expect(result.persistedDuration).toBe(600);
  expect(result.backupAfterCommit).toBe(1);
  expect(result.recoveredDuration).toBe(600);
  expect(result.recoveredUrlsChanged).toBe(true);
});
