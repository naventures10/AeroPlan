import { test, expect } from './fixtures';

test.describe('Mobile Search Bar Userflow', () => {
  // Set viewport to mobile size
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    // Mock the search API
    await page.route('**/api/v1/search*', async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q')?.toUpperCase() || '';

      let results: any[] = [];

      if (query === 'VOMM') {
        results = [
          {
            id: 'VOMM',
            name: 'CHENNAI/INTL',
            type: 'AERODROME',
            center: [80.1805, 12.9941],
            properties: { icao: 'VOMM', name: 'CHENNAI/INTL' },
          },
        ];
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(results),
      });
    });

    // Mock aerodrome metadata for VOMM
    await page.route('**/api/v1/aerodromes/VOMM/metadata', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          icao: 'VOMM',
          name: 'CHENNAI/INTL',
          data: { some: 'metadata' },
        }),
      });
    });

    // Mock weather for VOMM
    await page.route('**/api/v1/weather/VOMM*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metar: 'VOMM 271230Z 08005KT 6000 FEW020 32/24 Q1008 NOSIG',
          taf: 'VOMM 270900Z 2712/2818 09010KT 6000 FEW020 ...',
        }),
      });
    });

    // Mock NOTAMs for VOMM
    await page.route('**/api/v1/notams/VOMM*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Mock daylight for VOMM
    await page.route('**/api/v1/daylight/VOMM*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [] }),
      });
    });

    await page.goto('/app');
    // Wait for the main map canvas to load (shows app is ready)
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });

  test('Mobile search trigger, type, and select result', async ({ page }) => {
    // 1. Verify trigger button is visible and click it
    const triggerBtn = page.getByTestId('mobile-search-trigger');
    await expect(triggerBtn).toBeVisible({ timeout: 10000 });
    await triggerBtn.click();

    // 2. Verify overlay with input is open
    const input = page.locator('input.aip-mobile-search-input');
    await expect(input).toBeVisible();

    // 3. Type into input
    await input.fill('VOMM');

    // 4. Verify search result appears and click it
    const resultItem = page.getByTestId('mobile-search-result-item').filter({ hasText: 'VOMM' });
    await expect(resultItem).toBeVisible({ timeout: 10000 });
    await resultItem.click({ force: true });

    // 5. Verify overlay closes
    await expect(input).not.toBeVisible();
  });

  test('Mobile search clear button and back button dismiss overlay', async ({ page }) => {
    const triggerBtn = page.getByTestId('mobile-search-trigger');
    await expect(triggerBtn).toBeVisible({ timeout: 10000 });
    await triggerBtn.click();

    const input = page.locator('input.aip-mobile-search-input');
    await expect(input).toBeVisible();

    await input.fill('VOMM');
    const clearBtn = page.getByTestId('mobile-search-clear');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    await expect(input).toHaveValue('');
    await expect(clearBtn).not.toBeVisible();

    const backBtn = page.getByTestId('mobile-search-back');
    await backBtn.click();
    await expect(input).not.toBeVisible();
  });
});
