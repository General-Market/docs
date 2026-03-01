import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  testDir: './tests',
  fullyParallel: false,
  workers: 2,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    browserName: 'chromium',
  },
  projects: [
    {
      // ITP flow — runs serially (00 → 09), plus regression tests (16+)
      name: 'itp',
      testMatch: ['**/0[0-6]-*.spec.ts', '**/0[89]-*.spec.ts', '**/1[6-9]-*.spec.ts'],
    },
    {
      // Vision — runs in parallel with ITP flow (10-15 only; 16+ are itp regression)
      name: 'vision',
      testMatch: '**/1[0-5]-*.spec.ts',
    },
  ],
});
