/**
 * Fuzz vector generators for Phase 6 chaos testing.
 * Each vector includes edge-case parameters and whether it should revert.
 */

import { ChaosOpType, WEIGHT_SUM, MAX_ASSETS } from './config';

export interface FuzzVector {
  label: string;
  shouldRevert: boolean;
  overrides: Record<string, unknown>;
}

// ── Buy fuzz vectors ─────────────────────────────────────────────────

const BUY_FUZZ: FuzzVector[] = [
  {
    label: 'buy:zero-amount',
    shouldRevert: true,
    overrides: { amount: 0n },
  },
  {
    label: 'buy:dust-1wei',
    shouldRevert: true,
    overrides: { amount: 1n },
  },
  {
    label: 'buy:expired-deadline',
    shouldRevert: true,
    overrides: { deadline: 1n }, // timestamp in the past
  },
  {
    label: 'buy:max-uint256',
    shouldRevert: true,
    overrides: { amount: (1n << 256n) - 1n },
  },
  {
    label: 'buy:nonexistent-itp',
    shouldRevert: true,
    overrides: { itpId: '0x' + 'ff'.repeat(32) },
  },
];

// ── Sell fuzz vectors ────────────────────────────────────────────────

const SELL_FUZZ: FuzzVector[] = [
  {
    label: 'sell:zero-amount',
    shouldRevert: true,
    overrides: { amount: 0n },
  },
  {
    label: 'sell:exceeds-owned',
    shouldRevert: true,
    overrides: { amount: 10n ** 30n }, // far more than anyone holds
  },
  {
    label: 'sell:nonexistent-itp',
    shouldRevert: true,
    overrides: { itpId: '0x' + 'ff'.repeat(32) },
  },
  {
    label: 'sell:expired-deadline',
    shouldRevert: true,
    overrides: { deadline: 1n },
  },
];

// ── Create fuzz vectors ──────────────────────────────────────────────

const CREATE_FUZZ: FuzzVector[] = [
  {
    label: 'create:zero-assets',
    shouldRevert: true,
    overrides: { assetCount: 0 },
  },
  {
    label: 'create:exceeds-max-assets',
    shouldRevert: true,
    overrides: { assetCount: MAX_ASSETS + 1 },
  },
  {
    label: 'create:weights-dont-sum',
    shouldRevert: true,
    overrides: { badWeightSum: true }, // weights sum to less than 1e18
  },
];

// ── Rebalance fuzz vectors ───────────────────────────────────────────

const REBALANCE_FUZZ: FuzzVector[] = [
  {
    label: 'rebalance:weights-dont-sum',
    // requestRebalance on BridgeProxy is event-only — no weight validation at request time.
    // Oracles reject bad weights when relaying to L3 Index.rebalance (E014_InvalidWeightSum).
    shouldRevert: false,
    overrides: { badWeightSum: true },
  },
  {
    label: 'rebalance:nonexistent-itp',
    // requestRebalance is permissionless and doesn't validate itpId existence
    shouldRevert: false,
    overrides: { itpId: '0x' + 'ff'.repeat(32) },
  },
];

// ── Liquidate fuzz vectors ───────────────────────────────────────────

const LIQUIDATE_FUZZ: FuzzVector[] = [
  {
    label: 'liquidate:healthy-position',
    shouldRevert: true,
    overrides: { skipPriceDrop: true }, // position is healthy, liquidation should fail
  },
  {
    label: 'liquidate:zero-seize',
    shouldRevert: true,
    overrides: { seizedAssets: 0n },
  },
];

// ── Registry ─────────────────────────────────────────────────────────

const FUZZ_REGISTRY: Record<ChaosOpType, FuzzVector[]> = {
  buy: BUY_FUZZ,
  sell: SELL_FUZZ,
  create: CREATE_FUZZ,
  rebalance: REBALANCE_FUZZ,
  liquidate: LIQUIDATE_FUZZ,
};

/** Pick a random fuzz vector for the given operation type. */
export function pickFuzzVector(opType: ChaosOpType): FuzzVector {
  const vectors = FUZZ_REGISTRY[opType];
  return vectors[Math.floor(Math.random() * vectors.length)];
}

/** Get all fuzz vectors for a given op type. */
export function getFuzzVectors(opType: ChaosOpType): FuzzVector[] {
  return FUZZ_REGISTRY[opType];
}
