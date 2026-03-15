/**
 * Stress test configuration — addresses, RPCs, ABIs, constants.
 * All addresses from the local Anvil deployment (start.sh).
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Note: ABIs are not imported here since helpers.ts uses raw ABI encoding
// with precomputed selectors. The ABIs in frontend/lib/contracts/index-protocol-abi.ts
// serve as the canonical reference for function signatures.

// ── Chain configuration ──────────────────────────────────────────────

export const L3_RPC = 'http://localhost:8545';
export const SETTLEMENT_RPC = 'http://localhost:8546';
export const L3_CHAIN_ID = 111222333;
export const SETTLEMENT_CHAIN_ID = 421611337;

// ── Contract addresses (from start.sh / deploy scripts) ─────────────

export const L3_INDEX = '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6';
export const SETTLEMENT_BRIDGE_PROXY = '0x59b670e9fA9D0A427751Af201D676719a970857b';
export const SETTLEMENT_USDC = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
export const SETTLEMENT_BRIDGED_ITP = '0x8D308d3D699A85472d874DBDBbffd16bc9fBD856';

// ── Anvil accounts ──────────────────────────────────────────────────

export const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
export const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

/** Anvil's 10 pre-funded accounts (index 0 = deployer) */
export const ANVIL_ACCOUNTS = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
  '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
  '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
  '0x14dc79964da2C08b23698B3D3cc7Ca32193d9955',
  '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',
  '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
] as const;

// ── Health endpoints ─────────────────────────────────────────────────

export const ORACLE_HEALTH_PORTS = [10001, 10002, 10003];
export const AP_HEALTH_PORT = 9100;
export const BACKEND_URL = 'http://localhost:8200';

// ── Contract constants ───────────────────────────────────────────────

export const WEIGHT_SUM = 10n ** 18n;                   // 1e18 = 100%
export const MIN_WEIGHT = 2500000000000000n;             // 2.5e15 = 0.25%
export const MAX_ASSETS = 1000;
export const MIN_ORDER_AMOUNT = 10n ** 6n;               // 1 USDC (6 decimals) — typical minimum
export const QUEUE_WARNING = 100;
export const QUEUE_PAUSE = 500;

// ── Order enums (matching TypesLib.sol) ──────────────────────────────

export const Side = { BUY: 0, SELL: 1 } as const;
export const OrderStatus = {
  PENDING: 0,
  BATCHED: 1,
  FILLED: 2,
  CANCELLED: 3,
  EXPIRED: 4,
} as const;

// MockERC20 tokens are deployed via `forge create` at runtime.
// ERC20 selectors are precomputed in helpers.ts (mint=0x40c10f19, approve=0x095ea7b3, balanceOf=0x70a08231).

// ── Phase tier configurations ────────────────────────────────────────

export const PHASE1_TIERS = {
  A: { itps: 100, assetsPerItp: 3, label: 'Baseline gas/timing' },
  B: { itps: 1000, assetsPerItp: 3, label: 'Storage growth' },
  C: { itps: 10000, assetsPerItp: 3, label: 'RPC latency under large state' },
  D: { itps: 100, assetsPerItp: 100, label: 'O(N²) duplicate check gas' },
  E: { itps: 10, assetsPerItp: 250, label: 'Max-assets gas ceiling (250 fits 30M block limit)' },
} as const;

export const PHASE2_LEVELS = {
  A: { requests: 10, label: '~10s backlog' },
  B: { requests: 50, label: '~50s backlog' },
  C: { requests: 100, label: '~100s backlog' },
} as const;

export const PHASE3_TIERS = {
  A: { orders: 50, itps: 5, label: 'Baseline' },
  B: { orders: 200, itps: 10, label: 'Approach warning (100)' },
  C: { orders: 450, itps: 10, label: 'Approach pause (500)' },
  D: { orders: 501, itps: 10, label: 'Trigger E083_QueueFull' },
} as const;

export const PHASE4_TIERS = {
  A: { concurrent: 3, label: 'Baseline' },
  B: { concurrent: 10, label: 'Medium' },
  C: { concurrent: 50, label: 'High' },
} as const;

export const PHASE5_RATES = {
  Low: { buysPerSec: 5, sellsPerSec: 2, rebalanceInterval: 10000, itpCreateInterval: 5000 },
  Medium: { buysPerSec: 15, sellsPerSec: 6, rebalanceInterval: 5000, itpCreateInterval: 2000 },
  High: { buysPerSec: 50, sellsPerSec: 20, rebalanceInterval: 2000, itpCreateInterval: 1000 },
} as const;

// ── Phase 6: Chaos fuzz configuration ────────────────────────────────

export const PHASE6_TIERS = {
  Light:  { accounts: 100, opsPerTick: 10, fuzzRate: 0.05, durationMs: 60_000, tickMs: 100 },
  Medium: { accounts: 100, opsPerTick: 50, fuzzRate: 0.15, durationMs: 90_000, tickMs: 100 },
  Heavy:  { accounts: 100, opsPerTick: 200, fuzzRate: 0.30, durationMs: 120_000, tickMs: 100 },
} as const;

// Operation weight distribution (sum = 1.0)
export const PHASE6_OP_WEIGHTS = {
  buy: 0.35, sell: 0.25, create: 0.10, rebalance: 0.15, liquidate: 0.15,
} as const;
export type ChaosOpType = keyof typeof PHASE6_OP_WEIGHTS;

// Morpho addresses — loaded dynamically from deployments/morpho-e2e.json at runtime.
// These fallback constants match the default Anvil deployment.
export const MORPHO_FALLBACK = {
  MORPHO: '0x295129609d6876f5ECC62052Ba6bc082139A982c',
  MOCK_ORACLE: '0x737b8F095E3c575a6Ae5FE1711AdB8F271E20269',
  ADAPTIVE_IRM: '0xB92257D74B8815EC711071889cB506C8d66A6a06',
  LLTV: 770000000000000000n, // 0.77e18
} as const;

export interface MorphoConfig {
  morpho: string;
  mockOracle: string;
  adaptiveIrm: string;
  loanToken: string;       // SETTLEMENT_USDC
  collateralToken: string;  // BridgedITP
  lltv: bigint;
  marketId: string;
}

/** Load Morpho config from deployments/morpho-e2e.json, fallback to constants. */
export function loadMorphoConfig(): MorphoConfig | null {
  try {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const root = join(scriptDir, '..', '..');
    const raw = readFileSync(join(root, 'deployments', 'morpho-e2e.json'), 'utf8');
    const data = JSON.parse(raw);
    return {
      morpho: data.contracts?.MORPHO ?? MORPHO_FALLBACK.MORPHO,
      mockOracle: data.contracts?.MOCK_ORACLE ?? MORPHO_FALLBACK.MOCK_ORACLE,
      adaptiveIrm: data.contracts?.ADAPTIVE_IRM ?? MORPHO_FALLBACK.ADAPTIVE_IRM,
      loanToken: data.marketParams?.loanToken ?? SETTLEMENT_USDC,
      collateralToken: data.marketParams?.collateralToken ?? SETTLEMENT_BRIDGED_ITP,
      lltv: BigInt(data.marketParams?.lltv ?? MORPHO_FALLBACK.LLTV),
      marketId: data.contracts?.MARKET_ID ?? '',
    };
  } catch {
    return null;
  }
}
