import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import { connectWalletButton, itpCard } from '../helpers/selectors';
import {
  getItpStateL3,
  getItpCountL3,
  requestCreateItpDirect,
  getBridgedItpAddress,
  pollUntil,
  startArbBlockMiner,
} from '../helpers/backend-api';

test.describe('Create ITP', () => {
  test('create ITP via frontend + Arb bridge relay', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    const stopMiner = startArbBlockMiner(1000);

    try {
      // 1. Connect wallet
      const connectBtn = connectWalletButton(page);
      await expect(connectBtn).toBeVisible({ timeout: 15_000 });
      await connectBtn.click();
      await page.mouse.move(0, 0);
      const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
      await expect(page.getByRole('button', { name: truncated })).toBeVisible({ timeout: 15_000 });

      // 2. Wait for ITP listing to load (at least the deploy-script ITP)
      await expect(itpCard(page).first()).toBeVisible({ timeout: 30_000 });

      // 3. Record current ITP count on L3 before creating
      const itpCountBefore = await getItpCountL3();

      // 4. Scroll to the Create section
      const createSection = page.locator('#create-itp');
      await createSection.scrollIntoViewIfNeeded();

      // 5. Wait for assets to load
      const equalBtn = createSection.getByRole('button', { name: 'Equal', exact: true });
      await expect(equalBtn).toBeVisible({ timeout: 15_000 });

      // 6. Distribute weights equally
      await equalBtn.click();
      await expect(createSection.getByText('Total: 100%').first()).toBeVisible({ timeout: 3_000 });

      // 7. Open finalize modal
      const continueBtn = createSection.getByRole('button', { name: /Continue/ });
      await expect(continueBtn).toBeEnabled({ timeout: 5_000 });
      await continueBtn.click();

      // 8. Fill name and symbol
      const nameInput = page.locator('input[placeholder="e.g., DeFi Blue Chips"]');
      await expect(nameInput).toBeVisible({ timeout: 5_000 });
      await nameInput.fill('E2E Test');
      const symbolInput = page.locator('input[placeholder="e.g., DEFI"]');
      await symbolInput.fill('E2ET');

      // 9. Submit
      const submitBtn = page.getByRole('button', { name: /Finalize & Deploy/ });
      await expect(submitBtn).toBeEnabled({ timeout: 30_000 });
      await submitBtn.click();

      // 10. Wait for success banner (frontend tx confirmed on L3 BridgeProxy)
      await expect(page.getByText('ITP Request Created!').first()).toBeVisible({ timeout: 60_000 });

      // 11. Send requestCreateItp to Arb BridgeProxy (the one issuers watch)
      //     The frontend sends to L3 BridgeProxy, but issuers only watch Arb (port 8546).
      await requestCreateItpDirect(TEST_ADDRESS);

      // 12. Wait for issuers to relay → ITP count increases on L3
      await pollUntil(
        () => getItpCountL3(),
        (count) => count > itpCountBefore,
        120_000,
        3_000,
      );

      // 13. Verify ITP exists on L3 with assets
      const newCount = await getItpCountL3();
      expect(newCount).toBeGreaterThan(itpCountBefore);

      const newItpId = '0x' + newCount.toString(16).padStart(64, '0');
      const newState = await getItpStateL3(newItpId);
      expect(newState.assets.length).toBeGreaterThan(0);

      // 14. Verify BridgedITP was deployed on Arb
      const bridgedAddr = await getBridgedItpAddress(newItpId);
      const isZero = bridgedAddr === '0x' + '0'.repeat(40);
      expect(isZero, 'BridgedITP should be deployed on Arb').toBe(false);
      console.log(`ITP created via bridge: itpId=${newItpId}, bridgedItp=${bridgedAddr}`);
    } finally {
      stopMiner();
    }
  });
});
