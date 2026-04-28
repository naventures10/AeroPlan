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
    await mapPage.searchInput.fill('VATLA');
    const result = page.getByText('VATLA').first();
    await result.click();

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
    await mapPage.searchInput.fill('VATLA');
    await page.getByText('VATLA').first().click();

    // 3. Wait and Deselect
    await page.waitForTimeout(3000);
    const closeButton = page.getByTestId('close-feature-card');
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(page.getByTestId('feature-info-card')).not.toBeVisible();

    // 4. Manual Hover
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);
    await expect(page.locator('body')).toContainText('VATLA');

    // 5. Manual Click
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

    // 5. Verify Hover / Tooltip
    await page.waitForTimeout(3000);
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);
    await expect(page.locator('body')).toContainText('DVOR/DME');

    // 6. Close the card
    await page.getByTestId('close-feature-card').click();
    await expect(infoCard).not.toBeVisible();
  });

  test('User Story 4: Search for Airspace should auto-toggle layer ON and fly-to location', async ({
    page,
  }) => {
    // 1. Ensure Airspaces layer is OFF initially
    expect(await mapPage.isLayerActive('airspaces')).toBe(false);

    // 2. Search for a specific Airspace (e.g., Delhi FIR)
    await mapPage.searchInput.fill('Delhi FIR');

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
    await expect(page.locator('[data-testid="feature-info-card"]')).toContainText('AIRSPACE');
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

  test('User Story 4.1: Manual Airspace Interaction (Hover & Click on Map)', async ({ page }) => {
    test.setTimeout(120000);

    // 1. Manually toggle Airspaces ON
    await mapPage.toggleLayer('airspaces');
    expect(await mapPage.isLayerActive('airspaces')).toBe(true);

    // 2. Position the map over Delhi FIR
    // 2. Search for AIRSPACE
    await mapPage.searchInput.focus();
    await mapPage.searchInput.fill('Delhi FIR');
    const airspaceResult = page
      .locator('[data-testid="search-result-item"]')
      .filter({ hasText: 'Delhi' })
      .filter({ hasText: 'AIRSPACE' })
      .first();
    await expect(airspaceResult).toBeVisible({ timeout: 20000 });
    await airspaceResult.click({ force: true });
    // 3. Wait and Deselect
    const closeButton = page.getByTestId('close-feature-card').first();
    await expect(closeButton).toBeVisible({ timeout: 20000 });
    await closeButton.click();
    await expect(page.getByTestId('feature-info-card').first()).not.toBeVisible({ timeout: 10000 });

    // 4. Manual Hover on Canvas
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);

    // Verify tooltip appears
    await expect(page.locator('body').first()).toContainText('Delhi');
    await expect(page.locator('body').first()).toContainText('FIR');

    // 5. Manual Click on Canvas
    await page.mouse.click(width / 2, height / 2);

    // 6. Verify Info Card appears
    const infoCard = page.getByTestId('feature-info-card').first();
    await expect(infoCard).toBeVisible();
    await expect(page.locator('[data-testid="feature-info-card"]').first()).toContainText(
      'AIRSPACE',
    );
  });
});
