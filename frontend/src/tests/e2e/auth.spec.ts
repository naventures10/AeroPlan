import { test, expect } from '@playwright/test';

test.describe('Authentication Workflow', () => {
  // We want to test the auth flow from scratch, so we override the global storageState
  test.use({ storageState: { cookies: [], origins: [] } });

  const password = 'securepassword123';

  test('User Registration and Sign In/Out Flow', async ({ page }) => {
    const randomEmail = `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
    // 1. Landing Page -> Create Account
    await page.goto('/');

    // We expect to see the landing page "Create Account" button
    const landingCreateAccountBtn = page.getByRole('button', { name: 'Create Account' }).first();
    await landingCreateAccountBtn.click();

    // 2. Auth Modal - Registration
    const modalTitle = page.locator('.auth-modal-title');
    await expect(modalTitle).toHaveText('Create an Account');

    await page.getByPlaceholder('Amelia').fill('Test');
    await page.getByPlaceholder('Earhart').fill('User');
    await page.locator('input[type="email"]').fill(randomEmail);
    await page.locator('input[type="password"]').fill(password);

    // Submit registration
    await page
      .locator('.auth-modal-container')
      .getByRole('button', { name: 'Create Account' })
      .click();

    // 3. Verify logged in and redirected to App
    await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

    // Wait for the app interface to load
    const menuBtn = page.getByRole('button', { name: 'Toggle menu' });
    await expect(menuBtn).toBeVisible();

    // 4. Open Menu -> User Profile -> Sign Out
    await menuBtn.click();

    const profileBtn = page.getByRole('button', { name: 'User Profile' });
    await profileBtn.click();

    // The user profile modal should appear, click Sign Out
    const signOutBtn = page.getByRole('button', { name: 'Sign Out' });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // 5. Verify logged out (redirected back to landing page)
    await expect(page).toHaveURL(/\/$/);

    // 6. Sign In Flow
    const landingSignInBtn = page.getByRole('button', { name: 'Sign In' }).first();
    await expect(landingSignInBtn).toBeVisible();
    await landingSignInBtn.click();

    await expect(modalTitle).toHaveText('Welcome Back');

    await page.locator('input[type="email"]').fill(randomEmail);
    await page.locator('input[type="password"]').fill(password);

    // Submit login
    await page.locator('.auth-modal-container').getByRole('button', { name: 'Sign In' }).click();

    // 7. Verify logged in again
    await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
  });
});
