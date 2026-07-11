import { expect, test } from '@playwright/test';

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
    await overlay.locator('[data-v02-fx-skip]').click();
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
