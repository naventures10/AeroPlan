import { test, expect } from '@playwright/test';
import { MapPage } from './pages/MapPage';

test.describe('Chart Overlay Userflows', () => {
  let mapPage: MapPage;

  test.beforeEach(async ({ page }) => {
    // 1. Mock MapTiler to allow map initialization
    await page.route(/api\.maptiler\.com\/maps\/hybrid\/style\.json/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: 8,
          name: 'Mock Style',
          sources: { 'maptiler-terrain': { type: 'raster-dem', tiles: [] } },
          layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#000' } }],
        }),
      });
    });

    await page.route(/api\.maptiler\.com\/.*/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    // 2. Mock tile requests
    await page.route(/\/tiles\/wac_india\//, async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from([]) });
    });
    await page.route(/\/tiles\/erc_india\//, async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from([]) });
    });

    mapPage = new MapPage(page);
    await mapPage.goto();
    await mapPage.waitForReady();
  });

  test('Toggle World Aeronautical Chart (WAC)', async ({ page }) => {
    await mapPage.openOverlayMenu();
    const wacButton = page.locator('button', { hasText: 'World Aeronautical Chart' });
    await expect(wacButton).toBeVisible();

    // Toggle ON
    await wacButton.click();

    // Verify UI state (active class)
    await expect(wacButton).toHaveClass(/bg-amber-500/);

    // Verify Store state
    const isWacActive = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      return window.useMapStore.getState().activeLayers.wacMap;
    });
    expect(isWacActive).toBe(true);

    // Toggle OFF
    await wacButton.click();
    await expect(wacButton).not.toHaveClass(/bg-amber-500/);
  });

  test('Toggle Enroute Chart (ERC)', async ({ page }) => {
    await mapPage.openOverlayMenu();
    const ercButton = page.locator('button', { hasText: 'Enroute Chart' });
    await expect(ercButton).toBeVisible();

    // Toggle ON
    await ercButton.click();

    // Verify UI state
    await expect(ercButton).toHaveClass(/bg-emerald-500/);

    // Verify Store state
    const isErcActive = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      return window.useMapStore.getState().activeLayers.ercMap;
    });
    expect(isErcActive).toBe(true);

    // Toggle OFF
    await ercButton.click();
    await expect(ercButton).not.toHaveClass(/bg-emerald-500/);
  });

  test('Charts are mutually exclusive', async ({ page }) => {
    await mapPage.openOverlayMenu();
    const wacButton = page.locator('button', { hasText: 'World Aeronautical Chart' });
    const ercButton = page.locator('button', { hasText: 'Enroute Chart' });

    // 1. Enable WAC
    await wacButton.click();
    await expect(wacButton).toHaveClass(/bg-amber-500/);

    // 2. Enable ERC
    await ercButton.click();

    // 3. Verify ERC is ON and WAC is now OFF
    await expect(ercButton).toHaveClass(/bg-emerald-500/);
    await expect(wacButton).not.toHaveClass(/bg-amber-500/);

    const storeLayers = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      return window.useMapStore.getState().activeLayers;
    });
    expect(storeLayers.ercMap).toBe(true);
    expect(storeLayers.wacMap).toBe(false);
  });

  test('Auto-zoom when enabling charts at low zoom levels', async ({ page }) => {
    // 1. Set a very low zoom level initially
    await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      window.useMapStore.getState().setViewState({
        longitude: 78.9629,
        latitude: 20.5937,
        zoom: 5,
        pitch: 0,
        bearing: 0,
        maxPitch: 60,
      });
    });

    // 2. Open Menu and toggle ERC
    await mapPage.openOverlayMenu();
    await page.locator('button', { hasText: 'Enroute Chart' }).click();

    // 3. Verify zoom level increased (it should jump to 7.5 per implementation)
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            // @ts-expect-error - useMapStore is attached to window for testing
            return window.useMapStore.getState().viewState.zoom;
          });
        },
        { timeout: 10000 },
      )
      .toBeGreaterThan(7);
  });
});
