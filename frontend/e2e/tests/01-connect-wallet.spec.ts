import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import { connectWalletButton, ensureWalletConnected } from '../helpers/selectors';

test.describe('Connect Wallet', () => {
  test('connects wallet and shows truncated address', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    const addrBtn = page.getByRole('button', { name: truncated });

    // On testnet the mock wallet always auto-connects via seeded wagmi localStorage.
    // Wait directly for the address button — no fallback to Connect button needed.
    await expect(addrBtn).toBeVisible({ timeout: 60_000 });
  });

  test('disconnect button works', async ({ walletPage: page }) => {
    test.setTimeout(120_000);

    // Ensure connected — handles both auto-connect and manual connect paths.
    await ensureWalletConnected(page, TEST_ADDRESS);

    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    const addrBtn = page.getByRole('button', { name: truncated });

    // Click address button to trigger disconnect
    await addrBtn.click();

    // After disconnect the connect button must appear — give generous timeout
    // because the mock wallet does NOT auto-reconnect after an explicit disconnect.
    await expect(connectWalletButton(page)).toBeVisible({ timeout: 15_000 });
  });

  test('wallet reconnects on page reload', async ({ walletPage: page }) => {
    test.setTimeout(240_000);

    // Ensure connected first
    await ensureWalletConnected(page, TEST_ADDRESS);

    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    const addrBtn = page.getByRole('button', { name: truncated });

    // Navigate to same URL instead of reload — page.reload() causes frame detach under parallel load
    try {
      await page.goto(page.url(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    } catch {
      // Retry once
      await page.goto(page.url(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    }

    // Wagmi seeded localStorage — wallet should auto-reconnect on every fresh page load.
    // The connect button is never expected here; wait for the address directly.
    await expect(addrBtn).toBeVisible({ timeout: 60_000 });
  });
});
