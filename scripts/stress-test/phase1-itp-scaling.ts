/**
 * Phase 1: ITP Creation Scaling (Direct L3)
 *
 * Bypasses oracle relay — calls Index.createITP() directly on L3.
 * Measures gas costs, wall time, and RPC latency as ITP count grows.
 */

import {
  PHASE1_TIERS, L3_RPC, L3_INDEX, DEPLOYER,
} from './config';
import {
  log, logSection, logVerbose, timer, sleep,
  createItpDirect, getItpCount, getItpState, deployMockToken,
  l3Rpc,
} from './helpers';

export interface Phase1Result {
  tier: string;
  label: string;
  itpsCreated: number;
  totalGasUsed: bigint;
  avgGasPerItp: bigint;
  wallTimeMs: number;
  getItpCountLatencyMs: number;
  getItpStateLatencyMs: number;
  breakingPoint: string | null;
}

async function deployTestTokens(count: number): Promise<string[]> {
  log(`Deploying ${count} mock tokens for ITP creation...`);
  const tokens: string[] = [];
  // Deploy in batches of 10 for speed
  const batchSize = 10;
  for (let i = 0; i < count; i += batchSize) {
    const batch = Math.min(batchSize, count - i);
    const promises = Array.from({ length: batch }, (_, j) =>
      deployMockToken(`StressToken${i + j}`, `ST${i + j}`)
    );
    const results = await Promise.all(promises);
    tokens.push(...results);
    logVerbose(`  Deployed tokens ${i + 1}-${i + results.length}`);
  }
  return tokens;
}

function makeWeights(count: number): bigint[] {
  // Equal weights summing to 1e18
  const baseWeight = 10n ** 18n / BigInt(count);
  const weights = Array(count).fill(baseWeight) as bigint[];
  // Adjust last weight to ensure exact sum
  const sum = weights.reduce((a, b) => a + b, 0n);
  weights[weights.length - 1] += (10n ** 18n - sum);
  return weights;
}

async function runTier(
  tierKey: string,
  tier: { itps: number; assetsPerItp: number; label: string },
  tokens: string[],
): Promise<Phase1Result> {
  logSection(`Phase 1 Tier ${tierKey}: ${tier.itps} ITPs x ${tier.assetsPerItp} assets — ${tier.label}`);

  const result: Phase1Result = {
    tier: tierKey,
    label: tier.label,
    itpsCreated: 0,
    totalGasUsed: 0n,
    avgGasPerItp: 0n,
    wallTimeMs: 0,
    getItpCountLatencyMs: 0,
    getItpStateLatencyMs: 0,
    breakingPoint: null,
  };

  const useTokens = tokens.slice(0, tier.assetsPerItp);
  if (useTokens.length < tier.assetsPerItp) {
    result.breakingPoint = `Not enough tokens deployed (need ${tier.assetsPerItp}, have ${useTokens.length})`;
    return result;
  }

  const weights = makeWeights(tier.assetsPerItp);
  const prices = Array(tier.assetsPerItp).fill(10n ** 18n); // $1 each

  const t = timer(`tier-${tierKey}`);
  let lastItpId = '';

  for (let i = 0; i < tier.itps; i++) {
    try {
      const { receipt, itpId } = await createItpDirect(
        `Stress${tierKey}${i}`,
        `S${tierKey}${i}`,
        weights,
        useTokens,
        prices,
      );
      result.itpsCreated++;
      result.totalGasUsed += BigInt(receipt.gasUsed);
      lastItpId = itpId;

      if ((i + 1) % 100 === 0 || i === tier.itps - 1) {
        log(`  Created ${i + 1}/${tier.itps} ITPs (gas this tx: ${BigInt(receipt.gasUsed)})`);
      }
    } catch (err: any) {
      result.breakingPoint = `Failed at ITP #${i + 1}: ${err.message}`;
      log(`  BREAKING POINT at ITP #${i + 1}: ${err.message}`);
      break;
    }
  }

  result.wallTimeMs = t.stop().ms;

  if (result.itpsCreated > 0) {
    result.avgGasPerItp = result.totalGasUsed / BigInt(result.itpsCreated);
  }

  // Measure read latency
  const tCount = timer('getItpCount');
  try {
    await getItpCount();
    result.getItpCountLatencyMs = tCount.stop().ms;
  } catch {
    result.getItpCountLatencyMs = -1;
  }

  if (lastItpId) {
    const tState = timer('getItpState');
    try {
      await getItpState(lastItpId);
      result.getItpStateLatencyMs = tState.stop().ms;
    } catch {
      result.getItpStateLatencyMs = -1;
    }
  }

  log(`  Results: ${result.itpsCreated} created, avg gas=${result.avgGasPerItp}, wall=${result.wallTimeMs.toFixed(0)}ms`);
  log(`  Read latency: getItpCount=${result.getItpCountLatencyMs.toFixed(1)}ms, getItpState=${result.getItpStateLatencyMs.toFixed(1)}ms`);
  if (result.breakingPoint) {
    log(`  Breaking point: ${result.breakingPoint}`);
  }

  return result;
}

export async function runPhase1(): Promise<Phase1Result[]> {
  logSection('PHASE 1: ITP CREATION SCALING');

  // Deploy enough tokens for the largest tier (500+ for tier E)
  const maxTokens = Math.max(...Object.values(PHASE1_TIERS).map(t => t.assetsPerItp));
  const tokens = await deployTestTokens(maxTokens);

  const results: Phase1Result[] = [];
  const tiers = Object.entries(PHASE1_TIERS) as [string, typeof PHASE1_TIERS[keyof typeof PHASE1_TIERS]][];

  for (const [key, tier] of tiers) {
    const result = await runTier(key, tier, tokens);
    results.push(result);

    // If we hit a breaking point on a smaller tier, skip larger ones
    if (result.breakingPoint && tier.assetsPerItp <= 3) {
      log(`Skipping remaining tiers due to breaking point on tier ${key}`);
      break;
    }
  }

  return results;
}
