import { test, expect } from './fixtures';

test.describe('Mobile Layer Toolbar Userflow', () => {
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
    // Wait for the main map canvas to load (shows app is ready)
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('renders top-left menu trigger and opens navigation drawer', async ({ page }) => {
    const menuTrigger = page.getByTestId('mobile-menu-trigger');
    await expect(menuTrigger).toBeVisible();
    await expect(menuTrigger).toHaveAttribute('aria-expanded', 'false');

    // Click menu trigger to open drawer
    await menuTrigger.click();
    await expect(menuTrigger).toHaveAttribute('aria-expanded', 'true');

    // Verify the menu drawer is visible
    const drawer = page.locator('#aip-menu-drawer');
    await expect(drawer).toBeVisible();

    // Close the drawer using the close button inside MenuDrawer
    const closeBtn = page.locator('#aip-drawer-close-btn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Verify drawer is hidden and trigger expanded attribute resets
    await expect(drawer).not.toBeVisible();
    await expect(menuTrigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('renders bottom horizontal layers dock and toggles layers', async ({ page }) => {
    // Check toggle button for Waypoints
    const waypointsToggle = page.getByTestId('mobile-layer-toggle-waypoints');
    await expect(waypointsToggle).toBeVisible();
    await expect(waypointsToggle).not.toHaveClass(/active/);

    // Toggle waypoints ON
    await waypointsToggle.click();
    await expect(waypointsToggle).toHaveClass(/active/);

    // Toggle waypoints OFF
    await waypointsToggle.click();
    await expect(waypointsToggle).not.toHaveClass(/active/);
  });
});
