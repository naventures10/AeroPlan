import { expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';

export class TerminalPage {
  readonly page: Page;
  readonly dashboard: Locator;
  readonly expandButton: Locator;
  readonly chartDropdownTrigger: Locator;
  readonly chartDropdownMenu: Locator;
  readonly viewIn3DButton: Locator;
  readonly modalCloseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dashboard = page.locator('div').filter({ hasText: 'CONDITIONS' }).first();
    this.expandButton = page.getByTitle('Expand Dashboard');
    this.chartDropdownTrigger = page.getByRole('button', { name: 'AERODROME CHARTS' });
    this.chartDropdownMenu = page.locator('.aip-dropdown-menu');
    this.viewIn3DButton = page.getByText('View in 3D space');
    this.modalCloseButton = page.locator('button:has-text("✕")');
  }

  async switchTab(tabName: 'CONDITIONS' | 'METAR' | 'TAF' | 'NOTAM') {
    await this.page.getByText(tabName, { exact: true }).click();
  }

  async openChart(chartTitle: string) {
    await expect(this.chartDropdownTrigger).toBeVisible({ timeout: 10000 });
    await this.chartDropdownTrigger.click();
    const chartButton = this.page.getByRole('button', { name: chartTitle });
    await expect(chartButton).toBeVisible({ timeout: 10000 });
    await chartButton.click();
  }

  async clickViewIn3D() {
    await expect(this.viewIn3DButton).toBeVisible();
    await this.viewIn3DButton.click();
  }

  async closeChartModal() {
    await this.modalCloseButton.click();
    await expect(this.modalCloseButton).not.toBeVisible();
  }

  async isDashboardCollapsed(): Promise<boolean> {
    return !(await this.page.getByText('CONDITIONS').isVisible());
  }

  async expandDashboard() {
    if (await this.isDashboardCollapsed()) {
      await this.expandButton.click();
    }
  }
}
