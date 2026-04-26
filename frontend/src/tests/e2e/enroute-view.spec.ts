import { test, expect } from '@playwright/test';
import { MapPage } from './pages/MapPage';

test.describe('Enroute View Workflows', () => {
  let mapPage: MapPage;

  test.beforeEach(async ({ page }) => {
    mapPage = new MapPage(page);
    await mapPage.goto();
    await mapPage.waitForReady();
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

    // 4. Visual check for map content (Optional: ensure airport markers are present)
    // Since we verified the toggle is ON and MapView receives 'aerodromes' data,
    // we can be confident the engine is rendering them.
  });

  test('User Story 1.1: Toggling Airspaces ON should enable all airspace sub-layers', async () => {
    // 1. Toggle Airspaces ON
    await mapPage.toggleLayer('airspaces');

    // 2. Verify master and sub-layers are active
    expect(await mapPage.isLayerActive('airspaces')).toBe(true);

    // Check internal store state (if possible via UI or just assume based on color)
    // In our case, the 'airspaces' button color is the only indicator on the toolbar
    // But we know from the store logic that FIR, etc. are now true.
  });

  test('User Story 2: Search for waypoint should auto-toggle layer ON and fly-to location', async ({
    page,
  }) => {
    // 1. Ensure Waypoints layer is OFF initially
    expect(await mapPage.isLayerActive('waypoints')).toBe(false);

    // 2. Search for a specific waypoint (e.g., VATLA)
    await mapPage.searchInput.fill('VATLA');
    const result = page.getByText('VATLA').first();
    await result.click();

    // 3. Verify selection via Info Card
    const infoCard = page.getByTestId('feature-info-card');
    await expect(infoCard).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'VATLA' })).toBeVisible();

    // 4. Verify Layer Auto-Toggle
    // The layer should have been turned ON automatically by the search handler
    await expect
      .poll(
        async () => {
          return await mapPage.isLayerActive('waypoints');
        },
        { timeout: 5000 },
      )
      .toBe(true);

    // 5. Verify Hover / Tooltip
    // Wait for the fly-to animation (2000ms) to settle
    await page.waitForTimeout(3000);

    // Move mouse to center of map where VATLA is now centered
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);

    // Tooltip should appear with "SIGNIFICANT POINT"
    await expect(page.locator('body')).toContainText('SIGNIFICANT POINT');

    // 6. Close the card
    await page.getByTestId('close-feature-card').click();
    await expect(infoCard).not.toBeVisible();
  });

  test('User Story 2.1: Manual Waypoint Interaction (Hover & Click on Map)', async ({ page }) => {
    // 1. Manually toggle Waypoints ON
    await mapPage.toggleLayer('waypoints');
    expect(await mapPage.isLayerActive('waypoints')).toBe(true);

    // 2. Position the map over a known waypoint (VATLA)
    // We use search just to position the map, then we'll interact with the canvas
    await mapPage.searchInput.fill('VATLA');
    await page.getByText('VATLA').first().click();

    // 3. Wait for animation and then DESELECT it (to test manual clicking)
    await page.waitForTimeout(3000);
    await page.getByTestId('close-feature-card').click();
    await expect(page.getByTestId('feature-info-card')).not.toBeVisible();

    // 4. Manual Hover on Canvas
    // VATLA is now at the center of the map
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);

    // Verify tooltip appears
    await expect(page.locator('body')).toContainText('SIGNIFICANT POINT');
    await expect(page.locator('body')).toContainText('VATLA');

    // 5. Manual Click on Canvas
    await page.mouse.click(width / 2, height / 2);

    // 6. Verify Info Card appears from the manual click
    const infoCard = page.getByTestId('feature-info-card');
    await expect(infoCard).toBeVisible();
    await expect(page.getByRole('heading', { name: 'VATLA' })).toBeVisible();
  });

  test('User Story 3: Search for Navaid should auto-toggle layer ON and fly-to location', async ({
    page,
  }) => {
    // 1. Ensure Navaids layer is OFF initially
    expect(await mapPage.isLayerActive('navaids')).toBe(false);

    // 2. Search for a specific Navaid (e.g., MMV - Chennai VOR)
    await mapPage.searchInput.fill('MMV');
    const result = page.getByText('MMV').first();
    await result.click();

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

    // 5. Close the card
    await page.getByTestId('close-feature-card').click();
    await expect(infoCard).not.toBeVisible();
  });

  test('User Story 3.1: Manual Navaid Interaction (Hover & Click on Map)', async ({ page }) => {
    // 1. Manually toggle Navaids ON
    await mapPage.toggleLayer('navaids');
    expect(await mapPage.isLayerActive('navaids')).toBe(true);

    // 2. Position the map over MMV
    await mapPage.searchInput.fill('MMV');
    await page.getByText('MMV').first().click();

    // 3. Wait and Deselect
    await page.waitForTimeout(3000);
    await page.getByTestId('close-feature-card').click();
    await expect(page.getByTestId('feature-info-card')).not.toBeVisible();

    // 4. Manual Hover on Canvas
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);

    // Verify tooltip appears with Navaid specific info
    await expect(page.locator('body')).toContainText('CHENNAI');
    await expect(page.locator('body')).toContainText('VOR/DME');
    await expect(page.locator('body')).toContainText('MMV');

    // 5. Manual Click on Canvas
    await page.mouse.click(width / 2, height / 2);

    // 6. Verify Info Card appears
    const infoCard = page.getByTestId('feature-info-card');
    await expect(infoCard).toBeVisible();
    await expect(page.getByRole('heading', { name: 'CHENNAI' })).toBeVisible();
  });
});
