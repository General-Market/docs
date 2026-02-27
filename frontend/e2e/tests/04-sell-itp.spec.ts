import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import {
  connectWalletButton,
  sellButton,
  sellModal,
  itpCard,
} from '../helpers/selectors';
import { mintBridgedItp, mintL3Shares, startArbBlockMiner } from '../helpers/backend-api';

test.describe('Sell ITP', () => {
  test('sell ITP shares', async ({ walletPage: page }) => {
    // 1. Connect wallet
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();
    await page.mouse.move(0, 0);
    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByRole('button', { name: truncated })).toBeVisible({ timeout: 15_000 });

    // 2. Wait for ITP listing
    await expect(itpCard(page).first()).toBeVisible({ timeout: 30_000 });

    // 3. Always mint fresh shares for sell test (idempotent).
    // Must mint on both layers: BridgedITP on Arb + _userShares + vault tokens on L3.
    // Previous tests (buy) may have added some shares, but the pipeline may have
    // consumed them. Always minting avoids stale-state flakiness across test runs.
    const mintAmount = 100n * 10n ** 18n;
    await mintBridgedItp(TEST_ADDRESS, ITP_ID, mintAmount);
    await mintL3Shares(TEST_ADDRESS, ITP_ID, mintAmount);

    // 4. Click Sell on first ITP
    const sellBtn = sellButton(page);
    await expect(sellBtn).toBeVisible({ timeout: 10_000 });
    await sellBtn.click();

    // 5. Sell modal should appear (heading is "Sell {itpName}")
    await expect(page.getByRole('heading', { name: /^Sell\s/ })).toBeVisible({ timeout: 10_000 });

    // 6. Type a specific sell amount (NOT Max) to avoid mismatch when
    // BridgedITP balance > L3 shares. mintBridgedItp is additive (mints on top
    // of existing balance from buy test), but mintL3Shares sets an absolute
    // value. Selling a fixed amount within the minted L3 shares avoids the
    // issuer rejecting the order for insufficient L3 shares.
    const sharesInput = sellModal.sharesInput(page);
    await expect(sharesInput).toBeVisible({ timeout: 10_000 });
    await sharesInput.fill('50');

    // 7. Submit (Approve & Sell or Sell Shares)
    const submitBtn = sellModal.submitButton(page);
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();

    // 8. Mine Arb Anvil blocks periodically so issuers can confirm the sell event.
    // Issuers require 2 block confirmations before processing events. On Anvil with
    // auto-mine, blocks only advance when txs are submitted — without mining, the
    // sell event never becomes "confirmed" and the consensus pipeline never starts.
    const stopMiner = startArbBlockMiner(1000);
    try {
      // 9. Wait for sell completion via real issuer consensus pipeline.
      // Issuers relay the sell order to L3, batch it, fill it, and bridge USDC back.
      // This takes multiple consensus cycles (~30-90s depending on cycle timing).
      await expect(sellModal.orderSubmittedBanner(page)).toBeVisible({ timeout: 180_000 });
    } finally {
      stopMiner();
    }
  });
});
