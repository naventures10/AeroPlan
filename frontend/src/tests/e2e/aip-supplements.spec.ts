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

    // Verify the Document Viewer header is present
    await expect(modalHeader).toHaveText('Document Viewer');

    // Verify the PDF viewer controls are visible
    const viewerControls = page.locator('.aip-supplements-pdf-controls');
    await expect(viewerControls).toBeVisible();

    // Go back to the table
    const backBtn = page.locator('.aip-supplements-action-btn').first();
    await backBtn.click();
    await expect(modalHeader).toHaveText('AIP Supplements');

    // 4. Close the modal
    const closeBtn = page.locator('.aip-supplements-action-btn').last();
    await closeBtn.click();

    // Verify modal is closed
    await expect(modalHeader).not.toBeVisible();
  });
});
