import { test, expect } from './fixtures';
import { MapPage } from './pages/MapPage';
import { TerminalPage } from './pages/TerminalPage';

test.describe('Terminal View - Detailed Interactions', () => {
  let mapPage: MapPage;
  let terminalPage: TerminalPage;

  test.beforeEach(async ({ page }) => {
    // Intercept ALL aerodrome API calls
    await page.route('**/api/v1/aerodromes/VOMM/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/charts')) {
        // Mock 20 charts to ensure overflow and scroll buttons appear
        const manyCharts = Array.from({ length: 20 }, (_, i) => ({
          chart_id: i + 1,
          chart_title: `CHART ${i + 1}`,
          chart_index: `AD 2.VOMM-${i + 1}`,
          chart_url: `http://example.com/vomm-${i + 1}.pdf`,
        }));
        manyCharts[0] = {
          chart_id: 1,
          chart_title: 'RNP Y RWY 07',
          chart_index: 'AD 2.VOMM-1',
          chart_url: 'http://example.com/vomm-rnp.pdf',
        };
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(manyCharts),
        });
      }

      if (url.includes('/section/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            section_id: 'AD_2_2',
            title: 'AERODROME GEOGRAPHICAL AND ADMINISTRATIVE DATA',
            data_type: 'object',
            data: {
              rows: [{ label: 'Mock Label 1', value: 'Mock Value 1' }],
            },
          }),
        });
      }

      if (url.includes('/rnp-procedures')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              procedure_id: 101,
              icao_code: 'VOMM',
              chart_key: 'AD-2.VOMM-1',
              name: 'RNP Y RWY 07',
              min_lng: 80.0,
              min_lat: 12.8,
              max_lng: 80.4,
              max_lat: 13.2,
            },
          ]),
        });
      }

      if (url.includes('/metadata')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ icao: 'VOMM', name: 'CHENNAI/INTL' }),
        });
      }

      return route.continue();
    });

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

    // Mocks for dashboard
    await page.route('**/api/v1/weather/VOMM*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ metar: 'VOMM ...', taf: 'VOMM ...' }),
      });
    });
    await page.route('**/api/v1/notams/VOMM*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    await page.route('**/api/v1/daylight/VOMM*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [] }),
      });
    });

    mapPage = new MapPage(page);
    terminalPage = new TerminalPage(page);

    await mapPage.goto();
    await mapPage.waitForReady();
  });

  test('AIP Section dropdown and rendering', async ({ page }) => {
    await mapPage.search('VOMM');

    await expect(mapPage.aerodromeInfoButton).toBeVisible({ timeout: 15000 });
    await mapPage.aerodromeInfoButton.click();

    const sectionOption = page.getByText('AD 2.2', { exact: true });
    await expect(sectionOption).toBeVisible();
    await sectionOption.click();

    const modal = page.locator('div.fixed.inset-0.z-\\[101\\]');
    await expect(modal).toBeVisible();

    await expect(modal).toContainText('AERODROME GEOGRAPHICAL AND ADMINISTRATIVE DATA');
    await expect(modal).toContainText('Mock Value 1');

    await modal
      .locator('button')
      .filter({ has: page.locator('svg.lucide-x') })
      .first()
      .click();
    await expect(modal).not.toBeVisible();
  });

  test('Chart Carousel scrolling', async ({ page }) => {
    await mapPage.search('VOMM');
    await expect(terminalPage.chartCarousel).toBeVisible({ timeout: 15000 });

    const scrollRight = terminalPage.chartCarousel
      .locator('button')
      .filter({ has: page.locator('svg.lucide-chevron-right') });
    const scrollLeft = terminalPage.chartCarousel
      .locator('button')
      .filter({ has: page.locator('svg.lucide-chevron-left') });

    // With 20 charts, scroll right must be visible
    await expect(scrollRight).toBeVisible({ timeout: 10000 });

    const lastChart = page.locator('button[title="CHART 20"]');

    await scrollRight.click();
    await scrollRight.click();
    await scrollRight.click();

    await expect(scrollLeft).toBeVisible();
    await expect(lastChart).toBeVisible();
  });

  test('RNP Procedure selection activates transition', async ({ page }) => {
    await mapPage.search('VOMM');
    await terminalPage.openChart('RNP Y RWY 07');
    await terminalPage.clickViewIn3D();

    const state = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      const s = window.useMapStore.getState();
      return {
        viewMode: s.viewMode,
        pitch: s.viewState.pitch,
      };
    });

    expect(state.viewMode).toBe('TERMINAL');
    expect(state.pitch).toBeGreaterThan(40);
    await expect(page.locator('h2', { hasText: 'VOMM' })).toBeVisible();
  });
});
