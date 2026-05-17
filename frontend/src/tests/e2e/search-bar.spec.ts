import { test, expect } from './fixtures';
import { MapPage } from './pages/MapPage';

test.describe('Search Bar Userflow', () => {
  let mapPage: MapPage;

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
      } else if (query === 'VATLA') {
        results = [
          {
            id: 'VATLA',
            name: 'SIGNIFICANT POINT',
            type: 'WAYPOINT',
            center: [78.5, 14.2],
            properties: {
              waypoint_name: 'VATLA',
              type: 'WAYPOINT',
              raw_coordinates: '141200N 0783000E',
            },
          },
        ];
      } else if (query === 'VO') {
        results = [
          {
            id: 'VOMM',
            name: 'CHENNAI/INTL',
            type: 'AERODROME',
            center: [80.1805, 12.9941],
            properties: { icao: 'VOMM', name: 'CHENNAI/INTL' },
          },
          {
            id: 'VOTV',
            name: 'TRIVANDRUM/INTL',
            type: 'AERODROME',
            center: [76.92, 8.4821],
            properties: { icao: 'VOTV', name: 'TRIVANDRUM/INTL' },
          },
          {
            id: 'VOBL',
            name: 'KEMPEGOWDA/INTL',
            type: 'AERODROME',
            center: [77.7062, 13.1986],
            properties: { icao: 'VOBL', name: 'KEMPEGOWDA/INTL' },
          },
        ];
      } else if (query === 'XYZABC123') {
        results = [];
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

    mapPage = new MapPage(page);
    await mapPage.goto();
    await mapPage.waitForReady();
  });

  test('Basic search and mouse selection (Waypoint)', async ({ page }) => {
    // 1. Focus and type into search bar
    await mapPage.searchInput.focus();
    await mapPage.searchInput.fill('VATLA');

    // 2. Verify suggestions appear (with some wait for debounce)
    const suggestions = page.locator('div.aip-search-results-wrapper');
    await expect(suggestions).toBeVisible({ timeout: 5000 });

    // 3. Verify VATLA is in suggestions
    const vatlaResult = page.locator('div.aip-search-result-item').filter({ hasText: 'VATLA' });
    await expect(vatlaResult).toBeVisible();

    // 4. Click suggestion
    await vatlaResult.click({ force: true });

    // 5. Verify dropdown disappears
    await expect(suggestions).not.toBeVisible();

    // 6. Verify Info Card appears (after flyTo delay)
    const infoCard = page.getByTestId('feature-info-card').first();
    await expect(infoCard).toBeVisible({ timeout: 10000 });

    // Check for content inside the card
    await expect(infoCard).toContainText('WAYPOINT');
    await expect(infoCard).toContainText('VATLA');
    await expect(infoCard).toContainText('141200N 0783000E');
  });

  test('Aerodrome search selection (Terminal Dashboard)', async ({ page }) => {
    // 1. Search for an aerodrome
    await mapPage.searchInput.focus();
    await mapPage.searchInput.fill('VOMM');

    const vommResult = page.locator('div.aip-search-result-item').filter({ hasText: 'VOMM' });
    await expect(vommResult).toBeVisible();
    await vommResult.click({ force: true });

    // 2. Verify Terminal Dashboard appears
    // The ICAO code VOMM should be visible in the dashboard
    await expect(page.locator('h2', { hasText: 'VOMM' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Current Conditions')).toBeVisible();
  });

  test('Keyboard navigation (Arrow keys and Enter)', async ({ page }) => {
    // 1. Focus and type into search bar
    await mapPage.searchInput.focus();
    await mapPage.searchInput.fill('VO');

    // 2. Wait for suggestions
    const suggestions = page.locator('div.aip-search-results-wrapper');
    await expect(suggestions).toBeVisible();

    // 3. Verify multiple results are present
    const vommResult = page.locator('div.aip-search-result-item').filter({ hasText: 'VOMM' });
    await expect(vommResult).toBeVisible();

    // 4. Press ArrowDown to highlight the first result
    await page.keyboard.press('ArrowDown');

    // 5. Verify it's highlighted (has cyan border/text class)
    // We check for the background or border class that indicates selection
    await expect(vommResult).toHaveClass(/selected/);

    // 6. Press Enter to select
    await page.keyboard.press('Enter');

    // 7. Verify Dashboard appears for VOMM
    await expect(page.locator('h2', { hasText: 'VOMM' })).toBeVisible({ timeout: 15000 });
  });

  test('Clearing search input', async ({ page }) => {
    // 1. Focus and type
    await mapPage.searchInput.focus();
    await mapPage.searchInput.fill('VATLA');
    await expect(mapPage.searchInput).toHaveValue('VATLA');

    // 2. Verify clear button (X) is visible
    const clearButton = page.getByTestId('search-clear-button');
    await expect(clearButton).toBeVisible();

    // 3. Click clear button
    await clearButton.click({ force: true });

    // 4. Verify input is empty
    await expect(mapPage.searchInput).toHaveValue('');

    // 5. Verify clear button is hidden
    await expect(clearButton).not.toBeVisible();
  });

  test('No matching locations found state', async ({ page }) => {
    // 1. Type a random string
    await mapPage.searchInput.focus();
    await mapPage.searchInput.fill('XYZABC123');

    // 2. Verify "No matching locations" message
    await expect(page.getByText('No matching locations', { exact: false })).toBeVisible({
      timeout: 5000,
    });
  });

  test('Auto-toggle layers on selection', async ({ page }) => {
    // 1. Ensure waypoints layer is OFF initially
    expect(await mapPage.isLayerActive('waypoints')).toBe(false);

    // 2. Search for a waypoint
    await mapPage.searchInput.fill('VATLA');
    await page.getByText('VATLA').first().click({ force: true });

    // 3. Verify Waypoints layer is toggled ON
    await expect
      .poll(async () => await mapPage.isLayerActive('waypoints'), {
        timeout: 5000,
      })
      .toBe(true);
  });

  test('Dropdown focus/blur behavior', async ({ page }) => {
    // 1. Type something to show dropdown
    await mapPage.searchInput.fill('VO');
    const suggestions = page.locator('div.aip-search-results-wrapper');
    await expect(suggestions).toBeVisible();

    // 2. Blur the input
    await mapPage.searchInput.blur();

    // 3. Verify dropdown disappears
    await expect(suggestions).not.toBeVisible();

    // 4. Refocus input
    await mapPage.searchInput.focus();

    // 5. Verify dropdown reappears
    await expect(suggestions).toBeVisible();
  });
});
