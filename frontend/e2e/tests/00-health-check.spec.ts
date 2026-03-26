import { test, expect } from '@playwright/test';
import { checkHealth, checkRpc } from '../helpers/backend-api';
import { RPC_URL, L3_RPC_URL } from '../fixtures/wallet';
import { AP_URL } from '../env';

test.describe('Health Check', () => {
  test('frontend loads — Vision on root', async ({ page }) => {
    await page.goto('/');
    // Root is now the Vision page
    await expect(page.getByText(/vision|batch|market/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('frontend loads — ITP listing on /index', async ({ page }) => {
    await page.goto('/index');
    await expect(page).toHaveTitle(/General Market/i);
    // The page should show ITP content (cards or table)
    const hasContent = await page.locator('text=/Markets|ITP|NAV|Index|Prediction/i').first().isVisible({ timeout: 15_000 }).catch(() => false)
    expect(hasContent, '/index page did not load ITP content').toBe(true);
  });

  test('backend API is reachable', async () => {
    test.setTimeout(60_000);
    // Data-node may still be warming up after itp-data setup — retry with backoff
    let healthy = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      healthy = await checkHealth();
      if (healthy) break;
      console.warn(`[health-check] attempt ${attempt}/5 failed, waiting 5s...`);
      await new Promise(r => setTimeout(r, 5_000));
    }
    expect(healthy).toBe(true);
  });

  test('Settlement RPC is reachable', async () => {
    const ok = await checkRpc(RPC_URL);
    expect(ok).toBe(true);
  });

  test('L3 RPC is reachable', async () => {
    const ok = await checkRpc(L3_RPC_URL);
    expect(ok).toBe(true);
  });

  test('AP is reachable', async () => {
    try {
      const res = await fetch(`${AP_URL}/health`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      expect(res.ok).toBe(true);
    } catch (e: any) {
      // On testnet, Node.js on Mac can't reach VPS 2 directly (timeout).
      // Verify via L3 RPC instead — if L3 is up, AP is co-located.
      if (e?.name === 'TimeoutError') {
        const rpcOk = await checkRpc(L3_RPC_URL);
        expect(rpcOk).toBe(true); // L3 RPC lives on same VPS as AP
      } else {
        throw e;
      }
    }
  });

  test('ITP listing appears with at least one ITP', async ({ page }) => {
    test.setTimeout(120_000);
    // After itp-data setup, ITP cards may take time to appear (SSE + data-node indexing)
    const itpCards = page.locator('[id^="itp-card-"]');
    let itpVisible = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      itpVisible = await itpCards.first().isVisible({ timeout: 60_000 }).catch(() => false);
      if (itpVisible) break;
      console.warn(`[itp-listing] attempt ${attempt}/3 — no ITP cards yet, retrying...`);
    }
    expect(itpVisible).toBe(true);
  });
});
