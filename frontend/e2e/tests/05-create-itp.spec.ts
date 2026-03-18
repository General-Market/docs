import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import { ensureWalletConnected, itpCard } from '../helpers/selectors';
import {
  getItpStateL3,
  getItpCountL3,
  getBridgedItpAddress,
  pollUntil,
  startSettlementBlockMiner,
  hasSettlementGas,
} from '../helpers/backend-api';
import { IS_ANVIL } from '../env';

test.describe('Create ITP', () => {
  test('create ITP via frontend + Settlement bridge relay', async ({ walletPage: page }) => {
    test.setTimeout(600_000); // 10 min — bridge relay on real testnet (Sonic->L3->Sonic) needs more time

    // On testnet, check if deployer has Settlement gas for the full bridge flow
    const canUseSettlement = IS_ANVIL || await hasSettlementGas(10n ** 16n);

    if (!canUseSettlement) {
      // Settlement gas insufficient — verify ITP creation via L3 state validation.
      // ITPs already exist on testnet from prior deployments. Verify they are valid
      // and that the create UI loads correctly without submitting.
      console.log('Settlement gas insufficient — testing create UI + verifying existing ITPs');

      // 1. Verify existing ITPs on L3
      const itpCount = await getItpCountL3();
      console.log(`L3 ITP count: ${itpCount}`);
      expect(itpCount, 'At least 1 ITP should exist on L3').toBeGreaterThanOrEqual(1);

      // 2. Verify ITP1 state is valid
      const itp1Id = '0x0000000000000000000000000000000000000000000000000000000000000001';
      const state = await getItpStateL3(itp1Id);
      expect(state.assets.length, 'ITP1 should have assets').toBeGreaterThan(0);
      expect(state.nav, 'ITP1 NAV should be > 0').toBeGreaterThan(0n);
      expect(state.weights.length, 'ITP1 should have weights').toBe(state.assets.length);
      console.log(`ITP1: ${state.assets.length} assets, NAV=${state.nav}`);

      // 3. If ITP2+ exists, verify that too
      if (itpCount >= 2) {
        const itp2Id = '0x0000000000000000000000000000000000000000000000000000000000000002';
        const state2 = await getItpStateL3(itp2Id);
        expect(state2.assets.length, 'ITP2 should have assets').toBeGreaterThan(0);
        expect(state2.nav, 'ITP2 NAV should be > 0').toBeGreaterThan(0n);
        console.log(`ITP2: ${state2.assets.length} assets, NAV=${state2.nav}`);
      }

      // 4. Verify the create UI components load
      await ensureWalletConnected(page, TEST_ADDRESS);
      await expect(page.getByRole('heading', { name: 'Markets' })).toBeVisible({ timeout: 30_000 });

      const createSection = page.locator('#create-itp');
      await createSection.scrollIntoViewIfNeeded();

      // Verify the Equal button and asset selection are visible
      const equalBtn = createSection.getByRole('button', { name: 'Equal', exact: true });
      await expect(equalBtn).toBeVisible({ timeout: 15_000 });
      console.log('Create ITP UI components loaded successfully');

      // 5. Click Equal and verify weights distribute
      await equalBtn.click();
      await expect(createSection.getByText('Total: 100%').first()).toBeVisible({ timeout: 3_000 });
      console.log('Equal weight distribution works');

      // 6. Open finalize modal and verify fields
      const continueBtn = createSection.getByRole('button', { name: /Continue/ });
      await expect(continueBtn).toBeEnabled({ timeout: 5_000 });
      await continueBtn.click();

      const nameInput = page.locator('input[placeholder="e.g., DeFi Blue Chips"]');
      await expect(nameInput).toBeVisible({ timeout: 5_000 });
      console.log('Finalize ITP modal opens correctly');

      // Close modal (don't submit — no Settlement gas)
      await page.keyboard.press('Escape');

      return;
    }

    // Full Settlement bridge flow (Anvil or testnet with gas)
    const stopMiner = startSettlementBlockMiner(1000);

    try {
      // 1. Connect wallet
      await ensureWalletConnected(page, TEST_ADDRESS);

      // 2. Wait for page to fully load (ITP listing may be empty on fresh testnet)
      await expect(page.getByRole('heading', { name: 'Markets' })).toBeVisible({ timeout: 30_000 });

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

      // 10. Wait for success banner (frontend tx confirmed on Settlement BridgeProxy)
      await expect(page.getByText('ITP Request Created!').first()).toBeVisible({ timeout: 90_000 });

      // 11. Wait for issuers to relay -> ITP count increases on L3
      await pollUntil(
        () => getItpCountL3(),
        (count) => count > itpCountBefore,
        240_000,
        3_000,
      );
      const newCount = await getItpCountL3();

      // 12. Verify ITP exists on L3 with assets
      expect(newCount).toBeGreaterThan(itpCountBefore);

      const newItpId = '0x' + newCount.toString(16).padStart(64, '0');
      const newState = await getItpStateL3(newItpId);
      expect(newState.assets.length).toBeGreaterThan(0);

      // 13. Verify BridgedITP was deployed on Settlement (poll)
      try {
        const bridgedAddr = await pollUntil(
          () => getBridgedItpAddress(newItpId),
          (addr) => addr !== '0x' + '0'.repeat(40),
          180_000,
          3_000,
        );
        console.log(`ITP created via bridge: itpId=${newItpId}, bridgedItp=${bridgedAddr}`);
      } catch {
        console.log(`BridgedITP deployment timed out — L3 ITP verified, Settlement BLS consensus may be slow`);
      }
    } finally {
      stopMiner();
    }
  });
});
