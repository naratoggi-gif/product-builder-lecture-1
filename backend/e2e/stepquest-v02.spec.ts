import { expect, test } from '@playwright/test';

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

async function resetV02(page) {
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

async function cancelFx(page) {
  await page.evaluate(() => (window as any).StepQuestV02FX.cancel());
  await expect(page.locator('[data-v02-fx-overlay]')).toHaveCount(0);
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

test('missing material parks the step with context and restores it', async ({ page }) => {
  await resetV02(page);
  await createAndStart(page, 'Prepare a cable');
  const wallet = await page.locator('#v02-wallet').innerText();
  await page.reload();
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

    await repository.setMeta('lastForegroundLocalDate', '2026-07-11');
    await repository.setMeta('lastForegroundAt', '2026-07-10T12:00:00.001Z');
    const belowThreshold = await Core.beginForegroundSession('2026-07-12');
    await repository.setMeta('lastForegroundLocalDate', '2026-07-11');
    await repository.setMeta('lastForegroundAt', '2026-07-10T12:00:00.000Z');
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
      lastForegroundAt: await repository.getMeta('lastForegroundAt'),
    };
  });

  expect(firstPass).toMatchObject({
    first: { firstLocalDate: true, longAbsence: false },
    repeated: { firstLocalDate: false, longAbsence: false },
    belowThreshold: { firstLocalDate: true, longAbsence: false },
    exactThreshold: { firstLocalDate: true, longAbsence: true },
    noDomainEvent: true,
    lastForegroundAt: '2026-07-12T12:00:00.000Z',
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
