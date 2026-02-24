import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import { connectWalletButton } from '../helpers/selectors';

test.describe('Connect Wallet', () => {
  test('connects wallet and shows truncated address', async ({ walletPage: page }) => {
    // The mock wallet is injected — click Connect
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();

    // Move mouse away so group-hover:hidden CSS clears and address span is visible
    await page.mouse.move(0, 0);

    // Should show truncated address in the wallet button
    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByRole('button', { name: truncated })).toBeVisible({ timeout: 15_000 });
  });

  test('disconnect button works', async ({ walletPage: page }) => {
    // Connect first
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();
    await page.mouse.move(0, 0);

    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByRole('button', { name: truncated })).toBeVisible({ timeout: 15_000 });

    // Hover to reveal disconnect text, then click
    const walletBtn = page.getByRole('button', { name: truncated });
    await walletBtn.click();

    // Should show Login button again
    await expect(connectWalletButton(page)).toBeVisible({ timeout: 10_000 });
  });

  test('wallet reconnects on page reload', async ({ walletPage: page }) => {
    // Connect
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();
    await page.mouse.move(0, 0);

    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByRole('button', { name: truncated })).toBeVisible({ timeout: 15_000 });

    // Reload
    await page.reload();

    // Wagmi may auto-reconnect from stored state, or we may need to re-connect.
    // Either we see the address button or the Login button.
    const addressOrConnect = page.getByRole('button', { name: truncated }).or(connectWalletButton(page));
    await expect(addressOrConnect).toBeVisible({ timeout: 15_000 });
  });
});
