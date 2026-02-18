/**
 * Phase 6: Chaos Fuzz Test (100 accounts, reconciliation)
 *
 * Fires random buy/sell/create/rebalance/liquidate operations with injected
 * edge cases, then reconciles expected vs actual on-chain state.
 */

import {
  PHASE6_TIERS, PHASE6_OP_WEIGHTS, ChaosOpType,
  L3_RPC, ARB_RPC, L3_INDEX, DEPLOYER,
  Side, WEIGHT_SUM, MIN_WEIGHT, loadMorphoConfig, MorphoConfig,
} from './config';
import {
  log, logSection, logVerbose, timer, sleep,
  sendTx, submitOrder, getItpState, getItpCount, getUserShares,
  fundAccountUsdc, requestRebalance, requestCreateItp,
  deployMockToken, resetAllNonces, getBlockNumber,
  erc20BalanceOf, mintErc20, approveErc20, getL3Usdc,
  morphoSupplyCollateral, morphoBorrow, morphoLiquidate,
  setupBorrowPosition, triggerUndercollateralization, restoreOraclePrice,
  setMorphoOraclePrice, getMorphoPosition,
  mintItpShares,
} from './helpers';
import { checkAllHealthy } from './monitor';
import { setupChaosAccounts } from './accounts';
import { pickFuzzVector, FuzzVector } from './fuzz-vectors';
import { OperationLedger } from './ledger';
import { takeSnapshot, reconcile, ReconciliationResult, Mismatch, FuzzStats } from './reconcile';

// ── Result types ─────────────────────────────────────────────────────

export interface Phase6TierResult {
  tier: string;
  durationMs: number;
  opsAttempted: number;
  opsSucceeded: number;
  opsFailed: number;
  opsByType: Record<ChaosOpType, number>;
  fuzzStats: FuzzStats;
  reconciliation: ReconciliationResult;
  breakingPoint: string | null;
}

export type Phase6Result = Phase6TierResult[];

// ── Weighted random selection ────────────────────────────────────────

function weightedRandom(weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    r -= weight;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

// ── Main phase runner ────────────────────────────────────────────────

export async function runPhase6(): Promise<Phase6Result> {
  logSection('PHASE 6: CHAOS FUZZ TEST (100 accounts, reconciliation)');

  const results: Phase6Result = [];

  // Setup phase
  log('Setting up chaos infrastructure...');
  resetAllNonces();

  // Get 100 accounts, impersonate, fund
  let chaosAccounts: string[];
  try {
    chaosAccounts = await setupChaosAccounts(1_000_000n * 10n ** 18n);
  } catch (err: any) {
    log(`  ERROR: Could not setup chaos accounts: ${err.message}`);
    log('  Ensure start.sh uses --accounts 100');
    return [];
  }

  // Pre-deploy 10 mock tokens for ITP creation during chaos
  log('Pre-deploying mock tokens for chaos ITP creation...');
  const chaosTokens: string[] = [];
  for (let i = 0; i < 10; i++) {
    try {
      const addr = await deployMockToken(`ChaosToken${i}`, `CT${i}`);
      chaosTokens.push(addr);
    } catch {
      logVerbose(`  Failed to deploy ChaosToken${i}`);
    }
  }
  log(`  Deployed ${chaosTokens.length} chaos tokens`);

  // Load Morpho config
  const morphoCfg = loadMorphoConfig();
  let morphoAccounts: string[] = []; // dedicated accounts for liquidation

  if (morphoCfg) {
    log('Setting up Morpho borrow positions for liquidation testing...');
    // Use accounts 75-89 from chaosAccounts for Morpho positions
    const morphoCandidates = chaosAccounts.slice(65, 80);
    for (const account of morphoCandidates) {
      try {
        // Mint BridgedITP to user on Arb for collateral
        const collateralAmount = 1000n * 10n ** 18n;
        await mintItpShares(
          '0x' + '1'.padStart(64, '0'), // ITP #1
          account,
          collateralAmount,
        );
        // Mint USDC to Morpho for lending liquidity (deployer seeds)
        const borrowAmount = 100n * 10n ** 6n; // 100 USDC (6 decimals)
        await setupBorrowPosition(morphoCfg, account, collateralAmount, borrowAmount);
        morphoAccounts.push(account);
      } catch (err: any) {
        logVerbose(`  Morpho setup failed for ${account.slice(0, 10)}: ${err.message}`);
      }
    }
    log(`  Setup ${morphoAccounts.length} Morpho borrow positions`);
  } else {
    log('  Morpho not deployed — liquidation ops will be skipped');
  }

  // Get existing ITP IDs
  const itpCount = await getItpCount();
  const existingItpIds = Array.from({ length: Math.min(itpCount, 20) }, (_, i) =>
    '0x' + (i + 1).toString(16).padStart(64, '0')
  );

  // Track all ITP IDs (existing + created during chaos)
  let allItpIds = [...existingItpIds];

  // Get initial NAV
  let baseNav = 10n ** 18n;
  if (existingItpIds.length > 0) {
    try {
      const state = await getItpState(existingItpIds[0]);
      if (state.nav > 0n) baseNav = state.nav;
    } catch {}
  }

  // Run tiers sequentially
  for (const [tierName, tierCfg] of Object.entries(PHASE6_TIERS)) {
    log(`\nRunning ${tierName} tier...`);
    const result = await runChaosTier(
      tierName, tierCfg,
      chaosAccounts, chaosTokens, allItpIds,
      morphoCfg, morphoAccounts, baseNav,
    );
    results.push(result);

    // Update allItpIds with any newly created ITPs
    const newCount = await getItpCount();
    allItpIds = Array.from({ length: Math.min(newCount, 50) }, (_, i) =>
      '0x' + (i + 1).toString(16).padStart(64, '0')
    );

    if (result.breakingPoint) {
      log(`  Breaking point at ${tierName}: ${result.breakingPoint}`);
      break;
    }
  }

  return results;
}

// ── Single tier runner ───────────────────────────────────────────────

async function runChaosTier(
  tierName: string,
  tierCfg: { accounts: number; opsPerTick: number; fuzzRate: number; durationMs: number; tickMs: number },
  chaosAccounts: string[],
  chaosTokens: string[],
  itpIds: string[],
  morphoCfg: MorphoConfig | null,
  morphoAccounts: string[],
  baseNav: bigint,
): Promise<Phase6TierResult> {
  logSection(`Phase 6 Tier: ${tierName} — ${tierCfg.opsPerTick} ops/tick, ${(tierCfg.fuzzRate * 100).toFixed(0)}% fuzz`);

  resetAllNonces();

  const ledger = new OperationLedger();
  const tWall = timer(`chaos-${tierName}`);

  // Take initial snapshot
  const initialSnapshot = await takeSnapshot(chaosAccounts, itpIds);

  const startTime = Date.now();
  const endTime = startTime + tierCfg.durationMs;
  let opsAttempted = 0;
  let opsSucceeded = 0;
  let opsFailed = 0;
  const opsByType: Record<ChaosOpType, number> = { buy: 0, sell: 0, create: 0, rebalance: 0, liquidate: 0 };

  let tickCount = 0;
  let createdItpCount = 0;

  while (Date.now() < endTime) {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < tierCfg.opsPerTick; i++) {
      const account = chaosAccounts[Math.floor(Math.random() * chaosAccounts.length)];
      let opType = weightedRandom(PHASE6_OP_WEIGHTS) as ChaosOpType;

      // Skip liquidate if no Morpho
      if (opType === 'liquidate' && (!morphoCfg || morphoAccounts.length === 0)) {
        opType = 'buy'; // fallback
      }

      const isFuzz = Math.random() < tierCfg.fuzzRate;

      if (isFuzz) {
        const fuzzVec = pickFuzzVector(opType);
        promises.push(
          executeFuzzOp(opType, fuzzVec, account, itpIds, chaosTokens, morphoCfg, morphoAccounts, baseNav, ledger)
            .then(success => {
              opsAttempted++;
              opsByType[opType]++;
              if (success) opsSucceeded++;
              else opsFailed++;
            })
        );
      } else {
        promises.push(
          executeNormalOp(opType, account, itpIds, chaosTokens, morphoCfg, morphoAccounts, baseNav, ledger)
            .then(success => {
              opsAttempted++;
              opsByType[opType]++;
              if (success) opsSucceeded++;
              else opsFailed++;
              // Track new ITPs
              if (opType === 'create' && success) createdItpCount++;
            })
        );
      }
    }

    await Promise.allSettled(promises);

    // Health check every 5s
    tickCount++;
    if (tickCount % (5000 / tierCfg.tickMs) === 0) {
      const healthy = await checkAllHealthy();
      if (!healthy) {
        logVerbose(`  Health check failed at tick ${tickCount}`);
      }
    }

    // Progress every 10s
    const elapsed = Date.now() - startTime;
    if (elapsed > 0 && tickCount % (10000 / tierCfg.tickMs) === 0) {
      log(`  ${(elapsed / 1000).toFixed(0)}s: ops=${opsAttempted} (ok=${opsSucceeded} fail=${opsFailed}) fuzz=${ledger.getSummary().fuzzOps}`);
    }

    await sleep(tierCfg.tickMs);
  }

  const wallTime = tWall.stop().ms;

  // Post-chaos: wait for issuer pipeline to settle
  log('  Waiting 30s for pipeline to settle...');
  await sleep(30_000);

  // Update ITP list with newly created ones
  const newCount = await getItpCount();
  const allItpIds = Array.from({ length: Math.min(newCount, 50) }, (_, i) =>
    '0x' + (i + 1).toString(16).padStart(64, '0')
  );

  // Reconcile
  log('  Running reconciliation...');
  const reconciliation = await reconcile(initialSnapshot, chaosAccounts, ledger, allItpIds);

  const summary = ledger.getSummary();

  // Determine breaking point
  let breakingPoint: string | null = null;
  const criticals = reconciliation.mismatches.filter(m => m.severity === 'critical');
  if (criticals.length > 0) {
    breakingPoint = `${criticals.length} critical mismatches: ${criticals[0].description}`;
  }
  if (summary.fuzzIncorrectSuccesses > 0) {
    breakingPoint = `${summary.fuzzIncorrectSuccesses} fuzz ops succeeded that should have reverted`;
  }

  const result: Phase6TierResult = {
    tier: tierName,
    durationMs: wallTime,
    opsAttempted,
    opsSucceeded,
    opsFailed,
    opsByType,
    fuzzStats: reconciliation.fuzzStats,
    reconciliation,
    breakingPoint,
  };

  // Log summary
  log(`  ${tierName} complete: ${wallTime.toFixed(0)}ms`);
  log(`  Ops: ${opsAttempted} (${opsSucceeded} ok, ${opsFailed} failed)`);
  log(`  By type: buy=${opsByType.buy} sell=${opsByType.sell} create=${opsByType.create} rebalance=${opsByType.rebalance} liquidate=${opsByType.liquidate}`);
  log(`  Fuzz: ${summary.fuzzOps} total, ${summary.fuzzCorrectReverts} correct reverts, ${summary.fuzzIncorrectSuccesses} INCORRECT successes`);
  log(`  Events: ${reconciliation.events.ordersSubmitted} orders, ${reconciliation.events.fillsConfirmed} fills, ${reconciliation.events.itpsCreated} creates`);
  log(`  Mismatches: ${reconciliation.mismatches.length} (${criticals.length} critical)`);
  if (breakingPoint) {
    log(`  BREAKING POINT: ${breakingPoint}`);
  }

  return result;
}

// ── Operation executors ──────────────────────────────────────────────

async function executeNormalOp(
  opType: ChaosOpType,
  account: string,
  itpIds: string[],
  chaosTokens: string[],
  morphoCfg: MorphoConfig | null,
  morphoAccounts: string[],
  baseNav: bigint,
  ledger: OperationLedger,
): Promise<boolean> {
  try {
    switch (opType) {
      case 'buy': {
        if (itpIds.length === 0) return false;
        const itpId = itpIds[Math.floor(Math.random() * itpIds.length)];
        const amount = BigInt(Math.floor(Math.random() * 100_000) + 1) * 10n ** 18n;
        const limitPrice = baseNav + (baseNav * 10n / 100n);
        const id = ledger.record({ account, opType, itpId, amount, expectedRevert: false });
        const { receipt } = await submitOrder(itpId, Side.BUY, amount, limitPrice, 0n, undefined, account);
        ledger.markResult(id, true, receipt.transactionHash);
        return true;
      }
      case 'sell': {
        if (itpIds.length === 0) return false;
        const itpId = itpIds[Math.floor(Math.random() * itpIds.length)];
        // Check if user has shares
        let shares = 0n;
        try { shares = await getUserShares(itpId, account); } catch {}
        if (shares === 0n) return false;
        const sellAmount = shares / BigInt(Math.floor(Math.random() * 4) + 2); // sell 25-50%
        if (sellAmount === 0n) return false;
        const limitPrice = baseNav - (baseNav * 10n / 100n);
        const id = ledger.record({ account, opType, itpId, amount: sellAmount, expectedRevert: false });
        const { receipt } = await submitOrder(itpId, Side.SELL, sellAmount, limitPrice, 0n, undefined, account);
        ledger.markResult(id, true, receipt.transactionHash);
        return true;
      }
      case 'create': {
        if (chaosTokens.length < 2) return false;
        const numAssets = Math.floor(Math.random() * Math.min(chaosTokens.length, 10)) + 2;
        const assets = chaosTokens.slice(0, numAssets);
        const weights = generateValidWeights(numAssets);
        const prices = assets.map(() => 10n ** 18n);
        const id = ledger.record({ account, opType, itpId: 'new', amount: 0n, expectedRevert: false });
        const receipt = await requestCreateItp(
          `Chaos${Date.now() % 10000}`, `CX${Date.now() % 10000}`,
          weights, assets, prices, DEPLOYER,
        );
        ledger.markResult(id, true, receipt.transactionHash);
        return true;
      }
      case 'rebalance': {
        if (itpIds.length === 0) return false;
        const itpId = itpIds[Math.floor(Math.random() * itpIds.length)];
        const state = await getItpState(itpId);
        if (state.weights.length < 2) return false;
        const newWeights = generateShiftedWeights(state.weights);
        const id = ledger.record({ account, opType, itpId, amount: 0n, expectedRevert: false });
        const receipt = await requestRebalance(itpId, newWeights, `chaos-${Date.now()}`);
        ledger.markResult(id, true, receipt.transactionHash);
        return true;
      }
      case 'liquidate': {
        if (!morphoCfg || morphoAccounts.length === 0) return false;
        const borrower = morphoAccounts[Math.floor(Math.random() * morphoAccounts.length)];
        const id = ledger.record({ account, opType, itpId: 'morpho', amount: 0n, expectedRevert: false });
        // Drop price → liquidate → restore
        await triggerUndercollateralization(morphoCfg.mockOracle, 3n * 10n ** 17n); // 0.3 = 70% drop
        try {
          const pos = await getMorphoPosition(morphoCfg, borrower);
          if (pos.collateral > 0n) {
            const seize = pos.collateral / 2n;
            const receipt = await morphoLiquidate(morphoCfg, account, borrower, seize);
            ledger.markResult(id, true, receipt.transactionHash);
          } else {
            ledger.markResult(id, false);
          }
        } finally {
          await restoreOraclePrice(morphoCfg.mockOracle);
        }
        return true;
      }
    }
  } catch (err: any) {
    // Mark as failed in ledger
    const ops = ledger.getAll();
    const lastOp = ops[ops.length - 1];
    if (lastOp && lastOp.succeeded === null) {
      ledger.markResult(lastOp.id, false);
    }
    return false;
  }
}

async function executeFuzzOp(
  opType: ChaosOpType,
  fuzzVec: FuzzVector,
  account: string,
  itpIds: string[],
  chaosTokens: string[],
  morphoCfg: MorphoConfig | null,
  morphoAccounts: string[],
  baseNav: bigint,
  ledger: OperationLedger,
): Promise<boolean> {
  const itpId = itpIds.length > 0 ? itpIds[Math.floor(Math.random() * itpIds.length)] : '0x' + '1'.padStart(64, '0');
  const id = ledger.record({
    account, opType,
    itpId: (fuzzVec.overrides.itpId as string) ?? itpId,
    amount: (fuzzVec.overrides.amount as bigint) ?? 0n,
    expectedRevert: fuzzVec.shouldRevert,
    fuzzLabel: fuzzVec.label,
  });

  try {
    switch (opType) {
      case 'buy': {
        const targetItpId = (fuzzVec.overrides.itpId as string) ?? itpId;
        const amount = (fuzzVec.overrides.amount as bigint) ?? 100n * 10n ** 18n;
        const deadline = (fuzzVec.overrides.deadline as bigint) ?? undefined;
        const { receipt } = await submitOrder(targetItpId, Side.BUY, amount, baseNav * 2n, 0n, deadline, account);
        ledger.markResult(id, true, receipt.transactionHash);
        return true;
      }
      case 'sell': {
        const targetItpId = (fuzzVec.overrides.itpId as string) ?? itpId;
        const amount = (fuzzVec.overrides.amount as bigint) ?? 100n * 10n ** 18n;
        const deadline = (fuzzVec.overrides.deadline as bigint) ?? undefined;
        const { receipt } = await submitOrder(targetItpId, Side.SELL, amount, 1n, 0n, deadline, account);
        ledger.markResult(id, true, receipt.transactionHash);
        return true;
      }
      case 'create': {
        const badWeightSum = fuzzVec.overrides.badWeightSum as boolean;
        const assetCount = fuzzVec.overrides.assetCount as number | undefined;

        let assets: string[];
        let weights: bigint[];

        if (assetCount === 0) {
          assets = [];
          weights = [];
        } else if (assetCount && assetCount > 1000) {
          // Exceeds max — create dummy array
          assets = Array.from({ length: assetCount }, () => chaosTokens[0] ?? DEPLOYER);
          weights = Array.from({ length: assetCount }, () => WEIGHT_SUM / BigInt(assetCount));
        } else if (badWeightSum) {
          assets = chaosTokens.slice(0, 3);
          weights = [WEIGHT_SUM / 4n, WEIGHT_SUM / 4n, WEIGHT_SUM / 4n]; // sum = 75%, not 100%
        } else {
          assets = chaosTokens.slice(0, 3);
          weights = generateValidWeights(3);
        }

        const prices = assets.map(() => 10n ** 18n);
        const receipt = await requestCreateItp(`Fuzz${Date.now() % 1000}`, `FZ`, weights, assets, prices, DEPLOYER);
        ledger.markResult(id, true, receipt.transactionHash);
        return true;
      }
      case 'rebalance': {
        const targetItpId = (fuzzVec.overrides.itpId as string) ?? itpId;
        const badWeightSum = fuzzVec.overrides.badWeightSum as boolean;

        let newWeights: bigint[];
        if (badWeightSum) {
          // Weights that don't sum to 1e18
          newWeights = [WEIGHT_SUM / 3n, WEIGHT_SUM / 3n]; // sum != 1e18
        } else {
          const state = await getItpState(targetItpId);
          newWeights = generateShiftedWeights(state.weights);
        }

        const receipt = await requestRebalance(targetItpId, newWeights, `fuzz-${Date.now()}`);
        ledger.markResult(id, true, receipt.transactionHash);
        return true;
      }
      case 'liquidate': {
        if (!morphoCfg || morphoAccounts.length === 0) {
          ledger.markResult(id, false);
          return false;
        }
        const borrower = morphoAccounts[Math.floor(Math.random() * morphoAccounts.length)];
        const skipPriceDrop = fuzzVec.overrides.skipPriceDrop as boolean;
        const seizedAssets = (fuzzVec.overrides.seizedAssets as bigint) ?? undefined;

        if (!skipPriceDrop) {
          await triggerUndercollateralization(morphoCfg.mockOracle, 3n * 10n ** 17n);
        }
        try {
          const seize = seizedAssets ?? 10n ** 18n;
          const receipt = await morphoLiquidate(morphoCfg, account, borrower, seize);
          ledger.markResult(id, true, receipt.transactionHash);
          return true;
        } finally {
          if (!skipPriceDrop) {
            await restoreOraclePrice(morphoCfg.mockOracle);
          }
        }
      }
    }
  } catch {
    ledger.markResult(id, false);
    return false;
  }
}

// ── Weight helpers ───────────────────────────────────────────────────

function generateValidWeights(count: number): bigint[] {
  const weights: bigint[] = [];
  let remaining = WEIGHT_SUM;
  for (let i = 0; i < count - 1; i++) {
    // Ensure each weight >= MIN_WEIGHT and leaves room for the rest
    const maxForThis = remaining - MIN_WEIGHT * BigInt(count - i - 1);
    const w = MIN_WEIGHT + BigInt(Math.floor(Math.random() * Number(maxForThis - MIN_WEIGHT)));
    weights.push(w);
    remaining -= w;
  }
  weights.push(remaining); // last one gets remainder to sum exactly
  return weights;
}

function generateShiftedWeights(currentWeights: bigint[]): bigint[] {
  if (currentWeights.length < 2) return currentWeights;
  const newWeights = [...currentWeights];
  // Shift 0.5% from first to second (if possible)
  const shift = 5000000000000000n; // 0.5%
  if (newWeights[0] - shift >= MIN_WEIGHT) {
    newWeights[0] -= shift;
    newWeights[1] += shift;
  }
  return newWeights;
}
