import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import {
  connectWalletButton,
  borrowButtonOnCard,
  itpCard,
  lendingModal,
} from '../helpers/selectors';
import { getUserState, mintBridgedItp, rebalanceItp } from '../helpers/backend-api';

test.describe('Lending (Deposit → Borrow → Repay → Withdraw)', () => {
  test('full lending cycle', async ({ walletPage: page }) => {
    // ── Setup: connect wallet ────────────────────────────────
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();
    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByText(truncated, { exact: true })).toBeVisible({ timeout: 15_000 });

    // Wait for ITP listing
    await expect(itpCard(page).first()).toBeVisible({ timeout: 30_000 });

    // Ensure user has ITP shares (mint if bridge relay hasn't completed)
    const preState = await getUserState(TEST_ADDRESS, ITP_ID);
    if (BigInt(preState.bridged_itp_balance) === 0n) {
      await mintBridgedItp(TEST_ADDRESS, ITP_ID, 100n * 10n ** 18n);
    }

    // ── Open Lending Modal ───────────────────────────────────
    const borrowBtn = borrowButtonOnCard(page);
    // If no Borrow button visible on card, skip (no lending market)
    if (!(await borrowBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'No lending market available for this ITP');
      return;
    }
    await borrowBtn.click();

    // Modal should show "Borrow against"
    await expect(page.getByText(/Borrow against/)).toBeVisible({ timeout: 10_000 });

    // Ensure we're on the Borrow tab
    await lendingModal.borrowTab(page).click();

    // ── Step 1: Deposit Collateral ───────────────────────────
    const depositInput = lendingModal.deposit.amountInput(page);
    await expect(depositInput).toBeVisible({ timeout: 10_000 });
    await depositInput.fill('10');

    const depositBtn = lendingModal.deposit.submitButton(page);
    await expect(depositBtn).toBeEnabled({ timeout: 10_000 });
    await depositBtn.click();

    // Wait for "Deposited!" success
    await expect(lendingModal.deposit.successText(page)).toBeVisible({ timeout: 60_000 });

    // ── Step 2: Borrow USDC ──────────────────────────────────
    const borrowInput = lendingModal.borrow.amountInput(page);
    await expect(borrowInput).toBeVisible({ timeout: 15_000 });
    await borrowInput.fill('1');

    const borrowSubmitBtn = lendingModal.borrow.submitButton(page);
    await expect(borrowSubmitBtn).toBeEnabled({ timeout: 10_000 });
    await borrowSubmitBtn.click();

    // Wait for "Borrowed!" success
    await expect(lendingModal.borrow.successText(page)).toBeVisible({ timeout: 60_000 });

    // ── Step 2.5: Rebalance ITP ──────────────────────────────
    // Shift weights slightly while lending position is active
    await rebalanceItp(ITP_ID);
    // Wait for data-node to pick up new weights (2 poll cycles)
    await page.waitForTimeout(4_000);

    // ── Step 3: Repay Debt ───────────────────────────────────
    // Switch to Repay tab
    await lendingModal.repayTab(page).click();

    // Click MAX to repay full debt
    const repayMax = lendingModal.repay.maxButton(page);
    await expect(repayMax).toBeVisible({ timeout: 10_000 });
    await repayMax.click();

    const repayBtn = lendingModal.repay.submitButton(page);
    await expect(repayBtn).toBeEnabled({ timeout: 10_000 });
    await repayBtn.click();

    // Shares-based repay clears all borrowShares → debt is exactly 0.
    // Wait for either "Repaid!" success or Repay Debt section to disappear
    // (component unmounts once debt drops to 0).
    await Promise.race([
      expect(lendingModal.repay.successText(page)).toBeVisible({ timeout: 60_000 }),
      expect(page.locator('h2:has-text("Repay Debt")')).toBeHidden({ timeout: 60_000 }),
    ]);

    // ── Step 4: Withdraw Collateral ──────────────────────────
    // Wait for WithdrawCollateral component's position to refresh (debt=0).
    // When debt=0, subtitle changes from "limited by debt" to "Withdraw your ITP collateral".
    await expect(page.getByText('Withdraw your ITP collateral')).toBeVisible({ timeout: 30_000 });

    // With dust-free repay, MAX withdraw works (no residual micro-debt).
    const withdrawMax = lendingModal.withdraw.maxButton(page);
    await expect(withdrawMax).toBeVisible({ timeout: 10_000 });
    await withdrawMax.click();

    const withdrawBtn = lendingModal.withdraw.submitButton(page);
    await expect(withdrawBtn).toBeEnabled({ timeout: 10_000 });
    await withdrawBtn.click();

    // After full withdrawal, position closes → component unmounts → "Withdrawn!" may flash.
    // Wait for either "Withdrawn!" success or "No active position" (confirming position closed).
    await Promise.race([
      expect(lendingModal.withdraw.successText(page)).toBeVisible({ timeout: 60_000 }),
      expect(page.getByText('No active position')).toBeVisible({ timeout: 60_000 }),
    ]);
  });
});
