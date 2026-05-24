import { test, expect } from './fixtures';
import { MapPage } from './pages/MapPage';

test.describe('Toolbar Tooltips', () => {
  let mapPage: MapPage;

  test.beforeEach(async ({ page }) => {
    mapPage = new MapPage(page);
    await mapPage.goto();
    await mapPage.waitForReady();
  });

  test('layer toolbar tooltip opens on hover and dismisses with Escape', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Toggle Waypoints' });
    const tooltip = page.locator('[popover="hint"]').filter({ hasText: 'Waypoints' });

    await expect(tooltip).not.toBeVisible();
    await trigger.hover();
    await expect(tooltip).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(tooltip).not.toBeVisible();
  });

  test('layer toolbar tooltip also opens on keyboard focus', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Toggle menu' });
    const tooltip = page.locator('[popover="hint"]').filter({ hasText: 'Toggle menu' });

    await expect(tooltip).not.toBeVisible();
    await trigger.focus();
    await expect(tooltip).toBeVisible();
  });
});
