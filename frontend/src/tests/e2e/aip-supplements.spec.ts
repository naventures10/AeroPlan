import { test, expect } from './fixtures';
import { MapPage } from './pages/MapPage';

test.describe('AIP Supplements Workflow', () => {
  let mapPage: MapPage;

  test.beforeEach(async ({ page }) => {
    mapPage = new MapPage(page);
    await mapPage.goto();
    await mapPage.waitForReady();
  });

  test('User Story 1: Open menu drawer and open AIP supplements modal', async ({ page }) => {
    // 1. Toggle the menu drawer
    const menuToggleBtn = page.locator('#aip-menu-toggle-btn');
    await expect(menuToggleBtn).toBeVisible();
    await menuToggleBtn.click();

    // 2. Wait for the drawer item to be visible and click it
    const aipSupplementsItem = page.locator('#aip-drawer-item-aip-supplements');
    await expect(aipSupplementsItem).toBeVisible();
    await aipSupplementsItem.click();

    // 3. Verify modal opens
    const modalHeader = page.locator('.aip-supplements-header-title');
    await expect(modalHeader).toBeVisible();
    await expect(modalHeader).toHaveText('AIP Supplements');

    // Wait for the table to load (so there's at least one 'View PDF' button)
    const viewPdfBtn = page.getByRole('button', { name: 'View PDF' }).first();
    await expect(viewPdfBtn).toBeVisible({ timeout: 10000 });

    // Click the View PDF button
    await viewPdfBtn.click();

    // Verify the PDF viewer controls are visible (confirming PDF view is open)
    const viewerControls = page.locator('.aip-supplements-pdf-controls');
    await expect(viewerControls).toBeVisible({ timeout: 15000 });

    // 4. Close the modal by pressing Escape (since header/close btn is hidden in PDF mode)
    await page.keyboard.press('Escape');

    // Verify modal is closed
    await expect(page.locator('.aip-supplements-modal-container')).not.toBeVisible();
  });
});
