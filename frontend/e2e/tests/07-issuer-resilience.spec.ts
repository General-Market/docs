/**
 * Issuer Resilience E2E tests.
 *
 * On Anvil (RUN_RESILIENCE=1): kill/restart issuer processes to test crash recovery.
 * On testnet: verify all issuers are healthy, have peers, and are achieving consensus.
 */

import { test, expect } from '@playwright/test';
import { IS_ANVIL, ISSUER_URLS } from '../env';

import {
  getIssuerHealth,
  killIssuer,
  restartIssuer,
  waitForIssuerHealthy,
  waitForConsensusProgress,
  waitForConsensusWarmup,
  getConsensusTotal,
} from '../helpers/issuer-process';
import {
  placeBuyOrderDirect,
  placeSellOrderDirect,
  requestRebalanceDirect,
  getItpStateL3,
  mintBridgedItp,
  placeL3BuyOrderDirect,
} from '../helpers/backend-api';

const TEST_ADDRESS = '0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4';
const ITP_ID = '0x0000000000000000000000000000000000000000000000000000000000000001';

// Kill/restart tests only on Anvil with RUN_RESILIENCE=1
const RESILIENCE_ENABLED = process.env.RUN_RESILIENCE === '1';

test.describe.serial('Issuer Resilience', () => {
  if (IS_ANVIL) {
    // ── Anvil-only: kill/restart tests ──────────────────────────

    test.beforeEach(() => {
      // On Anvil, require RUN_RESILIENCE=1 to enable (these are slow & destructive)
      if (!RESILIENCE_ENABLED) test.skip();
    });

    test.afterAll(async () => {
      if (!RESILIENCE_ENABLED) return;
      console.log('Restoring all 3 issuers after resilience tests...');
      for (const id of [1, 2, 3]) {
        await killIssuer(id).catch(() => {});
      }
      await new Promise(r => setTimeout(r, 2_000));
      for (const id of [1, 2, 3]) {
        try {
          console.log(`Restarting issuer-${id}...`);
          await restartIssuer(id);
        } catch (e) {
          console.warn(`Failed to restart issuer-${id}: ${e}`);
        }
      }
      for (const id of [1, 2, 3]) {
        try {
          await waitForIssuerHealthy(id, 60_000);
          console.log(`Issuer-${id} healthy.`);
        } catch {
          console.warn(`Issuer-${id} didn't become healthy in afterAll`);
        }
      }
      try {
        await waitForConsensusWarmup([1, 2, 3], 120_000);
        console.log('All 3 issuers achieving consensus after restoration.');
      } catch (e) {
        console.warn(`Consensus warmup failed in afterAll: ${e}`);
      }
    });

    test.beforeAll(async () => {
      if (!RESILIENCE_ENABLED) return;
      for (const id of [1, 2, 3]) {
        console.log(`Killing issuer-${id} for clean restart...`);
        await killIssuer(id);
      }
      await new Promise(r => setTimeout(r, 2_000));
      for (const id of [1, 2, 3]) {
        console.log(`Starting issuer-${id} with threshold=2...`);
        await restartIssuer(id);
      }
      for (const id of [1, 2, 3]) {
        await waitForIssuerHealthy(id, 30_000);
      }
      console.log('Waiting for consensus warmup...');
      await waitForConsensusWarmup([1, 2, 3], 120_000);
      console.log('All issuers warmed up and achieving consensus.');
    });

    test('kill 1/3 issuers — system continues, killed node recovers', async () => {
      test.setTimeout(300_000);

      for (const id of [1, 2, 3]) {
        const health = await getIssuerHealth(id);
        expect(health, `issuer-${id} should be reachable`).not.toBeNull();
      }

      const baseline1 = await getConsensusTotal(1);
      const baseline2 = await getConsensusTotal(2);

      await killIssuer(3);
      expect(await getIssuerHealth(3)).toBeNull();
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

      await restartIssuer(3);
      await waitForIssuerHealthy(3, 60_000);
      await waitForConsensusWarmup([3], 60_000);

      const baselineAfter1 = await getConsensusTotal(1);
      const baselineAfter2 = await getConsensusTotal(2);
      const baselineAfter3 = await getConsensusTotal(3);

      await placeBuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, navPrice);

      await waitForConsensusProgress(1, 1, baselineAfter1, 90_000);
      await waitForConsensusProgress(2, 1, baselineAfter2, 90_000);
      await waitForConsensusProgress(3, 1, baselineAfter3, 90_000);
    });

    test('kill 2/3 issuers — system halts, recovers after quorum restored', async () => {
      test.setTimeout(300_000);

      for (const id of [1, 2]) {
        const health = await getIssuerHealth(id);
        expect(health, `issuer-${id} should be reachable`).not.toBeNull();
      }

      const baseline1 = await getConsensusTotal(1);

      await killIssuer(2);
      await killIssuer(3);
      expect(await getIssuerHealth(2)).toBeNull();
      expect(await getIssuerHealth(3)).toBeNull();
      await new Promise(r => setTimeout(r, 3_000));

      const state = await getItpStateL3(ITP_ID);
      const navPrice = state.nav > 0n ? state.nav : 1000000000000000000n;
      const usdcAmount = 100_000_000n;

      await placeBuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, navPrice);
      await mintBridgedItp(TEST_ADDRESS, ITP_ID, 10n * 10n ** 18n);
      await placeSellOrderDirect(TEST_ADDRESS, ITP_ID, 1n * 10n ** 18n, 0n);
      await requestRebalanceDirect(ITP_ID);

      await new Promise(r => setTimeout(r, 15_000));
      const health1During = await getIssuerHealth(1);
      expect(health1During, 'issuer-1 should still be alive with 0 peers').not.toBeNull();
      expect(health1During!.connected_peers).toBe(0);
      expect(
        health1During!.consensus.success_total,
        'consensus should NOT progress with only 1/3 issuers',
      ).toBe(baseline1);

      await restartIssuer(2);
      await waitForIssuerHealthy(1, 30_000);
      await waitForIssuerHealthy(2, 30_000);
      await waitForConsensusWarmup([1, 2], 60_000);

      const resumeBaseline1 = await getConsensusTotal(1);
      const resumeBaseline2 = await getConsensusTotal(2);

      await waitForConsensusProgress(1, 1, resumeBaseline1, 90_000);
      await waitForConsensusProgress(2, 1, resumeBaseline2, 90_000);

      await restartIssuer(3);
      await waitForIssuerHealthy(3, 30_000);
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
    // ── Testnet: verify all issuers healthy and achieving consensus ──

    test('all issuers healthy with full peer connectivity', async () => {
      test.setTimeout(60_000);

      // Verify each issuer is reachable via SSH tunnel
      for (let i = 0; i < ISSUER_URLS.length; i++) {
        const url = ISSUER_URLS[i];
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000) });
        const health = await res.json();

        console.log(`Issuer ${i + 1} (${url}): status=${health.status}, peers=${health.connected_peers}, consensus_success=${health.consensus?.success_total}`);

        expect(health.status, `issuer-${i + 1} should be healthy`).toBe('healthy');
        expect(health.connected_peers, `issuer-${i + 1} should have peers`).toBeGreaterThanOrEqual(1);
        expect(health.consensus?.success_total, `issuer-${i + 1} should have successful consensus rounds`).toBeGreaterThan(0);
      }
    });

    test('consensus is progressing across all issuers', async () => {
      test.setTimeout(120_000);

      // Record baseline consensus totals
      const baselines: number[] = [];
      for (const url of ISSUER_URLS) {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000) });
        const health = await res.json();
        baselines.push(health.consensus?.success_total ?? 0);
      }

      // Place an L3 order to trigger a consensus round
      const usdcAmount = 10n * 10n ** 18n;
      const limitPrice = 10n * 10n ** 18n;
      const orderId = await placeL3BuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, limitPrice);
      console.log(`Placed L3 buy order #${orderId} to trigger consensus`);

      // Wait for consensus to progress on at least 2/3 issuers (quorum)
      const deadline = Date.now() + 90_000;
      let progressCount = 0;
      while (Date.now() < deadline && progressCount < 2) {
        progressCount = 0;
        for (let i = 0; i < ISSUER_URLS.length; i++) {
          try {
            const res = await fetch(`${ISSUER_URLS[i]}/health`, { signal: AbortSignal.timeout(5_000) });
            const health = await res.json();
            if ((health.consensus?.success_total ?? 0) > baselines[i]) {
              progressCount++;
            }
          } catch { /* retry */ }
        }
        if (progressCount < 2) await new Promise(r => setTimeout(r, 3_000));
      }

      console.log(`Consensus progressed on ${progressCount}/${ISSUER_URLS.length} issuers`);
      expect(progressCount, 'at least 2/3 issuers should make consensus progress').toBeGreaterThanOrEqual(2);
    });
  }
});
