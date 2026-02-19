import { test, expect } from '@playwright/test';
import { checkHealth, checkRpc } from '../helpers/backend-api';
import { RPC_URL, L3_RPC_URL } from '../fixtures/wallet';

test.describe('Health Check', () => {
  test('frontend loads and shows page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AgiArena/i);
    // The hero heading should be visible
    await expect(page.getByRole('heading', { name: 'Index', exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('backend API is reachable', async () => {
    const healthy = await checkHealth();
    expect(healthy).toBe(true);
  });

  test('Arbitrum Anvil (8546) is reachable', async () => {
    const ok = await checkRpc(RPC_URL);
    expect(ok).toBe(true);
  });

  test('L3 Anvil (8545) is reachable', async () => {
    const ok = await checkRpc(L3_RPC_URL);
    expect(ok).toBe(true);
  });

  test('ITP listing appears with at least one ITP', async ({ page }) => {
    await page.goto('/');
    // Wait for ITP cards to load (they come from on-chain reads)
    const itpCards = page.locator('.bg-terminal-dark.border.border-white\\/10.rounded-lg.p-4');
    await expect(itpCards.first()).toBeVisible({ timeout: 30_000 });
  });
});
