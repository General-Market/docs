/**
 * ITP Morpho Liquidation Boundary Test
 *
 * Anvil-only. Manipulates oracle price to test health factor boundaries,
 * liquidation eligibility, and the liquidate() call itself.
 *
 * Flow:
 *   1. Mint collateral, supply to Morpho, borrow near max LTV
 *   2. Read health factor — should be above 1.0 but close
 *   3. Drop oracle price via anvil_setStorageAt until position is underwater
 *   4. Verify health factor < 1.0 (liquidatable)
 *   5. Execute liquidate() and verify collateral seizure + debt repayment
 *   6. Restore oracle price
 *
 * If the system is consistent, a healthy position cannot be liquidated,
 * and an unhealthy one cannot avoid it. That is the whole of Morpho's law.
 */

import { test, expect } from '../fixtures/wallet';
import { IS_ANVIL, L3_RPC } from '../env';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  calculateHealthFactor,
  calculateLiquidationPrice,
  MORPHO_CONSTANTS,
} from '../../lib/types/morpho';

// ── Deployment addresses ──────────────────────────────────────

const morphoDeploy = (() => {
  try {
    return JSON.parse(readFileSync(join(__dirname, '../../lib/contracts/morpho-deployment.json'), 'utf-8'));
  } catch {
    return { contracts: {}, marketParams: {} };
  }
})();

const activeDeploy = (() => {
  try {
    return JSON.parse(readFileSync(join(__dirname, '../../../deployments/active-deployment.json'), 'utf-8'));
  } catch {
    return { contracts: {} };
  }
})();

const MORPHO = morphoDeploy.contracts?.MORPHO;
const ORACLE = morphoDeploy.contracts?.ITP_NAV_ORACLE;
const MARKET_ID = morphoDeploy.contracts?.MARKET_ID;
const COLLATERAL_TOKEN = morphoDeploy.marketParams?.collateralToken;
const LOAN_TOKEN = morphoDeploy.marketParams?.loanToken;
const LLTV = morphoDeploy.marketParams?.lltv; // "770000000000000000" = 77%
const ADAPTIVE_IRM = morphoDeploy.contracts?.ADAPTIVE_IRM;
const INDEX_CONTRACT = activeDeploy.contracts?.Index ?? '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6';

// Anvil account #4 — dedicated to this test to avoid nonce collisions
const LIQUIDATION_USER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'; // Anvil #3
const LIQUIDATOR = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'; // Anvil #4

// ── RPC helpers ───────────────────────────────────────────────

async function l3RpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(L3_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function l3SendTx(txParams: Record<string, string>, label: string): Promise<string> {
  const txHash = await l3RpcCall('eth_sendTransaction', [txParams]) as string;
  let receipt: { status: string; gasUsed: string } | null = null;
  for (let i = 0; i < 15; i++) {
    receipt = await l3RpcCall('eth_getTransactionReceipt', [txHash]) as typeof receipt;
    if (receipt) break;
    await new Promise(r => setTimeout(r, 500));
  }
  if (!receipt) throw new Error(`${label}: tx not mined after 7.5s: ${txHash}`);
  if (receipt.status !== '0x1') throw new Error(`${label}: tx reverted (status=${receipt.status}, gas=${receipt.gasUsed}): ${txHash}`);
  return txHash;
}

// ── Oracle helpers ────────────────────────────────────────────

async function getOraclePrice(): Promise<bigint> {
  // price() selector = 0x9d1b464a (from IOracle interface — no args)
  const result = await l3RpcCall('eth_call', [
    { to: ORACLE, data: '0x9d1b464a' },
    'latest',
  ]) as string;
  return BigInt(result);
}

async function setOraclePrice(newPrice: bigint): Promise<void> {
  const priceHex = '0x' + newPrice.toString(16).padStart(64, '0');
  await l3RpcCall('anvil_setStorageAt', [ORACLE, '0x1', priceHex]);
  // Update timestamp so oracle doesn't appear stale
  const block = await l3RpcCall('eth_getBlockByNumber', ['latest', false]) as any;
  const timestamp = BigInt(block.timestamp);
  const tsHex = '0x' + timestamp.toString(16).padStart(64, '0');
  await l3RpcCall('anvil_setStorageAt', [ORACLE, '0x2', tsHex]);
}

// ── Position helpers ──────────────────────────────────────────

async function getMorphoPosition(user: string): Promise<{
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
}> {
  const marketIdPadded = MARKET_ID.replace('0x', '').padStart(64, '0');
  const userPadded = user.replace('0x', '').toLowerCase().padStart(64, '0');
  // position(bytes32,address) selector = 0x93c52062
  const data = `0x93c52062${marketIdPadded}${userPadded}`;
  const result = await l3RpcCall('eth_call', [
    { to: MORPHO, data },
    'latest',
  ]) as string;
  const hex = result.replace('0x', '');
  return {
    supplyShares: BigInt('0x' + hex.slice(0, 64)),
    borrowShares: BigInt('0x' + hex.slice(64, 128)),
    collateral: BigInt('0x' + hex.slice(128, 192)),
  };
}

/** Read market state: totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares */
async function getMarketState(): Promise<{
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
}> {
  const marketIdPadded = MARKET_ID.replace('0x', '').padStart(64, '0');
  // market(bytes32) selector = 0x5c60e39a
  const result = await l3RpcCall('eth_call', [
    { to: MORPHO, data: `0x5c60e39a${marketIdPadded}` },
    'latest',
  ]) as string;
  const hex = result.replace('0x', '');
  return {
    totalSupplyAssets: BigInt('0x' + hex.slice(0, 64)),
    totalSupplyShares: BigInt('0x' + hex.slice(64, 128)),
    totalBorrowAssets: BigInt('0x' + hex.slice(128, 192)),
    totalBorrowShares: BigInt('0x' + hex.slice(192, 256)),
  };
}

/** Compute debt amount from borrowShares using market state (Morpho share accounting) */
function computeDebtFromShares(
  borrowShares: bigint,
  totalBorrowAssets: bigint,
  totalBorrowShares: bigint,
): bigint {
  if (totalBorrowShares === 0n) return 0n;
  // Morpho rounds up: assets = shares * totalAssets / totalShares (round up)
  return (borrowShares * totalBorrowAssets + totalBorrowShares - 1n) / totalBorrowShares;
}

// ── Collateral & borrow helpers ───────────────────────────────

const pad = (addr: string) => addr.replace('0x', '').toLowerCase().padStart(64, '0');
const uint = (v: bigint) => v.toString(16).padStart(64, '0');

async function mintCollateralToken(user: string, amount: bigint): Promise<void> {
  // Impersonate Index contract to call mint(address,uint256) on collateral token
  await l3RpcCall('anvil_setBalance', [INDEX_CONTRACT, '0x56BC75E2D63100000']);
  await l3RpcCall('anvil_impersonateAccount', [INDEX_CONTRACT]);
  try {
    const mintData = `0x40c10f19${pad(user)}${uint(amount)}`;
    await l3SendTx({
      from: INDEX_CONTRACT,
      to: COLLATERAL_TOKEN,
      data: mintData,
      gas: '0x100000',
    }, `mint collateral to ${user.slice(0, 8)}`);
  } finally {
    await l3RpcCall('anvil_stopImpersonatingAccount', [INDEX_CONTRACT]);
  }
}

async function supplyCollateral(user: string, amount: bigint): Promise<void> {
  await l3RpcCall('anvil_setBalance', [user, '0x56BC75E2D63100000']);
  await l3RpcCall('anvil_impersonateAccount', [user]);
  try {
    // Approve Morpho to spend collateral
    const approveData = `0x095ea7b3${pad(MORPHO)}${'f'.repeat(64)}`;
    await l3SendTx({ from: user, to: COLLATERAL_TOKEN, data: approveData, gas: '0x100000' }, 'approve collateral');

    // supplyCollateral(MarketParams,uint256,address,bytes)
    const calldata = `0x238d6579${pad(LOAN_TOKEN)}${pad(COLLATERAL_TOKEN)}${pad(ORACLE)}${pad(ADAPTIVE_IRM)}${uint(BigInt(LLTV))}${uint(amount)}${pad(user)}${'100'.padStart(64, '0')}${'0'.padStart(64, '0')}`;
    await l3SendTx({ from: user, to: MORPHO, data: calldata, gas: '0x300000' }, 'supplyCollateral');
  } finally {
    await l3RpcCall('anvil_stopImpersonatingAccount', [user]);
  }
}

async function borrowFromMorpho(user: string, amount: bigint): Promise<void> {
  await l3RpcCall('anvil_impersonateAccount', [user]);
  try {
    // borrow(MarketParams,uint256,uint256,address,address) selector = 0x50d8cd4b
    const calldata = `0x50d8cd4b${pad(LOAN_TOKEN)}${pad(COLLATERAL_TOKEN)}${pad(ORACLE)}${pad(ADAPTIVE_IRM)}${uint(BigInt(LLTV))}${uint(amount)}${uint(0n)}${pad(user)}${pad(user)}`;
    await l3SendTx({ from: user, to: MORPHO, data: calldata, gas: '0x300000' }, `borrow ${amount}`);
  } finally {
    await l3RpcCall('anvil_stopImpersonatingAccount', [user]);
  }
}

/** Mint USDC (loan token) on L3. The loan token is a MockERC20 with public mint. */
async function mintLoanToken(user: string, amount: bigint): Promise<void> {
  await l3RpcCall('anvil_setBalance', [user, '0x56BC75E2D63100000']);
  await l3RpcCall('anvil_impersonateAccount', [user]);
  try {
    // Try direct mint — MockERC20 has mint(address,uint256)
    const mintData = `0x40c10f19${pad(user)}${uint(amount)}`;
    await l3SendTx({ from: user, to: LOAN_TOKEN, data: mintData, gas: '0x100000' }, 'mint USDC');
  } finally {
    await l3RpcCall('anvil_stopImpersonatingAccount', [user]);
  }
}

/**
 * Supply USDC as lender so there's liquidity for borrowers.
 * Without supply-side liquidity, borrow() reverts with INSUFFICIENT_LIQUIDITY.
 */
async function supplyLoanAsLender(lender: string, amount: bigint): Promise<void> {
  await mintLoanToken(lender, amount);
  await l3RpcCall('anvil_impersonateAccount', [lender]);
  try {
    // Approve Morpho
    const approveData = `0x095ea7b3${pad(MORPHO)}${'f'.repeat(64)}`;
    await l3SendTx({ from: lender, to: LOAN_TOKEN, data: approveData, gas: '0x100000' }, 'lender approve USDC');

    // supply(MarketParams,uint256,uint256,address,bytes) selector = 0xa99aad89
    // supply amount in assets, 0 shares, onBehalf = lender, empty bytes
    const calldata = `0xa99aad89${pad(LOAN_TOKEN)}${pad(COLLATERAL_TOKEN)}${pad(ORACLE)}${pad(ADAPTIVE_IRM)}${uint(BigInt(LLTV))}${uint(amount)}${uint(0n)}${pad(lender)}${'120'.padStart(64, '0')}${'0'.padStart(64, '0')}`;
    await l3SendTx({ from: lender, to: MORPHO, data: calldata, gas: '0x300000' }, 'supply USDC as lender');
  } finally {
    await l3RpcCall('anvil_stopImpersonatingAccount', [lender]);
  }
}

// ── Liquidation helper ────────────────────────────────────────

/**
 * Execute Morpho liquidate().
 * liquidate(MarketParams,address borrower,uint256 seizedAssets,uint256 repaidShares,bytes data)
 * selector = 0xd8eabcb8  (keccak256 of full ABI signature)
 */
async function liquidatePosition(
  liquidator: string,
  borrower: string,
  seizedAssets: bigint,
): Promise<string> {
  // Mint USDC for the liquidator to repay debt
  await mintLoanToken(liquidator, 1000n * 10n ** 18n);

  await l3RpcCall('anvil_impersonateAccount', [liquidator]);
  try {
    // Approve Morpho to pull loan tokens for repayment
    const approveData = `0x095ea7b3${pad(MORPHO)}${'f'.repeat(64)}`;
    await l3SendTx({ from: liquidator, to: LOAN_TOKEN, data: approveData, gas: '0x100000' }, 'liquidator approve USDC');

    // liquidate(MarketParams,address,uint256,uint256,bytes)
    // We seize a specific amount of collateral, repaidShares = 0 (Morpho computes it)
    const calldata = `0xd8eabcb8`
      + pad(LOAN_TOKEN)
      + pad(COLLATERAL_TOKEN)
      + pad(ORACLE)
      + pad(ADAPTIVE_IRM)
      + uint(BigInt(LLTV))
      + pad(borrower)
      + uint(seizedAssets)
      + uint(0n) // repaidShares = 0 (use seizedAssets)
      + '120'.padStart(64, '0') // bytes offset (9 head words * 32 = 0x120)
      + '0'.padStart(64, '0'); // bytes length = 0

    return await l3SendTx({ from: liquidator, to: MORPHO, data: calldata, gas: '0x500000' }, 'liquidate');
  } finally {
    await l3RpcCall('anvil_stopImpersonatingAccount', [liquidator]);
  }
}

// ── Tests ─────────────────────────────────────────────────────

test.describe('ITP Morpho Liquidation', () => {
  test.beforeEach(async () => {
    test.skip(!IS_ANVIL, 'Liquidation test requires Anvil price manipulation');

    if (!MORPHO || !ORACLE || !MARKET_ID || !COLLATERAL_TOKEN || !LOAN_TOKEN || !ADAPTIVE_IRM) {
      throw new Error('Morpho deployment incomplete — check morpho-deployment.json');
    }

    const code = await l3RpcCall('eth_getCode', [MORPHO, 'latest']) as string;
    if (!code || code === '0x' || code === '0x0') {
      throw new Error('Morpho contract not deployed at expected address');
    }
  });

  test('health factor computation matches TypeScript library', async () => {
    test.setTimeout(30_000);

    // Pure math verification — no chain state needed
    const collateral = 100n * 10n ** 18n;
    const oraclePrice = 10n ** 36n; // $1.00 per ITP
    const lltv = BigInt(LLTV);

    // Borrow 50 USDC against 100 ITP at $1 with 77% LLTV
    // maxBorrow = 100 * 1.0 * 0.77 = 77 USDC
    // healthFactor = 77 / 50 = 1.54
    const debt = 50n * 10n ** 18n;
    const hf = calculateHealthFactor(collateral, oraclePrice, debt, lltv);
    expect(hf).toBeCloseTo(1.54, 1);

    // At exactly max borrow, health factor = 1.0
    const maxDebt = 77n * 10n ** 18n;
    const hfAtMax = calculateHealthFactor(collateral, oraclePrice, maxDebt, lltv);
    expect(hfAtMax).toBeCloseTo(1.0, 1);

    // Over-borrowed: health factor < 1.0
    const overDebt = 80n * 10n ** 18n;
    const hfOver = calculateHealthFactor(collateral, oraclePrice, overDebt, lltv);
    expect(hfOver).toBeLessThan(1.0);

    // Zero debt: health factor = Infinity
    const hfZero = calculateHealthFactor(collateral, oraclePrice, 0n, lltv);
    expect(hfZero).toBe(Infinity);

    console.log('Health factor math verified: 1.54 at 50/77, 1.0 at max, <1.0 over max, Inf at zero debt');
  });

  test('liquidation price computation is correct', async () => {
    test.setTimeout(30_000);

    const collateral = 100n * 10n ** 18n;
    const lltv = BigInt(LLTV);

    // With 50 USDC debt on 100 ITP at 77% LLTV:
    // liquidationPrice = debt * 1e36 * 1e18 / (collateral * lltv)
    // = 50e18 * 1e36 * 1e18 / (100e18 * 0.77e18) = ~0.6494
    const debt = 50n * 10n ** 18n;
    const liqPrice = calculateLiquidationPrice(collateral, debt, lltv);
    expect(liqPrice).toBeCloseTo(0.6494, 2);

    // Zero collateral: liquidation price = 0
    expect(calculateLiquidationPrice(0n, debt, lltv)).toBe(0);

    console.log(`Liquidation price at 50 USDC debt / 100 ITP: $${liqPrice.toFixed(4)}`);
  });

  test('full liquidation cycle: deposit, borrow, price drop, liquidate', async () => {
    test.setTimeout(180_000);

    const lltvBn = BigInt(LLTV);
    const collateralAmount = 100n * 10n ** 18n;

    // ── Step 0: Ensure supply-side liquidity ──────────────
    // A third address supplies USDC so our borrower can borrow
    const LENDER = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc'; // Anvil #5
    await supplyLoanAsLender(LENDER, 500n * 10n ** 18n);
    console.log('Step 0: Lender supplied 500 USDC liquidity');

    // ── Step 1: Mint collateral and supply ────────────────
    await mintCollateralToken(LIQUIDATION_USER, collateralAmount);
    await supplyCollateral(LIQUIDATION_USER, collateralAmount);

    const pos1 = await getMorphoPosition(LIQUIDATION_USER);
    expect(pos1.collateral).toBeGreaterThanOrEqual(collateralAmount);
    console.log(`Step 1: Supplied ${pos1.collateral} collateral`);

    // ── Step 2: Borrow near max LTV ──────────────────────
    const oraclePrice = await getOraclePrice();
    console.log(`Oracle price: ${oraclePrice}`);

    // maxBorrow = collateral * oraclePrice * LLTV / (1e36 * 1e18)
    // Borrow 95% of max to stay just above liquidation
    const maxBorrow = (collateralAmount * oraclePrice * lltvBn) / (MORPHO_CONSTANTS.E36 * MORPHO_CONSTANTS.WAD);
    const borrowAmount = (maxBorrow * 95n) / 100n;
    console.log(`Max borrow: ${maxBorrow}, borrowing 95%: ${borrowAmount}`);

    await borrowFromMorpho(LIQUIDATION_USER, borrowAmount);

    const pos2 = await getMorphoPosition(LIQUIDATION_USER);
    expect(pos2.borrowShares).toBeGreaterThan(0n);

    // Compute actual debt from shares
    const market2 = await getMarketState();
    const debt2 = computeDebtFromShares(pos2.borrowShares, market2.totalBorrowAssets, market2.totalBorrowShares);
    const hf2 = calculateHealthFactor(pos2.collateral, oraclePrice, debt2, lltvBn);
    console.log(`Step 2: Borrowed. Health factor: ${hf2.toFixed(4)} (should be ~1.05)`);

    expect(hf2).toBeGreaterThan(1.0);
    expect(hf2).toBeLessThan(1.5); // close to liquidation but safe

    // ── Step 3: Verify healthy position cannot be liquidated ──
    let healthyLiquidationReverted = false;
    try {
      await liquidatePosition(LIQUIDATOR, LIQUIDATION_USER, 1n * 10n ** 18n);
    } catch {
      healthyLiquidationReverted = true;
    }
    expect(healthyLiquidationReverted).toBe(true);
    console.log('Step 3: Healthy position correctly rejected liquidation');

    // ── Step 4: Drop oracle price to make position underwater ──
    const droppedPrice = oraclePrice / 2n; // 50% price crash
    await setOraclePrice(droppedPrice);
    const confirmedPrice = await getOraclePrice();
    expect(confirmedPrice).toBe(droppedPrice);

    // Recompute health factor with new price
    const market4 = await getMarketState();
    const debt4 = computeDebtFromShares(pos2.borrowShares, market4.totalBorrowAssets, market4.totalBorrowShares);
    const hf4 = calculateHealthFactor(pos2.collateral, droppedPrice, debt4, lltvBn);
    console.log(`Step 4: Price halved. Health factor: ${hf4.toFixed(4)} (should be < 1.0)`);
    expect(hf4).toBeLessThan(1.0);

    // ── Step 5: Execute liquidation ──────────────────────
    const seizeAmount = 10n * 10n ** 18n; // Seize 10 ITP
    const txHash = await liquidatePosition(LIQUIDATOR, LIQUIDATION_USER, seizeAmount);
    console.log(`Step 5: Liquidation tx: ${txHash}`);

    const pos5 = await getMorphoPosition(LIQUIDATION_USER);
    expect(pos5.collateral).toBeLessThan(pos2.collateral);
    console.log(`Post-liquidation: collateral ${pos2.collateral} -> ${pos5.collateral} (seized ${pos2.collateral - pos5.collateral})`);

    // Debt should also decrease (some borrow shares burned)
    expect(pos5.borrowShares).toBeLessThan(pos2.borrowShares);
    console.log(`Post-liquidation: borrowShares ${pos2.borrowShares} -> ${pos5.borrowShares}`);

    // ── Step 6: Restore oracle price ─────────────────────
    await setOraclePrice(oraclePrice);
    const restored = await getOraclePrice();
    expect(restored).toBe(oraclePrice);
    console.log('Step 6: Oracle price restored');
  });

  test('partial liquidation leaves remaining position', async () => {
    test.setTimeout(180_000);

    const lltvBn = BigInt(LLTV);
    const collateralAmount = 200n * 10n ** 18n;

    // Ensure liquidity
    const LENDER2 = '0x976EA74026E726554dB657fA54763abd0C3a0aa9'; // Anvil #6
    await supplyLoanAsLender(LENDER2, 500n * 10n ** 18n);

    // Mint, supply, borrow at 90% of max
    await mintCollateralToken(LIQUIDATION_USER, collateralAmount);
    await supplyCollateral(LIQUIDATION_USER, collateralAmount);

    const oraclePrice = await getOraclePrice();
    const maxBorrow = (collateralAmount * oraclePrice * lltvBn) / (MORPHO_CONSTANTS.E36 * MORPHO_CONSTANTS.WAD);
    const borrowAmount = (maxBorrow * 90n) / 100n;
    await borrowFromMorpho(LIQUIDATION_USER, borrowAmount);

    const posBefore = await getMorphoPosition(LIQUIDATION_USER);
    expect(posBefore.collateral).toBeGreaterThan(0n);
    expect(posBefore.borrowShares).toBeGreaterThan(0n);

    // Drop price by 40% — enough to be underwater but not by a catastrophic margin
    const droppedPrice = (oraclePrice * 60n) / 100n;
    await setOraclePrice(droppedPrice);

    // Partial liquidation: seize only 20% of collateral
    const seizeAmount = posBefore.collateral / 5n;
    await liquidatePosition(LIQUIDATOR, LIQUIDATION_USER, seizeAmount);

    const posAfter = await getMorphoPosition(LIQUIDATION_USER);

    // Position should still exist (partial liquidation, not full)
    expect(posAfter.collateral).toBeGreaterThan(0n);
    expect(posAfter.collateral).toBeLessThan(posBefore.collateral);

    // Some debt repaid but not all
    expect(posAfter.borrowShares).toBeLessThan(posBefore.borrowShares);
    expect(posAfter.borrowShares).toBeGreaterThan(0n);

    console.log(`Partial liquidation: collateral ${posBefore.collateral} -> ${posAfter.collateral}, shares ${posBefore.borrowShares} -> ${posAfter.borrowShares}`);

    // Restore price
    await setOraclePrice(oraclePrice);
    console.log('Partial liquidation verified — position remains with reduced collateral and debt');
  });
});
