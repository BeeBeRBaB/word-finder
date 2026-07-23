import { test, expect } from '@playwright/test';

test('app boots and renders a full puzzle', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cell')).toHaveCount(169);          // 13 x 13
  await expect(page.locator('.w')).toHaveCount(12);
  await expect(page.locator('#theme')).not.toHaveText('Loading…');
  await expect(page.locator('#count')).toContainText('0 of 12 found');
});
