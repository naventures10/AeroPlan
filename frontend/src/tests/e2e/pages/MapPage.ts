import { expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';

export class MapPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly mapCanvas: Locator;
  readonly overlayMenuButton: Locator;
  readonly aerodromeInfoButton: Locator;
  readonly dashboardHandle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('input[placeholder*="SEARCH"]');
    this.mapCanvas = page.locator('canvas').first();
    this.overlayMenuButton = page.getByTitle('Map Overlays');
    this.aerodromeInfoButton = page.getByText('AERODROME INFORMATION');
    this.dashboardHandle = page.getByTitle('Expand Dashboard');
  }

  /**
   * Checks if a specific layer toggle in the LayerToolbar is active.
   * Active state is determined by the absence of the 'text-zinc-500' (inactive) class.
   */
  async isLayerActive(layerId: string): Promise<boolean> {
    const button = this.page.getByTitle(`Toggle ${layerId}`);
    const className = await button.getAttribute('class');
    return className ? !className.includes('text-zinc-500') : false;
  }

  async goto() {
    await this.page.goto('/');
  }

  async waitForReady() {
    // Wait for initial loader to disappear
    await expect(this.page.locator('#placeholder').first()).not.toBeVisible({ timeout: 30000 });
    // Ensure map is visible
    await expect(this.mapCanvas).toBeVisible();
  }

  async toggleLayer(layerName: string) {
    const button = this.page.getByTitle(`Toggle ${layerName}`);
    await button.click();
  }

  async openOverlayMenu() {
    await this.overlayMenuButton.click();
  }

  async selectEnrouteChart() {
    await this.openOverlayMenu();
    await this.page.getByText('Enroute Chart').click();
  }

  async search(query: string, resultText?: string) {
    await this.searchInput.fill(query);
    // Wait for search debounce and results
    await this.page.waitForTimeout(1000);

    // Use resultText if provided (more unique), otherwise use the query
    const targetText = resultText || query;
    const result = this.page.getByText(targetText).first();

    await expect(result).toBeVisible();
    await result.click();
  }
}
