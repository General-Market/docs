import { defineConfig } from '@playwright/test'

const BASE_URL = process.env.E2E_FRONTEND_URL || 'https://www.generalmarket.io'

export default defineConfig({
  testDir: './tests',
  testMatch: /35-production-smoke/,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 30_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    browserName: 'chromium',
  },
})
