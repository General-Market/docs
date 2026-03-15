/**
 * Phase 4: Rebalance Storm
 *
 * Triggers concurrent rebalances on multiple ITPs.
 * Measures latency, NAV preservation, and oracle cycle impact.
 */

import {
  PHASE4_TIERS, L3_RPC, DEPLOYER,
} from './config';
import {
  log, logSection, logVerbose, timer, sleep,
  getItpState, getItpCount, requestRebalance, executeRebalance,
  fetchPrices, pollUntil,
} from './helpers';

export interface Phase4Result {
  tier: string;
  label: string;
  rebalancesAttempted: number;
  rebalancesCompleted: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  navPreserved: boolean;
  navDriftPct: number;
  breakingPoint: string | null;
}

export async function runPhase4(): Promise<Phase4Result[]> {
  logSection('PHASE 4: REBALANCE STORM');

  const results: Phase4Result[] = [];

  for (const [key, tier] of Object.entries(PHASE4_TIERS)) {
    const result = await runTier(key, tier);
    results.push(result);
  }

  return results;
}

async function runTier(
  tierKey: string,
  tier: { concurrent: number; label: string },
): Promise<Phase4Result> {
  logSection(`Phase 4 Tier ${tierKey}: ${tier.concurrent} concurrent rebalances — ${tier.label}`);

  const result: Phase4Result = {
    tier: tierKey,
    label: tier.label,
    rebalancesAttempted: tier.concurrent,
    rebalancesCompleted: 0,
    avgLatencyMs: 0,
    maxLatencyMs: 0,
    navPreserved: true,
    navDriftPct: 0,
    breakingPoint: null,
  };

  // Find ITPs with non-zero supply (from previous phases)
  const itpCount = await getItpCount();
  if (itpCount === 0) {
    result.breakingPoint = 'No ITPs available';
    return result;
  }

  // Collect eligible ITPs (those with supply > 0 and enough assets)
  const eligibleItps: Array<{ itpId: string; state: ReturnType<typeof getItpState> extends Promise<infer T> ? T : never }> = [];

  for (let i = 1; i <= Math.min(itpCount, tier.concurrent + 10); i++) {
    const itpId = '0x' + i.toString(16).padStart(64, '0');
    try {
      const state = await getItpState(itpId);
      if (state.assets.length >= 2) {
        eligibleItps.push({ itpId, state });
      }
    } catch { /* skip */ }
    if (eligibleItps.length >= tier.concurrent) break;
  }

  if (eligibleItps.length === 0) {
    result.breakingPoint = 'No eligible ITPs (need >= 2 assets)';
    return result;
  }

  const targetCount = Math.min(tier.concurrent, eligibleItps.length);
  log(`  Found ${eligibleItps.length} eligible ITPs, targeting ${targetCount} rebalances`);
  result.rebalancesAttempted = targetCount;

  // Record pre-rebalance NAVs
  const preNavs: bigint[] = eligibleItps.slice(0, targetCount).map(e => e.state.nav);

  // Prepare new weights for each ITP
  const rebalancePlans = eligibleItps.slice(0, targetCount).map(({ itpId, state }) => {
    const newWeights = [...state.weights];
    const minWeight = 2500000000000000n;
    const shift = 5000000000000000n;

    if (newWeights[0] - shift >= minWeight) {
      newWeights[0] -= shift;
      newWeights[1] += shift;
    } else if (newWeights[1] - shift >= minWeight) {
      newWeights[1] -= shift;
      newWeights[0] += shift;
    }
    // else: weights unchanged (both near minimum)

    return { itpId, newWeights, assets: state.assets };
  });

  // Fire all rebalances concurrently via BridgeProxy (let oracles process)
  log('  Triggering concurrent rebalances...');
  const latencies: number[] = [];

  const rebalancePromises = rebalancePlans.map(async (plan, idx) => {
    const t = timer(`rebalance-${idx}`);
    try {
      await requestRebalance(plan.itpId, plan.newWeights, `stress-p4-${tierKey}-${idx}`);

      // Also try direct execution for the ones where we have price data
      try {
        const prices = await fetchPrices(plan.assets);
        await executeRebalance(plan.itpId, plan.newWeights, prices);
      } catch {
        // Direct execution may fail if oracle processes it first — that's fine
      }

      const elapsed = t.stop();
      latencies.push(elapsed.ms);
      return true;
    } catch (err: any) {
      logVerbose(`  Rebalance ${idx} failed: ${err.message}`);
      return false;
    }
  });

  const outcomes = await Promise.all(rebalancePromises);
  result.rebalancesCompleted = outcomes.filter(Boolean).length;

  // Calculate latency stats
  if (latencies.length > 0) {
    latencies.sort((a, b) => a - b);
    result.avgLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    result.maxLatencyMs = latencies[latencies.length - 1];
  }

  // Wait a moment for state to settle, then check NAV preservation
  await sleep(3_000);

  let maxDrift = 0;
  for (let i = 0; i < Math.min(targetCount, eligibleItps.length); i++) {
    try {
      const postState = await getItpState(eligibleItps[i].itpId);
      const preNav = preNavs[i];
      const postNav = postState.nav;

      if (preNav > 0n && postNav > 0n) {
        const drift = Number(postNav - preNav) / Number(preNav) * 100;
        maxDrift = Math.max(maxDrift, Math.abs(drift));
        if (Math.abs(drift) > 1) {
          result.navPreserved = false;
          logVerbose(`  ITP ${i}: NAV drift ${drift.toFixed(4)}% (${preNav} → ${postNav})`);
        }
      }
    } catch { /* skip */ }
  }
  result.navDriftPct = maxDrift;

  log(`  Completed: ${result.rebalancesCompleted}/${result.rebalancesAttempted}`);
  log(`  Latency: avg=${result.avgLatencyMs.toFixed(0)}ms max=${result.maxLatencyMs.toFixed(0)}ms`);
  log(`  NAV preserved: ${result.navPreserved} (max drift: ${result.navDriftPct.toFixed(4)}%)`);
  if (result.breakingPoint) {
    log(`  Breaking point: ${result.breakingPoint}`);
  }

  return result;
}
