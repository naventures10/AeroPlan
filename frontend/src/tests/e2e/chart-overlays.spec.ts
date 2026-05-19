import { test, expect } from './fixtures';
import { MapPage } from './pages/MapPage';

test.describe('Chart Overlay Userflows', () => {
  let mapPage: MapPage;

  test.beforeEach(async ({ page }) => {
    mapPage = new MapPage(page);
    await mapPage.goto();
    await mapPage.waitForReady();
  });

  test('Toggle World Aeronautical Chart (WAC)', async ({ page }) => {
    await mapPage.openOverlayMenu();
    const wacButton = page.locator('button', { hasText: 'World Aeronautical Chart' });
    await expect(wacButton).toBeVisible();

    // Toggle ON
    await wacButton.click({ force: true });

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
    await ercButton.click({ force: true });

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
    await wacButton.click({ force: true });
    await expect(wacButton).toHaveClass(/bg-amber-500/);

    // 2. Enable ERC
    await ercButton.click({ force: true });

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
    // 1. Set a very low zoom level initially and ensure layers are OFF
    await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      window.useMapStore.setState({
        activeLayers: { wacMap: false, ercMap: false },
        viewState: {
          longitude: 78.9629,
          latitude: 20.5937,
          zoom: 5,
          pitch: 0,
          bearing: 0,
          maxPitch: 60,
        },
      });
    });

    // 2. Open Menu and toggle ERC
    await mapPage.openOverlayMenu();
    await page.locator('button', { hasText: 'Enroute Chart' }).click({ force: true });

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
