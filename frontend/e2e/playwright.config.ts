import { defineConfig } from '@playwright/test';
import { IS_ANVIL, FRONTEND_URL } from './env';

export default defineConfig({
  globalSetup: IS_ANVIL ? require.resolve('./global-setup') : undefined,
  testDir: './tests',
  fullyParallel: false,
  workers: 2,
  timeout: IS_ANVIL ? 120_000 : 180_000,
  expect: {
    timeout: IS_ANVIL ? 15_000 : 30_000,
  },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: IS_ANVIL ? 30_000 : 60_000,
    navigationTimeout: 90_000,
    browserName: 'chromium',
    // Allow HTTP RPC calls from HTTPS pages on testnet (mixed content)
    ...(!IS_ANVIL ? {
      launchOptions: {
        args: ['--allow-running-insecure-content'],
      },
    } : {}),
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
