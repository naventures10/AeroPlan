import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:5173';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './src/tests/e2e',
  globalSetup: './src/tests/e2e/global-setup.ts',
  globalTeardown: './src/tests/e2e/global-teardown.ts',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Limit workers locally to prevent memory exhaustion and crashes */
  workers: process.env.CI ? 1 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'on',
    /* Use authenticated state globally */
    storageState: 'src/tests/e2e/artifacts/storageState.json',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-gl=angle',
            '--use-angle=gl',
            '--ignore-gpu-blocklist',
            '--disable-gpu-vsync',
          ],
        },
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /* Run your local dev server before starting the tests ONLY if BASE_URL is not set */
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 5173',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          VITE_E2E: 'true',
        },
      },

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: 'src/tests/e2e/artifacts/results',
});
