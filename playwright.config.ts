import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5195',
    trace: 'retain-on-failure',
    actionTimeout: 2_000,
    navigationTimeout: 2_000,
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    timezoneId: 'Etc/UTC',
    locale: 'en-GB',
    colorScheme: 'light',
    launchOptions: {
      args: [
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning',
        '--disable-lcd-text',
        '--force-device-scale-factor=1',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--use-gl=swiftshader',
        '--disable-smooth-scrolling',
        '--disable-partial-raster'
      ]
    }
  },
  snapshotPathTemplate: '{testDir}/{testFileDir}/screenshots/{arg}{ext}',
  projects: [
    { name: 'phone', use: { browserName: 'chromium', viewport: { width: 393, height: 852 } } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 1000 } } }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5195',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_USE_FIREBASE_EMULATORS: 'true',
      VITE_FIREBASE_PROJECT_ID: 'vintage-e2e',
      VITE_FIREBASE_API_KEY: 'e2e-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'vintage-e2e.firebaseapp.com',
      VITE_FIREBASE_APP_ID: '1:123456789:web:e2e'
    }
  },
  timeout: 30_000,
  expect: {
    timeout: 2_000,
    toHaveScreenshot: {
      maxDiffPixels: 0,
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css'
    }
  }
});
