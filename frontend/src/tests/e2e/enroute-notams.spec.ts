import { test, expect } from './fixtures';
import { MapPage } from './pages/MapPage';

test.describe('Enroute Notams Workflow', () => {
  let mapPage: MapPage;

  test.beforeEach(async ({ page }) => {
    mapPage = new MapPage(page);
    await mapPage.goto();
    await mapPage.waitForReady();

    // Mock API response for Enroute Notams
    await page.route('**/api/v1/notams/airspace*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            notam_id: 'A1234/26',
            fir: 'VOMF',
            valid_from: '2026-01-01T00:00:00Z',
            valid_to: '2026-01-31T23:59:00Z',
            is_permanent: false,
            description: 'MOCK ENROUTE NOTAM FOR TESTING',
          },
        ]),
      });
    });
  });

  test('User Story 1: Open menu drawer and open Enroute Notams card', async ({ page }) => {
    // 1. Toggle the menu drawer
    const menuToggleBtn = page.locator('#aip-menu-toggle-btn');
    await expect(menuToggleBtn).toBeVisible();
    await menuToggleBtn.click();

    // 2. Wait for the drawer item to be visible and click it
    const enrouteNotamsItem = page.locator('#aip-drawer-item-airspace-notams');
    await expect(enrouteNotamsItem).toBeVisible();
    await enrouteNotamsItem.click();

    // 3. Verify floating card opens
    const cardHeader = page.locator('.airspace-notams-header-title');
    await expect(cardHeader).toBeVisible();
    await expect(cardHeader).toHaveText('Enroute Notams');

    // 4. Verify mock NOTAM content appears
    await expect(page.getByText('A1234/26')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('MOCK ENROUTE NOTAM FOR TESTING')).toBeVisible();

    // 5. Verify search and filter inputs exist
    const searchInput = page.locator('.airspace-notams-search-input');
    await expect(searchInput).toBeVisible();

    const firSelect = page.locator('.airspace-notams-fir-select');
    await expect(firSelect).toBeVisible();

    // 6. Close the card
    const closeBtn = page.locator('.airspace-notams-close-btn');
    await closeBtn.click();

    // Verify card is closed
    await expect(cardHeader).not.toBeVisible();
  });
});
