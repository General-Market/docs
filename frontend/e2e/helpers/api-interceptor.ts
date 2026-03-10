/**
 * Playwright route interceptor for backend API endpoints.
 * When the data-node backend doesn't support certain endpoints,
 * this intercepts browser requests and responds with data from direct RPC calls.
 */
import type { Page, Route } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SETTLEMENT_RPC as ENV_SETTLEMENT_RPC, L3_RPC as ENV_L3_RPC, CONTRACTS, RPC_TIMEOUT } from '../env';

const SETTLEMENT_RPC = ENV_SETTLEMENT_RPC;
const L3_RPC = ENV_L3_RPC;
const SETTLEMENT_USDC = CONTRACTS.SETTLEMENT_USDC ?? '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
const SETTLEMENT_CUSTODY = CONTRACTS.SettlementBridgeCustody ?? '0x0B306BF915C4d645ff596e518fAf3F9669b97016';
const BRIDGE_PROXY = CONTRACTS.BridgeProxy ?? '0x59b670e9fA9D0A427751Af201D676719a970857b';
const BRIDGED_ITP_FACTORY = CONTRACTS.BridgedItpFactory ?? '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1';

// Read Morpho addresses from deployment JSON
function readMorphoDeployment() {
  try {
    const morphoJson = JSON.parse(readFileSync(join(__dirname, '../../lib/contracts/morpho-deployment.json'), 'utf-8'));
    return {
      morpho: morphoJson.contracts?.MORPHO || '',
      marketId: morphoJson.contracts?.MARKET_ID || '',
      mockOracle: morphoJson.contracts?.ITP_NAV_ORACLE || morphoJson.contracts?.MOCK_ORACLE || '',
      collateralToken: morphoJson.marketParams?.collateralToken || '',
      loanToken: morphoJson.marketParams?.loanToken || '',
    };
  } catch {
    return { morpho: '', marketId: '', mockOracle: '', collateralToken: '', loanToken: '' };
  }
}

const MORPHO_DEPLOY = readMorphoDeployment();
const MORPHO = MORPHO_DEPLOY.morpho;
/** The Morpho collateral token lives on L3 (same chain as Morpho) */
const MORPHO_COLLATERAL = MORPHO_DEPLOY.collateralToken;
/** The Morpho loan token (L3 WUSDC) — used for repay balance/allowance checks */
const MORPHO_LOAN_TOKEN = MORPHO_DEPLOY.loanToken;

async function rpcCall(method: string, params: unknown[], rpcUrl: string = SETTLEMENT_RPC): Promise<string> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(RPC_TIMEOUT),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result as string;
}

function pad32(hex: string): string {
  return hex.replace('0x', '').toLowerCase().padStart(64, '0');
}

async function erc20BalanceOf(token: string, account: string, rpc?: string): Promise<string> {
  const data = `0x70a08231${pad32(account)}`;
  const result = await rpcCall('eth_call', [{ to: token, data }, 'latest'], rpc);
  return BigInt(result).toString();
}

async function erc20Allowance(token: string, owner: string, spender: string, rpc?: string): Promise<string> {
  const data = `0xdd62ed3e${pad32(owner)}${pad32(spender)}`;
  const result = await rpcCall('eth_call', [{ to: token, data }, 'latest'], rpc);
  return BigInt(result).toString();
}

async function erc20Name(token: string, rpc?: string): Promise<string> {
  try {
    const result = await rpcCall('eth_call', [{ to: token, data: '0x06fdde03' }, 'latest'], rpc);
    return decodeString(result);
  } catch { return ''; }
}

async function erc20Symbol(token: string, rpc?: string): Promise<string> {
  try {
    const result = await rpcCall('eth_call', [{ to: token, data: '0x95d89b41' }, 'latest'], rpc);
    return decodeString(result);
  } catch { return ''; }
}

async function erc20TotalSupply(token: string, rpc?: string): Promise<string> {
  try {
    const result = await rpcCall('eth_call', [{ to: token, data: '0x18160ddd' }, 'latest'], rpc);
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
    // Get BridgedITP address from Settlement factory
    let bridgedItpAddr = await getBridgedItpAddress(itpId);

    // Settlement USDC for custody operations
    const [settlementUsdcBalance, usdcAllowanceCustody] = await Promise.all([
      erc20BalanceOf(SETTLEMENT_USDC, user),
      erc20Allowance(SETTLEMENT_USDC, user, SETTLEMENT_CUSTODY),
    ]);

    // For Morpho: read USDC balance and allowance from L3 (loan token)
    // Morpho is on L3 and uses L3_WUSDC as the loan token.
    let usdcBalance = settlementUsdcBalance;
    let usdcAllowanceMorpho = '0';
    if (MORPHO_LOAN_TOKEN && MORPHO) {
      try {
        const [l3Balance, l3Allowance] = await Promise.all([
          erc20BalanceOf(MORPHO_LOAN_TOKEN, user, L3_RPC),
          erc20Allowance(MORPHO_LOAN_TOKEN, user, MORPHO, L3_RPC),
        ]);
        usdcBalance = l3Balance;
        usdcAllowanceMorpho = l3Allowance;
      } catch {
        // L3 read failed — use Settlement balance
        usdcAllowanceMorpho = await erc20Allowance(SETTLEMENT_USDC, user, MORPHO).catch(() => '0');
      }
    } else {
      usdcAllowanceMorpho = await erc20Allowance(SETTLEMENT_USDC, user, MORPHO).catch(() => '0');
    }

    let bridgedItpBalance = '0';
    let bridgedItpAllowanceCustody = '0';
    let bridgedItpAllowanceMorpho = '0';
    let bridgedItpName = '';
    let bridgedItpSymbol = '';
    let bridgedItpTotalSupply = '0';

    // Read Morpho collateral token balance from L3 (where Morpho lives)
    // This is the token users actually deposit as collateral.
    if (MORPHO_COLLATERAL) {
      try {
        [bridgedItpBalance, bridgedItpAllowanceMorpho, bridgedItpName, bridgedItpSymbol, bridgedItpTotalSupply] = await Promise.all([
          erc20BalanceOf(MORPHO_COLLATERAL, user, L3_RPC),
          erc20Allowance(MORPHO_COLLATERAL, user, MORPHO, L3_RPC),
          erc20Name(MORPHO_COLLATERAL, L3_RPC),
          erc20Symbol(MORPHO_COLLATERAL, L3_RPC),
          erc20TotalSupply(MORPHO_COLLATERAL, L3_RPC),
        ]);
        bridgedItpAddr = MORPHO_COLLATERAL;
      } catch {
        // L3 read failed — fall back to Settlement BridgedITP below
      }
    }

    // Fallback: read BridgedITP from Settlement if L3 collateral read didn't work
    if (bridgedItpBalance === '0' && bridgedItpAddr && bridgedItpAddr !== MORPHO_COLLATERAL) {
      try {
        [bridgedItpBalance, bridgedItpAllowanceCustody, bridgedItpAllowanceMorpho, bridgedItpName, bridgedItpSymbol, bridgedItpTotalSupply] = await Promise.all([
          erc20BalanceOf(bridgedItpAddr, user),
          erc20Allowance(bridgedItpAddr, user, SETTLEMENT_CUSTODY),
          erc20Allowance(bridgedItpAddr, user, MORPHO),
          erc20Name(bridgedItpAddr),
          erc20Symbol(bridgedItpAddr),
          erc20TotalSupply(bridgedItpAddr),
        ]);
      } catch { /* ignore */ }
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

    // Morpho lives on L3
    const [posResult, mktResult, priceResult] = await Promise.all([
      rpcCall('eth_call', [{ to: MORPHO, data: posData }, 'latest'], L3_RPC),
      rpcCall('eth_call', [{ to: MORPHO, data: mktData }, 'latest'], L3_RPC),
      rpcCall('eth_call', [{ to: MOCK_ORACLE, data: priceData }, 'latest'], L3_RPC),
    ]);

    // Position: (uint256 supplyShares, uint128 borrowShares, uint128 collateral)
    const supplyShares = sliceUint(posResult, 0);
    const borrowShares = sliceUint(posResult, 1);
    const collateral = sliceUint(posResult, 2);
    // Debug logging removed — was too noisy

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
    console.error('[api-interceptor] handleMorphoPosition RPC error:', (err as Error).message, 'L3_RPC:', L3_RPC, 'MORPHO:', MORPHO, 'MARKET_ID:', MARKET_ID, 'ORACLE:', MOCK_ORACLE);
    // Fallback to zeros on error — guard against route already handled
    try {
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
    } catch {
      // Route already handled by try block — ignore
    }
  }
}

/**
 * Install API interceptors on a Playwright page.
 * Intercepts /user-state and /morpho-position requests that the backend can't serve
 * and responds with data from direct Anvil RPC calls.
 */
export async function installApiInterceptors(page: Page): Promise<void> {
  // Intercept user-state: use backend for base data, but always augment BridgedITP from RPC.
  // The data-node may use a stale BridgedItpFactory address, returning wrong bridged_itp_address.
  await page.route('**/user-state**', async (route) => {
    // Try the real backend first
    let backendData: Record<string, unknown> | null = null;
    try {
      const response = await route.fetch();
      if (response.ok()) {
        backendData = await response.json();
      }
    } catch {
      // Backend unreachable
    }

    if (backendData) {
      // Augment with Morpho collateral token data from L3 (where Morpho market lives)
      try {
        const url = new URL(route.request().url());
        const user = url.searchParams.get('user') || '';
        const collateralAddr = MORPHO_COLLATERAL || await getBridgedItpAddress(url.searchParams.get('itp_id') || '');
        const rpc = MORPHO_COLLATERAL ? L3_RPC : SETTLEMENT_RPC;
        if (collateralAddr) {
          const [balance, allowanceMorpho, name, symbol, totalSupply] = await Promise.all([
            erc20BalanceOf(collateralAddr, user, rpc),
            erc20Allowance(collateralAddr, user, MORPHO, rpc),
            erc20Name(collateralAddr, rpc),
            erc20Symbol(collateralAddr, rpc),
            erc20TotalSupply(collateralAddr, rpc),
          ]);
          backendData.bridged_itp_address = collateralAddr;
          backendData.bridged_itp_balance = balance;
          backendData.bridged_itp_allowance_morpho = allowanceMorpho;
          backendData.bridged_itp_name = name;
          backendData.bridged_itp_symbol = symbol;
          backendData.bridged_itp_total_supply = totalSupply;
        }
      } catch {
        // RPC augmentation failed — use backend data as-is
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(backendData),
      });
      return;
    }

    // Fallback: serve entirely from RPC
    await handleUserState(route);
  });

  // Always read Morpho position from direct L3 RPC — the backend may have
  // stale/old Morpho deployment data that doesn't match morpho-deployment.json.
  await page.route('**/morpho-position**', async (route) => {
    await handleMorphoPosition(route);
  });

  // Override SSE `user-positions` events with correct data from L3 Morpho.
  // The backend SSE may stream stale positions from an old Morpho deployment.
  // useMorphoPosition prefers SSE over REST, so stale SSE blocks the REST fix above.
  // Inject a client-side override: patch EventSource to replace user-positions events.
  if (MORPHO && MARKET_ID) {
    await page.addInitScript(`
      (() => {
        const _ES = window.EventSource;
        window.EventSource = function(url, opts) {
          const es = new _ES(url, opts);
          const _addEventListener = es.addEventListener.bind(es);
          es.addEventListener = function(type, listener, options) {
            if (type === 'user-positions') {
              // Wrap the listener to skip stale SSE data — let REST handle it
              return _addEventListener(type, () => {}, options);
            }
            return _addEventListener(type, listener, options);
          };
          return es;
        };
        window.EventSource.CONNECTING = _ES.CONNECTING;
        window.EventSource.OPEN = _ES.OPEN;
        window.EventSource.CLOSED = _ES.CLOSED;
      })();
    `);
  }
}
