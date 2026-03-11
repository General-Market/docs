import { defineConfig } from '@playwright/test';
import { IS_ANVIL, FRONTEND_URL } from './env';

/**
 * 3-phase test execution with separate wallet keys per chain:
 *
 * Phase 1 — DATA (2 projects, parallel on Anvil, serial on testnet):
 *   itp-data (DEPLOYER_KEY):    01 → 02 → 03 → 04 → 05 → 07 → 08 → 10-morpho → 18 → 26
 *   vision-data (VISION_PLAYER_KEY): 10-vision → 12 → 13 → 15 → 25 → 14 → 19 → 20 → 21
 *
 * Phase 2 — UI VERIFY (depends on respective Phase 1 project):
 *   ui-verify-itp (depends: itp-data): 00, 06, 16, 17, 22, 23, 24, 27, 28, 32, 34
 *   ui-verify-vision (depends: vision-data): 11, 29, 33, 35
 *
 * Phase 3 — LATE WRITES (depends on Phase 1 AND Phase 2 — no concurrent DEPLOYER usage):
 *   write-after: 30, 31
 *
 * NONCE SAFETY: On testnet, workers=1 because `backend-api.ts`'s `l3SignedSend` has no
 * cross-process nonce lock. On Anvil, `ensureUsdcBalance` is a no-op (pre-funded in
 * globalSetup) and Anvil auto-manages nonces for unsigned txs, so parallel is safe.
 */
export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  testDir: './tests',
  fullyParallel: false,
  workers: IS_ANVIL ? 2 : 1, // Parallel on Anvil only — testnet lacks cross-process nonce lock
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
    ...(!IS_ANVIL ? {
      launchOptions: {
        args: ['--allow-running-insecure-content'],
      },
    } : {}),
  },
  projects: [
    // Phase 1: produce on-chain state (separate keys, parallel on Anvil)
    {
      name: 'itp-data',
      // 0[1-578]: tests 01-05, 07, 08. NOT 06 (moved to ui-verify-itp).
      testMatch: /(^|\/)0[1-578]-.*\.spec\.ts$|(^|\/)10-morpho.*\.spec\.ts$|(^|\/)18-.*\.spec\.ts$|(^|\/)26-.*\.spec\.ts$/,
    },
    {
      name: 'vision-data',
      testMatch: /(^|\/)10-vision\.spec\.ts$|(^|\/)1[2-5]-.*\.spec\.ts$|(^|\/)19-.*\.spec\.ts$|(^|\/)2[0-1]-.*\.spec\.ts$|(^|\/)25-.*\.spec\.ts$/,
    },
    // Phase 2: UI verification (depends on respective Phase 1 only — limited blast radius)
    {
      name: 'ui-verify-itp',
      dependencies: ['itp-data'],
      testMatch: /(^|\/)00-.*\.spec\.ts$|(^|\/)06-.*\.spec\.ts$|(^|\/)1[6-7]-.*\.spec\.ts$|(^|\/)2[2-4]-.*\.spec\.ts$|(^|\/)27-.*\.spec\.ts$|(^|\/)28-.*\.spec\.ts$|(^|\/)32-.*\.spec\.ts$|(^|\/)34-.*\.spec\.ts$/,
    },
    {
      name: 'ui-verify-vision',
      dependencies: ['vision-data'],
      testMatch: /(^|\/)11-.*\.spec\.ts$|(^|\/)29-.*\.spec\.ts$|(^|\/)33-.*\.spec\.ts$|(^|\/)35-.*\.spec\.ts$/,
    },
    // Phase 3: late writes (after ALL earlier phases — prevents concurrent DEPLOYER usage)
    {
      name: 'write-after',
      dependencies: ['itp-data', 'vision-data', 'ui-verify-itp', 'ui-verify-vision'],
      testMatch: /(^|\/)30-.*\.spec\.ts$|(^|\/)31-.*\.spec\.ts$/,
    },
  ],
  ...(!process.env.E2E_FRONTEND_URL ? {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  } : {}),
});
