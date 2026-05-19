import { test, expect } from './fixtures';
import { MapPage } from './pages/MapPage';

test.describe('Chart Overlay Userflows', () => {
  let mapPage: MapPage;

  test.beforeEach(async ({ page }) => {
    mapPage = new MapPage(page);
    await mapPage.goto();
    await mapPage.waitForReady();
  });

  test('Toggle Enroute Chart (ERC) directly', async ({ page }) => {
    await expect(mapPage.ercToggleButton).toBeVisible();

    // Toggle ON
    await mapPage.ercToggleButton.click();

    // Verify Store state
    const isErcActive = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      return window.useMapStore.getState().activeLayers.ercMap;
    });
    expect(isErcActive).toBe(true);

    // Toggle OFF
    await mapPage.ercToggleButton.click();
    const isErcActiveOff = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      return window.useMapStore.getState().activeLayers.ercMap;
    });
    expect(isErcActiveOff).toBe(false);
  });

  test('Toggle Base Map Styles via cycling (Dark, Light, Hybrid)', async ({ page }) => {
    await expect(mapPage.baseMapButton).toBeVisible();

    // Initial state should be dark
    const initialStyle = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      return window.useMapStore.getState().mapStyle;
    });
    expect(initialStyle).toBe('dark');

    // 1. Click to cycle to Light Mode
    await mapPage.cycleBaseMap();
    const currentStyle1 = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      return window.useMapStore.getState().mapStyle;
    });
    expect(currentStyle1).toBe('light');

    // 2. Click to cycle to Hybrid Mode
    await mapPage.cycleBaseMap();
    const currentStyle2 = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      return window.useMapStore.getState().mapStyle;
    });
    expect(currentStyle2).toBe('hybrid');

    // 3. Click to cycle back to Dark Mode
    await mapPage.cycleBaseMap();
    const currentStyle3 = await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      return window.useMapStore.getState().mapStyle;
    });
    expect(currentStyle3).toBe('dark');
  });

  test('Auto-zoom when enabling charts at low zoom levels', async ({ page }) => {
    // 1. Set a very low zoom level initially and ensure layers are OFF
    await page.evaluate(() => {
      // @ts-expect-error - useMapStore is attached to window for testing
      window.useMapStore.setState({
        activeLayers: { ercMap: false },
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

    // 2. Toggle ERC
    await mapPage.ercToggleButton.click();

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

  test('Interact with Zoom Slider', async ({ page }) => {
    // 1. Verify zoom slider is visible
    await expect(mapPage.zoomSlider).toBeVisible();

    // 2. Set zoom via slider input
    await mapPage.zoomSlider.fill('12.5');

    // 3. Verify state updated successfully
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            // @ts-expect-error - useMapStore is attached to window for testing
            return window.useMapStore.getState().viewState.zoom;
          });
        },
        { timeout: 5000 },
      )
      .toBeCloseTo(12.5, 1);
  });
});
