import { expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';

const layerIdToTitle: Record<string, string> = {
  aerodromes: 'Aerodromes',
  waypoints: 'Waypoints',
  navaids: 'NavAids',
  atsroutes: 'ATS Routes',
  atsRoutes: 'ATS Routes',
  airspaces: 'Airspaces',
  weather: 'Weather',
};

export class MapPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly mapCanvas: Locator;
  readonly baseMapButton: Locator;
  readonly ercToggleButton: Locator;
  readonly zoomSlider: Locator;
  readonly aerodromeInfoButton: Locator;
  readonly dashboardHandle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('input.aip-search-input');
    this.mapCanvas = page.locator('canvas').first();
    this.baseMapButton = page.getByTitle('Change Base Map');
    this.ercToggleButton = page.getByTitle('Toggle Enroute Chart');
    this.zoomSlider = page.getByLabel('Zoom Level');
    this.aerodromeInfoButton = page.getByText('AERODROME INFORMATION');
    this.dashboardHandle = page.getByTitle('Expand Dashboard');
  }

  /**
   * Checks if a specific layer toggle in the LayerToolbar is active.
   * Active state is determined by the presence of the 'active' class.
   */
  async isLayerActive(layerId: string): Promise<boolean> {
    const title = layerIdToTitle[layerId.toLowerCase()] || layerIdToTitle[layerId] || layerId;
    const button = this.page.getByRole('button', { name: `Toggle ${title}`, exact: true });
    const className = await button.getAttribute('class');
    return className ? className.includes('active') : false;
  }

  async goto() {
    await this.page.goto('/app');
  }

  async waitForReady() {
    // Wait for initial loader to disappear
    await expect(this.page.locator('#placeholder').first()).not.toBeVisible({ timeout: 30000 });
    // Ensure map is visible
    await expect(this.mapCanvas).toBeVisible({ timeout: 15000 });
    // Ensure UI has faded in (important for framer-motion animations)
    await expect(this.searchInput).toBeVisible({ timeout: 15000 });
  }

  async toggleLayer(layerName: string) {
    const title = layerIdToTitle[layerName.toLowerCase()] || layerIdToTitle[layerName] || layerName;
    const button = this.page.getByRole('button', { name: `Toggle ${title}`, exact: true });
    await button.click();
  }

  async cycleBaseMap() {
    await this.baseMapButton.click();
  }

  async selectEnrouteChart() {
    await this.ercToggleButton.click();
  }

  async search(query: string, resultText?: string) {
    await this.searchInput.focus();
    await this.searchInput.fill(query);

    // Small delay to allow debounce and animation to start
    await this.page.waitForTimeout(500);

    // Use resultText if provided (more unique), otherwise use the query
    const targetText = resultText || query;
    const result = this.page
      .locator('[data-testid="search-result-item"]')
      .filter({ hasText: targetText })
      .first();

    // Wait for results to appear (auto-retries)
    await expect(result).toBeVisible({ timeout: 25000 });
    await result.click({ force: true });
  }
}
