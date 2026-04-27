import { test, expect } from '@playwright/test';
import { MapPage } from './pages/MapPage';
import { TerminalPage } from './pages/TerminalPage';

test.describe('3D Terminal View Userflows', () => {
  let mapPage: MapPage;
  let terminalPage: TerminalPage;

  test.beforeEach(async ({ page }) => {
    // 1. Mock API Responses for VOMM
    await page.route('**/api/v1/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'VOMM',
            name: 'CHENNAI/INTL',
            type: 'AERODROME',
            center: [80.1805, 12.9941],
            properties: { icao: 'VOMM', name: 'CHENNAI/INTL' },
          },
        ]),
      });
    });

    await page.route('**/api/v1/aerodromes/VOMM/charts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            chart_id: 1,
            chart_title: 'RNP Y RWY 07',
            chart_index: 'AD 2.VOMM-1',
            chart_url: 'http://example.com/vomm-rnp.pdf',
          },
          {
            chart_id: 2,
            chart_title: 'AERODROME CHART',
            chart_index: 'AD 2.VOMM-2',
            chart_url: 'http://example.com/vomm-ad.pdf',
          },
        ]),
      });
    });

    await page.route('**/api/v1/aerodromes/VOMM/rnp-procedures', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            procedure_id: 101,
            icao_code: 'VOMM',
            chart_key: 'AD-2.VOMM-1', // Normalized 'AD 2.VOMM-1'
            name: 'RNP Y RWY 07',
            min_lng: 80.0,
            min_lat: 12.8,
            max_lng: 80.4,
            max_lat: 13.2,
          },
        ]),
      });
    });

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

    await page.route('**/api/v1/notams/VOMM*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            notam_id: 'A1234/26',
            series: 'A',
            number: '1234',
            year: '26',
            description: 'MOCK NOTAM DESCRIPTION',
            valid_from: '2026-04-27T00:00:00Z',
            valid_to: '2026-04-28T23:59:59Z',
          },
        ]),
      });
    });

    await page.route('**/api/v1/daylight/VOMM*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ twilight_from: '05:30', twilight_to: '18:30' }),
      });
    });

    await page.route('**/api/v1/aerodromes/VOMM/metadata', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ icao: 'VOMM', name: 'CHENNAI/INTL' }),
      });
    });

    // Mock PDF proxy
    await page.route('**/api/v1/proxy/pdf*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4'),
      });
    });

    mapPage = new MapPage(page);
    terminalPage = new TerminalPage(page);

    await mapPage.goto();
    await mapPage.waitForReady();
  });

  test('Navigate to Terminal View and interact with Dashboard', async ({ page }) => {
    // 1. Search and select VOMM
    await mapPage.search('VOMM');

    // 2. Verify Dashboard appears
    await expect(page.locator('h2', { hasText: 'VOMM' })).toBeVisible({ timeout: 15000 });

    // 3. Check METAR tab
    await terminalPage.switchTab('METAR');
    await expect(page.getByText('VOMM 271230Z 08005KT')).toBeVisible();

    // 4. Check NOTAM tab
    await terminalPage.switchTab('NOTAM');
    await expect(page.getByText('MOCK NOTAM DESCRIPTION')).toBeVisible();

    // 5. Test Collapse/Expand
    await page.keyboard.press('Escape'); // Triggers collapse
    await expect(page.getByText('CONDITIONS')).not.toBeVisible();

    await terminalPage.expandDashboard();
    await expect(page.getByText('CONDITIONS')).toBeVisible();
  });

  test('Select RNP Procedure and trigger 3D View', async ({ page }) => {
    // 1. Navigate to VOMM
    await mapPage.search('VOMM');

    // 2. Verify Chart Carousel is visible
    await expect(terminalPage.chartCarousel).toBeVisible();

    // 3. Open RNP Chart
    await terminalPage.openChart('RNP Y RWY 07');

    // 4. Verify "View in 3D space" button is present (because RNP procedure matched)
    await expect(terminalPage.viewIn3DButton).toBeVisible();

    // 5. Click "View in 3D space"
    await terminalPage.clickViewIn3D();

    // 6. Verify Dashboard/Modal closes and View Mode switches to TERMINAL in store
    await expect(terminalPage.modalCloseButton).not.toBeVisible();

    const viewMode = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      return window.useMapStore.getState().viewMode;
    });
    expect(viewMode).toBe('TERMINAL');

    // 7. Verify 3D state (pitch)
    const pitch = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      return window.useMapStore.getState().viewState.pitch;
    });
    expect(pitch).toBeGreaterThan(0);
  });

  test('Return to Enroute from Terminal View', async ({ page }) => {
    // 1. Navigate to VOMM
    await mapPage.search('VOMM');
    await expect(page.locator('h2', { hasText: 'VOMM' })).toBeVisible();

    // 2. Press Escape twice to return
    // First Escape collapses the dashboard
    await page.keyboard.press('Escape');

    // Small wait for collapse animation if needed, but playwright should poll
    await page.keyboard.press('Escape');

    // 3. Verify Enroute-only elements reappear
    await expect(mapPage.searchInput).toBeVisible();

    // Dashboard should be gone
    await expect(page.locator('h2', { hasText: 'VOMM' })).not.toBeVisible();

    const viewMode = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      return window.useMapStore.getState().viewMode;
    });
    expect(viewMode).toBe('ENROUTE');
  });
});
