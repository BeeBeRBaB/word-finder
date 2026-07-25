import { test, expect } from '@playwright/test';

test('app boots and renders a full puzzle', async ({ page }) => {
  // Pinned rather than a random deal: the catalog currently lists more categories
  // than have a subjects/ module on disk (parallel content authoring), so an
  // unpinned load would sometimes boot to "Offline" instead of a puzzle.
  await page.goto('/?subject=nature/birds');
  // 169 on a desktop board, 100 on a phone. Asserting a perfect square rather than a
  // number is what lets this one spec cover both projects.
  const cells = await page.locator('.cell').count();
  expect([100, 169]).toContain(cells);
  await expect(page.locator('#subject')).not.toHaveText('Loading…');
  await expect(page.locator('#count')).toContainText(`0 of ${await page.locator('.w').count()} found`);
});
