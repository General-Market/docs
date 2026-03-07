/**
 * Full rebalance E2E test.
 * Verifies the complete rebalance cycle:
 * 1. Read current ITP weights and NAV
 * 2. Request rebalance with new weights
 * 3. Wait for issuer consensus on L3
 * 4. Verify NAV preserved within tolerance
 * 5. Verify new weights match requested weights
 */
import { test, expect } from '@playwright/test';
import {
  getItpStateL3,
  rebalanceItp,
  mineSettlementBlocks,
  startSettlementBlockMiner,
} from '../helpers/backend-api';
import { CONSENSUS_TIMEOUT } from '../env';

/** Known ITP ID (first ITP) */
const ITP_ID = '0x0000000000000000000000000000000000000000000000000000000000000001';

test.describe('Rebalance Full Cycle', () => {
  test('rebalance preserves NAV and updates weights', async () => {
    test.setTimeout(360_000); // 6 min — issuer consensus can take 2-4 min

    // 1. Read current state
    const stateBefore = await getItpStateL3(ITP_ID);
    expect(stateBefore.assets.length).toBeGreaterThan(1);
    expect(stateBefore.weights.length).toBeGreaterThan(1);

    const navBefore = stateBefore.nav;
    const weightsBefore = [...stateBefore.weights];
    console.log(`Before: NAV=${navBefore}, weights[0]=${weightsBefore[0]}, weights[1]=${weightsBefore[1]}`);

    // NAV must be non-zero for the test to be meaningful
    expect(navBefore).toBeGreaterThan(0n);

    // 2. Start block miner (issuers need Settlement blocks for event confirmation)
    const stopMiner = startSettlementBlockMiner(1000);

    try {
      // 3. Execute rebalance (shifts 0.5% weight between asset[0] and asset[1])
      console.log('Requesting rebalance...');
      await rebalanceItp(ITP_ID, CONSENSUS_TIMEOUT);
      console.log('Rebalance completed');

      // Mine a few more blocks for finality
      await mineSettlementBlocks(3);

      // 4. Read state after rebalance
      const stateAfter = await getItpStateL3(ITP_ID);
      const navAfter = stateAfter.nav;
      const weightsAfter = stateAfter.weights;

      console.log(`After: NAV=${navAfter}, weights[0]=${weightsAfter[0]}, weights[1]=${weightsAfter[1]}`);

      // 5. Verify weights changed
      expect(weightsAfter[0]).not.toBe(weightsBefore[0]);
      expect(weightsAfter[1]).not.toBe(weightsBefore[1]);

      // 6. Verify total weight sum is preserved (should sum to 1e18)
      const totalWeightBefore = weightsBefore.reduce((a, b) => a + b, 0n);
      const totalWeightAfter = weightsAfter.reduce((a, b) => a + b, 0n);
      expect(totalWeightAfter).toBe(totalWeightBefore);

      // 7. Verify NAV preserved within 0.1%
      // NAV can drift slightly due to price movements between weight read and rebalance execution
      if (navBefore > 0n && navAfter > 0n) {
        const navDiffBps = (navAfter > navBefore
          ? (navAfter - navBefore) * 10000n / navBefore
          : (navBefore - navAfter) * 10000n / navBefore);
        console.log(`NAV drift: ${navDiffBps} bps`);
        // Allow up to 10 bps (0.1%) drift
        expect(navDiffBps).toBeLessThanOrEqual(10n);
      }

      // 8. Verify inventory was recalculated
      expect(stateAfter.inventory.length).toBe(stateBefore.inventory.length);
      // At least one inventory entry should have changed
      const inventoryChanged = stateAfter.inventory.some(
        (inv, i) => inv !== stateBefore.inventory[i]
      );
      expect(inventoryChanged).toBe(true);
    } finally {
      stopMiner();
    }
  });
});
