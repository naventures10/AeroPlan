import { test, expect } from './fixtures';
import { MapPage } from './pages/MapPage';

test.describe('Weather Layers Userflows (Wind & Clouds)', () => {
  test.beforeEach(async ({ page }) => {
    const mapPage = new MapPage(page);

    // Intercept weather manifest to ensure stable test data
    await page.route('**/api/v1/weather/weather_manifest.json', async (route) => {
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

  test('Toggle Weather Layer and switch between Wind and Cloud', async ({ page }) => {
    // 1. Initially weather controls should not be visible
    await expect(page.locator('.wind-status')).not.toBeVisible();

    // 2. Open Layer Toolbar toggle Weather
    const weatherToggle = page.getByRole('button', { name: 'Toggle Weather' });
    await expect(weatherToggle).toBeVisible({ timeout: 15000 });
    await weatherToggle.click({ force: true });

    // 3. Verify Weather Mode UI is active (defaulting to Wind)
    await expect(page.locator('.wind-status')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.wind-altitude')).toBeVisible();
    await expect(page.locator('.wind-timeline')).toBeVisible();
    // Wind legend should be visible
    await expect(page.locator('.wind-legend-v')).toBeVisible();

    // 4. Switch to Cloud mode (and toggle off wind for exclusive view in test)
    const cloudBtn = page.getByRole('button', { name: 'Cloud' });
    await cloudBtn.click({ force: true });
    const windBtn = page.getByRole('button', { name: 'Wind' });
    await windBtn.click({ force: true });

    // 5. Verify Cloud Mode UI
    // Status badge still exists (now showing cloud status)
    await expect(page.locator('.wind-status')).toBeVisible();
    // Legend should be hidden for clouds
    await expect(page.locator('.wind-legend-v')).not.toBeVisible();
    // Common controls still there
    await expect(page.locator('.wind-altitude')).toBeVisible();
    await expect(page.locator('.wind-timeline')).toBeVisible();

    // 6. Close Weather Layer via the badge X button
    await page.locator('.wind-status button').click({ force: true });
    await expect(page.locator('.wind-status')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle Weather' })).not.toHaveClass(/active/);
  });

  test('Escape closes weather view immediately', async ({ page }) => {
    const weatherToggle = page.getByRole('button', { name: 'Toggle Weather' });
    await expect(weatherToggle).toBeVisible({ timeout: 15000 });

    await weatherToggle.click({ force: true });
    await expect(page.locator('.wind-status')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.wind-status')).not.toBeVisible();

    const weatherState = await page.evaluate(() => {
      const store = (window as any).useMapStore.getState();
      return {
        isWeatherMode: store.isWeatherMode,
        weather: store.activeLayers.weather,
      };
    });

    expect(weatherState).toEqual({ isWeatherMode: false, weather: false });
  });

  test('Altitude Slider interaction in Weather mode', async ({ page }) => {
    // Enter Weather Mode via store
    await page.evaluate(() => {
      const store = (window as any).useMapStore.getState();
      store.setIsWeatherMode(true);
    });

    await expect(page.locator('.wind-altitude')).toBeVisible();

    // Check initial altitude display — should show Surface
    await expect(page.getByTestId('wind-altitude-display')).toContainText('SFC');

    // Step up through levels by clicking the up button
    const upBtn = page.getByTestId('altitude-up');
    // Click up 10 times to reach FL100 (each click is 1000ft)
    for (let i = 0; i < 10; i++) {
      await upBtn.click({ force: true });
    }

    await expect(page.getByTestId('wind-altitude-display')).toContainText('FL100');
  });

  test('Timeline playback interaction in Weather mode', async ({ page }) => {
    // Enter Weather Mode via store
    await page.evaluate(() => {
      const store = (window as any).useMapStore.getState();
      store.setIsWeatherMode(true);
    });

    await expect(page.locator('.wind-timeline')).toBeVisible();

    // 1. Initial play state should be false
    const playButton = page.locator('.wind-timeline__play-circle');

    // 2. Toggle Play
    await playButton.click({ force: true });

    // 3. Verify store state for playing (shared weather playback)
    const isPlaying = await page.evaluate(
      () => (window as any).useMapStore.getState().windIsPlaying,
    );
    expect(isPlaying).toBe(true);

    // 4. Verify pause works
    await playButton.click({ force: true });
    await page.waitForTimeout(500);
    const isPlayingAfterPause = await page.evaluate(
      () => (window as any).useMapStore.getState().windIsPlaying,
    );
    expect(isPlayingAfterPause).toBe(false);
  });
});
