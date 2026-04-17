import { defineConfig } from '@playwright/test';
import { FRONTEND_URL } from './env';

/**
 * Cascade-safe project layout — oracle failures never block UI/API tests.
 *
 * Phase 1 — DATA (2 projects, separate wallet keys):
 *   itp-data:    01-05, 09, 10-morpho, 26, 36, 47  (stable — no oracle consensus)
 *   vision-data: 10-vision, 12-15, 19-21, 25, 41-46, 48-49
 *
 * Phase 2a — UI NEEDS ITP STATE (depends on itp-data):
 *   ui-needs-state: 00, 16, 17, 22-24, 29, 31, 32  (ITP listings, wallet balances, portfolio)
 *
 * Phase 2b — UI + API STANDALONE (no dependencies):
 *   ui-standalone: 06, 11, 27, 28, 33, 34
 *
 * Oracle — STANDALONE (failures isolated, no downstream impact):
 *   itp-oracle: 07, 08, 18  (oracle consensus, settlement bridge)
 *
 * Late writes: 30 (depends itp-data only)
 * Swarm: 40 (standalone)
 * Production smoke: 35 (standalone)
 * Page smoke: 50-52, 56-59, 63-69 (standalone, no wallet)
 *
 * NONCE SAFETY: workers=1 — l3SignedSend has no cross-process nonce lock.
 */
export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 30_000,
  },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 60_000,
    navigationTimeout: 90_000,
    browserName: 'chromium',
    launchOptions: {
      args: ['--allow-running-insecure-content'],
    },
  },
  projects: [
    // ── Phase 1: produce on-chain state (separate keys, parallel on Anvil) ──
    {
      name: 'itp-data',
      // Core ITP state: 01-05, 09, 10-morpho, 26, 36, 47
      // NOT 07/08/18 (oracle-dependent, moved to itp-oracle to avoid cascade)
      testMatch: /(^|\/)0[1-59]-.*\.spec\.ts$|(^|\/)10-morpho.*\.spec\.ts$|(^|\/)26-.*\.spec\.ts$|(^|\/)36-.*\.spec\.ts$|(^|\/)47-.*\.spec\.ts$/,
    },
    {
      name: 'vision-data',
      testMatch: /(^|\/)10-vision\.spec\.ts$|(^|\/)1[2-5]-.*\.spec\.ts$|(^|\/)19-.*\.spec\.ts$|(^|\/)2[0-1]-.*\.spec\.ts$|(^|\/)25-.*\.spec\.ts$|(^|\/)4[1-6]-.*\.spec\.ts$|(^|\/)4[89]-.*\.spec\.ts$/,
    },

    // ── Phase 2a: UI that needs ITP state (wallet balances, ITP listings, portfolio) ──
    {
      name: 'ui-needs-state',
      dependencies: ['itp-data'],
      testMatch: /(^|\/)00-.*\.spec\.ts$|(^|\/)1[6-7]-.*\.spec\.ts$|(^|\/)2[2-4]-.*\.spec\.ts$|(^|\/)29-.*\.spec\.ts$|(^|\/)31-.*\.spec\.ts$|(^|\/)32-.*\.spec\.ts$/,
    },

    // ── Phase 2b: UI + API verification — standalone (no ITP state needed) ──
    {
      name: 'ui-standalone',
      testMatch: /(^|\/)06-.*\.spec\.ts$|(^|\/)11-.*\.spec\.ts$|(^|\/)27-.*\.spec\.ts$|(^|\/)28-.*\.spec\.ts$|(^|\/)33-.*\.spec\.ts$|(^|\/)34-.*\.spec\.ts$/,
    },

    // ── Oracle-dependent tests — standalone (failures don't cascade) ──
    {
      name: 'itp-oracle',
      testMatch: /(^|\/)0[78]-.*\.spec\.ts$|(^|\/)18-.*\.spec\.ts$/,
    },

    // ── Late writes (needs ITP state only — reduced dependency surface) ──
    {
      name: 'write-after',
      dependencies: ['itp-data'],
      testMatch: /(^|\/)30-.*\.spec\.ts$/,
    },

    // ── Swarm (standalone — long-running, shouldn't block anything) ──
    {
      name: 'swarm',
      testMatch: /40-/,
      use: { browserName: 'chromium' as const },
    },

    // ── Standalone: production smoke (no dependencies) ──
    {
      name: 'production-smoke',
      testMatch: /(^|\/)35-.*\.spec\.ts$/,
    },

    // ── Standalone: page smoke (no wallet, no on-chain state) ──
    {
      name: 'page-smoke',
      testMatch: /(^|\/)5[0-2]-.*\.spec\.ts$|(^|\/)5[6-9]-.*\.spec\.ts$|(^|\/)63-.*\.spec\.ts$|(^|\/)6[4-9]-.*\.spec\.ts$/,
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
