import { expect, test } from '@playwright/test';

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
