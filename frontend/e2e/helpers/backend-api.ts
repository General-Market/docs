/**
 * Backend API helpers for E2E test verification.
 * These call the data-node backend directly to verify on-chain state,
 * rather than relying on the UI's polling which may be stale.
 */

import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { INDEX_ABI, BRIDGE_PROXY_ABI, ARB_CUSTODY_ABI, ERC20_ABI } from '../../lib/contracts/index-protocol-abi';

const BACKEND_URL = 'http://localhost:8200';

export interface UserState {
  usdc_balance: string;
  usdc_allowance_custody: string;
  usdc_allowance_morpho: string;
  bridged_itp_address: string;
  bridged_itp_balance: string;
  bridged_itp_allowance_custody: string;
  bridged_itp_allowance_morpho: string;
  bridged_itp_name: string;
  bridged_itp_symbol: string;
  bridged_itp_total_supply: string;
}

export interface MorphoPosition {
  collateral: string;
  borrow_shares: string;
  debt_amount: string;
  oracle_price: string;
  health_factor: string;
  max_borrow: string;
  max_withdraw: string;
  market: {
    total_supply_assets: string;
    total_supply_shares: string;
    total_borrow_assets: string;
    total_borrow_shares: string;
  };
}

export interface OrderData {
  id: number;
  user: string;
  side: number;
  amount: string;
  limit_price: string;
  itp_id: string;
  timestamp: string;
  status: number;
  fill: {
    fill_price: string;
    fill_amount: string;
    cycle_number: string;
  } | null;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Backend ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    // Some backends don't have /health — try user-state as fallback
    try {
      const res = await fetch(
        `${BACKEND_URL}/user-state?user=0x0000000000000000000000000000000000000000&itp_id=0x0000000000000000000000000000000000000000000000000000000000000001`,
        { signal: AbortSignal.timeout(5_000) },
      );
      return res.status < 500;
    } catch {
      return false;
    }
  }
}

export async function checkRpc(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: AbortSignal.timeout(5_000),
    });
    const json = await res.json();
    return !!json.result;
  } catch {
    return false;
  }
}

export async function getUserState(user: string, itpId: string): Promise<UserState> {
  try {
    return await fetchJson<UserState>(`/user-state?user=${user}&itp_id=${itpId}`);
  } catch {
    // Backend endpoint not available — read balances via RPC
    return getUserStateViaRpc(user, itpId);
  }
}

export async function getMorphoPosition(user: string): Promise<MorphoPosition> {
  return fetchJson<MorphoPosition>(`/morpho-position?user=${user}`);
}

export async function getOrder(orderId: number | string): Promise<OrderData> {
  try {
    return await fetchJson<OrderData>(`/order?id=${orderId}`);
  } catch {
    // Data-node unavailable — read order from L3 Index contract directly
    return getOrderViaL3(orderId);
  }
}

async function getOrderViaL3(orderId: number | string): Promise<OrderData> {
  const calldata = encodeFunctionData({
    abi: INDEX_ABI,
    functionName: 'getOrder',
    args: [BigInt(orderId)],
  });
  const result = await l3RpcCall('eth_call', [
    { to: L3_INDEX, data: calldata },
    'latest',
  ]) as `0x${string}`;

  const decoded = decodeFunctionResult({
    abi: INDEX_ABI,
    functionName: 'getOrder',
    data: result,
  }) as unknown as [{ id: bigint; user: string; pairId: string; side: number; amount: bigint; limitPrice: bigint; slippageTier: bigint; deadline: bigint; itpId: string; timestamp: bigint; status: number }];

  const o = decoded[0];
  return {
    id: Number(o.id),
    user: o.user,
    side: o.side,
    amount: o.amount.toString(),
    limit_price: o.limitPrice.toString(),
    itp_id: o.itpId,
    timestamp: o.timestamp.toString(),
    status: o.status,
    fill: null,
  };
}

// ── Direct RPC helpers (fallback when backend endpoints unavailable) ─────

const ARB_RPC = 'http://localhost:8546';

// Addresses read from deployments/active-deployment.json at import time
const _deployment = (() => {
  try {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const path = join(__dirname, '..', '..', '..', 'deployments', 'active-deployment.json');
    return JSON.parse(readFileSync(path, 'utf-8')).contracts;
  } catch {
    return null;
  }
})();

const BRIDGED_ITP = _deployment?.BridgedITP ?? '0x2Eab31C830BB4B1fD8FB8738F6F4A52357737A11';
const ARB_USDC = _deployment?.ARB_USDC ?? '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
const BRIDGE_PROXY = _deployment?.BridgeProxy ?? '0x0B306BF915C4d645ff596e518fAf3F9669b97016';
const ARB_CUSTODY = _deployment?.ArbBridgeCustody ?? '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1';
/** Anvil deployer account (auto-accepted for eth_sendTransaction) */
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

/** Inline ABI for sellITPFromArbitrum (not in shared ABI file) */
const SELL_ABI = [
  {
    inputs: [
      { name: 'itpId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
      { name: 'limitPrice', type: 'uint256' },
      { name: 'slippageTier', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'sellITPFromArbitrum',
    outputs: [{ name: 'orderId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(ARB_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

/** ERC20 balanceOf via eth_call */
async function erc20BalanceOf(token: string, account: string): Promise<string> {
  // balanceOf(address) selector = 0x70a08231
  const paddedAddr = account.toLowerCase().replace('0x', '').padStart(64, '0');
  const data = `0x70a08231${paddedAddr}`;
  const result = await rpcCall('eth_call', [{ to: token, data }, 'latest']) as string;
  return BigInt(result).toString();
}

async function getUserStateViaRpc(user: string, _itpId: string): Promise<UserState> {
  const [usdcBalance, itpBalance] = await Promise.all([
    erc20BalanceOf(ARB_USDC, user),
    erc20BalanceOf(BRIDGED_ITP, user),
  ]);
  return {
    usdc_balance: usdcBalance,
    usdc_allowance_custody: '0',
    usdc_allowance_morpho: '0',
    bridged_itp_address: BRIDGED_ITP,
    bridged_itp_balance: itpBalance,
    bridged_itp_allowance_custody: '0',
    bridged_itp_allowance_morpho: '0',
    bridged_itp_name: '',
    bridged_itp_symbol: '',
    bridged_itp_total_supply: '0',
  };
}

/**
 * Mint BridgedITP tokens to a user by impersonating the BridgeProxy on Anvil.
 * BridgedITP.mint() is onlyBridgeProxy, so we impersonate it to bypass BLS
 * verification entirely. This is the correct E2E approach since BLS is now
 * active (aggregated pubkey is set on-chain).
 */
export async function mintBridgedItp(
  user: string,
  _itpId: string,
  amount: bigint,
): Promise<void> {
  // Fund BridgeProxy with ETH for gas (it's a contract with no balance)
  await rpcCall('anvil_setBalance', [BRIDGE_PROXY, '0x56BC75E2D63100000']); // 100 ETH
  // Impersonate BridgeProxy to call BridgedITP.mint(user, amount) directly
  await rpcCall('anvil_impersonateAccount', [BRIDGE_PROXY]);
  try {
    // mint(address,uint256) selector = 0x40c10f19
    const userPadded = user.replace('0x', '').toLowerCase().padStart(64, '0');
    const amountHex = amount.toString(16).padStart(64, '0');
    const data = `0x40c10f19${userPadded}${amountHex}`;

    await rpcCall('eth_sendTransaction', [{
      from: BRIDGE_PROXY,
      to: BRIDGED_ITP,
      data,
      gas: '0x100000', // 1M gas
    }]);
  } finally {
    await rpcCall('anvil_stopImpersonatingAccount', [BRIDGE_PROXY]);
  }
}

// ── L3 RPC helpers (rebalance operates on L3 directly) ──────────────────

const L3_RPC = 'http://localhost:8545';
const L3_INDEX = _deployment?.Index ?? '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6';
const L3_ISSUER_REGISTRY = _deployment?.IssuerRegistry ?? '0x610178dA211FEF7D417bC0e6FeD39F05609AD788';

async function l3RpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(L3_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${json.error.message} (data: ${json.error.data ?? 'none'})`);
  return json.result;
}

export interface ItpState {
  creator: string;
  totalSupply: bigint;
  nav: bigint;
  assets: string[];
  weights: bigint[];
  inventory: bigint[];
}

/**
 * Fetch ITP state from L3 Index contract via eth_call.
 */
export async function getItpStateL3(itpId: string): Promise<ItpState> {
  const calldata = encodeFunctionData({
    abi: INDEX_ABI,
    functionName: 'getITPState',
    args: [itpId as `0x${string}`],
  });

  const result = await l3RpcCall('eth_call', [
    { to: L3_INDEX, data: calldata },
    'latest',
  ]) as `0x${string}`;

  const decoded = decodeFunctionResult({
    abi: INDEX_ABI,
    functionName: 'getITPState',
    data: result,
  }) as [string, bigint, bigint, string[], bigint[], bigint[]];

  return {
    creator: decoded[0],
    totalSupply: decoded[1],
    nav: decoded[2],
    assets: decoded[3],
    weights: decoded[4],
    inventory: decoded[5],
  };
}

/**
 * Get the current ITP count from L3 Index contract.
 * Returns the number of ITPs that have been created so far.
 */
export async function getItpCountL3(): Promise<number> {
  // getItpCount() selector = keccak256("getItpCount()")[:4]
  const data = '0x2fa9f978';
  const result = await l3RpcCall('eth_call', [
    { to: L3_INDEX, data },
    'latest',
  ]) as string;
  return Number(BigInt(result));
}

/**
 * Temporarily clear the aggregated BLS pubkey on L3 IssuerRegistry.
 * Returns the original pubkey bytes for restoration.
 * Used to bypass BLS verification for direct E2E test operations.
 */
async function clearL3AggPubkey(): Promise<string> {
  // getAggregatedPubkey() selector = 0x7004e072
  const currentPubkey = await l3RpcCall('eth_call', [{
    to: L3_ISSUER_REGISTRY,
    data: '0x7004e072',
  }, 'latest']) as string;

  // setAggregatedPubkey(bytes) selector = 0xb009fd60, with empty bytes
  // ABI encoding: selector + offset(0x20) + length(0x00)
  const clearData = '0xb009fd60' +
    '0'.repeat(62) + '20' + // offset to bytes data
    '0'.repeat(64);         // bytes length = 0
  await l3RpcCall('eth_sendTransaction', [{
    from: DEPLOYER,
    to: L3_ISSUER_REGISTRY,
    data: clearData,
    gas: '0x100000',
  }]);

  return currentPubkey;
}

/**
 * Restore the aggregated BLS pubkey on L3 IssuerRegistry.
 */
async function restoreL3AggPubkey(encodedPubkey: string): Promise<void> {
  // setAggregatedPubkey(bytes) with the original bytes
  // The encodedPubkey from getAggregatedPubkey() is already ABI-encoded (offset+length+data)
  // We need to re-encode it for setAggregatedPubkey(bytes)
  // setAggregatedPubkey selector = 0xb009fd60
  const restoreData = '0xb009fd60' + encodedPubkey.replace('0x', '');
  await l3RpcCall('eth_sendTransaction', [{
    from: DEPLOYER,
    to: L3_ISSUER_REGISTRY,
    data: restoreData,
    gas: '0x100000',
  }]);
}

/**
 * Rebalance an ITP by calling requestRebalance on the L3 Index contract
 * (emits RebalanceRequested event on L3) and waiting for issuers to
 * execute it via BLS consensus.
 * Shifts 0.5% weight from asset[0] to asset[1].
 */
export async function rebalanceItp(itpId: string): Promise<void> {
  const state = await getItpStateL3(itpId);
  const weightsBefore = state.weights[0];

  // Compute new weights (shift between asset[0] and asset[1])
  const newWeights = [...state.weights];
  const MIN_WEIGHT = 2500000000000000n;
  const DESIRED_SHIFT = 5000000000000000n;
  const maxShift = newWeights[0] - MIN_WEIGHT;
  const shift = maxShift > 0n ? (maxShift < DESIRED_SHIFT ? maxShift : DESIRED_SHIFT) : 0n;
  if (shift === 0n) {
    const reverseMax = newWeights[1] - MIN_WEIGHT;
    const reverseShift = reverseMax > 0n ? (reverseMax < DESIRED_SHIFT ? reverseMax : DESIRED_SHIFT) : 0n;
    if (reverseShift === 0n) throw new Error('Both assets at minimum weight, cannot rebalance');
    newWeights[1] = newWeights[1] - reverseShift;
    newWeights[0] = newWeights[0] + reverseShift;
  } else {
    newWeights[0] = newWeights[0] - shift;
    newWeights[1] = newWeights[1] + shift;
  }

  // Call requestRebalance on L3 Index (emits RebalanceRequested on L3,
  // which issuers monitor and process via BLS consensus)
  const calldata = encodeFunctionData({
    abi: INDEX_ABI,
    functionName: 'requestRebalance',
    args: [
      itpId as `0x${string}`,
      [],
      [] as readonly `0x${string}`[],
      newWeights,
      'E2E rebalance test',
    ],
  });

  await l3RpcCall('eth_sendTransaction', [{
    from: DEPLOYER,
    to: L3_INDEX,
    data: calldata,
    gas: '0x200000',
  }]);

  // Wait for issuers to execute the rebalance on L3 (weights change)
  await pollUntil(
    () => getItpStateL3(itpId),
    (s) => s.weights[0] !== weightsBefore,
    90_000,
    2_000,
  );
}

/**
 * Poll an async function until a predicate is satisfied.
 * Used for waiting on order fills, balance changes, etc.
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  timeoutMs = 90_000,
  intervalMs = 3_000,
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await fn();
      if (predicate(result)) return result;
    } catch {
      // Retry on error
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  // One final attempt
  const result = await fn();
  if (predicate(result)) return result;
  throw new Error(`pollUntil timed out after ${timeoutMs}ms`);
}

// ── Direct order placement (via Anvil impersonation) ────────────────────

/**
 * Place a buy order directly on ArbBridgeCustody by impersonating the user.
 * Returns the orderId.
 */
export async function placeBuyOrderDirect(
  user: string,
  itpId: string,
  usdcAmount: bigint,
  limitPrice: bigint,
): Promise<number> {
  // Fund user with ETH for gas
  await rpcCall('anvil_setBalance', [user, '0x56BC75E2D63100000']); // 100 ETH

  // Mint USDC to user (deployer can call mint on test USDC)
  const mintData = encodeFunctionData({
    abi: [{ inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'mint', outputs: [], stateMutability: 'nonpayable', type: 'function' }] as const,
    functionName: 'mint',
    args: [user as `0x${string}`, usdcAmount],
  });
  await rpcCall('eth_sendTransaction', [{
    from: DEPLOYER,
    to: ARB_USDC,
    data: mintData,
    gas: '0x100000',
  }]);

  await rpcCall('anvil_impersonateAccount', [user]);
  try {
    // Approve USDC to ArbBridgeCustody
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ARB_CUSTODY as `0x${string}`, usdcAmount],
    });
    await rpcCall('eth_sendTransaction', [{
      from: user,
      to: ARB_USDC,
      data: approveData,
      gas: '0x100000',
    }]);

    // Read crossChainOrderId before placing (this is the next order ID counter)
    const nextIdData = encodeFunctionData({
      abi: ARB_CUSTODY_ABI,
      functionName: 'crossChainOrderId',
      args: [],
    });
    const nextIdResult = await rpcCall('eth_call', [
      { to: ARB_CUSTODY, data: nextIdData },
      'latest',
    ]) as string;
    const orderId = Number(BigInt(nextIdResult));

    // Deadline: 1 hour from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Place buy order
    const buyData = encodeFunctionData({
      abi: ARB_CUSTODY_ABI,
      functionName: 'buyITPFromArbitrum',
      args: [
        itpId as `0x${string}`,
        usdcAmount,
        limitPrice,
        1n, // slippageTier
        deadline,
      ],
    });
    await rpcCall('eth_sendTransaction', [{
      from: user,
      to: ARB_CUSTODY,
      data: buyData,
      gas: '0x200000',
    }]);

    return orderId;
  } finally {
    await rpcCall('anvil_stopImpersonatingAccount', [user]);
  }
}

/**
 * Place a sell order directly on ArbBridgeCustody by impersonating the user.
 * Returns the orderId.
 */
export async function placeSellOrderDirect(
  user: string,
  itpId: string,
  amount: bigint,
  limitPrice: bigint,
): Promise<number> {
  // Fund user with ETH for gas
  await rpcCall('anvil_setBalance', [user, '0x56BC75E2D63100000']); // 100 ETH
  await rpcCall('anvil_impersonateAccount', [user]);
  try {
    // Approve BridgedITP to ArbBridgeCustody
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ARB_CUSTODY as `0x${string}`, amount],
    });
    await rpcCall('eth_sendTransaction', [{
      from: user,
      to: BRIDGED_ITP,
      data: approveData,
      gas: '0x100000',
    }]);

    // Read crossChainOrderId (next sell order ID)
    const nextIdData = encodeFunctionData({
      abi: ARB_CUSTODY_ABI,
      functionName: 'crossChainOrderId',
      args: [],
    });
    const nextIdResult = await rpcCall('eth_call', [
      { to: ARB_CUSTODY, data: nextIdData },
      'latest',
    ]) as string;
    const orderId = Number(BigInt(nextIdResult));

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Place sell order
    const sellData = encodeFunctionData({
      abi: SELL_ABI,
      functionName: 'sellITPFromArbitrum',
      args: [
        itpId as `0x${string}`,
        amount,
        limitPrice,
        1n, // slippageTier
        deadline,
      ],
    });
    await rpcCall('eth_sendTransaction', [{
      from: user,
      to: ARB_CUSTODY,
      data: sellData,
      gas: '0x200000',
    }]);

    return orderId;
  } finally {
    await rpcCall('anvil_stopImpersonatingAccount', [user]);
  }
}

/**
 * Request ITP creation via BridgeProxy by impersonating the user.
 * Uses first 3 assets from ITP-1 with equal weights.
 * Returns the creation nonce.
 */
export async function requestCreateItpDirect(
  user: string,
): Promise<number> {
  // Read nextCreationNonce before placing
  const nonceData = encodeFunctionData({
    abi: BRIDGE_PROXY_ABI,
    functionName: 'nextCreationNonce',
    args: [],
  });
  const nonceResult = await rpcCall('eth_call', [
    { to: BRIDGE_PROXY, data: nonceData },
    'latest',
  ]) as string;
  const nonce = Number(BigInt(nonceResult));

  // Get existing ITP-1 state for asset addresses
  const itpId = '0x0000000000000000000000000000000000000000000000000000000000000001';
  const state = await getItpStateL3(itpId);
  const assets = state.assets.slice(0, 3);

  // Equal weights summing to 1e18
  const w = 1000000000000000000n / 3n; // ~333333333333333333
  const weights = [w, w, 1000000000000000000n - w - w]; // last gets remainder

  // Fetch prices from data-node, fallback to $1 for mock tokens
  let prices: bigint[];
  try {
    const addresses = assets.join(',');
    const priceRes = await fetch(
      `${BACKEND_URL}/fast-prices-by-address?addresses=${addresses}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!priceRes.ok) throw new Error(`${priceRes.status}`);
    const priceJson = await priceRes.json() as {
      prices: Record<string, { price: string; symbol: string }>;
    };
    prices = assets.map(addr => {
      const entry = priceJson.prices[addr.toLowerCase()] ?? priceJson.prices[addr];
      return entry ? BigInt(entry.price) : 1000000000000000000n;
    });
  } catch {
    // Data-node unavailable — use $1 default (mock Bitget tokens on Anvil)
    prices = assets.map(() => 1000000000000000000n);
  }

  // Fund user with ETH for gas
  await rpcCall('anvil_setBalance', [user, '0x56BC75E2D63100000']); // 100 ETH
  await rpcCall('anvil_impersonateAccount', [user]);
  try {
    const createData = encodeFunctionData({
      abi: BRIDGE_PROXY_ABI,
      functionName: 'requestCreateItp',
      args: [
        'Resilience Test',
        'RSLT',
        weights,
        assets as `0x${string}`[],
        prices,
        { description: '', websiteUrl: '', videoUrl: '' },
      ],
    });
    await rpcCall('eth_sendTransaction', [{
      from: user,
      to: BRIDGE_PROXY,
      data: createData,
      gas: '0x400000',
    }]);

    return nonce;
  } finally {
    await rpcCall('anvil_stopImpersonatingAccount', [user]);
  }
}

/**
 * Request rebalance via BridgeProxy (event-only, picked up by issuers).
 * Shifts 0.5% weight between asset[0] and asset[1].
 * Returns the rebalance nonce.
 */
export async function requestRebalanceDirect(
  itpId: string,
): Promise<number> {
  const state = await getItpStateL3(itpId);

  // Compute new weights (same logic as existing rebalanceItp)
  const newWeights = [...state.weights];
  const MIN_WEIGHT = 2500000000000000n;
  const DESIRED_SHIFT = 5000000000000000n;
  const maxShift = newWeights[0] - MIN_WEIGHT;
  const shift = maxShift > 0n ? (maxShift < DESIRED_SHIFT ? maxShift : DESIRED_SHIFT) : 0n;
  if (shift === 0n) {
    const reverseMax = newWeights[1] - MIN_WEIGHT;
    const reverseShift = reverseMax > 0n ? (reverseMax < DESIRED_SHIFT ? reverseMax : DESIRED_SHIFT) : 0n;
    if (reverseShift === 0n) throw new Error('Both assets at minimum weight, cannot rebalance');
    newWeights[1] = newWeights[1] - reverseShift;
    newWeights[0] = newWeights[0] + reverseShift;
  } else {
    newWeights[0] = newWeights[0] - shift;
    newWeights[1] = newWeights[1] + shift;
  }

  // Read nextRebalanceNonce
  // nextRebalanceNonce() selector = keccak256("nextRebalanceNonce()")[:4]
  const nonceSelector = '0x67ea57a3';
  const nonceResult = await rpcCall('eth_call', [
    { to: BRIDGE_PROXY, data: nonceSelector },
    'latest',
  ]) as string;
  const nonce = Number(BigInt(nonceResult));

  const requestCalldata = encodeFunctionData({
    abi: BRIDGE_PROXY_ABI,
    functionName: 'requestRebalance',
    args: [
      itpId as `0x${string}`,
      [],
      [],
      newWeights,
      'resilience test',
    ],
  });

  await rpcCall('eth_sendTransaction', [{
    from: DEPLOYER,
    to: BRIDGE_PROXY,
    data: requestCalldata,
    gas: '0x200000',
  }]);

  return nonce;
}

/**
 * Wait for an order to be filled (status !== 0).
 * Returns the filled order data.
 */
export async function waitForOrderFill(
  orderId: number,
  timeoutMs = 90_000,
): Promise<OrderData> {
  return pollUntil(
    () => getOrder(orderId),
    (order) => order.status !== 0,
    timeoutMs,
    3_000,
  );
}

/**
 * Assert that an order stays pending (status === 0) for the entire duration.
 * Throws if the order status ever changes.
 */
export async function assertOrderNotFilled(
  orderId: number,
  waitMs: number,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < waitMs) {
    try {
      const order = await getOrder(orderId);
      if (order.status !== 0) {
        throw new Error(`Order ${orderId} unexpectedly changed to status ${order.status} after ${Date.now() - start}ms`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('unexpectedly changed')) throw e;
      // Network/parse errors during polling are fine — order might not be indexed yet
    }
    await new Promise(r => setTimeout(r, 2_000));
  }
}

/**
 * Wait for an ERC20 balance to increase above a baseline on Arb Anvil.
 * Used to verify cross-chain order fills when data-node is unavailable.
 */
export async function waitForBalanceIncrease(
  token: string,
  account: string,
  baselineBalance: bigint,
  timeoutMs = 90_000,
): Promise<bigint> {
  return pollUntil(
    async () => BigInt(await erc20BalanceOf(token, account)),
    (balance) => balance > baselineBalance,
    timeoutMs,
    3_000,
  );
}

/**
 * Assert that a balance does NOT change for the entire duration.
 */
export async function assertBalanceUnchanged(
  token: string,
  account: string,
  expectedBalance: bigint,
  waitMs: number,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < waitMs) {
    const current = BigInt(await erc20BalanceOf(token, account));
    if (current !== expectedBalance) {
      throw new Error(`Balance changed unexpectedly: expected ${expectedBalance}, got ${current}`);
    }
    await new Promise(r => setTimeout(r, 2_000));
  }
}

/** Expose erc20BalanceOf and contract addresses for direct use in tests */
export { erc20BalanceOf, BRIDGED_ITP, ARB_USDC };
