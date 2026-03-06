/**
 * Issuer crash/recovery E2E tests.
 *
 * With 3 issuer nodes and BLS threshold=2:
 * - Test A: Kill 1/3 — system continues (2 remaining >= threshold)
 * - Test B: Kill 2/3 — system halts, then recovers when quorum restored
 *
 * Verifies consensus participation across ALL nodes including
 * reconnected ones. Requires data-node for on-chain order fills.
 */

import { test, expect } from '@playwright/test';

const IS_TESTNET = process.env.E2E_TESTNET === '1';

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
} from '../helpers/backend-api';

const TEST_ADDRESS = '0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4';
const ITP_ID = '0x0000000000000000000000000000000000000000000000000000000000000001';

// Skip unless RUN_RESILIENCE=1 — this test kills/restarts issuers and takes 5+ minutes
const RESILIENCE_ENABLED = process.env.RUN_RESILIENCE === '1';

test.describe.serial('Issuer Resilience', () => {
  // Issuer resilience tests require killing/restarting local issuer processes.
  // On testnet, issuers run on VPS — process management requires SSH access.
  // These tests are legitimately local-only (not a skip to avoid fixing).
  test.beforeEach(() => {
    test.skip(IS_TESTNET, 'Requires local issuer process management (kill/restart PIDs)');
  });
  // Always restore all 3 issuers so subsequent tests (Vision, etc.) aren't broken
  test.afterAll(async () => {
    if (!RESILIENCE_ENABLED) return;
    console.log('Restoring all 3 issuers after resilience tests...');
    // Kill all first to ensure clean state (they may be running with wrong config)
    for (const id of [1, 2, 3]) {
      await killIssuer(id).catch(() => {});
    }
    await new Promise(r => setTimeout(r, 2_000));

    // Restart all 3
    for (const id of [1, 2, 3]) {
      try {
        console.log(`Restarting issuer-${id}...`);
        await restartIssuer(id);
      } catch (e) {
        console.warn(`Failed to restart issuer-${id}: ${e}`);
      }
    }

    // Wait for all to be healthy (connected to peers)
    for (const id of [1, 2, 3]) {
      try {
        await waitForIssuerHealthy(id, 60_000);
        console.log(`Issuer-${id} healthy.`);
      } catch {
        console.warn(`Issuer-${id} didn't become healthy in afterAll — subsequent tests may fail`);
      }
    }

    // Wait for consensus warmup — ensures issuers are actually working
    try {
      await waitForConsensusWarmup([1, 2, 3], 120_000);
      console.log('All 3 issuers achieving consensus after restoration.');
    } catch (e) {
      console.warn(`Consensus warmup failed in afterAll: ${e}`);
    }
  });

  // Kill ALL issuers and restart with consistent config (threshold=2, generous timeout).
  // start.sh uses threshold=3 by default, which requires all 3 nodes. We need threshold=2
  // so that killing 1 node still allows consensus with the remaining 2.
  test.beforeAll(async () => {
    if (!RESILIENCE_ENABLED) return;
    // Kill all issuers regardless of health — ensures consistent config
    for (const id of [1, 2, 3]) {
      console.log(`Killing issuer-${id} for clean restart...`);
      await killIssuer(id);
    }

    // Wait for ports to be freed
    await new Promise(r => setTimeout(r, 2_000));

    // Restart all with threshold=2 and generous consensus timeout
    for (const id of [1, 2, 3]) {
      console.log(`Starting issuer-${id} with threshold=2...`);
      await restartIssuer(id);
    }

    // Wait for all to be healthy with peers
    for (const id of [1, 2, 3]) {
      await waitForIssuerHealthy(id, 30_000);
    }

    // Wait for consensus warmup — at least 1 successful round proves the cluster works
    console.log('Waiting for consensus warmup...');
    await waitForConsensusWarmup([1, 2, 3], 120_000);
    console.log('All issuers warmed up and achieving consensus.');
  });

  // ── Test A: Kill 1/3 — system continues ────

  test('kill 1/3 issuers — system continues, killed node recovers', async () => {
    test.skip(!RESILIENCE_ENABLED, 'Use RUN_RESILIENCE=1 to enable');
    test.setTimeout(300_000);

    // 1. Verify all 3 issuers healthy
    for (const id of [1, 2, 3]) {
      const health = await getIssuerHealth(id);
      expect(health, `issuer-${id} should be reachable`).not.toBeNull();
    }

    // 2. Record baseline consensus totals for surviving issuers
    const baseline1 = await getConsensusTotal(1);
    const baseline2 = await getConsensusTotal(2);

    // 3. Kill issuer-3
    await killIssuer(3);

    // 4. Confirm issuer-3 is dead
    expect(await getIssuerHealth(3)).toBeNull();

    // 5. Wait for P2P disconnect detection
    await new Promise(r => setTimeout(r, 3_000));

    // --- Queue operations while 1 node is down ---

    const state = await getItpStateL3(ITP_ID);
    const navPrice = state.nav > 0n ? state.nav : 1000000000000000000n;

    // 6a. Place buy order
    const usdcAmount = 100_000_000n;
    await placeBuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, navPrice);

    // 6b. Ensure user has BridgedITP shares for sell
    await mintBridgedItp(TEST_ADDRESS, ITP_ID, 10n * 10n ** 18n);

    // 6c. Place sell order
    await placeSellOrderDirect(TEST_ADDRESS, ITP_ID, 1n * 10n ** 18n, 0n);

    // 6d. Request rebalance
    await requestRebalanceDirect(ITP_ID);

    // --- Verify consensus CONTINUES with 2/3 quorum ---

    // 7. Wait for at least 1 successful consensus round on surviving issuers
    // With real consensus (chain writes), most price rounds fail so allow 180s
    await waitForConsensusProgress(1, 1, baseline1, 180_000);
    await waitForConsensusProgress(2, 1, baseline2, 180_000);

    // --- Restart killed node ---

    // 8. Restart issuer-3
    await restartIssuer(3);

    // 9. Wait for healthy (connected to peers)
    await waitForIssuerHealthy(3, 60_000);

    // 9b. Wait for issuer-3 to reconstruct state and achieve consensus
    await waitForConsensusWarmup([3], 60_000);

    // 10. Verify reconnected issuer-3 participates in consensus
    const baselineAfter1 = await getConsensusTotal(1);
    const baselineAfter2 = await getConsensusTotal(2);
    const baselineAfter3 = await getConsensusTotal(3);

    await placeBuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, navPrice);

    // All 3 issuers must achieve consensus — proves issuer-3 rejoined the protocol
    await waitForConsensusProgress(1, 1, baselineAfter1, 90_000);
    await waitForConsensusProgress(2, 1, baselineAfter2, 90_000);
    await waitForConsensusProgress(3, 1, baselineAfter3, 90_000);
  });

  // ── Test B: Kill 2/3 — system halts, then recovers ──

  test('kill 2/3 issuers — system halts, recovers after quorum restored', async () => {
    test.skip(!RESILIENCE_ENABLED, 'Use RUN_RESILIENCE=1 to enable');
    test.setTimeout(300_000);

    // 1. Verify issuers 1 and 2 are healthy (3 may still be warming up)
    for (const id of [1, 2]) {
      const health = await getIssuerHealth(id);
      expect(health, `issuer-${id} should be reachable`).not.toBeNull();
    }

    // 2. Record baseline consensus totals
    const baseline1 = await getConsensusTotal(1);

    // 3. Kill issuer-2 and issuer-3
    await killIssuer(2);
    await killIssuer(3);

    // 4. Confirm both are dead
    expect(await getIssuerHealth(2)).toBeNull();
    expect(await getIssuerHealth(3)).toBeNull();

    // 5. Wait for disconnect detection
    await new Promise(r => setTimeout(r, 3_000));

    // --- Queue operations while consensus is impossible ---

    const state = await getItpStateL3(ITP_ID);
    const navPrice = state.nav > 0n ? state.nav : 1000000000000000000n;
    const usdcAmount = 100_000_000n;

    await placeBuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, navPrice);
    await mintBridgedItp(TEST_ADDRESS, ITP_ID, 10n * 10n ** 18n);
    await placeSellOrderDirect(TEST_ADDRESS, ITP_ID, 1n * 10n ** 18n, 0n);
    await requestRebalanceDirect(ITP_ID);

    // --- Verify consensus HALTS (1/3 < threshold) ---

    // 6. Wait and verify no consensus progress
    await new Promise(r => setTimeout(r, 15_000));
    const health1During = await getIssuerHealth(1);
    expect(health1During, 'issuer-1 should still be alive with 0 peers').not.toBeNull();
    expect(health1During!.connected_peers).toBe(0);
    expect(
      health1During!.consensus.success_total,
      'consensus should NOT progress with only 1/3 issuers',
    ).toBe(baseline1);

    // --- Restore quorum ---

    // 7. Restart issuer-2 (now 2/3 = quorum)
    await restartIssuer(2);

    // 8. Wait for both to be healthy (they need each other as peers)
    await waitForIssuerHealthy(1, 30_000);
    await waitForIssuerHealthy(2, 30_000);

    // 8b. Wait for issuer-2 to reconstruct state and re-establish consensus
    await waitForConsensusWarmup([1, 2], 60_000);

    // --- Verify consensus RESUMES ---

    // 9. Get fresh baselines
    const resumeBaseline1 = await getConsensusTotal(1);
    const resumeBaseline2 = await getConsensusTotal(2);

    // 10. Wait for consensus to resume
    await waitForConsensusProgress(1, 1, resumeBaseline1, 90_000);
    await waitForConsensusProgress(2, 1, resumeBaseline2, 90_000);

    // --- Restart issuer-3, verify full cluster ---

    // 11. Restart issuer-3
    await restartIssuer(3);
    await waitForIssuerHealthy(3, 30_000);

    // 11b. Wait for issuer-3 to reconstruct state and achieve consensus
    await waitForConsensusWarmup([3], 60_000);

    // 12. Verify ALL 3 nodes process consensus after full recovery
    const finalBaseline1 = await getConsensusTotal(1);
    const finalBaseline2 = await getConsensusTotal(2);
    const finalBaseline3 = await getConsensusTotal(3);

    await placeBuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, navPrice);

    // All 3 nodes must achieve consensus — proves full cluster recovered
    await waitForConsensusProgress(1, 1, finalBaseline1, 90_000);
    await waitForConsensusProgress(2, 1, finalBaseline2, 90_000);
    await waitForConsensusProgress(3, 1, finalBaseline3, 90_000);
  });
});
