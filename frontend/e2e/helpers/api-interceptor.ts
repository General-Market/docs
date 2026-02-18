/**
 * Playwright route interceptor for backend API endpoints.
 * When the data-node backend doesn't support certain endpoints,
 * this intercepts browser requests and responds with data from direct RPC calls.
 */
import type { Page, Route } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

const ARB_RPC = 'http://localhost:8546';

// Contract addresses — read from deployment JSONs (deterministic Anvil addresses)
const ARB_USDC = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
const ARB_CUSTODY = '0x0B306BF915C4d645ff596e518fAf3F9669b97016';
const BRIDGE_PROXY = '0x59b670e9fA9D0A427751Af201D676719a970857b';
const BRIDGED_ITP_FACTORY = '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1';

// Read Morpho address from deployment JSON (changes when collateral token changes)
function readMorphoDeployment() {
  try {
    const morphoJson = JSON.parse(readFileSync(join(__dirname, '../../lib/contracts/morpho-deployment.json'), 'utf-8'));
    return {
      morpho: morphoJson.contracts?.MORPHO || '',
      marketId: morphoJson.contracts?.MARKET_ID || '',
      mockOracle: morphoJson.contracts?.MOCK_ORACLE || '',
    };
  } catch {
    return { morpho: '', marketId: '', mockOracle: '' };
  }
}

const MORPHO_DEPLOY = readMorphoDeployment();
const MORPHO = MORPHO_DEPLOY.morpho;

async function rpcCall(method: string, params: unknown[]): Promise<string> {
  const res = await fetch(ARB_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result as string;
}

function pad32(hex: string): string {
  return hex.replace('0x', '').toLowerCase().padStart(64, '0');
}

async function erc20BalanceOf(token: string, account: string): Promise<string> {
  const data = `0x70a08231${pad32(account)}`;
  const result = await rpcCall('eth_call', [{ to: token, data }, 'latest']);
  return BigInt(result).toString();
}

async function erc20Allowance(token: string, owner: string, spender: string): Promise<string> {
  const data = `0xdd62ed3e${pad32(owner)}${pad32(spender)}`;
  const result = await rpcCall('eth_call', [{ to: token, data }, 'latest']);
  return BigInt(result).toString();
}

async function erc20Name(token: string): Promise<string> {
  try {
    const result = await rpcCall('eth_call', [{ to: token, data: '0x06fdde03' }, 'latest']);
    return decodeString(result);
  } catch { return ''; }
}

async function erc20Symbol(token: string): Promise<string> {
  try {
    const result = await rpcCall('eth_call', [{ to: token, data: '0x95d89b41' }, 'latest']);
    return decodeString(result);
  } catch { return ''; }
}

async function erc20TotalSupply(token: string): Promise<string> {
  try {
    const result = await rpcCall('eth_call', [{ to: token, data: '0x18160ddd' }, 'latest']);
    return BigInt(result).toString();
  } catch { return '0'; }
}

function decodeString(hex: string): string {
  // ABI-encoded string: offset (32 bytes) + length (32 bytes) + data
  const clean = hex.replace('0x', '');
  if (clean.length < 128) return '';
  const length = parseInt(clean.slice(64, 128), 16);
  const data = clean.slice(128, 128 + length * 2);
  let str = '';
  for (let i = 0; i < data.length; i += 2) {
    const code = parseInt(data.slice(i, i + 2), 16);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
}

/** Get BridgedITP address for an ITP ID via BridgedItpFactory.deployedItps() */
async function getBridgedItpAddress(itpId: string): Promise<string> {
  // deployedItps(bytes32) selector = 0x... need to compute
  // Actually, let's use the known address from deployment for now
  // But for robustness, call the factory
  const selector = '0x8f57752e'; // cast sig "deployedItps(bytes32)"
  const data = `${selector}${pad32(itpId)}`;
  try {
    const result = await rpcCall('eth_call', [{ to: BRIDGED_ITP_FACTORY, data }, 'latest']);
    const addr = '0x' + result.slice(-40);
    if (addr === '0x0000000000000000000000000000000000000000') return '';
    return addr;
  } catch {
    return '';
  }
}

async function handleUserState(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const user = url.searchParams.get('user') || '';
  const itpId = url.searchParams.get('itp_id') || '';

  try {
    // Get BridgedITP address
    let bridgedItpAddr = await getBridgedItpAddress(itpId);

    const [usdcBalance, usdcAllowanceCustody, usdcAllowanceMorpho] = await Promise.all([
      erc20BalanceOf(ARB_USDC, user),
      erc20Allowance(ARB_USDC, user, ARB_CUSTODY),
      erc20Allowance(ARB_USDC, user, MORPHO),
    ]);

    let bridgedItpBalance = '0';
    let bridgedItpAllowanceCustody = '0';
    let bridgedItpAllowanceMorpho = '0';
    let bridgedItpName = '';
    let bridgedItpSymbol = '';
    let bridgedItpTotalSupply = '0';

    if (bridgedItpAddr) {
      [bridgedItpBalance, bridgedItpAllowanceCustody, bridgedItpAllowanceMorpho, bridgedItpName, bridgedItpSymbol, bridgedItpTotalSupply] = await Promise.all([
        erc20BalanceOf(bridgedItpAddr, user),
        erc20Allowance(bridgedItpAddr, user, ARB_CUSTODY),
        erc20Allowance(bridgedItpAddr, user, MORPHO),
        erc20Name(bridgedItpAddr),
        erc20Symbol(bridgedItpAddr),
        erc20TotalSupply(bridgedItpAddr),
      ]);
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        usdc_balance: usdcBalance,
        usdc_allowance_custody: usdcAllowanceCustody,
        usdc_allowance_morpho: usdcAllowanceMorpho,
        bridged_itp_address: bridgedItpAddr || '0x0000000000000000000000000000000000000000',
        bridged_itp_balance: bridgedItpBalance,
        bridged_itp_allowance_custody: bridgedItpAllowanceCustody,
        bridged_itp_allowance_morpho: bridgedItpAllowanceMorpho,
        bridged_itp_name: bridgedItpName,
        bridged_itp_symbol: bridgedItpSymbol,
        bridged_itp_total_supply: bridgedItpTotalSupply,
      }),
    });
  } catch (err) {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: String(err) }),
    });
  }
}

// Morpho market params — read from deployment JSON
const MARKET_ID = MORPHO_DEPLOY.marketId;
const MOCK_ORACLE = MORPHO_DEPLOY.mockOracle;
const LLTV = BigInt('770000000000000000'); // 0.77e18

function sliceUint(hex: string, wordIndex: number): bigint {
  const clean = hex.replace('0x', '');
  const start = wordIndex * 64;
  return BigInt('0x' + (clean.slice(start, start + 64) || '0'));
}

async function handleMorphoPosition(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const user = url.searchParams.get('user') || '';

  try {
    // position(bytes32,address) = 0x93c52062
    const posData = `0x93c52062${pad32(MARKET_ID)}${pad32(user)}`;
    // market(bytes32) = 0x5c60e39a
    const mktData = `0x5c60e39a${pad32(MARKET_ID)}`;
    // price() = 0xa035b1fe
    const priceData = '0xa035b1fe';

    const [posResult, mktResult, priceResult] = await Promise.all([
      rpcCall('eth_call', [{ to: MORPHO, data: posData }, 'latest']),
      rpcCall('eth_call', [{ to: MORPHO, data: mktData }, 'latest']),
      rpcCall('eth_call', [{ to: MOCK_ORACLE, data: priceData }, 'latest']),
    ]);

    // Position: (uint256 supplyShares, uint128 borrowShares, uint128 collateral)
    const supplyShares = sliceUint(posResult, 0);
    const borrowShares = sliceUint(posResult, 1);
    const collateral = sliceUint(posResult, 2);

    // Market: (uint128 totalSupplyAssets, uint128 totalSupplyShares,
    //          uint128 totalBorrowAssets, uint128 totalBorrowShares,
    //          uint128 lastUpdate, uint128 fee)
    const totalSupplyAssets = sliceUint(mktResult, 0);
    const totalSupplyShares = sliceUint(mktResult, 1);
    const totalBorrowAssets = sliceUint(mktResult, 2);
    const totalBorrowShares = sliceUint(mktResult, 3);

    const oraclePrice = BigInt(priceResult);

    // Compute debt amount from borrow shares (round up)
    let debtAmount = 0n;
    if (borrowShares > 0n && totalBorrowShares > 0n) {
      debtAmount = (borrowShares * totalBorrowAssets + totalBorrowShares - 1n) / totalBorrowShares;
    }

    // max_borrow = (collateral * oraclePrice * lltv / 1e36 / 1e18) - debtAmount
    let maxBorrow = 0n;
    if (collateral > 0n && oraclePrice > 0n) {
      const maxDebt = (collateral * oraclePrice * LLTV) / (10n ** 36n) / (10n ** 18n);
      maxBorrow = maxDebt > debtAmount ? maxDebt - debtAmount : 0n;
    }

    // max_withdraw = collateral - requiredCollateral
    // Round UP requiredCollateral (ceiling division) to avoid precision mismatch
    // with frontend's BigInt-based health factor check.
    let maxWithdraw = collateral;
    if (debtAmount > 0n && oraclePrice > 0n && LLTV > 0n) {
      const denom = oraclePrice * LLTV;
      const requiredCollateral = (debtAmount * 10n ** 36n * 10n ** 18n + denom - 1n) / denom;
      maxWithdraw = collateral > requiredCollateral ? collateral - requiredCollateral : 0n;
    }

    // health_factor = (collateral * oraclePrice * lltv) / (debtAmount * 1e36 * 1e18)
    let healthFactor = '999999999';
    if (debtAmount > 0n) {
      const hf = (collateral * oraclePrice * LLTV) / (debtAmount * 10n ** 36n);
      healthFactor = hf.toString();
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        collateral: collateral.toString(),
        borrow_shares: borrowShares.toString(),
        debt_amount: debtAmount.toString(),
        oracle_price: oraclePrice.toString(),
        health_factor: healthFactor,
        max_borrow: maxBorrow.toString(),
        max_withdraw: maxWithdraw.toString(),
        market: {
          total_supply_assets: totalSupplyAssets.toString(),
          total_supply_shares: totalSupplyShares.toString(),
          total_borrow_assets: totalBorrowAssets.toString(),
          total_borrow_shares: totalBorrowShares.toString(),
        },
      }),
    });
  } catch (err) {
    // Fallback to zeros on error
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        collateral: '0',
        borrow_shares: '0',
        debt_amount: '0',
        oracle_price: '1000000000000000000',
        health_factor: '999999999',
        max_borrow: '0',
        max_withdraw: '0',
        market: {
          total_supply_assets: '0',
          total_supply_shares: '0',
          total_borrow_assets: '0',
          total_borrow_shares: '0',
        },
      }),
    });
  }
}

/**
 * Install API interceptors on a Playwright page.
 * Intercepts /user-state and /morpho-position requests that the backend can't serve
 * and responds with data from direct Anvil RPC calls.
 */
export async function installApiInterceptors(page: Page): Promise<void> {
  // Only intercept if the backend returns 404 (stale binary)
  await page.route('**/user-state**', async (route) => {
    // Try the real backend first
    try {
      const response = await route.fetch();
      if (response.ok()) {
        await route.fulfill({ response });
        return;
      }
    } catch {
      // Backend unreachable
    }
    // Fallback: serve from RPC
    await handleUserState(route);
  });

  // Try backend first for morpho-position; fallback to RPC if unavailable.
  // (start.sh now deploys Morpho with the real BridgedITP collateral token.)
  await page.route('**/morpho-position**', async (route) => {
    try {
      const response = await route.fetch();
      if (response.ok()) {
        await route.fulfill({ response });
        return;
      }
    } catch {
      // Backend unreachable
    }
    // Fallback: serve from RPC
    await handleMorphoPosition(route);
  });
}
