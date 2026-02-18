/**
 * Phase 5: Combined Load (60s sustained)
 *
 * Runs all operations simultaneously at escalating rates.
 * Measures issuer cycle duration, fill latency percentiles, and health stability.
 */

import {
  PHASE5_RATES, L3_RPC, ARB_RPC, DEPLOYER, ANVIL_ACCOUNTS,
  Side, OrderStatus,
} from './config';
import {
  log, logSection, logVerbose, timer, sleep,
  submitOrder, getOrder, pollOrderStatus,
  getItpState, getItpCount,
  fundAccountUsdc, requestRebalance, requestCreateItp,
  deployMockToken, resetAllNonces,
} from './helpers';
import { checkAllHealthy, getMonitorSnapshot } from './monitor';

export interface Phase5Result {
  rate: string;
  durationMs: number;
  buysSubmitted: number;
  sellsSubmitted: number;
  rebalancesRequested: number;
  itpsCreated: number;
  ordersFilledCount: number;
  fillLatencyP50Ms: number;
  fillLatencyP95Ms: number;
  fillLatencyP99Ms: number;
  healthDrops: number;
  breakingPoint: string | null;
}

const PHASE_DURATION_MS = 60_000;

export async function runPhase5(): Promise<Phase5Result[]> {
  logSection('PHASE 5: COMBINED LOAD (60s sustained)');

  const results: Phase5Result[] = [];

  for (const [key, rate] of Object.entries(PHASE5_RATES)) {
    const result = await runRate(key, rate);
    results.push(result);

    // If high rate broke things, don't escalate further
    if (result.breakingPoint) {
      log(`  Breaking point reached at ${key} rate, stopping escalation.`);
      break;
    }
  }

  return results;
}

async function runRate(
  rateKey: string,
  rate: { buysPerSec: number; sellsPerSec: number; rebalanceInterval: number; itpCreateInterval: number },
): Promise<Phase5Result> {
  logSection(`Phase 5 Rate: ${rateKey} — ${rate.buysPerSec} buys/s, ${rate.sellsPerSec} sells/s`);

  // Reset nonce cache between rates to avoid stale nonces
  resetAllNonces();

  const result: Phase5Result = {
    rate: rateKey,
    durationMs: 0,
    buysSubmitted: 0,
    sellsSubmitted: 0,
    rebalancesRequested: 0,
    itpsCreated: 0,
    ordersFilledCount: 0,
    fillLatencyP50Ms: 0,
    fillLatencyP95Ms: 0,
    fillLatencyP99Ms: 0,
    healthDrops: 0,
    breakingPoint: null,
  };

  // Get available ITPs
  const itpCount = await getItpCount();
  if (itpCount === 0) {
    result.breakingPoint = 'No ITPs available';
    return result;
  }

  const maxItps = Math.min(itpCount, 10);
  const itpIds = Array.from({ length: maxItps }, (_, i) =>
    '0x' + (i + 1).toString(16).padStart(64, '0')
  );

  // Fund accounts
  const senders = ANVIL_ACCOUNTS.slice(1, 10);
  const fundAmount = 100000n * 10n ** 18n;
  log('Funding test accounts...');
  await Promise.all(senders.map(a => fundAccountUsdc(a, fundAmount).catch(() => {})));

  // Get NAV
  let nav = 10n ** 18n;
  try {
    const state = await getItpState(itpIds[0]);
    if (state.nav > 0n) nav = state.nav;
  } catch {}

  // Deploy tokens for ITP creation stream
  let createTokens: string[] = [];
  try {
    const [ct1, ct2, ct3] = await Promise.all([
      deployMockToken('CombT1', 'CT1'),
      deployMockToken('CombT2', 'CT2'),
      deployMockToken('CombT3', 'CT3'),
    ]);
    createTokens = [ct1, ct2, ct3];
  } catch {
    log('  Warning: could not deploy tokens for ITP creation stream');
  }

  // Track order submission times for latency calculation
  const orderSubmitTimes: Map<number, number> = new Map();
  const fillLatencies: number[] = [];

  const tWall = timer('combined');
  const startTime = Date.now();
  const endTime = startTime + PHASE_DURATION_MS;

  let buyCounter = 0;
  let sellCounter = 0;

  // Interval-based submission loops
  const buyInterval = 1000 / rate.buysPerSec;
  const sellInterval = rate.sellsPerSec > 0 ? 1000 / rate.sellsPerSec : Infinity;

  let lastBuyTime = startTime;
  let lastSellTime = startTime;
  let lastRebalanceTime = startTime;
  let lastCreateTime = startTime;
  let healthDrops = 0;

  log(`  Running for 60s at ${rateKey} rate...`);

  // Main loop — tick every 50ms
  while (Date.now() < endTime) {
    const now = Date.now();
    const elapsed = now - startTime;
    const promises: Promise<void>[] = [];

    // Submit buys
    while (now - lastBuyTime >= buyInterval && buyCounter < rate.buysPerSec * 65) {
      const sender = senders[buyCounter % senders.length];
      const itpId = itpIds[buyCounter % itpIds.length];
      const orderAmount = 50n * 10n ** 18n; // smaller amounts for sustained load

      promises.push(
        submitOrder(itpId, Side.BUY, orderAmount, nav + (nav * 15n / 100n), 0n, undefined, sender)
          .then(({ orderId }) => {
            result.buysSubmitted++;
            orderSubmitTimes.set(orderId, Date.now());
          })
          .catch(() => { /* ignore individual failures in flood */ })
      );

      buyCounter++;
      lastBuyTime += buyInterval;
    }

    // Submit sells (if we have any shares — best effort)
    while (now - lastSellTime >= sellInterval && sellCounter < rate.sellsPerSec * 65) {
      // Sells are harder since we need shares. Submit as buy-then-sell is too slow.
      // Instead, submit sell orders that may fail (no shares) — we're testing throughput.
      const sender = senders[sellCounter % senders.length];
      const itpId = itpIds[sellCounter % itpIds.length];
      const sellAmount = 10n * 10n ** 18n;

      promises.push(
        submitOrder(itpId, Side.SELL, sellAmount, nav - (nav * 15n / 100n), 0n, undefined, sender)
          .then(({ orderId }) => {
            result.sellsSubmitted++;
            orderSubmitTimes.set(orderId, Date.now());
          })
          .catch(() => { /* expected: most will fail without shares */ })
      );

      sellCounter++;
      lastSellTime += sellInterval;
    }

    // Trigger rebalance
    if (now - lastRebalanceTime >= rate.rebalanceInterval && itpIds.length > 0) {
      const rebalItpId = itpIds[result.rebalancesRequested % itpIds.length];
      promises.push(
        (async () => {
          try {
            const state = await getItpState(rebalItpId);
            if (state.weights.length >= 2) {
              const newWeights = [...state.weights];
              const shift = 5000000000000000n;
              const minW = 2500000000000000n;
              if (newWeights[0] - shift >= minW) {
                newWeights[0] -= shift;
                newWeights[1] += shift;
              }
              await requestRebalance(rebalItpId, newWeights, `p5-${rateKey}`);
              result.rebalancesRequested++;
            }
          } catch { /* ignore */ }
        })()
      );
      lastRebalanceTime = now;
    }

    // Create ITP
    if (now - lastCreateTime >= rate.itpCreateInterval && createTokens.length >= 3) {
      const weights = [400000000000000000n, 300000000000000000n, 300000000000000000n];
      const prices = [10n ** 18n, 10n ** 18n, 10n ** 18n];
      promises.push(
        requestCreateItp(
          `Comb${result.itpsCreated}`,
          `C${result.itpsCreated}`,
          weights, createTokens, prices,
        )
          .then(() => { result.itpsCreated++; })
          .catch(() => {})
      );
      lastCreateTime = now;
    }

    // Check health every 5s
    if (elapsed % 5000 < 100) {
      const healthy = await checkAllHealthy();
      if (!healthy) healthDrops++;
    }

    // Await current batch
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }

    // Progress update every 10s
    if (elapsed % 10000 < 100) {
      log(`  ${(elapsed / 1000).toFixed(0)}s: buys=${result.buysSubmitted} sells=${result.sellsSubmitted} rebalances=${result.rebalancesRequested} creates=${result.itpsCreated}`);
    }

    await sleep(50); // tick
  }

  result.durationMs = tWall.stop().ms;
  result.healthDrops = healthDrops;

  // Sample fill latencies from submitted orders
  log('  Checking fill status for submitted orders...');
  const sampleIds = [...orderSubmitTimes.keys()].slice(0, 30);
  for (const orderId of sampleIds) {
    try {
      const order = await getOrder(orderId);
      if (order.status === OrderStatus.FILLED) {
        const submitTime = orderSubmitTimes.get(orderId) ?? 0;
        if (submitTime > 0) {
          fillLatencies.push(Date.now() - submitTime);
        }
        result.ordersFilledCount++;
      }
    } catch { /* skip */ }
  }

  if (fillLatencies.length > 0) {
    fillLatencies.sort((a, b) => a - b);
    result.fillLatencyP50Ms = percentile(fillLatencies, 50);
    result.fillLatencyP95Ms = percentile(fillLatencies, 95);
    result.fillLatencyP99Ms = percentile(fillLatencies, 99);
  }

  // Check if we hit critical thresholds
  const snapshot = getMonitorSnapshot();
  const criticalLatencies = snapshot.samples.filter(s => s.latencyMs > 2000);
  if (criticalLatencies.length > snapshot.samples.length * 0.1) {
    result.breakingPoint = `>10% of health checks exceeded 2s latency (${criticalLatencies.length}/${snapshot.samples.length})`;
  }

  log(`  ${rateKey} rate complete: ${result.durationMs.toFixed(0)}ms`);
  log(`  Buys: ${result.buysSubmitted}, Sells: ${result.sellsSubmitted}, Rebalances: ${result.rebalancesRequested}, Creates: ${result.itpsCreated}`);
  log(`  Fills (sampled): ${result.ordersFilledCount}/${sampleIds.length}`);
  if (fillLatencies.length > 0) {
    log(`  Fill latency: P50=${result.fillLatencyP50Ms.toFixed(0)}ms P95=${result.fillLatencyP95Ms.toFixed(0)}ms P99=${result.fillLatencyP99Ms.toFixed(0)}ms`);
  }
  log(`  Health drops: ${result.healthDrops}`);
  if (result.breakingPoint) {
    log(`  Breaking point: ${result.breakingPoint}`);
  }

  return result;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
