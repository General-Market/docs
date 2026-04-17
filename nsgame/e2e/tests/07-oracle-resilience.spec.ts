/**
 * Oracle Resilience E2E tests.
 *
 * These tests require live oracle processes — they only run when oracles are
 * reachable (testnet with VPS oracles, or local Anvil with manually started oracles).
 * On local Anvil, start.sh does NOT launch oracle binaries, so these tests skip
 * automatically unless oracles happen to be running.
 */

import { test, expect } from '@playwright/test';
import { ORACLE_URLS, DEPLOYER_ADDRESS } from '../env';

import {
  placeL3BuyOrderDirect,
} from '../helpers/backend-api';

const TEST_ADDRESS = DEPLOYER_ADDRESS;
const ITP_ID = '0x0000000000000000000000000000000000000000000000000000000000000001';

/** Probe whether at least one oracle is reachable. Returns false on connection refused. */
async function oraclesReachable(): Promise<boolean> {
  for (const url of ORACLE_URLS) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5_000) });
      if (res.ok || res.status < 500) return true;
    } catch {
      // connection refused — this oracle is dead
    }
  }
  return false;
}

test.describe.serial('Oracle Resilience', () => {
  test('all oracles healthy with full peer connectivity', async () => {
    test.setTimeout(60_000);

    const reachable = await oraclesReachable();
    if (!reachable) {
      console.log('No oracle processes reachable — skipping (oracles only run on VPS or with manual local start)');
      test.skip();
      return;
    }

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
    // Fresh deploys need warm-up: bitmap hash mismatches cause many failed rounds
    // before the first successful consensus. 5 min accommodates cold oracles.
    test.setTimeout(300_000);
    const testStart = Date.now();

    const reachable = await oraclesReachable();
    if (!reachable) {
      console.log('No oracle processes reachable — skipping (oracles only run on VPS or with manual local start)');
      test.skip();
      return;
    }

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

    // Wait for consensus to progress on at least 2/3 oracles (quorum).
    // Budget: test timeout minus elapsed setup minus 15s safety margin.
    const pollBudget = Math.max(60_000, 300_000 - (Date.now() - testStart) - 15_000);
    const deadline = Date.now() + pollBudget;
    let progressCount = 0;
    let attempts = 0;
    while (Date.now() < deadline && progressCount < 2) {
      progressCount = 0;
      attempts++;
      for (let i = 0; i < ORACLE_URLS.length; i++) {
        try {
          const res = await fetch(`${ORACLE_URLS[i]}/health`, { signal: AbortSignal.timeout(5_000) });
          const health = await res.json();
          if ((health.consensus?.success_total ?? 0) > baselines[i]) {
            progressCount++;
          }
        } catch { /* retry */ }
      }
      if (progressCount < 2) {
        if (attempts % 10 === 0) {
          console.log(`Still waiting for consensus progress... ${progressCount}/2 oracles progressed (${Math.round((Date.now() - testStart) / 1000)}s elapsed)`);
        }
        await new Promise(r => setTimeout(r, 3_000));
      }
    }

    // If first order didn't trigger consensus, place a second to nudge the pipeline
    if (progressCount < 2) {
      console.log(`First order didn't produce quorum consensus — placing retry order`);
      const retryOrderId = await placeL3BuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, limitPrice);
      console.log(`Placed retry L3 buy order #${retryOrderId}`);

      const retryDeadline = Date.now() + Math.max(30_000, 300_000 - (Date.now() - testStart) - 10_000);
      while (Date.now() < retryDeadline && progressCount < 2) {
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
    }

    console.log(`Consensus progressed on ${progressCount}/${ORACLE_URLS.length} oracles (${Math.round((Date.now() - testStart) / 1000)}s total)`);
    expect(progressCount, 'at least 2/3 oracles should make consensus progress').toBeGreaterThanOrEqual(2);
  });
});
