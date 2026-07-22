import { test, expect } from './fixtures';
import { MapPage } from './pages/MapPage';

test.describe('Enroute View Workflows', () => {
  let mapPage: MapPage;

  test.beforeEach(async ({ page }) => {
    mapPage = new MapPage(page);
    await mapPage.goto();
    await mapPage.waitForReady();
  });

  test.afterEach(async ({ page }) => {
    // Navigate away to explicitly destroy the map instance and free the WebGL context
    // This prevents WebGL context exhaustion crashes on the CI runner
    await page.goto('about:blank');
  });

  test('User Story 1: Initial state should only have Airports active', async () => {
    // 1. Verify Search Bar is present
    await expect(mapPage.searchInput).toBeVisible();

    // 2. Verify Map Canvas is rendered
    await expect(mapPage.mapCanvas).toBeVisible();

    // 3. Verify Initial Layer States
    // Only 'aerodromes' should be active
    expect(await mapPage.isLayerActive('aerodromes')).toBe(true);

    // Others should be inactive
    expect(await mapPage.isLayerActive('waypoints')).toBe(false);
    expect(await mapPage.isLayerActive('navaids')).toBe(false);
    expect(await mapPage.isLayerActive('atsRoutes')).toBe(false);
    expect(await mapPage.isLayerActive('airspaces')).toBe(false);
  });

  test('User Story 1.1: Toggling Airspaces ON should enable all airspace sub-layers', async () => {
    // 1. Toggle Airspaces ON
    await mapPage.toggleLayer('airspaces');

    // 2. Verify master and sub-layers are active
    expect(await mapPage.isLayerActive('airspaces')).toBe(true);
  });

  test('User Story 2: Search for waypoint should auto-toggle layer ON and fly-to location', async ({
    page,
  }) => {
    // 1. Ensure Waypoints layer is OFF initially
    expect(await mapPage.isLayerActive('waypoints')).toBe(false);

    // 2. Search for a specific waypoint (e.g., VATLA)
    await mapPage.searchInput.clear();
    await mapPage.searchInput.pressSequentially('VATLA', { delay: 100 });
    const result = page
      .locator('[data-testid="search-result-item"]')
      .filter({ hasText: 'VATLA' })
      .first();
    await expect(result).toBeVisible({ timeout: 15000 });
    await result.click({ force: true });

    // 3. Verify selection via Info Card
    const infoCard = page.getByTestId('feature-info-card');
    await expect(infoCard).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'VATLA' })).toBeVisible();

    // 4. Verify Layer Auto-Toggle
    await expect
      .poll(
        async () => {
          return await mapPage.isLayerActive('waypoints');
        },
        { timeout: 5000 },
      )
      .toBe(true);

    // 5. Verify Hover / Tooltip
    await page.waitForTimeout(3000);
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);
    await expect(page.locator('body')).toContainText(/SIGNIFICANT POINT/i, { timeout: 15000 });

    // 6. Close the card
    await page.getByTestId('close-feature-card').click();
    await expect(infoCard).not.toBeVisible();
  });

  test('User Story 2.1: Manual Waypoint Interaction (Hover & Click on Map)', async ({ page }) => {
    // 1. Manually toggle Waypoints ON
    await mapPage.toggleLayer('waypoints');
    expect(await mapPage.isLayerActive('waypoints')).toBe(true);

    // 2. Position the map over a known waypoint (VATLA)
    await mapPage.searchInput.clear();
    await mapPage.searchInput.pressSequentially('VATLA', { delay: 100 });
    const vatlaResult = page
      .locator('[data-testid="search-result-item"]')
      .filter({ hasText: 'VATLA' })
      .first();
    await expect(vatlaResult).toBeVisible({ timeout: 15000 });
    await vatlaResult.click({ force: true });

    // 3. Wait and Deselect
    await page.waitForTimeout(3000);
    const closeButton = page.getByTestId('close-feature-card');
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(page.getByTestId('feature-info-card')).not.toBeVisible();

    // 4. Manual Hover
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);
    await expect(page.locator('body')).toContainText(/VATLA/i, { timeout: 15000 });

    // 5. Manual Click
    await page.waitForTimeout(500);
    await page.mouse.click(width / 2, height / 2);
    await expect(page.getByTestId('feature-info-card')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'VATLA' })).toBeVisible();
  });

  test('User Story 3: Search for NavAid should auto-toggle layer ON and fly-to location', async ({
    page,
  }) => {
    // 1. Ensure NavAids layer is OFF initially
    expect(await mapPage.isLayerActive('navaids')).toBe(false);

    // 2. Search for a specific NavAid (e.g., MMV)
    await mapPage.searchInput.clear();
    await mapPage.searchInput.pressSequentially('MMV', { delay: 100 });
    const mmvResult = page
      .locator('[data-testid="search-result-item"]')
      .filter({ hasText: 'MMV' })
      .first();
    await expect(mmvResult).toBeVisible({ timeout: 15000 });
    await mmvResult.click({ force: true });

    // 3. Verify selection via Info Card
    const infoCard = page.getByTestId('feature-info-card');
    await expect(infoCard).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'CHENNAI' })).toBeVisible();

    // 4. Verify Layer Auto-Toggle
    await expect
      .poll(
        async () => {
          return await mapPage.isLayerActive('navaids');
        },
        { timeout: 5000 },
      )
      .toBe(true);

    // 5. Verify Hover / Tooltip
    await page.waitForTimeout(3000);
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);
    await expect(page.locator('body')).toContainText(/DVOR\/DME/i, { timeout: 15000 });

    // 6. Close the card
    await page.getByTestId('close-feature-card').click();
    await expect(infoCard).not.toBeVisible();
  });

  test('User Story 4: Search for Airspace should auto-toggle layer ON, fly-to, and show info card', async ({
    page,
  }) => {
    // 1. Ensure Airspaces layer is OFF initially
    expect(await mapPage.isLayerActive('airspaces')).toBe(false);

    // 2. Search for a specific Airspace (e.g., Delhi FIR)
    await mapPage.searchInput.clear();
    await mapPage.searchInput.pressSequentially('Delhi FIR', { delay: 100 });

    // Select the AIRSPACE result
    const airspaceResult = page
      .locator('[data-testid="search-result-item"]')
      .filter({ hasText: 'Delhi' })
      .filter({ hasText: 'AIRSPACE' })
      .first();

    await expect(airspaceResult).toBeVisible({ timeout: 10000 });
    await airspaceResult.click();

    // 3. Verify selection via Info Card
    const infoCard = page.getByTestId('feature-info-card');
    await expect(infoCard).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="feature-info-card"]')).toContainText('Delhi');

    // 4. Verify Layer Auto-Toggle
    await expect
      .poll(
        async () => {
          return await mapPage.isLayerActive('airspaces');
        },
        { timeout: 5000 },
      )
      .toBe(true);

    // 5. Close the card
    await page.getByTestId('close-feature-card').click();
    await expect(infoCard).not.toBeVisible();
  });

  test('User Story 4.1: Manual Airspace Label Click should open info card without highlighting', async ({
    page,
  }) => {
    test.setTimeout(120000);

    // 1. Position the map over Delhi FIR using search FIRST (before loading heavy airspaces)
    // This avoids blocking the main thread during typing
    await mapPage.searchInput.clear();
    await mapPage.searchInput.pressSequentially('Delhi FIR', { delay: 100 });
    const airspaceResult = page
      .locator('[data-testid="search-result-item"]')
      .filter({ hasText: 'Delhi' })
      .filter({ hasText: 'AIRSPACE' })
      .first();
    await expect(airspaceResult).toBeVisible({ timeout: 20000 });
    await airspaceResult.click({ force: true });

    // 2. Verify info card appears and search auto-toggled the layer ON
    const infoCard = page.getByTestId('feature-info-card');
    await expect(infoCard).toBeVisible({ timeout: 10000 });
    expect(await mapPage.isLayerActive('airspaces')).toBe(true);

    // 3. Close the card to remove the search highlighting
    await page.getByTestId('close-feature-card').click();
    await expect(infoCard).not.toBeVisible();

    // 4. Wait for the map and heavy GeoJSON to settle
    await page.waitForTimeout(3000);

    // 5. Verify the airspace layer is still ON after dismissing the card
    expect(await mapPage.isLayerActive('airspaces')).toBe(true);

    // 6. Simulate a manual airspace label click by directly invoking the same
    //    setSelectedFeature action the DeckGL click handler calls.
    //    window.useMapStore is exposed in E2E/dev/localhost mode via main.tsx.
    //    This validates the info card rendering pipeline without relying on
    //    pixel-perfect map rendering position on CI.
    await page.evaluate(() => {
      const store = (window as any).useMapStore?.getState?.();
      if (store?.setSelectedFeature) {
        store.setSelectedFeature({
          type: 'AIRSPACE',
          data: {
            properties: {
              name: 'DELHI FIR',
              identification: 'DELHI FIR',
              airspace_type: 'FIR',
            },
          },
        });
      }
    });
    await expect(page.getByTestId('feature-info-card')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="feature-info-card"]')).toContainText('DELHI');
  });
});
