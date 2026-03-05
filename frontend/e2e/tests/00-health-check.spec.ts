import { test, expect } from '@playwright/test';
import { checkHealth, checkRpc } from '../helpers/backend-api';
import { RPC_URL, L3_RPC_URL } from '../fixtures/wallet';

test.describe('Health Check', () => {
  test('frontend loads — Vision on root', async ({ page }) => {
    await page.goto('/');
    // Root is now the Vision page
    await expect(page.getByText(/vision|batch|market/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('frontend loads — ITP listing on /index', async ({ page }) => {
    await page.goto('/index');
    await expect(page).toHaveTitle(/General Market/i);
    // The hero heading should be visible
    await expect(page.getByRole('heading', { name: 'Markets' })).toBeVisible({ timeout: 15_000 });
  });

  test('backend API is reachable', async () => {
    const healthy = await checkHealth();
    expect(healthy).toBe(true);
  });

  test('Arbitrum RPC is reachable', async () => {
    const ok = await checkRpc(RPC_URL);
    expect(ok).toBe(true);
  });

  test('L3 RPC is reachable', async () => {
    const ok = await checkRpc(L3_RPC_URL);
    expect(ok).toBe(true);
  });

  test('ITP listing appears with at least one ITP', async ({ page }) => {
    await page.goto('/index');
    // Wait for ITP cards to load (they come from on-chain reads)
    const itpCards = page.locator('[id^="itp-card-"]');
    await expect(itpCards.first()).toBeVisible({ timeout: 30_000 });
  });
});
