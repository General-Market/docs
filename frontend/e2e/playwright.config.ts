import { defineConfig } from '@playwright/test';
import { IS_ANVIL, FRONTEND_URL } from './env';

/**
 * Two projects run in parallel on 2 workers:
 * - itp: Index/ITP tests (00-08, 16-18, 22-24, 26-27)
 * - vision: Vision tests (10-15, 19-21, 25)
 *
 * Vision tests share PLAYER1/PLAYER2 accounts for L3 transactions,
 * so they MUST run on a single worker to avoid cross-process nonce conflicts.
 * The L3 nonce lock is process-local and can't serialize across workers.
 */
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
    video: 'off',
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
  projects: [
    {
      name: 'itp',
      testMatch: /(^|\/)0[0-8]-.*\.spec\.ts$|(^|\/)1[6-8]-.*\.spec\.ts$|(^|\/)2[2-4]-.*\.spec\.ts$|(^|\/)2[6-7]-.*\.spec\.ts$/,
    },
    {
      name: 'vision',
      testMatch: /(^|\/)1[0-5]-.*\.spec\.ts$|(^|\/)19-.*\.spec\.ts$|(^|\/)2[0-1]-.*\.spec\.ts$|(^|\/)25-.*\.spec\.ts$/,
    },
  ],
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
