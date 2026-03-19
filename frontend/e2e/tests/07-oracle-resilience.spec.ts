/**
 * Oracle Resilience E2E tests.
 *
 * On Anvil (RUN_RESILIENCE=1): kill/restart oracle processes to test crash recovery.
 * On testnet: verify all oracles are healthy, have peers, and are achieving consensus.
 */

import { test, expect } from '@playwright/test';
import { ORACLE_URLS, DEPLOYER_ADDRESS } from '../env';

import {
  placeL3BuyOrderDirect,
} from '../helpers/backend-api';

const TEST_ADDRESS = DEPLOYER_ADDRESS;
const ITP_ID = '0x0000000000000000000000000000000000000000000000000000000000000001';

test.describe.serial('Oracle Resilience', () => {
  test('all oracles healthy with full peer connectivity', async () => {
    test.setTimeout(60_000);

    // Verify each oracle is reachable via SSH tunnel
    for (let i = 0; i < ORACLE_URLS.length; i++) {
      const url = ORACLE_URLS[i];
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000) });
      const health = await res.json();

      console.log(`Oracle ${i + 1} (${url}): status=${health.status}, peers=${health.connected_peers}, consensus_success=${health.consensus?.success_total}`);

      expect(health.status, `oracle-${i + 1} should be healthy`).toBe('healthy');
      expect(health.connected_peers, `oracle-${i + 1} should have peers`).toBeGreaterThanOrEqual(1);
      expect(health.consensus?.success_total, `oracle-${i + 1} should have successful consensus rounds`).toBeGreaterThan(0);
    }
  });

  test('consensus is progressing across all oracles', async () => {
    test.setTimeout(120_000);

    // Record baseline consensus totals
    const baselines: number[] = [];
    for (const url of ORACLE_URLS) {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000) });
      const health = await res.json();
      baselines.push(health.consensus?.success_total ?? 0);
    }

    // Place an L3 order to trigger a consensus round
    const usdcAmount = 10n * 10n ** 18n;
    const limitPrice = 10n * 10n ** 18n;
    const orderId = await placeL3BuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, limitPrice);
    console.log(`Placed L3 buy order #${orderId} to trigger consensus`);

    // Wait for consensus to progress on at least 2/3 oracles (quorum)
    // Vision bitmap hash mismatches cause many failed rounds — allow extra time
    const deadline = Date.now() + 180_000;
    let progressCount = 0;
    while (Date.now() < deadline && progressCount < 2) {
      progressCount = 0;
      for (let i = 0; i < ORACLE_URLS.length; i++) {
        try {
          const res = await fetch(`${ORACLE_URLS[i]}/health`, { signal: AbortSignal.timeout(5_000) });
          const health = await res.json();
          if ((health.consensus?.success_total ?? 0) > baselines[i]) {
            progressCount++;
          }
        } catch { /* retry */ }
      }
      if (progressCount < 2) await new Promise(r => setTimeout(r, 3_000));
    }

    console.log(`Consensus progressed on ${progressCount}/${ORACLE_URLS.length} oracles`);
    expect(progressCount, 'at least 2/3 oracles should make consensus progress').toBeGreaterThanOrEqual(2);
  });
});
