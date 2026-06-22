import { expect, test } from '@playwright/test';

async function resetGuest(page) {
  await page.goto('/goals.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function createGoal(page, title = 'study for ten minutes') {
  await page.locator('#goal-title').fill(title);
  await page.locator('#btn-create-stepquest').click();
  await expect(page.locator('#btn-complete-current')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await resetGuest(page);
});

test('guest creates a goal and completes the first tiny action', async ({ page }) => {
  await createGoal(page);
  await page.locator('#btn-complete-current').click();

  await expect(page.locator('.reward-pulse')).toBeVisible();
  await expect(page.locator('#btn-undo-complete')).toBeVisible();
});

test('guest shrinks a blocked action and completes the replacement', async ({ page }) => {
  await createGoal(page, 'clean the room');
  await page.locator('#btn-open-shrink').click();
  await page.locator('[data-reason="too_big"]').click();

  await expect(page.locator('.shrink-pulse')).toBeVisible();
  await expect(page.locator('#btn-complete-current')).toBeVisible();

  await page.locator('#btn-complete-current').click();
  await expect(page.locator('.reward-pulse')).toBeVisible();
});

test('guest complete then undo keeps rewards reversible', async ({ page }) => {
  await createGoal(page, 'start exercising');
  const materialStat = page.locator('.stat').filter({ hasText: '재료' }).locator('strong');
  const before = await materialStat.innerText();

  await page.locator('#btn-complete-current').click();
  await expect(page.locator('#btn-undo-complete')).toBeVisible();
  await page.locator('#btn-undo-complete').click();

  await expect(page.locator('.undo-pulse')).toBeVisible();
  await expect(materialStat).toHaveText(before);
});

test('production mode does not expose local super mode', async ({ page, request }) => {
  const superScript = await request.get('/dev/super-mode.js?v=0.1.1-alpha');
  expect(await superScript.text()).toContain('window.StepQuestSuperMode=undefined');

  const html = await page.content();
  expect(html).not.toContain('super@stepquest.local');
  expect(html).not.toContain('stepquest-super-1234');
  expect(html).not.toContain('one_punch_hero');

  const hookType = await page.evaluate('typeof window.StepQuestSuperMode');
  expect(hookType).toBe('undefined');
});
