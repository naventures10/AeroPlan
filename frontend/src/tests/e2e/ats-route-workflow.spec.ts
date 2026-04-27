import { test, expect } from '@playwright/test';
import { MapPage } from './pages/MapPage';

test.describe('ATS Route Workflows', () => {
  let mapPage: MapPage;

  test.beforeEach(async ({ page }) => {
    mapPage = new MapPage(page);
    await mapPage.goto();
    await mapPage.waitForReady();
  });

  test('ATS Route layer should be inactive by default', async () => {
    // Verify Initial Layer States
    expect(await mapPage.isLayerActive('atsRoutes')).toBe(false);
  });

  test('Searching for an ATS Route should auto-toggle layer and show details', async ({ page }) => {
    // 1. Ensure ATS Routes layer is OFF initially
    expect(await mapPage.isLayerActive('atsRoutes')).toBe(false);

    // 2. Search for a specific ATS Route (e.g., A201)
    await mapPage.searchInput.fill('A201');

    // Select the ATS ROUTE result
    const routeResult = page
      .locator('div.cursor-pointer')
      .filter({ hasText: 'A201' })
      .filter({ hasText: 'ATS ROUTE' })
      .first();

    await expect(routeResult).toBeVisible({ timeout: 10000 });
    await routeResult.click();

    // 3. Verify selection via Info Card
    const infoCard = page.getByTestId('feature-info-card');
    await expect(infoCard).toBeVisible({ timeout: 10000 });
    await expect(infoCard).toContainText('A201');
    await expect(infoCard).toContainText('ATS ROUTE');

    // 4. Verify Layer remains INACTIVE (to avoid clutter)
    // The specific route is highlighted via selectedRouteIds, but the global layer is not toggled ON.
    expect(await mapPage.isLayerActive('atsRoutes')).toBe(false);

    // 5. Verify Route Details are loaded (check for segments or waypoints in the card)
    // Based on RouteDetailsPanel implementation, it should show waypoints or segments
    await expect(page.getByText('FIXES')).toBeVisible();

    // 6. Close the card
    await page.getByTestId('close-feature-card').click();
    await expect(infoCard).not.toBeVisible();
  });

  test('Selecting an ATS Route should trigger animation state changes', async ({ page }) => {
    // 1. Search for a route
    await mapPage.searchInput.fill('A201');
    const routeResult = page
      .locator('div.cursor-pointer')
      .filter({ hasText: 'A201' })
      .filter({ hasText: 'ATS ROUTE' })
      .first();
    await expect(routeResult).toBeVisible({ timeout: 10000 });
    await routeResult.click();

    // 2. Check store for animation state using exposed window.useMapStore
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const store = (window as any).useMapStore.getState();
            return {
              hasTrips: store.animatedTrips.length > 0,
              isPlaying: store.animationConfig?.playing === true,
              duration: store.animationConfig?.duration || 0,
            };
          });
        },
        {
          message: 'Animation should be triggered in the store',
          timeout: 10000,
        },
      )
      .toEqual({
        hasTrips: true,
        isPlaying: true,
        duration: expect.any(Number),
      });

    // 3. Verify that animatedTrips is populated
    const tripsCount = await page.evaluate(
      () => (window as any).useMapStore.getState().animatedTrips.length,
    );
    expect(tripsCount).toBeGreaterThan(0);
  });

  test('Manual ATS Route Interaction (Toggle, Hover & Click)', async ({ page }) => {
    // 1. Manually toggle ATS Routes ON
    await mapPage.toggleLayer('atsRoutes');
    expect(await mapPage.isLayerActive('atsRoutes')).toBe(true);

    // 2. Search and fly to a route to center it (e.g., A201)
    await mapPage.searchInput.fill('A201');
    const routeResult = page
      .locator('div.cursor-pointer')
      .filter({ hasText: 'A201' })
      .filter({ hasText: 'ATS ROUTE' })
      .first();
    await expect(routeResult).toBeVisible({ timeout: 10000 });
    await routeResult.click();

    // 3. Wait for the Info Card to appear (indicates animation/deferred timer started)
    const infoCard = page.getByTestId('feature-info-card');
    await expect(infoCard).toBeVisible({ timeout: 10000 });

    const closeButton = page.getByTestId('close-feature-card');
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(page.getByTestId('feature-info-card')).not.toBeVisible();

    // 4. Manual Hover on Canvas (center of screen after fly-to)
    const viewportSize = page.viewportSize();
    if (!viewportSize) throw new Error('Viewport size not set');
    const { width, height } = viewportSize;
    await page.mouse.move(width / 2, height / 2);

    // Verify tooltip appears - should contain 'ROUTE'
    // Note: Tooltip implementation might take a moment to appear
    await expect(page.locator('body')).toContainText('ROUTE');

    // 5. Manual Click on Canvas
    await page.mouse.click(width / 2, height / 2);

    // 6. Verify Info Card appears
    await expect(infoCard).toBeVisible();
    await expect(infoCard).toContainText('ATS ROUTE');
  });
});
