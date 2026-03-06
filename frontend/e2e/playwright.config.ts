import { defineConfig } from '@playwright/test';

const IS_TESTNET = process.env.E2E_TESTNET === '1';
const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000';

export default defineConfig({
  globalSetup: IS_TESTNET ? undefined : require.resolve('./global-setup'),
  testDir: './tests',
  fullyParallel: false,
  workers: 2,
  timeout: IS_TESTNET ? 180_000 : 120_000,
  expect: {
    timeout: IS_TESTNET ? 30_000 : 15_000,
  },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: IS_TESTNET ? 60_000 : 30_000,
    navigationTimeout: 90_000,
    browserName: 'chromium',
  },
  // Start local dev server if no E2E_FRONTEND_URL override
  ...(!process.env.E2E_FRONTEND_URL ? {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  } : {}),
});
