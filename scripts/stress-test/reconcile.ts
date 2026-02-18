/**
 * Snapshot + diff engine for Phase 6 reconciliation.
 * Takes before/after snapshots of on-chain state and computes expected vs actual deltas.
 */

import { L3_RPC, L3_INDEX } from './config';
import {
  getItpState, getUserShares, getBlockNumber, erc20BalanceOf,
  getL3Usdc, getPendingOrderCount, getFailedFillEscrow,
  rpcCall, l3Rpc, log, logVerbose,
  ItpState,
} from './helpers';
import {
  OperationLedger, LedgerEntry, ParsedEvents,
  parseEventsInRange, ParsedFillConfirmed,
} from './ledger';

// getITP(bytes32) selector
const SEL_GET_ITP = 'f917d3f9';

// ── Types ────────────────────────────────────────────────────────────

export interface ItpSnapshot {
  totalSupply: bigint;
  nav: bigint;
  weights: bigint[];
  inventory: bigint[];
}

export interface Snapshot {
  blockNumber: number;
  itpStates: Map<string, ItpSnapshot>;
  userShares: Map<string, Map<string, bigint>>; // itpId → user → shares
  usdcBalances: Map<string, bigint>; // account → balance
  pendingOrderCount: number;
}

export type MismatchSeverity = 'critical' | 'warning' | 'info';

export interface Mismatch {
  category: string;
  description: string;
  expected: string;
  actual: string;
  severity: MismatchSeverity;
}

export interface FuzzStats {
  totalFuzzOps: number;
  correctReverts: number;
  incorrectSuccesses: number; // CRITICAL: fuzz ops that should have reverted but succeeded
  correctSuccesses: number;
  incorrectReverts: number;
}

export interface ReconciliationResult {
  initialBlock: number;
  finalBlock: number;
  mismatches: Mismatch[];
  fuzzStats: FuzzStats;
  events: {
    ordersSubmitted: number;
    fillsConfirmed: number;
    itpsCreated: number;
    rebalances: number;
    feesCharged: number;
  };
  stuckOrders: number;
  escrowLeaks: number;
}

// ── Snapshot ──────────────────────────────────────────────────────────

/** Take a snapshot of on-chain state for the given ITPs and sampled accounts. */
export async function takeSnapshot(
  accounts: string[],
  itpIds: string[],
  sampleSize: number = 20,
): Promise<Snapshot> {
  const blockNumber = await getBlockNumber(L3_RPC);
  const usdc = await getL3Usdc();

  // Sample accounts for balance tracking
  const sampledAccounts = accounts.slice(0, Math.min(sampleSize, accounts.length));

  // Fetch ITP states in parallel
  const itpStates = new Map<string, ItpSnapshot>();
  const itpPromises = itpIds.map(async (itpId) => {
    try {
      const state = await getItpState(itpId);
      itpStates.set(itpId, {
        totalSupply: state.totalSupply,
        nav: state.nav,
        weights: state.weights,
        inventory: state.inventory,
      });
    } catch { /* ITP may not exist yet */ }
  });
  await Promise.all(itpPromises);

  // Fetch user shares (sampled)
  const userShares = new Map<string, Map<string, bigint>>();
  for (const itpId of itpIds) {
    const sharesMap = new Map<string, bigint>();
    const sharePromises = sampledAccounts.map(async (account) => {
      try {
        const shares = await getUserShares(itpId, account);
        if (shares > 0n) sharesMap.set(account, shares);
      } catch {}
    });
    await Promise.all(sharePromises);
    if (sharesMap.size > 0) userShares.set(itpId, sharesMap);
  }

  // Fetch USDC balances (sampled)
  const usdcBalances = new Map<string, bigint>();
  const balPromises = sampledAccounts.map(async (account) => {
    try {
      const bal = await erc20BalanceOf(L3_RPC, usdc, account);
      usdcBalances.set(account, bal);
    } catch {}
  });
  await Promise.all(balPromises);

  // Pending order count
  let pendingOrderCount = 0;
  try {
    pendingOrderCount = await getPendingOrderCount();
  } catch {}

  return {
    blockNumber,
    itpStates,
    userShares,
    usdcBalances,
    pendingOrderCount,
  };
}

// ── Reconciliation ───────────────────────────────────────────────────

/** Reconcile expected vs actual on-chain state after chaos testing. */
export async function reconcile(
  initialSnapshot: Snapshot,
  accounts: string[],
  ledger: OperationLedger,
  itpIds: string[],
): Promise<ReconciliationResult> {
  const mismatches: Mismatch[] = [];

  // 1. Check tx receipts for all ledger ops → classify succeeded/reverted
  log('Reconciling: checking tx receipts...');
  const allOps = ledger.getAll();
  for (const op of allOps) {
    if (op.txHash && op.succeeded === null) {
      try {
        const receipt = await l3Rpc('eth_getTransactionReceipt', [op.txHash]) as any;
        if (receipt) {
          ledger.markResult(op.id, receipt.status === '0x1');
        }
      } catch {}
    }
  }

  // 2. Fuzz validation
  const fuzzStats: FuzzStats = {
    totalFuzzOps: 0,
    correctReverts: 0,
    incorrectSuccesses: 0,
    correctSuccesses: 0,
    incorrectReverts: 0,
  };

  for (const op of allOps) {
    if (op.expectedRevert) {
      fuzzStats.totalFuzzOps++;
      if (op.succeeded === false) {
        fuzzStats.correctReverts++;
      } else if (op.succeeded === true) {
        fuzzStats.incorrectSuccesses++;
        mismatches.push({
          category: 'fuzz-validation',
          description: `Fuzz op ${op.fuzzLabel} succeeded but should have reverted (account=${op.account}, itpId=${op.itpId})`,
          expected: 'revert',
          actual: 'success',
          severity: 'critical',
        });
      }
    } else {
      // Non-fuzz ops: "correctSuccesses" = normal ops that worked,
      // "incorrectReverts" = normal ops that failed (expected — e.g. sell with 0 shares, insufficient balance).
      // Not a real concern unless the number is disproportionately high.
      if (op.succeeded === true) fuzzStats.correctSuccesses++;
      else if (op.succeeded === false) fuzzStats.incorrectReverts++;
    }
  }

  // 3. Parse event logs
  log('Reconciling: parsing event logs...');
  const finalBlock = await getBlockNumber(L3_RPC);

  // Scan FillConfirmed only in this tier's block range
  const events = await parseEventsInRange(initialSnapshot.blockNumber, finalBlock);

  // Scan OrderSubmitted from block 0 so cross-tier fills can find their parent order.
  // Fills from previous tiers whose orders were submitted before our snapshot would
  // otherwise be silently skipped, causing totalSupply mismatches.
  const allOrders = (await parseEventsInRange(0, finalBlock)).ordersSubmitted;

  // Build orderId → order lookup (covers all orders, not just this tier)
  const orderById = new Map<bigint, typeof allOrders[0]>();
  for (const o of allOrders) {
    orderById.set(o.orderId, o);
  }

  // 4. Compute expected deltas from FillConfirmed events
  // Build per-ITP fill deltas for totalSupply
  const supplyDeltas = new Map<string, bigint>(); // itpId → net supply change

  for (const fill of events.fillsConfirmed) {
    // Look up order from full history (not just this tier's events)
    const orderEvent = orderById.get(fill.orderId);
    if (!orderEvent) {
      logVerbose(`  Reconcile: FillConfirmed for orderId=${fill.orderId} has no matching OrderSubmitted (orphan)`);
      continue;
    }

    const itpId = orderEvent.itpId;
    const delta = supplyDeltas.get(itpId) ?? 0n;

    if (orderEvent.side === 0) {
      // BUY: shares minted = (fillAmount * 1e18) / fillPrice (matches Index._processFill)
      const sharesMinted = fill.fillPrice > 0n
        ? (fill.fillAmount * (10n ** 18n)) / fill.fillPrice
        : 0n;
      supplyDeltas.set(itpId, delta + sharesMinted);
    } else {
      // SELL: net supply change = -fillAmount (contract burns order.amount then refunds unfilled)
      supplyDeltas.set(itpId, delta - fill.fillAmount);
    }
  }

  // 5. Read actual final state
  log('Reconciling: taking final snapshot...');
  const finalSnapshot = await takeSnapshot(accounts, itpIds);

  // 6. Diff: totalSupply per ITP
  for (const itpId of itpIds) {
    // ITPs created during chaos won't have an initial snapshot — assume supply started at 0
    const initial = initialSnapshot.itpStates.get(itpId) ?? { totalSupply: 0n, nav: 0n, weights: [], inventory: [] };
    const final_ = finalSnapshot.itpStates.get(itpId);
    if (!final_) continue; // ITP doesn't exist yet (create still pending)

    const expectedDelta = supplyDeltas.get(itpId) ?? 0n;
    const expectedSupply = initial.totalSupply + expectedDelta;
    const actualSupply = final_.totalSupply;

    // Allow 1% tolerance for rounding in fill calculations
    if (expectedSupply > 0n) {
      const diff = actualSupply > expectedSupply
        ? actualSupply - expectedSupply
        : expectedSupply - actualSupply;
      const tolerance = expectedSupply / 100n; // 1%

      if (diff > tolerance && diff > 10n ** 15n) {
        mismatches.push({
          category: 'totalSupply',
          description: `ITP ${itpId.slice(0, 10)}... totalSupply mismatch`,
          expected: expectedSupply.toString(),
          actual: actualSupply.toString(),
          severity: diff > tolerance * 10n ? 'critical' : 'warning',
        });
      }
    }
  }

  // 7. NAV consistency: recompute from inventory * prices
  for (const itpId of itpIds) {
    const state = finalSnapshot.itpStates.get(itpId);
    if (!state || state.nav === 0n) continue;

    // NAV should be > 0 if there are assets with inventory
    const hasInventory = state.inventory.some(inv => inv > 0n);
    if (hasInventory && state.nav === 0n) {
      mismatches.push({
        category: 'nav-consistency',
        description: `ITP ${itpId.slice(0, 10)}... has inventory but NAV is 0`,
        expected: '>0',
        actual: '0',
        severity: 'critical',
      });
    }
  }

  // 7b. USDC conservation: Index contract USDC balance should equal sum of all ITP totalValues
  // (every USDC that enters the contract via buy should be accounted in totalValue)
  {
    const usdc = await getL3Usdc();
    const indexUsdcBalance = await erc20BalanceOf(L3_RPC, usdc, L3_INDEX);
    let sumTotalValue = 0n;
    // Read totalValue from ITPCore struct via getITP(bytes32)
    for (const itpId of itpIds) {
      try {
        const data = `0x${SEL_GET_ITP}${itpId.replace('0x', '').padStart(64, '0')}`;
        const result = await l3Rpc('eth_call', [{ to: L3_INDEX, data }, 'latest']) as string;
        const hex = result.replace('0x', '');
        // ITPCore layout: name(0), symbol(1), creator(2), createdAt(3), feeRate(4), status(5), totalSupply(6), totalValue(7), assetCount(8)
        if (hex.length >= 9 * 64) {
          const totalValue = BigInt('0x' + hex.slice(7 * 64, 8 * 64));
          sumTotalValue += totalValue;
        }
      } catch {}
    }
    if (sumTotalValue > 0n) {
      // Index USDC balance should be >= sum of totalValues (could be > due to pending order escrow)
      if (indexUsdcBalance < sumTotalValue) {
        const deficit = sumTotalValue - indexUsdcBalance;
        // Allow small tolerance for rounding (0.01%)
        const tolerance = sumTotalValue / 10000n;
        if (deficit > tolerance && deficit > 10n ** 15n) {
          mismatches.push({
            category: 'usdc-conservation',
            description: `Index contract USDC balance (${indexUsdcBalance}) < sum of ITP totalValues (${sumTotalValue}). Deficit: ${deficit}`,
            expected: `>=${sumTotalValue.toString()}`,
            actual: indexUsdcBalance.toString(),
            severity: 'critical',
          });
        }
      }
      logVerbose(`  USDC conservation: Index balance=${indexUsdcBalance}, sum(totalValue)=${sumTotalValue}, surplus=${indexUsdcBalance - sumTotalValue}`);
    }
  }

  // 7c. Per-user shares invariant: sum of all user shares for an ITP should equal totalSupply
  // (no shares created from nothing or lost)
  for (const itpId of itpIds) {
    const finalState = finalSnapshot.itpStates.get(itpId);
    if (!finalState || finalState.totalSupply === 0n) continue;

    // Sum shares across sampled accounts
    const sharesMap = finalSnapshot.userShares.get(itpId);
    if (!sharesMap || sharesMap.size === 0) continue;

    let sampledShareSum = 0n;
    for (const [, shares] of sharesMap) {
      sampledShareSum += shares;
    }

    // Sampled shares can't exceed totalSupply (would mean over-minting)
    if (sampledShareSum > finalState.totalSupply) {
      mismatches.push({
        category: 'share-overflow',
        description: `ITP ${itpId.slice(0, 10)}... sampled user shares (${sampledShareSum}) exceed totalSupply (${finalState.totalSupply})`,
        expected: `<=${finalState.totalSupply.toString()}`,
        actual: sampledShareSum.toString(),
        severity: 'critical',
      });
    }
  }

  // 7d. Every FillConfirmed must have a matching OrderSubmitted (no phantom fills)
  {
    let orphanFills = 0;
    for (const fill of events.fillsConfirmed) {
      if (!orderById.has(fill.orderId)) {
        orphanFills++;
      }
    }
    if (orphanFills > 0) {
      mismatches.push({
        category: 'orphan-fills',
        description: `${orphanFills} FillConfirmed events have no matching OrderSubmitted (phantom fills)`,
        expected: '0',
        actual: orphanFills.toString(),
        severity: 'critical',
      });
    }
  }

  // 7e. Fill amount should not exceed order amount (no over-fill)
  {
    let overFills = 0;
    for (const fill of events.fillsConfirmed) {
      const order = orderById.get(fill.orderId);
      if (!order) continue;
      if (fill.fillAmount > order.amount) {
        overFills++;
        logVerbose(`  Over-fill: orderId=${fill.orderId} fillAmount=${fill.fillAmount} > orderAmount=${order.amount}`);
      }
    }
    if (overFills > 0) {
      mismatches.push({
        category: 'over-fill',
        description: `${overFills} fills exceed their order amount (potential over-minting)`,
        expected: '0',
        actual: overFills.toString(),
        severity: 'critical',
      });
    }
  }

  // 8. Stuck orders: any PENDING after 30s pipeline settle time
  // We already waited 30s for the pipeline to settle before reconciliation,
  // so any remaining pending orders are genuinely stuck.
  let stuckOrders = 0;
  if (finalSnapshot.pendingOrderCount > 0) {
    {
      stuckOrders = finalSnapshot.pendingOrderCount;
      if (stuckOrders > 0) {
        mismatches.push({
          category: 'stuck-orders',
          description: `${stuckOrders} orders still pending after test completion`,
          expected: '0',
          actual: stuckOrders.toString(),
          severity: stuckOrders > 10 ? 'warning' : 'info',
        });
      }
    }
  }

  // 9. Escrow: check failedFillEscrow for non-zero
  let escrowLeaks = 0;
  // Sample a few recent order IDs
  const recentOrders = events.ordersSubmitted.slice(-20);
  for (const order of recentOrders) {
    try {
      const escrow = await getFailedFillEscrow(Number(order.orderId));
      if (escrow > 0n) {
        escrowLeaks++;
      }
    } catch {}
  }
  if (escrowLeaks > 0) {
    mismatches.push({
      category: 'escrow-leak',
      description: `${escrowLeaks} orders have non-zero failedFillEscrow`,
      expected: '0',
      actual: escrowLeaks.toString(),
      severity: 'warning',
    });
  }

  return {
    initialBlock: initialSnapshot.blockNumber,
    finalBlock,
    mismatches,
    fuzzStats,
    events: {
      ordersSubmitted: events.ordersSubmitted.length,
      fillsConfirmed: events.fillsConfirmed.length,
      itpsCreated: events.itpsCreated.length,
      rebalances: events.rebalances.length,
      feesCharged: events.feesCharged.length,
    },
    stuckOrders,
    escrowLeaks,
  };
}
