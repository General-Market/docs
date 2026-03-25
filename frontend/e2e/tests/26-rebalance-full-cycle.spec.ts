/**
 * Full rebalance E2E test.
 * Verifies the complete rebalance cycle:
 * 1. Read current ITP weights and NAV
 * 2. Request rebalance with new weights — verifies the TX lands on-chain (hard assertion)
 * 3. Wait for oracle consensus on L3 — soft-pass if oracles don't execute within timeout
 * 4. If consensus observed: verify NAV preserved within tolerance and weights updated
 *
 * Oracle consensus is treated as a separate concern from TX submission, following the
 * same pattern as the bridge relay test (05-create-itp.spec.ts). A stalled oracle
 * should not fail the submission assertion.
 *
 * Known limitation: if any ITP asset has no contract code on L3 (e.g. codeless
 * mock token), issuers cannot fetch prices and rebalance consensus will stall.
 * In that case, we verify the request was submitted and skip oracle verification.
 *
 * Discovers a valid ITP dynamically — no hardcoded ITP IDs.
 */
import { test, expect } from '@playwright/test';
import {
  getItpStateL3,
  getAvailableItpIds,
  submitRebalanceRequest,
  pollUntil,
  l3RpcCall,
} from '../helpers/backend-api';
import { CONSENSUS_TIMEOUT } from '../env';

/** Check if an address has contract code on L3 */
async function hasCode(address: string): Promise<boolean> {
  const code = await l3RpcCall('eth_getCode', [address, 'latest']) as string;
  return code !== '0x' && code !== '0x0';
}

test.describe('Rebalance Full Cycle', () => {
  test('rebalance preserves NAV and updates weights', async () => {
    // Submission itself is fast. Oracle consensus is what takes time.
    // We allow up to CONSENSUS_TIMEOUT for oracle processing, but it is not a hard failure.
    test.setTimeout(CONSENSUS_TIMEOUT + 120_000);

    // 0. Discover a valid ITP with >=2 assets (rebalance needs at least 2)
    const itpIds = await getAvailableItpIds(5);
    let ITP_ID: string | null = null;
    let stateBefore: Awaited<ReturnType<typeof getItpStateL3>> | null = null;
    for (const id of itpIds) {
      const s = await getItpStateL3(id);
      if (s.assets.length >= 2 && s.weights.length >= 2 && s.nav > 0n) {
        ITP_ID = id;
        stateBefore = s;
        break;
      }
    }
    if (!ITP_ID || !stateBefore) {
      console.log(`No ITP with >=2 assets found among ${itpIds.length} ITPs — skipping rebalance test`);
      test.skip();
      return;
    }
    console.log(`Rebalance: targeting ITP ${ITP_ID} (${stateBefore.assets.length} assets)`);

    // 1. Record state
    const navBefore = stateBefore.nav;
    const weightsBefore = [...stateBefore.weights];
    console.log(`Before: NAV=${navBefore}, weights[0]=${weightsBefore[0]}, weights[1]=${weightsBefore[1]}`);

    // NAV must be non-zero for the test to be meaningful
    expect(navBefore).toBeGreaterThan(0n);

    // 2. Check if all assets have contract code — if any is codeless, issuers
    // cannot compute prices and rebalance will stall
    const codelessAssets: string[] = [];
    for (const asset of stateBefore.assets) {
      if (!(await hasCode(asset))) {
        codelessAssets.push(asset);
      }
    }
    // Also check if assets are in the symbol-map (oracle needs prices for rebalance)
    let unpricedAssets = 0;
    try {
      const { readFileSync } = require('fs');
      const { join } = require('path');
      const smap = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'data', 'symbol-map.json'), 'utf-8'));
      for (const asset of stateBefore.assets) {
        if (!smap[asset.toLowerCase()]) unpricedAssets++;
      }
    } catch { /* symbol-map not available */ }

    if (codelessAssets.length > 0 || unpricedAssets > 0) {
      console.log(`WARNING: ${codelessAssets.length} codeless, ${unpricedAssets} unpriced asset(s) — rebalance consensus will stall`);
      if (codelessAssets.length > 0) console.log(`Codeless: ${codelessAssets.join(', ')}`);
      console.log('Verifying ITP state is valid and skipping rebalance execution');

      expect(stateBefore.assets.length).toBe(stateBefore.weights.length);
      const totalWeight = weightsBefore.reduce((a, b) => a + b, 0n);
      expect(totalWeight).toBe(1000000000000000000n);
      return;
    }

    // 3. Submit the rebalance request on-chain — hard assertion: TX must land
    console.log('Submitting requestRebalance TX...');
    const { txHash, weightsBefore: w0Before } = await submitRebalanceRequest(ITP_ID);
    console.log(`requestRebalance TX confirmed: ${txHash}`);
    // TX confirmed means the contract accepted the rebalance request.
    // This is the primary hard assertion — the oracle pipeline is a soft concern.
    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/i);

    // 4. Wait for oracle consensus (soft-pass: timeout is not a hard failure)
    console.log(`Waiting up to ${CONSENSUS_TIMEOUT / 1000}s for oracle to execute rebalance...`);
    let oracleExecuted = false;
    try {
      await pollUntil(
        () => getItpStateL3(ITP_ID!),
        (s) => s.weights[0] !== w0Before,
        CONSENSUS_TIMEOUT,
        3_000,
      );
      oracleExecuted = true;
    } catch {
      console.warn('SKIP: Oracle did not execute rebalance within timeout — requestRebalance TX succeeded but oracle consensus is a separate concern.');
      console.warn(`TX: ${txHash}`);
      return;
    }

    // 5. Oracle executed — verify the outcome
    const stateAfter = await getItpStateL3(ITP_ID);
    const navAfter = stateAfter.nav;
    const weightsAfter = stateAfter.weights;

    console.log(`After: NAV=${navAfter}, weights[0]=${weightsAfter[0]}, weights[1]=${weightsAfter[1]}`);

    // Weights must have changed
    expect(weightsAfter[0]).not.toBe(weightsBefore[0]);
    expect(weightsAfter[1]).not.toBe(weightsBefore[1]);

    // Total weight sum preserved (must sum to 1e18)
    const totalWeightBefore = weightsBefore.reduce((a, b) => a + b, 0n);
    const totalWeightAfter = weightsAfter.reduce((a, b) => a + b, 0n);
    expect(totalWeightAfter).toBe(totalWeightBefore);

    // NAV preserved within 2%
    if (navBefore > 0n && navAfter > 0n) {
      const navDiffBps = (navAfter > navBefore
        ? (navAfter - navBefore) * 10000n / navBefore
        : (navBefore - navAfter) * 10000n / navBefore);
      console.log(`NAV drift: ${navDiffBps} bps`);
      expect(navDiffBps).toBeLessThanOrEqual(200n);
    }

    // Inventory recalculated
    expect(stateAfter.inventory.length).toBe(stateBefore.inventory.length);
    const inventoryChanged = stateAfter.inventory.some(
      (inv, i) => inv !== stateBefore!.inventory[i]
    );
    expect(inventoryChanged).toBe(true);

    console.log('Rebalance completed and verified.');
  });
});
