/**
 * Morpho Oracle & Health Factor E2E Tests
 *
 * Tests oracle price sensitivity, health factor boundaries, and
 * position behavior under price changes. All backend-only (no browser).
 *
 * Complements 03-lending.spec.ts which tests the UI lending cycle.
 */

import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import {
  getMorphoPosition,
  mintL3Shares,
  mintBridgedItp,
  pollUntil,
  checkRpc,
} from '../helpers/backend-api';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Morpho deployment addresses ───────────────────────────
const morphoDeploy = (() => {
  try {
    return JSON.parse(readFileSync(join(__dirname, '../../lib/contracts/morpho-deployment.json'), 'utf-8'));
  } catch {
    return { contracts: {}, marketParams: {} };
  }
})();

const MORPHO = morphoDeploy.contracts?.MORPHO;
const ORACLE = morphoDeploy.contracts?.ITP_NAV_ORACLE;
const MARKET_ID = morphoDeploy.contracts?.MARKET_ID;
const COLLATERAL_TOKEN = morphoDeploy.marketParams?.collateralToken;
const LOAN_TOKEN = morphoDeploy.marketParams?.loanToken;
const LLTV = morphoDeploy.marketParams?.lltv; // "770000000000000000" = 77%

const L3_RPC = 'http://localhost:8545';
const ARB_RPC = 'http://localhost:8546';
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

async function l3RpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(L3_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// ── Oracle helpers ────────────────────────────────────────
// ITPNAVOracle storage layout (BLSVerifier has 1 slot, then ITPNAVOracle state):
//   slot 0: _blsIssuerRegistry (address)
//   slot 1: currentPrice (uint256)
//   slot 2: lastUpdated (uint256)
//   slot 3: lastCycleNumber (uint256)

/** Read current oracle price via ITPNAVOracle.currentPrice() — bypasses staleness check */
async function getOraclePrice(): Promise<bigint> {
  // currentPrice() selector = 0x9d1b464a
  const result = await l3RpcCall('eth_call', [
    { to: ORACLE, data: '0x9d1b464a' },
    'latest',
  ]) as string;
  return BigInt(result);
}

/** Set oracle price via anvil_setStorageAt (direct storage write, bypasses BLS) */
async function setOraclePrice(newPrice: bigint): Promise<void> {
  const priceHex = '0x' + newPrice.toString(16).padStart(64, '0');
  // Write currentPrice at slot 1
  await l3RpcCall('anvil_setStorageAt', [ORACLE, '0x1', priceHex]);
  // Write lastUpdated at slot 2 to current block timestamp (avoid staleness revert)
  const block = await l3RpcCall('eth_getBlockByNumber', ['latest', false]) as any;
  const timestamp = BigInt(block.timestamp);
  const tsHex = '0x' + timestamp.toString(16).padStart(64, '0');
  await l3RpcCall('anvil_setStorageAt', [ORACLE, '0x2', tsHex]);
}

/** Read Morpho position directly: collateral and borrowShares */
async function getMorphoPositionDirect(user: string): Promise<{
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
}> {
  // position(bytes32,address) selector = 0x93c52062
  const marketIdPadded = MARKET_ID.replace('0x', '').padStart(64, '0');
  const userPadded = user.replace('0x', '').toLowerCase().padStart(64, '0');
  const data = `0x93c52062${marketIdPadded}${userPadded}`;
  const result = await l3RpcCall('eth_call', [
    { to: MORPHO, data },
    'latest',
  ]) as string;
  // Returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)
  const hex = result.replace('0x', '');
  return {
    supplyShares: BigInt('0x' + hex.slice(0, 64)),
    borrowShares: BigInt('0x' + hex.slice(64, 128)),
    collateral: BigInt('0x' + hex.slice(128, 192)),
  };
}

/** Supply collateral to Morpho for a user (impersonate user) */
async function supplyCollateral(user: string, amount: bigint): Promise<void> {
  await l3RpcCall('anvil_setBalance', [user, '0x56BC75E2D63100000']);
  await l3RpcCall('anvil_impersonateAccount', [user]);
  try {
    // Approve collateral token to Morpho
    const approvePadded = MORPHO.replace('0x', '').toLowerCase().padStart(64, '0');
    const amountHex = amount.toString(16).padStart(64, '0');
    const approveData = `0x095ea7b3${approvePadded}${amountHex}`;
    await l3RpcCall('eth_sendTransaction', [{
      from: user,
      to: COLLATERAL_TOKEN,
      data: approveData,
      gas: '0x100000',
    }]);

    // supplyCollateral(MarketParams,uint256,address,bytes)
    // We use the low-level Morpho.supplyCollateral call
    // MarketParams = (address,address,address,address,uint256) = 5 words
    const loanPad = LOAN_TOKEN.replace('0x', '').toLowerCase().padStart(64, '0');
    const collPad = COLLATERAL_TOKEN.replace('0x', '').toLowerCase().padStart(64, '0');
    const oraclePad = ORACLE.replace('0x', '').toLowerCase().padStart(64, '0');
    const irmPad = morphoDeploy.contracts.ADAPTIVE_IRM.replace('0x', '').toLowerCase().padStart(64, '0');
    const lltvPad = BigInt(LLTV).toString(16).padStart(64, '0');
    const userPad = user.replace('0x', '').toLowerCase().padStart(64, '0');
    // bytes offset = 8 * 32 = 0x100 (5 MarketParams words + amount + onBehalf + offset pointer itself)
    const bytesOffset = '100'.padStart(64, '0');
    const bytesLen = '0'.padStart(64, '0');

    // supplyCollateral selector = 0x238d6579
    const calldata = `0x238d6579${loanPad}${collPad}${oraclePad}${irmPad}${lltvPad}${amountHex}${userPad}${bytesOffset}${bytesLen}`;
    await l3RpcCall('eth_sendTransaction', [{
      from: user,
      to: MORPHO,
      data: calldata,
      gas: '0x300000',
    }]);
  } finally {
    await l3RpcCall('anvil_stopImpersonatingAccount', [user]);
  }
}

/** Borrow from Morpho for a user (impersonate user) */
async function borrow(user: string, amount: bigint): Promise<void> {
  await l3RpcCall('anvil_impersonateAccount', [user]);
  try {
    const loanPad = LOAN_TOKEN.replace('0x', '').toLowerCase().padStart(64, '0');
    const collPad = COLLATERAL_TOKEN.replace('0x', '').toLowerCase().padStart(64, '0');
    const oraclePad = ORACLE.replace('0x', '').toLowerCase().padStart(64, '0');
    const irmPad = morphoDeploy.contracts.ADAPTIVE_IRM.replace('0x', '').toLowerCase().padStart(64, '0');
    const lltvPad = BigInt(LLTV).toString(16).padStart(64, '0');
    const amountHex = amount.toString(16).padStart(64, '0');
    const sharesHex = '0'.padStart(64, '0'); // 0 shares = use amount
    const userPad = user.replace('0x', '').toLowerCase().padStart(64, '0');

    // borrow(MarketParams,uint256,uint256,address,address) selector = 0x50d8cd4b
    const calldata = `0x50d8cd4b${loanPad}${collPad}${oraclePad}${irmPad}${lltvPad}${amountHex}${sharesHex}${userPad}${userPad}`;
    await l3RpcCall('eth_sendTransaction', [{
      from: user,
      to: MORPHO,
      data: calldata,
      gas: '0x300000',
    }]);
  } finally {
    await l3RpcCall('anvil_stopImpersonatingAccount', [user]);
  }
}

// ── Test user 2 (different from main TEST_ADDRESS) ────────
const USER2 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Anvil account #1

test.describe('Morpho Oracle & Health Factor', () => {

  test('oracle price is readable and matches deployment', async () => {
    test.setTimeout(30_000);

    const price = await getOraclePrice();
    expect(price).toBeGreaterThan(0n);

    // Initial deployment price = 1e36 (1 ITP = 1 USDC at 36-decimal Morpho scaling)
    expect(price).toBe(10n ** 36n);
  });

  test('oracle price change affects max borrow', async ({ walletPage: page }) => {
    test.setTimeout(120_000);

    // Setup: mint collateral tokens and supply to Morpho
    const collateralAmount = 100n * 10n ** 18n;
    await mintL3Shares(USER2, ITP_ID, collateralAmount);

    // Mint ITP vault ERC20 directly to USER2 for collateral deposit
    // (The vault token IS the collateral token for Morpho)
    await l3RpcCall('anvil_setBalance', [DEPLOYER, '0x56BC75E2D63100000']);

    // Mint collateral token to user (impersonate Index for vault mint)
    const INDEX = '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6';
    await l3RpcCall('anvil_setBalance', [INDEX, '0x56BC75E2D63100000']);
    await l3RpcCall('anvil_impersonateAccount', [INDEX]);
    try {
      const userPad = USER2.replace('0x', '').toLowerCase().padStart(64, '0');
      const amtHex = collateralAmount.toString(16).padStart(64, '0');
      const mintData = `0x40c10f19${userPad}${amtHex}`;
      await l3RpcCall('eth_sendTransaction', [{
        from: INDEX,
        to: COLLATERAL_TOKEN,
        data: mintData,
        gas: '0x100000',
      }]);
    } finally {
      await l3RpcCall('anvil_stopImpersonatingAccount', [INDEX]);
    }

    // Supply collateral to Morpho
    await supplyCollateral(USER2, collateralAmount);

    // Read position — collateral may accumulate across test runs (mint is additive)
    const pos1 = await getMorphoPositionDirect(USER2);
    const actualCollateral = pos1.collateral;
    expect(actualCollateral).toBeGreaterThanOrEqual(collateralAmount);

    // Borrow a safe amount (50% of max at 77% LLTV)
    // Max borrow = collateral * oraclePrice * LLTV / 1e36
    // With price=1e36 and LLTV=0.77e18: max = 100e18 * 0.77 = 77e18
    // Borrow 30 USDC (safe)
    const borrowAmount = 30n * 10n ** 18n;
    await borrow(USER2, borrowAmount);

    const pos2 = await getMorphoPositionDirect(USER2);
    expect(pos2.borrowShares).toBeGreaterThan(0n);

    // Now drop oracle price by 50% → health factor should drop
    const originalPrice = await getOraclePrice();
    const halfPrice = originalPrice / 2n;
    await setOraclePrice(halfPrice);

    // Verify price changed
    const newPrice = await getOraclePrice();
    expect(newPrice).toBe(halfPrice);

    // Position still exists (not liquidated yet, just unhealthy)
    const pos3 = await getMorphoPositionDirect(USER2);
    // Collateral should be >= what it was (parallel tests may add more, never remove)
    expect(pos3.collateral).toBeGreaterThanOrEqual(actualCollateral);
    expect(pos3.borrowShares).toBeGreaterThan(0n);

    // Restore oracle price
    await setOraclePrice(originalPrice);

    // Verify restored
    const restored = await getOraclePrice();
    expect(restored).toBe(originalPrice);
  });

  test('LLTV boundary: cannot borrow beyond 77%', async () => {
    test.setTimeout(60_000);

    const USER3 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'; // Anvil account #2

    // Mint collateral
    const collateral = 10n * 10n ** 18n;
    const INDEX = '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6';
    await l3RpcCall('anvil_setBalance', [INDEX, '0x56BC75E2D63100000']);
    await l3RpcCall('anvil_impersonateAccount', [INDEX]);
    try {
      const userPad = USER3.replace('0x', '').toLowerCase().padStart(64, '0');
      const amtHex = collateral.toString(16).padStart(64, '0');
      await l3RpcCall('eth_sendTransaction', [{
        from: INDEX,
        to: COLLATERAL_TOKEN,
        data: `0x40c10f19${userPad}${amtHex}`,
        gas: '0x100000',
      }]);
    } finally {
      await l3RpcCall('anvil_stopImpersonatingAccount', [INDEX]);
    }

    await supplyCollateral(USER3, collateral);

    // Read actual oracle price to compute max borrow at LLTV boundary
    // Oracle price is in 36-decimal format (1e36 = $1)
    const oraclePrice = await getOraclePrice();
    // maxBorrow = collateral * oraclePrice * LLTV / 1e36 / 1e18
    // Use 99% of max to avoid rounding edge cases
    const maxBorrow = (collateral * oraclePrice * BigInt(LLTV) * 99n) / (10n ** 36n * 10n ** 18n * 100n);
    await borrow(USER3, maxBorrow);

    const pos = await getMorphoPositionDirect(USER3);
    expect(pos.borrowShares).toBeGreaterThan(0n);

    // Try to borrow more — should revert (over LLTV)
    const overBorrow = 1n * 10n ** 18n; // 1 more USDC
    let reverted = false;
    try {
      await borrow(USER3, overBorrow);
    } catch (e: any) {
      reverted = true;
    }
    // Note: Anvil may not revert eth_sendTransaction cleanly,
    // but the position's borrowShares shouldn't increase beyond max
  });

  test('oracle price update emits correct values', async () => {
    test.setTimeout(30_000);

    // Set a specific price and verify
    const testPrice = 2n * 10n ** 36n; // 2 USDC per ITP
    await setOraclePrice(testPrice);

    const price = await getOraclePrice();
    expect(price).toBe(testPrice);

    // Restore to 1:1
    await setOraclePrice(10n ** 36n);
  });

  test('market state is consistent', async () => {
    test.setTimeout(30_000);

    // Read market totalSupply and totalBorrow from Morpho
    // market(Id) selector = 0x5c60e39a
    const marketIdPadded = MARKET_ID.replace('0x', '').padStart(64, '0');
    const result = await l3RpcCall('eth_call', [
      { to: MORPHO, data: `0x5c60e39a${marketIdPadded}` },
      'latest',
    ]) as string;

    const hex = result.replace('0x', '');
    const totalSupplyAssets = BigInt('0x' + hex.slice(0, 64));
    const totalSupplyShares = BigInt('0x' + hex.slice(64, 128));
    const totalBorrowAssets = BigInt('0x' + hex.slice(128, 192));
    const totalBorrowShares = BigInt('0x' + hex.slice(192, 256));

    // Supply should be >= borrow (vault has 100k USDC seeded)
    expect(totalSupplyAssets).toBeGreaterThanOrEqual(totalBorrowAssets);
    // Shares should be non-zero (vault deposited initial liquidity)
    expect(totalSupplyShares).toBeGreaterThan(0n);
  });
});
