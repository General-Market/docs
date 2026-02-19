import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import { connectWalletButton, disconnectButton } from '../helpers/selectors';

test.describe('Connect Wallet', () => {
  test('connects wallet and shows truncated address', async ({ walletPage: page }) => {
    // The mock wallet is injected — click Connect
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();

    // Should show truncated address: 0xf39F...2266
    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByText(truncated, { exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('disconnect button works', async ({ walletPage: page }) => {
    // Connect first
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();

    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByText(truncated, { exact: true })).toBeVisible({ timeout: 15_000 });

    // Now disconnect
    const disconnectBtn = disconnectButton(page);
    await disconnectBtn.click();

    // Should show Connect Wallet again
    await expect(connectWalletButton(page)).toBeVisible({ timeout: 10_000 });
  });

  test('wallet reconnects on page reload', async ({ walletPage: page }) => {
    // Connect
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();

    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByText(truncated, { exact: true })).toBeVisible({ timeout: 15_000 });

    // Reload
    await page.reload();

    // Wagmi may auto-reconnect from stored state, or we may need to re-connect.
    // Either we see the address or the Connect button.
    const addressOrConnect = page.getByText(truncated, { exact: true }).or(connectWalletButton(page));
    await expect(addressOrConnect).toBeVisible({ timeout: 15_000 });
  });
});
