import { test, expect } from '@playwright/test';
import { MapPage } from './pages/MapPage';

test.describe('Wind Layer Userflows', () => {
  test.beforeEach(async ({ page }) => {
    const mapPage = new MapPage(page);

    // Intercept weather manifest to ensure stable test data
    await page.route('**/weather/weather_manifest.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generated_at: '2026-04-28T07:00:00Z',
          forecasts: [
            {
              valid_time: '2026-04-28T06:00:00Z',
              files: { surface: 'mock-sfc-06.tif' },
            },
            {
              valid_time: '2026-04-28T09:00:00Z',
              files: { surface: 'mock-sfc-09.tif' },
            },
            {
              valid_time: '2026-04-28T12:00:00Z',
              files: { surface: 'mock-sfc-12.tif' },
            },
          ],
        }),
      });
    });

    await mapPage.goto();
    await mapPage.waitForReady();
  });

  test('Toggle Wind Layer and verify controls appear', async ({ page }) => {
    // 1. Initially wind controls should not be visible
    await expect(page.locator('.wind-status')).not.toBeVisible();

    // 2. Open Layer Toolbar toggle Wind
    const windToggle = page.getByTitle('Toggle windlayer');
    await expect(windToggle).toBeVisible({ timeout: 15000 });
    await windToggle.click();

    // 3. Verify Wind Mode UI is active
    await expect(page.locator('.wind-status')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.wind-altitude')).toBeVisible();
    await expect(page.locator('.wind-timeline')).toBeVisible();

    // 4. Close Wind Layer via the badge X button
    await page.locator('.wind-status button').click();
    await expect(page.locator('.wind-status')).not.toBeVisible();
  });

  test('Escape closes wind layer immediately after enabling it', async ({ page }) => {
    const windToggle = page.getByTitle('Toggle windlayer');
    await expect(windToggle).toBeVisible({ timeout: 15000 });

    await windToggle.click();
    await page.keyboard.press('Escape');

    await expect(page.locator('.wind-status')).not.toBeVisible();

    const windState = await page.evaluate(() => {
      const store = (window as any).useMapStore.getState();
      return {
        isWindMode: store.isWindMode,
        windlayer: store.activeLayers.windlayer,
      };
    });

    expect(windState).toEqual({ isWindMode: false, windlayer: false });
  });

  test('Altitude Slider interaction', async ({ page }) => {
    // Enter Wind Mode via store
    await page.evaluate(() => {
      const store = (window as any).useMapStore.getState();
      if (store.setIsWindMode) {
        store.setIsWindMode(true);
      } else {
        (window as any).useMapStore.setState({ isWindMode: true });
        (window as any).useMapStore.getState().toggleLayer('windlayer');
      }
    });

    await expect(page.locator('.wind-altitude')).toBeVisible();

    // Check initial altitude display
    await expect(page.locator('.wind-altitude__display')).toHaveText('Surface');

    // Change altitude via slider
    const slider = page.locator('.wind-altitude__input');
    await slider.fill('10'); // Should be FL100

    await expect(page.locator('.wind-altitude__display')).toHaveText('FL100');
  });

  test('Timeline playback interaction', async ({ page }) => {
    // Enter Wind Mode via store
    await page.evaluate(() => {
      const store = (window as any).useMapStore.getState();
      if (store.setIsWindMode) {
        store.setIsWindMode(true);
      } else {
        (window as any).useMapStore.setState({ isWindMode: true });
        (window as any).useMapStore.getState().toggleLayer('windlayer');
      }
    });

    await expect(page.locator('.wind-timeline')).toBeVisible();

    // 1. Initial play state should be false
    const playButton = page.locator('.wind-timeline__play-circle');

    // 2. Toggle Play
    await playButton.click();

    // 3. Verify store state for playing
    const isPlaying = await page.evaluate(
      () => (window as any).useMapStore.getState().windIsPlaying,
    );
    expect(isPlaying).toBe(true);

    // 4. Verify pause works
    await playButton.click();
    await page.waitForTimeout(500);
    const isPlayingAfterPause = await page.evaluate(
      () => (window as any).useMapStore.getState().windIsPlaying,
    );
    expect(isPlayingAfterPause).toBe(false);
  });
});
