/**
 * Backend API helpers for E2E test verification.
 * These call the data-node backend directly to verify on-chain state,
 * rather than relying on the UI's polling which may be stale.
 */

import { encodeFunctionData, decodeFunctionResult, createWalletClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { INDEX_ABI, BRIDGE_PROXY_ABI, ARB_CUSTODY_ABI, ERC20_ABI } from '../../lib/contracts/index-protocol-abi';

const IS_TESTNET = process.env.E2E_TESTNET === '1';
const BACKEND_URL = process.env.E2E_BACKEND_URL || (IS_TESTNET ? 'http://116.203.156.98:8200' : 'http://localhost:8200');
const TEST_PRIVATE_KEY = (process.env.E2E_PRIVATE_KEY || '0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537') as `0x${string}`;

/** Safely parse a hex RPC result to BigInt. Returns 0n for empty/null results. */
function safeBigInt(hex: unknown): bigint {
  if (!hex || hex === '0x' || hex === '0x0') return 0n;
  return BigInt(hex as string);
}

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

const ARB_RPC = process.env.E2E_ARB_RPC_URL || (IS_TESTNET ? 'http://142.132.164.24/' : 'http://localhost:8546');

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
const BRIDGED_ITP_FACTORY = _deployment?.BridgedItpFactory ?? '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1';
/** Deployer account — Anvil #0 locally, real deployer on testnet */
const DEPLOYER = IS_TESTNET ? '0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4' : '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

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
  return (result && result !== '0x') ? BigInt(result).toString() : '0';
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
 * Mint BridgedITP tokens to a user.
 * - Anvil: impersonate BridgeProxy to call BridgedITP.mint() directly
 * - Testnet: not available (BridgedITP.mint is onlyBridgeProxy, requires actual bridge flow)
 */
export async function mintBridgedItp(
  user: string,
  itpId: string,
  amount: bigint,
): Promise<void> {
  if (IS_TESTNET) {
    throw new Error('mintBridgedItp not available on testnet — use actual bridge buy flow instead');
  }

  let bridgedToken = BRIDGED_ITP;
  if (itpId !== '0x0000000000000000000000000000000000000000000000000000000000000001') {
    const addr = await getBridgedItpAddress(itpId);
    if (addr === '0x' + '0'.repeat(40)) {
      throw new Error(`No BridgedITP deployed for itpId ${itpId}`);
    }
    bridgedToken = addr;
  }

  await rpcCall('anvil_setBalance', [BRIDGE_PROXY, '0x56BC75E2D63100000']);
  await rpcCall('anvil_impersonateAccount', [BRIDGE_PROXY]);
  try {
    const userPadded = user.replace('0x', '').toLowerCase().padStart(64, '0');
    const amountHex = amount.toString(16).padStart(64, '0');
    const data = `0x40c10f19${userPadded}${amountHex}`;
    await rpcCall('eth_sendTransaction', [{
      from: BRIDGE_PROXY, to: bridgedToken, data, gas: '0x100000',
    }]);
  } finally {
    await rpcCall('anvil_stopImpersonatingAccount', [BRIDGE_PROXY]);
  }
}

/**
 * Mint L3 ITP shares for a user via anvil_setStorageAt.
 * Sets _userShares[itpId][user] and increases _itps[itpId].totalSupply
 * on the L3 Index contract. Also mints ITP vault ERC20 tokens so that
 * confirmFills can burn them during SELL processing.
 *
 * Storage layout (InvestmentStorage.sol):
 *   _userShares at slot 18: mapping(bytes32 itpId => mapping(address user => uint256))
 *   _itps at slot 5: mapping(bytes32 itpId => ITPCore)
 *     ITPCore.totalSupply is at struct offset 6
 */
export async function mintL3Shares(
  user: string,
  itpId: string,
  amount: bigint,
): Promise<void> {
  if (IS_TESTNET) {
    throw new Error('mintL3Shares not available on testnet — use actual buy flow instead (requires anvil_setStorageAt)');
  }
  // Compute _userShares[itpId][user] storage slot
  // inner = keccak256(abi.encode(itpId, 18))
  const slot18 = '0x' + BigInt(18).toString(16).padStart(64, '0');
  const itpIdPadded = itpId.replace('0x', '').padStart(64, '0');
  const innerInput = '0x' + itpIdPadded + slot18.replace('0x', '');
  const innerSlot = await keccak256Hex(innerInput);
  // final = keccak256(abi.encode(user, innerSlot))
  const userPadded = user.replace('0x', '').toLowerCase().padStart(64, '0');
  const finalInput = '0x' + userPadded + innerSlot.replace('0x', '');
  const shareSlot = await keccak256Hex(finalInput);

  const amountHex = '0x' + amount.toString(16).padStart(64, '0');
  await l3RpcCall('anvil_setStorageAt', [L3_INDEX, shareSlot, amountHex]);

  // Compute _itps[itpId].totalSupply storage slot
  // base = keccak256(abi.encode(itpId, 5))
  const slot5 = '0x' + BigInt(5).toString(16).padStart(64, '0');
  const baseInput = '0x' + itpIdPadded + slot5.replace('0x', '');
  const baseSlot = await keccak256Hex(baseInput);
  const totalSupplySlot = '0x' + (BigInt(baseSlot) + 6n).toString(16).padStart(64, '0');

  // Read current totalSupply and add the new shares
  const currentHex = await l3RpcCall('eth_getStorageAt', [L3_INDEX, totalSupplySlot, 'latest']) as string;
  const current = BigInt(currentHex);
  const newSupply = current + amount;
  const newSupplyHex = '0x' + newSupply.toString(16).padStart(64, '0');
  await l3RpcCall('anvil_setStorageAt', [L3_INDEX, totalSupplySlot, newSupplyHex]);

  // Mint ITP vault ERC20 tokens (required for confirmFills SELL burn)
  // Read vault address via itpVaults(bytes32) on L3 Index
  // itpVaults is at slot 14 in InvestmentStorage
  const slot14 = '0x' + BigInt(14).toString(16).padStart(64, '0');
  const vaultSlotInput = '0x' + itpIdPadded + slot14.replace('0x', '');
  const vaultSlot = await keccak256Hex(vaultSlotInput);
  const vaultHex = await l3RpcCall('eth_getStorageAt', [L3_INDEX, vaultSlot, 'latest']) as string;
  const vaultAddr = '0x' + BigInt(vaultHex).toString(16).padStart(40, '0');

  if (BigInt(vaultHex) !== 0n) {
    // ITP vault has onlyIndex modifier, so impersonate Index contract
    await l3RpcCall('anvil_setBalance', [L3_INDEX, '0x56BC75E2D63100000']); // 100 ETH
    await l3RpcCall('anvil_impersonateAccount', [L3_INDEX]);
    try {
      // mint(address,uint256) selector = 0x40c10f19
      const mintUserPadded = user.replace('0x', '').toLowerCase().padStart(64, '0');
      const mintAmountHex = amount.toString(16).padStart(64, '0');
      const mintData = `0x40c10f19${mintUserPadded}${mintAmountHex}`;
      await l3RpcCall('eth_sendTransaction', [{
        from: L3_INDEX,
        to: vaultAddr,
        data: mintData,
        gas: '0x100000',
      }]);
    } finally {
      await l3RpcCall('anvil_stopImpersonatingAccount', [L3_INDEX]);
    }
  }
}

/**
 * Mint L3_WUSDC (18 decimals) to a user.
 * Test L3_WUSDC allows the deployer to call mint(address,uint256) directly.
 */
export async function mintL3Usdc(
  user: string,
  amount: bigint,
): Promise<void> {
  const userPadded = user.replace('0x', '').toLowerCase().padStart(64, '0');
  const amountHex = amount.toString(16).padStart(64, '0');
  const data = `0x40c10f19${userPadded}${amountHex}`;

  if (IS_TESTNET) {
    await l3SignedSend(L3_WUSDC, data);
  } else {
    await l3RpcCall('eth_sendTransaction', [{
      from: DEPLOYER,
      to: L3_WUSDC,
      data,
      gas: '0x100000',
    }]);
  }
}

/**
 * Read L3 user shares for an ITP via eth_call on L3 Index.
 */
export async function getL3UserShares(user: string, itpId: string): Promise<bigint> {
  const calldata = encodeFunctionData({
    abi: INDEX_ABI,
    functionName: 'getUserShares',
    args: [itpId as `0x${string}`, user as `0x${string}`],
  });
  const result = await l3RpcCall('eth_call', [
    { to: L3_INDEX, data: calldata },
    'latest',
  ]) as string;
  return result && result !== '0x' ? BigInt(result) : 0n;
}

/**
 * Read L3_WUSDC balance for a user via eth_call.
 */
export async function getL3UsdcBalance(user: string): Promise<bigint> {
  const paddedAddr = user.toLowerCase().replace('0x', '').padStart(64, '0');
  const data = `0x70a08231${paddedAddr}`;
  const result = await l3RpcCall('eth_call', [
    { to: L3_WUSDC, data },
    'latest',
  ]) as string;
  return safeBigInt(result);
}

/** Compute keccak256 of hex data using eth RPC (avoids JS crypto dependency) */
async function keccak256Hex(data: string): Promise<string> {
  // Use L3 Anvil's web3_sha3 method
  return await l3RpcCall('web3_sha3', [data]) as string;
}

// ── L3 RPC helpers (rebalance operates on L3 directly) ──────────────────

const L3_RPC = process.env.E2E_L3_RPC_URL || (IS_TESTNET ? 'http://142.132.164.24/' : 'http://localhost:8545');
const L3_INDEX = _deployment?.Index ?? '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6';
const L3_ISSUER_REGISTRY = _deployment?.IssuerRegistry ?? '0x610178dA211FEF7D417bC0e6FeD39F05609AD788';
const L3_WUSDC = _deployment?.L3_WUSDC ?? '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';

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

/**
 * Send a signed transaction on L3 using the deployer private key.
 * Used on testnet where anvil_impersonateAccount is not available.
 */
async function l3SignedSend(to: string, data: string, value?: bigint): Promise<string> {
  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const chain = defineChain({
    id: Number(process.env.E2E_CHAIN_ID || 111222333),
    name: 'Index L3',
    nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
    rpcUrls: { default: { http: [L3_RPC] } },
  });
  const client = createWalletClient({ account, chain, transport: http(L3_RPC) });
  return client.sendTransaction({
    to: to as `0x${string}`,
    data: data as `0x${string}`,
    value,
    gas: 1_000_000n,
  });
}

/**
 * Send a signed transaction on ARB using the deployer private key.
 */
async function arbSignedSend(to: string, data: string, value?: bigint): Promise<string> {
  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const chainId = Number(process.env.E2E_ARB_CHAIN_ID || (IS_TESTNET ? process.env.E2E_CHAIN_ID || 111222333 : 421611337));
  const chain = defineChain({
    id: chainId,
    name: 'Arb',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [ARB_RPC] } },
  });
  const client = createWalletClient({ account, chain, transport: http(ARB_RPC) });
  return client.sendTransaction({
    to: to as `0x${string}`,
    data: data as `0x${string}`,
    value,
    gas: 1_000_000n,
  });
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
  return Number(safeBigInt(result));
}

/**
 * Temporarily clear the aggregated BLS pubkey on L3 IssuerRegistry.
 * Returns the original pubkey bytes for restoration.
 * Used to bypass BLS verification for direct E2E test operations.
 */
async function clearL3AggPubkey(): Promise<string> {
  const currentPubkey = await l3RpcCall('eth_call', [{
    to: L3_ISSUER_REGISTRY,
    data: '0x7004e072',
  }, 'latest']) as string;

  const clearData = '0xb009fd60' +
    '0'.repeat(62) + '20' +
    '0'.repeat(64);

  if (IS_TESTNET) {
    await l3SignedSend(L3_ISSUER_REGISTRY, clearData);
  } else {
    await l3RpcCall('eth_sendTransaction', [{
      from: DEPLOYER,
      to: L3_ISSUER_REGISTRY,
      data: clearData,
      gas: '0x100000',
    }]);
  }

  return currentPubkey;
}

async function restoreL3AggPubkey(encodedPubkey: string): Promise<void> {
  const restoreData = '0xb009fd60' + encodedPubkey.replace('0x', '');

  if (IS_TESTNET) {
    await l3SignedSend(L3_ISSUER_REGISTRY, restoreData);
  } else {
    await l3RpcCall('eth_sendTransaction', [{
      from: DEPLOYER,
      to: L3_ISSUER_REGISTRY,
      data: restoreData,
      gas: '0x100000',
    }]);
  }
}

/**
 * Rebalance an ITP by calling requestRebalance on the L3 Index contract
 * (emits RebalanceRequested event on L3) and waiting for issuers to
 * execute it via BLS consensus.
 * Shifts 0.5% weight from asset[0] to asset[1].
 */
export async function rebalanceItp(itpId: string, timeoutMs = 180_000): Promise<void> {
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

  if (IS_TESTNET) {
    await l3SignedSend(L3_INDEX, calldata);
  } else {
    await l3RpcCall('eth_sendTransaction', [{
      from: DEPLOYER,
      to: L3_INDEX,
      data: calldata,
      gas: '0x200000',
    }]);
  }

  // Wait for issuers to execute the rebalance on L3 (weights change)
  // Rebalance consensus can take 2+ cycles
  await pollUntil(
    () => getItpStateL3(itpId),
    (s) => s.weights[0] !== weightsBefore,
    timeoutMs,
    3_000,
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
  // Mint USDC to user (deployer can call mint on test USDC)
  const mintData = encodeFunctionData({
    abi: [{ inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'mint', outputs: [], stateMutability: 'nonpayable', type: 'function' }] as const,
    functionName: 'mint',
    args: [user as `0x${string}`, usdcAmount],
  });

  // Approve USDC to ArbBridgeCustody
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [ARB_CUSTODY as `0x${string}`, usdcAmount],
  });

  // Read crossChainOrderId before placing
  const nextIdData = encodeFunctionData({
    abi: ARB_CUSTODY_ABI,
    functionName: 'crossChainOrderId',
    args: [],
  });
  const nextIdResult = await rpcCall('eth_call', [
    { to: ARB_CUSTODY, data: nextIdData },
    'latest',
  ]) as string;
  const orderId = Number(safeBigInt(nextIdResult));

  const latestBlock = await rpcCall('eth_getBlockByNumber', ['latest', false]) as { timestamp: string };
  const chainTimestamp = Number(safeBigInt(latestBlock.timestamp));
  const deadline = BigInt(chainTimestamp + 3600);

  const buyData = encodeFunctionData({
    abi: ARB_CUSTODY_ABI,
    functionName: 'buyITPFromArbitrum',
    args: [
      itpId as `0x${string}`,
      usdcAmount,
      limitPrice,
      1n,
      deadline,
    ],
  });

  if (IS_TESTNET) {
    // On testnet: user = deployer, sign all txs
    await arbSignedSend(ARB_USDC, mintData);
    await arbSignedSend(ARB_USDC, approveData);
    await arbSignedSend(ARB_CUSTODY, buyData);
  } else {
    await rpcCall('anvil_setBalance', [user, '0x56BC75E2D63100000']);
    await rpcCall('eth_sendTransaction', [{ from: DEPLOYER, to: ARB_USDC, data: mintData, gas: '0x100000' }]);
    await rpcCall('anvil_impersonateAccount', [user]);
    await rpcCall('eth_sendTransaction', [{ from: user, to: ARB_USDC, data: approveData, gas: '0x100000' }]);
    await rpcCall('eth_sendTransaction', [{ from: user, to: ARB_CUSTODY, data: buyData, gas: '0x200000' }]);
  }

  return orderId;
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
  let bridgedToken = BRIDGED_ITP;
  if (itpId !== '0x0000000000000000000000000000000000000000000000000000000000000001') {
    const addr = await getBridgedItpAddress(itpId);
    if (addr === '0x' + '0'.repeat(40)) {
      throw new Error(`No BridgedITP deployed for itpId ${itpId}`);
    }
    bridgedToken = addr;
  }

  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [ARB_CUSTODY as `0x${string}`, amount],
  });

  const nextIdData = encodeFunctionData({
    abi: ARB_CUSTODY_ABI,
    functionName: 'crossChainOrderId',
    args: [],
  });
  const nextIdResult = await rpcCall('eth_call', [
    { to: ARB_CUSTODY, data: nextIdData },
    'latest',
  ]) as string;
  const orderId = Number(safeBigInt(nextIdResult));

  const latestBlock = await rpcCall('eth_getBlockByNumber', ['latest', false]) as { timestamp: string };
  const chainTimestamp = Number(safeBigInt(latestBlock.timestamp));
  const deadline = BigInt(chainTimestamp + 3600);

  const sellData = encodeFunctionData({
    abi: SELL_ABI,
    functionName: 'sellITPFromArbitrum',
    args: [
      itpId as `0x${string}`,
      amount,
      limitPrice,
      1n,
      deadline,
    ],
  });

  if (IS_TESTNET) {
    await arbSignedSend(bridgedToken, approveData);
    await arbSignedSend(ARB_CUSTODY, sellData);
  } else {
    await rpcCall('anvil_setBalance', [user, '0x56BC75E2D63100000']);
    await rpcCall('anvil_impersonateAccount', [user]);
    const approveTxHash = await rpcCall('eth_sendTransaction', [{ from: user, to: bridgedToken, data: approveData, gas: '0x100000' }]) as string;
    let approveReceipt: { status: string } | null = null;
    for (let i = 0; i < 5; i++) {
      approveReceipt = await rpcCall('eth_getTransactionReceipt', [approveTxHash]) as { status: string } | null;
      if (approveReceipt) break;
      await new Promise(r => setTimeout(r, 500));
    }
    if (!approveReceipt || approveReceipt.status !== '0x1') {
      throw new Error(`BridgedITP approve tx reverted (status=${approveReceipt?.status}): ${approveTxHash}`);
    }
    await rpcCall('anvil_impersonateAccount', [user]);
    const sellTxHash = await rpcCall('eth_sendTransaction', [{ from: user, to: ARB_CUSTODY, data: sellData, gas: '0x200000' }]) as string;
    let sellReceipt: { status: string } | null = null;
    for (let i = 0; i < 5; i++) {
      sellReceipt = await rpcCall('eth_getTransactionReceipt', [sellTxHash]) as { status: string } | null;
      if (sellReceipt) break;
      await new Promise(r => setTimeout(r, 500));
    }
    if (!sellReceipt || sellReceipt.status !== '0x1') {
      throw new Error(`sellITPFromArbitrum tx reverted (status=${sellReceipt?.status}): ${sellTxHash}`);
    }
  }

  return orderId;
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
  const nonce = Number(safeBigInt(nonceResult));

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

  if (IS_TESTNET) {
    await arbSignedSend(BRIDGE_PROXY, createData);
  } else {
    await rpcCall('anvil_setBalance', [user, '0x56BC75E2D63100000']);
    await rpcCall('anvil_impersonateAccount', [user]);
    await rpcCall('eth_sendTransaction', [{
      from: user,
      to: BRIDGE_PROXY,
      data: createData,
      gas: '0x400000',
    }]);
  }

  return nonce;
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
  const nonce = Number(safeBigInt(nonceResult));

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

  if (IS_TESTNET) {
    await arbSignedSend(BRIDGE_PROXY, requestCalldata);
  } else {
    await rpcCall('eth_sendTransaction', [{
      from: DEPLOYER,
      to: BRIDGE_PROXY,
      data: requestCalldata,
      gas: '0x200000',
    }]);
  }

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

/**
 * Mint USDC to a user via Anvil deployer.
 * Test USDC allows the deployer to call mint(address,uint256) directly.
 */
export async function mintUsdc(
  user: string,
  amount: bigint,
): Promise<void> {
  const userPadded = user.replace('0x', '').toLowerCase().padStart(64, '0');
  const amountHex = amount.toString(16).padStart(64, '0');
  const data = `0x40c10f19${userPadded}${amountHex}`;

  if (IS_TESTNET) {
    await arbSignedSend(ARB_USDC, data);
  } else {
    await rpcCall('eth_sendTransaction', [{
      from: DEPLOYER,
      to: ARB_USDC,
      data,
      gas: '0x100000',
    }]);
  }
}

/**
 * Mine empty blocks on Arb Anvil.
 * Issuers require `confirmations` (default: 2) blocks after an event
 * before they consider it confirmed. On Anvil with auto-mine, blocks
 * only advance when txs are submitted, so events may never become
 * "confirmed" without this helper.
 */
export async function mineArbBlocks(count: number): Promise<void> {
  if (IS_TESTNET) return; // Blocks mine naturally on testnet
  await rpcCall('anvil_mine', [`0x${count.toString(16)}`]);
}

/**
 * Start a periodic block miner.
 * On testnet: no-op (blocks mine naturally).
 */
export function startArbBlockMiner(intervalMs = 1000): () => void {
  if (IS_TESTNET) return () => {};
  const timer = setInterval(() => {
    rpcCall('anvil_mine', ['0x1']).catch(() => {});
  }, intervalMs);
  return () => clearInterval(timer);
}

/**
 * Get the BridgedITP address for an ITP ID on Arb via BridgeProxy.orbitToArbitrum().
 * Returns the zero address if no BridgedITP has been deployed for this ITP.
 */
export async function getBridgedItpAddress(itpId: string): Promise<string> {
  const calldata = encodeFunctionData({
    abi: BRIDGE_PROXY_ABI,
    functionName: 'orbitToArbitrum',
    args: [itpId as `0x${string}`],
  });
  const result = await rpcCall('eth_call', [
    { to: BRIDGE_PROXY, data: calldata },
    'latest',
  ]) as string;
  return '0x' + result.slice(26);
}

/**
 * Deploy a BridgedITP for an ITP on Arb Anvil (when test 05 didn't create it).
 * Impersonates BridgeProxy to call BridgedItpFactory.deployBridgedItp(),
 * then sets BridgeProxy storage mappings via anvil_setStorageAt.
 *
 * BridgeProxy storage layout (OZ v5 ERC-7201 + BLSVerifier):
 *   slot 0: BLSVerifier._blsIssuerRegistry
 *   slot 1: issuerRegistry
 *   slot 2: bridgedItpFactory
 *   slot 3: nextCreationNonce
 *   slot 4: _pendingCreations (mapping)
 *   slot 5: orbitToArbitrum (mapping(bytes32 => address))
 *   slot 6: arbitrumToOrbit (mapping(address => bytes32))
 */
export async function deployBridgedItpDirect(
  itpId: string,
  name: string,
  symbol: string,
): Promise<string> {
  // Check if already deployed
  const existing = await getBridgedItpAddress(itpId);
  if (existing !== '0x' + '0'.repeat(40)) {
    return existing;
  }

  if (IS_TESTNET) {
    throw new Error('deployBridgedItpDirect not available on testnet — requires anvil_impersonateAccount + anvil_setStorageAt');
  }

  // Fund BridgeProxy with ETH for gas
  await rpcCall('anvil_setBalance', [BRIDGE_PROXY, '0x56BC75E2D63100000']); // 100 ETH

  // Impersonate BridgeProxy to call factory
  await rpcCall('anvil_impersonateAccount', [BRIDGE_PROXY]);
  try {
    const deployData = encodeFunctionData({
      abi: [{
        name: 'deployBridgedItp',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'orbitItpId', type: 'bytes32' },
        ],
        outputs: [{ name: 'bridgedItp', type: 'address' }],
      }],
      functionName: 'deployBridgedItp',
      args: [name, symbol, itpId as `0x${string}`],
    });

    await rpcCall('eth_sendTransaction', [{
      from: BRIDGE_PROXY,
      to: BRIDGED_ITP_FACTORY,
      data: deployData,
      gas: '0x500000',
    }]);
    await rpcCall('anvil_mine', ['0x1']);
  } finally {
    await rpcCall('anvil_stopImpersonatingAccount', [BRIDGE_PROXY]);
  }

  // Read deployed address from factory.deployedItps(itpId)
  const itpIdPadded = itpId.replace('0x', '').padStart(64, '0');
  const factoryCalldata = '0x8f57752e' + itpIdPadded; // deployedItps(bytes32)
  const factoryResult = await rpcCall('eth_call', [
    { to: BRIDGED_ITP_FACTORY, data: factoryCalldata },
    'latest',
  ]) as string;
  const deployedAddr = '0x' + factoryResult.slice(26);

  if (deployedAddr === '0x' + '0'.repeat(40)) {
    throw new Error('BridgedITP deployment failed — factory returned zero address');
  }

  // Helper: compute keccak256 via Arb Anvil's web3_sha3
  const sha3 = async (data: string) => await rpcCall('web3_sha3', [data]) as string;

  // Set BridgeProxy.orbitToArbitrum[itpId] = deployedAddr (slot 5)
  const slot5Hex = '0x' + BigInt(5).toString(16).padStart(64, '0');
  const mappingInput = '0x' + itpIdPadded + slot5Hex.replace('0x', '');
  const storageSlot = await sha3(mappingInput);
  const addrPadded = '0x' + deployedAddr.replace('0x', '').toLowerCase().padStart(64, '0');
  await rpcCall('anvil_setStorageAt', [BRIDGE_PROXY, storageSlot, addrPadded]);

  // Set BridgeProxy.arbitrumToOrbit[deployedAddr] = itpId (slot 6)
  const slot6Hex = '0x' + BigInt(6).toString(16).padStart(64, '0');
  const addrForMapping = deployedAddr.replace('0x', '').toLowerCase().padStart(64, '0');
  const reverseInput = '0x' + addrForMapping + slot6Hex.replace('0x', '');
  const reverseSlot = await sha3(reverseInput);
  await rpcCall('anvil_setStorageAt', [BRIDGE_PROXY, reverseSlot, itpId]);

  // Verify by reading back
  const verifyAddr = await getBridgedItpAddress(itpId);
  if (verifyAddr.toLowerCase() !== deployedAddr.toLowerCase()) {
    throw new Error(`BridgeProxy.orbitToArbitrum verification failed: expected ${deployedAddr}, got ${verifyAddr} — storage slot may be wrong`);
  }

  return deployedAddr;
}

/** Expose erc20BalanceOf and contract addresses for direct use in tests */
export { erc20BalanceOf, BRIDGED_ITP, ARB_USDC, ARB_CUSTODY, BRIDGE_PROXY, L3_WUSDC };
