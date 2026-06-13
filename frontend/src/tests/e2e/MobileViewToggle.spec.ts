import { test, expect } from './fixtures';

test.describe('Mobile View Toggle Userflow', () => {
  // Set viewport to mobile size
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    // Mock daylight for map loading
    await page.route('**/api/v1/daylight/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [] }),
      });
    });

    // Mock airspace NOTAMs that MenuDrawer fetches on open
    await page.route('**/api/v1/notams/airspace*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/app');
    // Wait for the main map canvas to load
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('renders 2D enroute controls and responds to click actions', async ({ page }) => {
    // Check view toggle pill is visible
    const togglePill = page.getByTestId('mobile-view-toggle-pill');
    await expect(togglePill).toBeVisible();

    // Check zoom buttons are visible
    const zoomIn = page.getByTestId('mobile-zoom-in');
    const zoomOut = page.getByTestId('mobile-zoom-out');
    await expect(zoomIn).toBeVisible();
    await expect(zoomOut).toBeVisible();

    // Click ERC overlay toggle
    const ercToggle = page.getByTestId('mobile-layer-toggle-ercMap');
    await expect(ercToggle).toBeVisible();
    await expect(ercToggle).not.toHaveClass(/bg-emerald/);
    await ercToggle.click();
    await expect(ercToggle).toHaveClass(/bg-emerald/);

    // Click compass
    const compass = page.getByTestId('mobile-compass-toggle');
    await expect(compass).toBeVisible();
    await compass.click();

    // Click style toggle
    const styleToggle = page.getByTestId('mobile-map-style-toggle');
    await expect(styleToggle).toBeVisible();
    await styleToggle.click();
  });
});
