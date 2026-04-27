import { expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';

export class TerminalPage {
  readonly page: Page;
  readonly dashboard: Locator;
  readonly expandButton: Locator;
  readonly chartCarousel: Locator;
  readonly viewIn3DButton: Locator;
  readonly modalCloseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dashboard = page.locator('div.glass-morphism-heavy').filter({ hasText: 'DASHBOARD' });
    this.expandButton = page.getByTitle('Expand Dashboard');
    this.chartCarousel = page
      .locator('span:has-text("Aerodrome Charts")')
      .locator('..')
      .locator('..');
    this.viewIn3DButton = page.getByText('View in 3D space');
    this.modalCloseButton = page.getByText('✕');
  }

  async switchTab(tabName: 'CONDITIONS' | 'METAR' | 'TAF' | 'NOTAM') {
    await this.page.getByText(tabName, { exact: true }).click();
  }

  async openChart(chartTitle: string) {
    const chartButton = this.page.locator(`button[title*="${chartTitle}"]`);
    await expect(chartButton).toBeVisible();
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
    // If width is 38 (from motion.div animate={{ width: isCollapsed ? 38 : 78 }}), it's collapsed
    // But playwright might not see the raw style if it's dynamic.
    // We can check if tabs are visible.
    return !(await this.page.getByText('CONDITIONS').isVisible());
  }
  async expandDashboard() {
    if (await this.isDashboardCollapsed()) {
      await this.expandButton.click();
    }
  }
}
