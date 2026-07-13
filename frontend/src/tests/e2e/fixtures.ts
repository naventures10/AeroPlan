/* eslint-disable react-hooks/rules-of-hooks */
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Intercept and fulfill/abort MapTiler requests to prevent actual API calls during testing
    // This applies to ALL tests using this 'test' fixture
    await page.route('**/*maptiler.com*/**', async (route) => {
      const url = route.request().url();
      if (url.includes('style.json')) {
        // MapLibre requires a valid style JSON to initialize without crashing
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            version: 8,
            name: 'Mock Style',
            sources: {
              'maptiler-terrain': {
                type: 'raster-dem',
                tiles: [],
                tileSize: 256,
              },
            },
            layers: [
              {
                id: 'background',
                type: 'background',
                paint: { 'background-color': '#0a0f1e' },
              },
            ],
          }),
        });
      } else {
        // Abort all other MapTiler requests (tiles, fonts, etc.)
        await route.abort();
      }
    });

    // Mock tile requests for standard layers to keep tests isolated
    await page.route(/\/tiles\/erc_india\//, async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from([]) });
    });

    await page.addInitScript(() => {
      (window as any).__LOCKS__ = {
        lockAipSupplements: false,
        lockAerodromeCharts: false,
      };
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await use(page);
  },
});

export { expect } from '@playwright/test';
