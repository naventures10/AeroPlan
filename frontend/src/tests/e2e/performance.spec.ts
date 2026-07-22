import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

declare global {
  interface Window {
    startFPSProfiling?: () => void;
    stopFPSProfiling?: () => {
      averageFps: number;
      minimumFps: number;
      maxFrameTimeMs: number;
      droppedFramesPercent30fps: number;
      totalFrames: number;
      durationMs: number;
      activeLayers: Record<string, boolean>;
    } | null;
  }
}

interface BenchmarkingResult {
  configuration: string;
  averageFps: number;
  minimumFps: number;
  maxFrameTimeMs: number;
  droppedFramesPercent30fps: number;
  totalFrames: number;
  durationMs: number;
}

const testResults: BenchmarkingResult[] = [];

// Emulate iPhone 11 parameters manually (avoiding devices['iPhone 11'] which forces WebKit)
// This allows running in Chromium to support CDP-based CPU throttling.
test.use({
  viewport: { width: 414, height: 896 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1',
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

test.describe('Mobile Map Layer Performance Profiling (iPhone 11)', () => {
  test.beforeEach(async ({ page }) => {
    // Only run performance profiling on Chromium project to utilize CDP throttling
    if (test.info().project.name !== 'chromium') {
      test.skip();
      return;
    }

    // Enable 6x CPU throttling via Chrome DevTools Protocol to simulate mobile device hardware
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 6 });

    // Mock daylight API
    await page.route('**/api/v1/daylight/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [] }),
      });
    });

    // Mock airspace NOTAMs
    await page.route('**/api/v1/notams/airspace*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // Navigate away to destroy map and free WebGL contexts
    await page.goto('about:blank');
  });

  test.afterAll(() => {
    // Generate and write markdown performance comparison report
    if (testResults.length === 0) return;

    let markdown = `# Mobile Map Layer Rendering Performance Report\n\n`;
    markdown += `**Date**: ${new Date().toISOString()}\n`;
    markdown += `**Device Emulation**: iPhone 11 (6x CPU Throttling applied)\n\n`;
    markdown += `| Layer Configuration | Avg FPS | Min FPS | Max Frame Time | % Frames < 30 FPS (Dropped) | Total Frames | Test Duration |\n`;
    markdown += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

    testResults.forEach((res) => {
      markdown += `| **${res.configuration}** | ${res.averageFps} | ${res.minimumFps} | ${res.maxFrameTimeMs} ms | ${res.droppedFramesPercent30fps}% | ${res.totalFrames} | ${(res.durationMs / 1000).toFixed(1)}s |\n`;
    });

    markdown += `\n### Recommendations & Analysis\n`;
    markdown += `- Check the percentage of dropped frames: values above 15% indicate visible stuttering during interaction.\n`;
    markdown += `- Minimum FPS highlights frame spikes (e.g. from data loading or heavy shader compiles).\n`;

    // __dirname is available in CommonJS/ESM mixed contexts or via node path resolution
    const reportsDir = path.join(process.cwd(), 'src', 'tests', 'e2e', 'artifacts', 'results');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const reportPath = path.join(reportsDir, 'performance-report.md');
    fs.writeFileSync(reportPath, markdown, 'utf8');

    console.log('\n=============================================================');
    console.log('         MOBILE PERFORMANCE PROFILE RESULTS MATRIX           ');
    console.log('=============================================================');
    console.table(
      testResults.map((r) => ({
        Layer: r.configuration,
        'Avg FPS': `${r.averageFps} FPS`,
        'Min FPS': `${r.minimumFps} FPS`,
        'Max Frame Time': `${r.maxFrameTimeMs} ms`,
        'Laggy Frames': `${r.droppedFramesPercent30fps}%`,
      })),
    );
    console.log(`Saved performance report to: ${reportPath}`);
    console.log('=============================================================\n');
  });

  const runPerformanceBenchmark = async (
    page: Page,
    configName: string,
    setupStoreState: () => void,
  ) => {
    await page.goto('/app');

    // Wait for canvas to load and become visible
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20000 });
    // Small delay to let initial loads settle
    await page.waitForTimeout(2000);

    // Apply custom layer state programmatically in store by evaluating the callback directly in browser context
    await page.evaluate(setupStoreState);

    // Wait 1.5s for data fetches and WebGL compiles to settle
    await page.waitForTimeout(1500);

    // Start FPS profiling
    await page.evaluate(() => {
      if (window.startFPSProfiling) {
        window.startFPSProfiling();
      } else {
        console.warn('startFPSProfiling is not registered on window');
      }
    });

    // Get viewport bounding size for map gestures
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;

      // Interaction 1: Pan left and right
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx - 150, cy + 30, { steps: 25 });
      await page.waitForTimeout(100);
      await page.mouse.move(cx + 150, cy - 30, { steps: 25 });
      await page.mouse.up();

      // Interaction 2: Zoom in and out using wheel scroll
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(300);
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(300);

      // Interaction 3: Map tilt/rotation (using CustomMapController middle-click triggers)
      await page.mouse.move(cx, cy);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(cx + 80, cy - 60, { steps: 20 });
      await page.mouse.up({ button: 'middle' });
      await page.waitForTimeout(200);
    }

    // Stop FPS profiling
    const stats = await page.evaluate(() => {
      if (window.stopFPSProfiling) {
        return window.stopFPSProfiling();
      }
      return null;
    });

    if (stats) {
      testResults.push({
        configuration: configName,
        averageFps: stats.averageFps,
        minimumFps: stats.minimumFps,
        maxFrameTimeMs: stats.maxFrameTimeMs,
        droppedFramesPercent30fps: stats.droppedFramesPercent30fps,
        totalFrames: stats.totalFrames,
        durationMs: stats.durationMs,
      });
    }
  };

  test('Profile case: Baseline (Aerodromes only)', async ({ page }) => {
    await runPerformanceBenchmark(page, 'Baseline (Aerodromes)', () => {
      const store = (window as unknown as { useMapStore: { setState: (s: unknown) => void } })
        .useMapStore;
      store.setState({
        activeLayers: {
          aerodromes: true,
          waypoints: false,
          navaids: false,
          atsRoutes: false,
          airspaces: false,
          airspaceFIR: false,
          airspaceRegulated: false,
          airspaceControl: false,
          airspaceUpr: false,
          ercMap: false,
          weather: false,
        },
        isWeatherMode: false,
        isWindMode: false,
        isCloudMode: false,
      });
    });
  });

  test('Profile case: Aerodromes + Waypoints', async ({ page }) => {
    await runPerformanceBenchmark(page, 'Aerodromes + Waypoints', () => {
      const store = (window as unknown as { useMapStore: { setState: (s: unknown) => void } })
        .useMapStore;
      store.setState({
        activeLayers: {
          aerodromes: true,
          waypoints: true,
          navaids: false,
          atsRoutes: false,
          airspaces: false,
          airspaceFIR: false,
          airspaceRegulated: false,
          airspaceControl: false,
          airspaceUpr: false,
          ercMap: false,
          weather: false,
        },
        isWeatherMode: false,
        isWindMode: false,
        isCloudMode: false,
      });
    });
  });

  test('Profile case: Aerodromes + Navaids', async ({ page }) => {
    await runPerformanceBenchmark(page, 'Aerodromes + Navaids', () => {
      const store = (window as unknown as { useMapStore: { setState: (s: unknown) => void } })
        .useMapStore;
      store.setState({
        activeLayers: {
          aerodromes: true,
          waypoints: false,
          navaids: true,
          atsRoutes: false,
          airspaces: false,
          airspaceFIR: false,
          airspaceRegulated: false,
          airspaceControl: false,
          airspaceUpr: false,
          ercMap: false,
          weather: false,
        },
        isWeatherMode: false,
        isWindMode: false,
        isCloudMode: false,
      });
    });
  });

  test('Profile case: Aerodromes + ATS Routes', async ({ page }) => {
    await runPerformanceBenchmark(page, 'Aerodromes + ATS Routes', () => {
      const store = (window as unknown as { useMapStore: { setState: (s: unknown) => void } })
        .useMapStore;
      store.setState({
        activeLayers: {
          aerodromes: true,
          waypoints: false,
          navaids: false,
          atsRoutes: true,
          airspaces: false,
          airspaceFIR: false,
          airspaceRegulated: false,
          airspaceControl: false,
          airspaceUpr: false,
          ercMap: false,
          weather: false,
        },
        isWeatherMode: false,
        isWindMode: false,
        isCloudMode: false,
      });
    });
  });

  test('Profile case: Aerodromes + Airspaces', async ({ page }) => {
    await runPerformanceBenchmark(page, 'Aerodromes + Airspaces', () => {
      const store = (window as unknown as { useMapStore: { setState: (s: unknown) => void } })
        .useMapStore;
      store.setState({
        activeLayers: {
          aerodromes: true,
          waypoints: false,
          navaids: false,
          atsRoutes: false,
          airspaces: true,
          airspaceFIR: true,
          airspaceRegulated: true,
          airspaceControl: true,
          airspaceUpr: true,
          ercMap: false,
          weather: false,
        },
        isWeatherMode: false,
        isWindMode: false,
        isCloudMode: false,
      });
    });
  });

  test('Profile case: Aerodromes + Weather Layers', async ({ page }) => {
    await runPerformanceBenchmark(page, 'Aerodromes + Weather', () => {
      const store = (window as unknown as { useMapStore: { setState: (s: unknown) => void } })
        .useMapStore;
      store.setState({
        activeLayers: {
          aerodromes: true,
          waypoints: false,
          navaids: false,
          atsRoutes: false,
          airspaces: false,
          airspaceFIR: false,
          airspaceRegulated: false,
          airspaceControl: false,
          airspaceUpr: false,
          ercMap: false,
          weather: true,
        },
        isWeatherMode: true,
        isWindMode: true,
        isCloudMode: true,
      });
    });
  });

  test('Profile case: All Layers toggled ON', async ({ page }) => {
    test.setTimeout(60000);
    await runPerformanceBenchmark(page, 'All Layers ON', () => {
      const store = (window as unknown as { useMapStore: { setState: (s: unknown) => void } })
        .useMapStore;
      store.setState({
        activeLayers: {
          aerodromes: true,
          waypoints: true,
          navaids: true,
          atsRoutes: true,
          airspaces: true,
          airspaceFIR: true,
          airspaceRegulated: true,
          airspaceControl: true,
          airspaceUpr: true,
          ercMap: false,
          weather: true,
        },
        isWeatherMode: true,
        isWindMode: true,
        isCloudMode: true,
      });
    });
  });
});
