/**
 * Oracle Resilience E2E tests.
 *
 * On Anvil (RUN_RESILIENCE=1): kill/restart oracle processes to test crash recovery.
 * On testnet: verify all oracles are healthy, have peers, and are achieving consensus.
 */

import { test, expect } from '@playwright/test';
import { IS_ANVIL, ORACLE_URLS, DEPLOYER_ADDRESS } from '../env';

import {
  getOracleHealth,
  killOracle,
  restartOracle,
  waitForOracleHealthy,
  waitForConsensusProgress,
  waitForConsensusWarmup,
  getConsensusTotal,
} from '../helpers/oracle-process';
import {
  placeBuyOrderDirect,
  placeSellOrderDirect,
  requestRebalanceDirect,
  getItpStateL3,
  mintBridgedItp,
  placeL3BuyOrderDirect,
} from '../helpers/backend-api';

const TEST_ADDRESS = DEPLOYER_ADDRESS;
const ITP_ID = '0x0000000000000000000000000000000000000000000000000000000000000001';

// Kill/restart tests only on Anvil with RUN_RESILIENCE=1
const RESILIENCE_ENABLED = process.env.RUN_RESILIENCE === '1';

test.describe.serial('Oracle Resilience', () => {
  if (IS_ANVIL) {
    // ── Anvil-only: kill/restart tests ──────────────────────────

    test.beforeEach(() => {
      // On Anvil, require RUN_RESILIENCE=1 to enable (these are slow & destructive)
      if (!RESILIENCE_ENABLED) test.skip();
    });

    test.afterAll(async () => {
      if (!RESILIENCE_ENABLED) return;
      console.log('Restoring all 3 oracles after resilience tests...');
      for (const id of [1, 2, 3]) {
        await killOracle(id).catch(() => {});
      }
      await new Promise(r => setTimeout(r, 2_000));
      for (const id of [1, 2, 3]) {
        try {
          console.log(`Restarting oracle-${id}...`);
          await restartOracle(id);
        } catch (e) {
          console.warn(`Failed to restart oracle-${id}: ${e}`);
        }
      }
      for (const id of [1, 2, 3]) {
        try {
          await waitForOracleHealthy(id, 60_000);
          console.log(`Oracle-${id} healthy.`);
        } catch {
          console.warn(`Oracle-${id} didn't become healthy in afterAll`);
        }
      }
      try {
        await waitForConsensusWarmup([1, 2, 3], 120_000);
        console.log('All 3 oracles achieving consensus after restoration.');
      } catch (e) {
        console.warn(`Consensus warmup failed in afterAll: ${e}`);
      }
    });

    test.beforeAll(async () => {
      if (!RESILIENCE_ENABLED) return;
      for (const id of [1, 2, 3]) {
        console.log(`Killing oracle-${id} for clean restart...`);
        await killOracle(id);
      }
      await new Promise(r => setTimeout(r, 2_000));
      for (const id of [1, 2, 3]) {
        console.log(`Starting oracle-${id} with threshold=2...`);
        await restartOracle(id);
      }
      for (const id of [1, 2, 3]) {
        await waitForOracleHealthy(id, 30_000);
      }
      console.log('Waiting for consensus warmup...');
      await waitForConsensusWarmup([1, 2, 3], 120_000);
      console.log('All oracles warmed up and achieving consensus.');
    });

    test('kill 1/3 oracles — system continues, killed node recovers', async () => {
      test.setTimeout(300_000);

      for (const id of [1, 2, 3]) {
        const health = await getOracleHealth(id);
        expect(health, `oracle-${id} should be reachable`).not.toBeNull();
      }

      const baseline1 = await getConsensusTotal(1);
      const baseline2 = await getConsensusTotal(2);

      await killOracle(3);
      expect(await getOracleHealth(3)).toBeNull();
      await new Promise(r => setTimeout(r, 3_000));

      const state = await getItpStateL3(ITP_ID);
      const navPrice = state.nav > 0n ? state.nav : 1000000000000000000n;
      const usdcAmount = 100_000_000n;

      await placeBuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, navPrice);
      await mintBridgedItp(TEST_ADDRESS, ITP_ID, 10n * 10n ** 18n);
      await placeSellOrderDirect(TEST_ADDRESS, ITP_ID, 1n * 10n ** 18n, 0n);
      await requestRebalanceDirect(ITP_ID);

      await waitForConsensusProgress(1, 1, baseline1, 180_000);
      await waitForConsensusProgress(2, 1, baseline2, 180_000);

      await restartOracle(3);
      await waitForOracleHealthy(3, 60_000);
      await waitForConsensusWarmup([3], 60_000);

      const baselineAfter1 = await getConsensusTotal(1);
      const baselineAfter2 = await getConsensusTotal(2);
      const baselineAfter3 = await getConsensusTotal(3);

      await placeBuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, navPrice);

      await waitForConsensusProgress(1, 1, baselineAfter1, 90_000);
      await waitForConsensusProgress(2, 1, baselineAfter2, 90_000);
      await waitForConsensusProgress(3, 1, baselineAfter3, 90_000);
    });

    test('kill 2/3 oracles — system halts, recovers after quorum restored', async () => {
      test.setTimeout(300_000);

      for (const id of [1, 2]) {
        const health = await getOracleHealth(id);
        expect(health, `oracle-${id} should be reachable`).not.toBeNull();
      }

      const baseline1 = await getConsensusTotal(1);

      await killOracle(2);
      await killOracle(3);
      expect(await getOracleHealth(2)).toBeNull();
      expect(await getOracleHealth(3)).toBeNull();
      await new Promise(r => setTimeout(r, 3_000));

      const state = await getItpStateL3(ITP_ID);
      const navPrice = state.nav > 0n ? state.nav : 1000000000000000000n;
      const usdcAmount = 100_000_000n;

      await placeBuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, navPrice);
      await mintBridgedItp(TEST_ADDRESS, ITP_ID, 10n * 10n ** 18n);
      await placeSellOrderDirect(TEST_ADDRESS, ITP_ID, 1n * 10n ** 18n, 0n);
      await requestRebalanceDirect(ITP_ID);

      await new Promise(r => setTimeout(r, 15_000));
      const health1During = await getOracleHealth(1);
      expect(health1During, 'oracle-1 should still be alive with 0 peers').not.toBeNull();
      expect(health1During!.connected_peers).toBe(0);
      expect(
        health1During!.consensus.success_total,
        'consensus should NOT progress with only 1/3 oracles',
      ).toBe(baseline1);

      await restartOracle(2);
      await waitForOracleHealthy(1, 30_000);
      await waitForOracleHealthy(2, 30_000);
      await waitForConsensusWarmup([1, 2], 60_000);

      const resumeBaseline1 = await getConsensusTotal(1);
      const resumeBaseline2 = await getConsensusTotal(2);

      await waitForConsensusProgress(1, 1, resumeBaseline1, 90_000);
      await waitForConsensusProgress(2, 1, resumeBaseline2, 90_000);

      await restartOracle(3);
      await waitForOracleHealthy(3, 30_000);
      await waitForConsensusWarmup([3], 60_000);

      const finalBaseline1 = await getConsensusTotal(1);
      const finalBaseline2 = await getConsensusTotal(2);
      const finalBaseline3 = await getConsensusTotal(3);

      await placeBuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, navPrice);

      await waitForConsensusProgress(1, 1, finalBaseline1, 90_000);
      await waitForConsensusProgress(2, 1, finalBaseline2, 90_000);
      await waitForConsensusProgress(3, 1, finalBaseline3, 90_000);
    });
  } else {
    // ── Testnet: verify all oracles healthy and achieving consensus ──

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
  }
});
