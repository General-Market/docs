/**
 * Phase 3: Order Flood
 *
 * Floods buy/sell orders as fast as Anvil can mine them.
 * Tests queue depth limits, fill latency, and throughput.
 */

import {
  PHASE3_TIERS, L3_RPC, L3_INDEX, DEPLOYER, ANVIL_ACCOUNTS,
  Side, OrderStatus,
} from './config';
import {
  log, logSection, logVerbose, timer, sleep,
  submitOrder, getOrder, pollOrderStatus, getItpState, getItpCount,
  fundAccountUsdc, getUserShares, getNextOrderId,
  l3Rpc, resetAllNonces,
} from './helpers';

export interface Phase3Result {
  tier: string;
  label: string;
  ordersSubmitted: number;
  ordersFailed: number;
  ordersFilledCount: number;
  submitRatePerSec: number;
  fillLatencyP50Ms: number;
  fillLatencyP95Ms: number;
  fillLatencyP99Ms: number;
  wallTimeMs: number;
  queueFullTriggered: boolean;
  breakingPoint: string | null;
}

export async function runPhase3(): Promise<Phase3Result[]> {
  logSection('PHASE 3: ORDER FLOOD');

  const results: Phase3Result[] = [];

  for (const [key, tier] of Object.entries(PHASE3_TIERS)) {
    const result = await runTier(key, tier);
    results.push(result);
  }

  return results;
}

async function runTier(
  tierKey: string,
  tier: { orders: number; itps: number; label: string },
): Promise<Phase3Result> {
  logSection(`Phase 3 Tier ${tierKey}: ${tier.orders} orders across ${tier.itps} ITPs — ${tier.label}`);

  // Reset nonce cache between tiers to avoid stale nonces
  resetAllNonces();

  const result: Phase3Result = {
    tier: tierKey,
    label: tier.label,
    ordersSubmitted: 0,
    ordersFailed: 0,
    ordersFilledCount: 0,
    submitRatePerSec: 0,
    fillLatencyP50Ms: 0,
    fillLatencyP95Ms: 0,
    fillLatencyP99Ms: 0,
    wallTimeMs: 0,
    queueFullTriggered: false,
    breakingPoint: null,
  };

  // Get available ITPs
  const itpCount = await getItpCount();
  const availableItps = Math.min(tier.itps, itpCount);
  if (availableItps === 0) {
    result.breakingPoint = 'No ITPs available (run Phase 1 first)';
    return result;
  }

  const itpIds = Array.from({ length: availableItps }, (_, i) =>
    '0x' + (i + 1).toString(16).padStart(64, '0')
  );

  // Fund test accounts with USDC (use accounts 1-9, rotate)
  const senders = ANVIL_ACCOUNTS.slice(1, 10); // accounts 1-9
  const amountPerAccount = BigInt(tier.orders) * 200n * 10n ** 18n; // generous buffer

  log('Funding test accounts...');
  await Promise.all(
    senders.map(account => fundAccountUsdc(account, amountPerAccount).catch(() => {}))
  );

  // Get NAV for limit price
  let nav = 10n ** 18n;
  try {
    const state = await getItpState(itpIds[0]);
    if (state.nav > 0n) nav = state.nav;
  } catch {}

  const buyLimit = nav + (nav * 10n / 100n); // NAV * 1.10
  const orderAmount = 100n * 10n ** 18n; // 100 USDC

  // Submit orders as fast as possible
  const tWall = timer('wall');
  const tSubmit = timer('submit');
  const orderIds: number[] = [];
  const submitTimestamps: number[] = [];
  let queueFull = false;

  log(`Submitting ${tier.orders} buy orders...`);

  // Send in concurrent batches
  const batchSize = Math.min(20, tier.orders);
  let submitted = 0;
  let failed = 0;

  for (let batch = 0; batch < tier.orders; batch += batchSize) {
    const count = Math.min(batchSize, tier.orders - batch);
    const promises: Promise<void>[] = [];

    for (let i = 0; i < count; i++) {
      const sender = senders[(batch + i) % senders.length];
      const itpId = itpIds[(batch + i) % itpIds.length];

      promises.push(
        submitOrder(itpId, Side.BUY, orderAmount, buyLimit, 0n, undefined, sender)
          .then(({ orderId }) => {
            orderIds.push(orderId);
            submitTimestamps.push(Date.now());
            submitted++;
          })
          .catch(err => {
            failed++;
            if (err.message.includes('E083') || err.message.includes('QueueFull')) {
              queueFull = true;
              if (!result.breakingPoint) {
                result.breakingPoint = `Queue full at order #${batch + i + 1}: ${err.message}`;
              }
            } else {
              logVerbose(`  Order #${batch + i + 1} failed: ${err.message}`);
            }
          })
      );
    }

    await Promise.all(promises);

    if (queueFull) {
      log(`  Queue full triggered after ${submitted} orders`);
      break;
    }

    if ((submitted + failed) % 50 === 0) {
      log(`  Progress: ${submitted} submitted, ${failed} failed`);
    }
  }

  const submitTimeMs = tSubmit.stop().ms;
  result.ordersSubmitted = submitted;
  result.ordersFailed = failed;
  result.submitRatePerSec = submitted > 0 ? (submitted / submitTimeMs) * 1000 : 0;
  result.queueFullTriggered = queueFull;

  log(`  Submitted ${submitted} orders in ${submitTimeMs.toFixed(0)}ms (${result.submitRatePerSec.toFixed(1)}/s)`);

  // Wait for fills and measure latency
  if (submitted > 0) {
    log('  Waiting for fills...');
    const fillLatencies: number[] = [];
    const sampleSize = Math.min(50, orderIds.length); // Sample to avoid huge wait
    const sampleIds = orderIds.slice(0, sampleSize);

    const fillPromises = sampleIds.map((orderId, idx) =>
      pollOrderStatus(orderId, OrderStatus.FILLED, 180_000)
        .then(() => {
          const latency = Date.now() - submitTimestamps[idx];
          fillLatencies.push(latency);
        })
        .catch(() => {
          // Not filled within timeout
        })
    );

    await Promise.all(fillPromises);

    result.ordersFilledCount = fillLatencies.length;

    if (fillLatencies.length > 0) {
      fillLatencies.sort((a, b) => a - b);
      result.fillLatencyP50Ms = percentile(fillLatencies, 50);
      result.fillLatencyP95Ms = percentile(fillLatencies, 95);
      result.fillLatencyP99Ms = percentile(fillLatencies, 99);
      log(`  Fills: ${fillLatencies.length}/${sampleSize} sampled`);
      log(`  Latency: P50=${result.fillLatencyP50Ms.toFixed(0)}ms P95=${result.fillLatencyP95Ms.toFixed(0)}ms P99=${result.fillLatencyP99Ms.toFixed(0)}ms`);
    } else {
      log('  No orders filled within timeout.');
    }
  }

  result.wallTimeMs = tWall.stop().ms;
  log(`  Total wall time: ${result.wallTimeMs.toFixed(0)}ms`);
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
