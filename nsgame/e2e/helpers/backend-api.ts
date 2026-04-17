/**
 * Backend API helpers for E2E test verification.
 * These call the data-node backend directly to verify on-chain state,
 * rather than relying on the UI's polling which may be stale.
 */

import { encodeFunctionData, decodeFunctionResult, createWalletClient, createPublicClient, http, defineChain, keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { INDEX_ABI, BRIDGE_PROXY_ABI, SETTLEMENT_CUSTODY_ABI, ERC20_ABI } from '../../lib/contracts/index-protocol-abi';
import {
  L3_RPC as ENV_L3_RPC, SETTLEMENT_RPC as ENV_SETTLEMENT_RPC,
  BACKEND_URL as ENV_BACKEND_URL, CHAIN_ID as ENV_CHAIN_ID, SETTLEMENT_CHAIN_ID as ENV_SETTLEMENT_CHAIN_ID,
  DEPLOYER_KEY, CONTRACTS, DEPLOYER_ADDRESS,
  RPC_TIMEOUT, MORPHO_DEPLOYMENT, MORPHO_CONTRACTS, MORPHO_MARKET_PARAMS,
} from '../env';

/** Retry wrapper for flaky network calls (testnet RPCs, backend). */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 2000): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        console.warn(`[withRetry] attempt ${i + 1}/${attempts} failed: ${(err as Error).message}`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

/** Wrap viem http transport to include Accept header (nginx requires it) */
const rpcHttp = (url: string) => http(url, { fetchOptions: { headers: { Accept: 'application/json' } } });
const BACKEND_URL = ENV_BACKEND_URL;
const TEST_PRIVATE_KEY = DEPLOYER_KEY;

/** Safely parse a hex RPC result to BigInt. Returns 0n for empty/null results. */
function safeBigInt(hex: unknown): bigint {
  if (!hex || hex === '0x' || hex === '0x0') return 0n;
  return BigInt(hex as string);
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
  return withRetry(async () => {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    });
    if (!res.ok) throw new Error(`Backend ${path}: ${res.status} ${res.statusText}`);
    return res.json();
  });
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
      headers: { 'Accept': 'application/json' },
    });
    return res.ok;
  } catch {
    // Node.js may not reach the data-node directly (firewall).
    // Fall back to checking the L3 RPC as a proxy for backend health.
    try {
      const res = await fetch(ENV_L3_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
        signal: AbortSignal.timeout(5_000),
      });
      const json = await res.json();
      return !!json.result;
    } catch {
      return false;
    }
  }
}

export async function checkRpc(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json();
    return !!json.result;
  } catch {
    return false;
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

const SETTLEMENT_RPC = ENV_SETTLEMENT_RPC;

const BRIDGED_ITP = CONTRACTS.BridgedITP ?? '';
const SETTLEMENT_USDC = CONTRACTS.SETTLEMENT_USDC ?? '';
const BRIDGE_PROXY = CONTRACTS.BridgeProxy ?? '';
const SETTLEMENT_CUSTODY = CONTRACTS.SettlementBridgeCustody ?? '';
/** Deployer account */
const DEPLOYER = DEPLOYER_ADDRESS;

/** Inline ABI for sellITPFromSettlement */
const SELL_ABI = [
  {
    inputs: [
      { name: 'itpId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
      { name: 'limitPrice', type: 'uint256' },
      { name: 'slippageTier', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'sellITPFromSettlement',
    outputs: [{ name: 'orderId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  return withRetry(async () => {
    const res = await fetch(SETTLEMENT_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
  });
}

/** ERC20 balanceOf via eth_call */
async function erc20BalanceOf(token: string, account: string): Promise<string> {
  // balanceOf(address) selector = 0x70a08231
  const paddedAddr = account.toLowerCase().replace('0x', '').padStart(64, '0');
  const data = `0x70a08231${paddedAddr}`;
  const result = await rpcCall('eth_call', [{ to: token, data }, 'latest']) as string;
  return (result && result !== '0x') ? BigInt(result).toString() : '0';
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

  await l3SignedSend(L3_WUSDC, data);
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

// ── L3 RPC helpers (rebalance operates on L3 directly) ──────────────────

const L3_RPC = ENV_L3_RPC;
const L3_INDEX = CONTRACTS.Index ?? '';
const L3_WUSDC = CONTRACTS.L3_WUSDC ?? '';

export async function l3RpcCall(method: string, params: unknown[]): Promise<unknown> {
  return withRetry(async () => {
    const res = await fetch(L3_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    });
    const json = await res.json();
    if (json.error) throw new Error(`${json.error.message} (data: ${json.error.data ?? 'none'})`);
    return json.result;
  });
}

/** Simple async mutex to prevent parallel nonce conflicts on testnet. */
let _l3NonceLock: Promise<void> = Promise.resolve();
function withL3NonceLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = _l3NonceLock;
  let resolve: () => void;
  _l3NonceLock = new Promise(r => { resolve = r; });
  return prev.then(fn).finally(() => resolve!());
}

/**
 * Singleton L3 chain + clients (reuse across calls for correct nonce tracking).
 */
const _l3Chain = defineChain({
  id: ENV_CHAIN_ID,
  name: 'Index L3',
  nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
  rpcUrls: { default: { http: [L3_RPC] } },
});
const _l3Account = privateKeyToAccount(TEST_PRIVATE_KEY);
const _l3Pub = createPublicClient({ chain: _l3Chain, transport: rpcHttp(L3_RPC) });


/**
 * Send a signed transaction on L3 using the deployer private key.
 * Used on testnet with signed transactions.
 * Uses a mutex + nonce retry to handle nonce conflicts with the browser wallet
 * (which sends txs from the same key via a separate code path).
 */
export async function l3SignedSend(to: string, data: string, value?: bigint): Promise<string> {
  return withL3NonceLock(async () => {
    const account = _l3Account ?? privateKeyToAccount(TEST_PRIVATE_KEY);
    const client = createWalletClient({ account, chain: _l3Chain, transport: rpcHttp(L3_RPC) });

    // Retry up to 3 times on nonce-too-low (browser wallet may have sent txs)
    for (let attempt = 0; attempt < 3; attempt++) {
      const nonce = await _l3Pub.getTransactionCount({ address: account.address, blockTag: 'pending' });
      try {
        const hash = await client.sendTransaction({
          to: to as `0x${string}`,
          data: data as `0x${string}`,
          value,
          gas: 1_000_000n,
          nonce,
        });
        const receipt = await _l3Pub.waitForTransactionReceipt({ hash, timeout: 30_000 });
        if (receipt && (receipt.status === 'reverted' || receipt.status === '0x0')) {
          throw new Error(`Transaction reverted on-chain: ${hash}`);
        }
        return hash;
      } catch (err: any) {
        if (err?.message?.includes('nonce too low') && attempt < 2) {
          console.log(`[l3SignedSend] nonce too low (attempt ${attempt + 1}), retrying...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw err;
      }
    }
    throw new Error('l3SignedSend: max retries exceeded');
  });
}

/** Simple async mutex to prevent parallel nonce conflicts on testnet. */
let _settlementNonceLock: Promise<void> = Promise.resolve();
function withSettlementNonceLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = _settlementNonceLock;
  let resolve: () => void;
  _settlementNonceLock = new Promise(r => { resolve = r; });
  return prev.then(fn).finally(() => resolve!());
}

/**
 * Send a signed transaction on Settlement using the deployer private key.
 * Uses a mutex to prevent parallel nonce conflicts on testnet.
 */
async function settlementSignedSend(to: string, data: string, value?: bigint): Promise<string> {
  return withSettlementNonceLock(async () => {
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const chainId = ENV_SETTLEMENT_CHAIN_ID;
    const chain = defineChain({
      id: chainId,
      name: 'Settlement',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [SETTLEMENT_RPC] } },
    });
    const client = createWalletClient({ account, chain, transport: rpcHttp(SETTLEMENT_RPC) });
    return client.sendTransaction({
      to: to as `0x${string}`,
      data: data as `0x${string}`,
      value,
      gas: 1_000_000n,
    });
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
 * Discover the first available ITP ID on L3 that has assets.
 * Scans ITP IDs 1..itpCount and returns the first with a non-empty asset list.
 * Throws if no valid ITP is found.
 */
export async function getFirstAvailableItpId(): Promise<string> {
  const count = await getItpCountL3();
  for (let i = 1; i <= count; i++) {
    const id = '0x' + i.toString(16).padStart(64, '0');
    try {
      const state = await getItpStateL3(id);
      if (state.assets.length > 0) return id;
    } catch {
      // ITP may not exist at this ID — skip
    }
  }
  throw new Error(`No valid ITP found on L3 (scanned 1..${count})`);
}

/**
 * Discover ITP IDs on L3 that have assets. Returns up to `limit` IDs.
 */
export async function getAvailableItpIds(limit = 5): Promise<string[]> {
  const count = await getItpCountL3();
  const ids: string[] = [];
  for (let i = 1; i <= count && ids.length < limit; i++) {
    const id = '0x' + i.toString(16).padStart(64, '0');
    try {
      const state = await getItpStateL3(id);
      if (state.assets.length > 0) ids.push(id);
    } catch {
      // skip
    }
  }
  return ids;
}

/**
 * Compute the new weight array for a rebalance: shifts 0.5% between asset[0] and asset[1].
 * Exported so callers can inspect the target weights without submitting a TX.
 */
export function computeRebalanceWeights(weights: readonly bigint[]): bigint[] {
  const newWeights = [...weights];
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
  return newWeights;
}

/**
 * Submit a requestRebalance TX on L3 and wait for on-chain confirmation.
 * Does NOT wait for oracle consensus — that is a separate concern.
 * Returns the weights[0] value before the request, and the new weights sent,
 * so callers can later poll for the oracle-driven state change.
 */
export async function submitRebalanceRequest(itpId: string): Promise<{ txHash: string; weightsBefore: bigint; newWeights: bigint[] }> {
  const state = await getItpStateL3(itpId);
  const weightsBefore = state.weights[0];
  const newWeights = computeRebalanceWeights(state.weights);

  // Send requestRebalance to L3 Index (emits RebalanceRequested event).
  // Oracles use DataNodeChainReader which may not forward RebalanceRequested events.
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

  const txHash = await l3SignedSend(L3_INDEX, calldata);
  console.log(`[rebalance] L3 requestRebalance tx: ${txHash}`);
  await new Promise(r => setTimeout(r, 2000));
  const receipt = await l3RpcCall('eth_getTransactionReceipt', [txHash]) as { status: string; logs: unknown[] } | null;
  if (!receipt || receipt.status !== '0x1') {
    throw new Error(`requestRebalance tx reverted: ${txHash} status=${receipt?.status}`);
  }
  console.log(`[rebalance] TX confirmed with ${receipt.logs.length} events`);
  return { txHash, weightsBefore, newWeights };
}

/**
 * Rebalance an ITP by calling requestRebalance on the L3 Index contract
 * (emits RebalanceRequested event on L3) and waiting for oracles to
 * execute it via BLS consensus.
 * Shifts 0.5% weight from asset[0] to asset[1].
 */
export async function rebalanceItp(itpId: string, timeoutMs = 180_000): Promise<void> {
  const { weightsBefore } = await submitRebalanceRequest(itpId);

  // Wait for oracles to execute the rebalance on L3 (weights change)
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
    } catch (err) {
      console.warn(`[pollUntil] ${(err as Error).message}`);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  // One final attempt
  const result = await fn();
  if (predicate(result)) return result;
  throw new Error(`pollUntil timed out after ${timeoutMs}ms`);
}

// ── Direct order placement (via signed transactions) ────────────────────

/**
 * Place a buy order directly on SettlementBridgeCustody by impersonating the user.
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

  // Approve USDC to SettlementBridgeCustody
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [SETTLEMENT_CUSTODY as `0x${string}`, usdcAmount],
  });

  // Read crossChainOrderId before placing
  const nextIdData = encodeFunctionData({
    abi: SETTLEMENT_CUSTODY_ABI,
    functionName: 'crossChainOrderId',
    args: [],
  });
  const nextIdResult = await rpcCall('eth_call', [
    { to: SETTLEMENT_CUSTODY, data: nextIdData },
    'latest',
  ]) as string;
  const orderId = Number(safeBigInt(nextIdResult));

  const latestBlock = await rpcCall('eth_getBlockByNumber', ['latest', false]) as { timestamp: string };
  const chainTimestamp = Number(safeBigInt(latestBlock.timestamp));
  const deadline = BigInt(chainTimestamp + 3600);

  const buyData = encodeFunctionData({
    abi: SETTLEMENT_CUSTODY_ABI,
    functionName: 'buyITPFromSettlement',
    args: [
      itpId as `0x${string}`,
      usdcAmount,
      limitPrice,
      1n,
      deadline,
    ],
  });

  // Sign all txs with deployer key
  await settlementSignedSend(SETTLEMENT_USDC, mintData);
  await settlementSignedSend(SETTLEMENT_USDC, approveData);
  await settlementSignedSend(SETTLEMENT_CUSTODY, buyData);

  return orderId;
}

/**
 * Place a sell order directly on SettlementBridgeCustody by impersonating the user.
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
    args: [SETTLEMENT_CUSTODY as `0x${string}`, amount],
  });

  const nextIdData = encodeFunctionData({
    abi: SETTLEMENT_CUSTODY_ABI,
    functionName: 'crossChainOrderId',
    args: [],
  });
  const nextIdResult = await rpcCall('eth_call', [
    { to: SETTLEMENT_CUSTODY, data: nextIdData },
    'latest',
  ]) as string;
  const orderId = Number(safeBigInt(nextIdResult));

  const latestBlock = await rpcCall('eth_getBlockByNumber', ['latest', false]) as { timestamp: string };
  const chainTimestamp = Number(safeBigInt(latestBlock.timestamp));
  const deadline = BigInt(chainTimestamp + 3600);

  const sellData = encodeFunctionData({
    abi: SELL_ABI,
    functionName: 'sellITPFromSettlement',
    args: [
      itpId as `0x${string}`,
      amount,
      limitPrice,
      1n,
      deadline,
    ],
  });

  await settlementSignedSend(bridgedToken, approveData);
  await settlementSignedSend(SETTLEMENT_CUSTODY, sellData);

  return orderId;
}

/**
 * Check if the deployer has enough native gas on Settlement to send transactions.
 * On testnet (Sonic), the deployer needs S tokens for gas.
 * Returns true if balance >= minBalance (default 0.01 S).
 */
export async function hasSettlementGas(minBalance = 10n ** 16n): Promise<boolean> {
  try {
    const result = await rpcCall('eth_getBalance', [DEPLOYER, 'latest']) as string;
    return safeBigInt(result) >= minBalance;
  } catch {
    return false;
  }
}

/**
 * Place a buy order directly on L3 Index (no bridge needed).
 * Ensures user has L3 USDC, approves Index, then calls submitOrder(side=0).
 * Amount is in L3 USDC (18 decimals). Returns the L3 orderId.
 */
export async function placeL3BuyOrderDirect(
  user: string,
  itpId: string,
  usdcAmount: bigint,
  limitPrice: bigint,
): Promise<number> {
  // Ensure user has enough L3 USDC
  const usdcBalance = await getL3UsdcBalance(user);
  if (usdcBalance < usdcAmount) {
    await mintL3Usdc(user, usdcAmount * 2n);
    // Brief wait for the mint to confirm
    await new Promise(r => setTimeout(r, 2000));
  }

  // Approve max USDC to Index (avoids stale-allowance issues on retries)
  const MAX_UINT256 = 2n ** 256n - 1n;
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [L3_INDEX as `0x${string}`, MAX_UINT256],
  });

  await l3SignedSend(L3_WUSDC, approveData);

  // Read current L3 nextOrderId
  const nextIdData = encodeFunctionData({
    abi: INDEX_ABI,
    functionName: 'nextOrderId',
    args: [],
  });
  const nextIdResult = await l3RpcCall('eth_call', [
    { to: L3_INDEX, data: nextIdData },
    'latest',
  ]) as string;
  const orderId = Number(safeBigInt(nextIdResult));

  // Get L3 block timestamp for deadline
  const latestBlock = await l3RpcCall('eth_getBlockByNumber', ['latest', false]) as { timestamp: string };
  const chainTimestamp = Number(safeBigInt(latestBlock.timestamp));
  const deadline = BigInt(chainTimestamp + 3600);

  const buyData = encodeFunctionData({
    abi: INDEX_ABI,
    functionName: 'submitOrder',
    args: [
      itpId as `0x${string}`,
      0, // BUY
      usdcAmount,
      limitPrice,
      1n, // slippageTier
      deadline,
    ],
  });

  await l3SignedSend(L3_INDEX, buyData);

  return orderId;
}

/**
 * Place a sell order directly on L3 Index (no bridge, no BridgedITP needed).
 * Calls Index.submitOrder(itpId, SELL=1, amount, limitPrice, slippageTier, deadline).
 * User must have L3 ITP shares. Payout is L3 USDC (18 decimals).
 * Returns the L3 orderId.
 */
export async function placeL3SellOrderDirect(
  user: string,
  itpId: string,
  amount: bigint,
  limitPrice: bigint,
): Promise<number> {
  // Read current L3 nextOrderId
  const nextIdData = encodeFunctionData({
    abi: INDEX_ABI,
    functionName: 'nextOrderId',
    args: [],
  });
  const nextIdResult = await l3RpcCall('eth_call', [
    { to: L3_INDEX, data: nextIdData },
    'latest',
  ]) as string;
  const orderId = Number(safeBigInt(nextIdResult));

  // Get L3 block timestamp for deadline
  const latestBlock = await l3RpcCall('eth_getBlockByNumber', ['latest', false]) as { timestamp: string };
  const chainTimestamp = Number(safeBigInt(latestBlock.timestamp));
  const deadline = BigInt(chainTimestamp + 3600);

  const sellData = encodeFunctionData({
    abi: INDEX_ABI,
    functionName: 'submitOrder',
    args: [
      itpId as `0x${string}`,
      1, // SELL
      amount,
      limitPrice,
      1n, // slippageTier
      deadline,
    ],
  });

  await l3SignedSend(L3_INDEX, sellData);

  return orderId;
}

/**
 * Read on-chain order status from L3 Index.
 * Returns: 0=Pending, 1=Processing, 2=Filled, 3=Cancelled, 4=Expired
 */
export async function getL3OrderStatus(orderId: number): Promise<number> {
  // orders(uint256) returns a tuple — status is the last field
  const calldata = encodeFunctionData({
    abi: INDEX_ABI,
    functionName: 'getOrder',
    args: [BigInt(orderId)],
  });
  const result = await l3RpcCall('eth_call', [
    { to: L3_INDEX, data: calldata },
    'latest',
  ]) as string;
  if (!result || result === '0x') return 0;
  // getOrder returns packed struct — last 32 bytes is the status field
  const statusHex = '0x' + result.slice(-64);
  return Number(BigInt(statusHex));
}

/**
 * Request rebalance via BridgeProxy (event-only, picked up by oracles).
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

  await settlementSignedSend(BRIDGE_PROXY, requestCalldata);

  return nonce;
}

/**
 * Get the BridgedITP address for an ITP ID on Settlement via BridgeProxy.orbitToSettlement().
 * Returns the zero address if no BridgedITP has been deployed for this ITP.
 */
export async function getBridgedItpAddress(itpId: string): Promise<string> {
  const calldata = encodeFunctionData({
    abi: BRIDGE_PROXY_ABI,
    functionName: 'orbitToSettlement',
    args: [itpId as `0x${string}`],
  });
  const result = await rpcCall('eth_call', [
    { to: BRIDGE_PROXY, data: calldata },
    'latest',
  ]) as string;
  return '0x' + result.slice(26);
}

/**
 * Deploy a BridgedITP for an ITP on Settlement (when test 05 didn't create it).
 * Calls BridgeProxy.registerExistingItp() via signed tx (onlyOwner).
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

  // Call BridgeProxy.registerExistingItp() via signed tx (onlyOwner)
  const registerData = encodeFunctionData({
    abi: [{
      name: 'registerExistingItp',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'orbitItpId', type: 'bytes32' },
        { name: 'name', type: 'string' },
        { name: 'symbol', type: 'string' },
        { name: 'deployer', type: 'address' },
      ],
      outputs: [{ name: 'bridgedItpAddress', type: 'address' }],
    }],
    functionName: 'registerExistingItp',
    args: [itpId as `0x${string}`, name, symbol, DEPLOYER as `0x${string}`],
  });
  await settlementSignedSend(BRIDGE_PROXY, registerData);
  // Read back the deployed address
  const deployed = await getBridgedItpAddress(itpId);
  if (deployed === '0x' + '0'.repeat(40)) {
    throw new Error('registerExistingItp succeeded but BridgedITP address is still zero');
  }
  return deployed;
}

// ── Morpho collateral token (ITP Vault on L3) ──────────────

export let MORPHO_COLLATERAL = MORPHO_MARKET_PARAMS.collateralToken ?? '';

/**
 * Override the in-memory Morpho deployment config.
 * Used when the on-chain market is stale and the test creates a fresh one.
 * Mutates MORPHO_DEPLOYMENT in place so readMorphoDeployment() returns updated values.
 */
export function overrideMorphoConfig(newConfig: {
  contracts: Record<string, string>;
  marketParams: Record<string, string>;
}) {
  Object.assign(MORPHO_DEPLOYMENT.contracts, newConfig.contracts);
  Object.assign(MORPHO_DEPLOYMENT.marketParams, newConfig.marketParams);
  Object.assign(MORPHO_CONTRACTS, newConfig.contracts);
  Object.assign(MORPHO_MARKET_PARAMS, newConfig.marketParams);
  MORPHO_COLLATERAL = newConfig.marketParams.collateralToken ?? MORPHO_COLLATERAL;
}

/**
 * Check if an address is a valid ERC20 by calling totalSupply().
 * Returns false if the call reverts or the address has no code.
 */
export async function isValidErc20(address: string): Promise<boolean> {
  try {
    // totalSupply() selector = 0x18160ddd
    const result = await l3RpcCall('eth_call', [{ to: address, data: '0x18160ddd' }, 'latest']);
    // A valid response is a 32-byte hex string (0x + 64 chars)
    return typeof result === 'string' && result.length >= 66;
  } catch {
    return false;
  }
}

/**
 * Create a new Morpho market via signed L3 TX.
 * The IRM and LLTV must already be enabled on the Morpho contract.
 * Returns the market ID (bytes32).
 */
export async function createMorphoMarketDirect(
  morphoAddr: string,
  loanToken: string,
  collateralToken: string,
  oracle: string,
  irm: string,
  lltv: bigint,
): Promise<string> {
  const pad = (addr: string) => addr.replace('0x', '').toLowerCase().padStart(64, '0');
  const uint = (v: bigint) => v.toString(16).padStart(64, '0');

  // Compute market ID first to check if it already exists
  const marketId = keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, address, address, address, uint256'),
      [loanToken as `0x${string}`, collateralToken as `0x${string}`, oracle as `0x${string}`, irm as `0x${string}`, lltv],
    ),
  );

  // Check if market already exists (idempotent — safe for repeated test runs)
  const marketIdHex = marketId.replace('0x', '');
  const checkResult = await l3RpcCall('eth_call', [
    { to: morphoAddr, data: '0x5c60e39a' + marketIdHex },
    'latest',
  ]) as string;
  const checkHex = (checkResult || '').slice(2);
  const lastUpdate = checkHex.length >= 320 ? BigInt('0x' + (checkHex.slice(256, 320) || '0')) : 0n;

  if (lastUpdate > 0n) {
    console.log(`Market ${marketId} already exists (lastUpdate=${lastUpdate}) — reusing`);
    return marketId;
  }

  // createMarket((address,address,address,address,uint256)) selector = 0x8c1358a2
  const data = '0x8c1358a2'
    + pad(loanToken)
    + pad(collateralToken)
    + pad(oracle)
    + pad(irm)
    + uint(lltv);

  await l3SignedSend(morphoAddr, data);
  return marketId;
}

/**
 * Supply loan tokens directly to a Morpho market (makes them available for borrowing).
 * Mints tokens, approves Morpho, then calls supply().
 */
export async function supplyToMorphoDirect(
  morphoAddr: string,
  loanToken: string,
  amount: bigint,
  marketParams: { loanToken: string; collateralToken: string; oracle: string; irm: string; lltv: string },
): Promise<void> {
  const pad = (addr: string) => addr.replace('0x', '').toLowerCase().padStart(64, '0');
  const uint = (v: bigint) => v.toString(16).padStart(64, '0');
  const deployer = DEPLOYER_ADDRESS;

  // Mint loan tokens to deployer
  const mintData = '0x40c10f19' + pad(deployer) + uint(amount);
  await l3SignedSend(loanToken, mintData);

  // Approve Morpho to spend loan tokens
  const approveData = '0x095ea7b3' + pad(morphoAddr) + 'f'.repeat(64);
  await l3SignedSend(loanToken, approveData);

  // supply((address,address,address,address,uint256),uint256,uint256,address,bytes) selector = 0xa99aad89
  // supply amount in assets, 0 shares, onBehalf = deployer
  // bytes offset = 9 words * 32 = 0x120 (5 MarketParams + assets + shares + onBehalf + offset pointer)
  const supplyData = '0xa99aad89'
    + pad(marketParams.loanToken)
    + pad(marketParams.collateralToken)
    + pad(marketParams.oracle)
    + pad(marketParams.irm)
    + uint(BigInt(marketParams.lltv))
    + uint(amount)
    + uint(0n) // shares = 0
    + pad(deployer)
    + '120'.padStart(64, '0') // bytes offset
    + '0'.padStart(64, '0'); // bytes length = 0

  await l3SignedSend(morphoAddr, supplyData);
}

/**
 * Mint Morpho collateral tokens (ITP Vault MockERC20) on L3.
 * The MockERC20 has a public mint(address,uint256) function.
 * Works via signed tx with deployer key.
 */
export async function mintMorphoCollateral(
  user: string,
  amount: bigint,
): Promise<void> {
  if (!MORPHO_COLLATERAL) throw new Error('MORPHO_COLLATERAL not found in morpho-deployment.json');
  const userPadded = user.replace('0x', '').toLowerCase().padStart(64, '0');
  const amountHex = amount.toString(16).padStart(64, '0');
  // mint(address,uint256) selector = 0x40c10f19
  const data = `0x40c10f19${userPadded}${amountHex}`;
  await l3SignedSend(MORPHO_COLLATERAL, data);
}

// ── Morpho direct operations (bypass browser wallet) ────────

/** Read full Morpho deployment config — from env.ts (single source of truth) */
export function readMorphoDeployment() {
  return (MORPHO_CONTRACTS.MORPHO) ? MORPHO_DEPLOYMENT : null;
}

/**
 * Withdraw collateral from Morpho directly via signed L3 TX.
 * Bypasses the browser wallet — used for E2E reliability on testnet.
 */
export async function withdrawCollateralDirect(
  user: string,
  amount: bigint,
): Promise<string> {
  const morpho = readMorphoDeployment();
  if (!morpho) throw new Error('morpho-deployment.json not found');

  const mp = morpho.marketParams;
  // withdrawCollateral((address,address,address,address,uint256),uint256,address,address)
  // ABI-encode: marketParams struct (5 fields) + amount + onBehalf + receiver
  const pad = (addr: string) => addr.replace('0x', '').toLowerCase().padStart(64, '0');
  const uint = (v: bigint) => v.toString(16).padStart(64, '0');

  const data = '0x8720316d' // withdrawCollateral selector
    + pad(mp.loanToken)
    + pad(mp.collateralToken)
    + pad(mp.oracle)
    + pad(mp.irm)
    + uint(BigInt(mp.lltv))
    + uint(amount)
    + pad(user)
    + pad(user); // receiver = onBehalf

  return l3SignedSend(morpho.contracts.MORPHO, data);
}

/**
 * Read Morpho position for a user directly from L3 RPC.
 */
export async function getMorphoPositionDirect(user: string): Promise<{ collateral: bigint; borrowShares: bigint }> {
  const morpho = readMorphoDeployment();
  if (!morpho) throw new Error('morpho-deployment.json not found');

  const marketId = morpho.contracts.MARKET_ID.replace('0x', '');
  const userPadded = user.replace('0x', '').toLowerCase().padStart(64, '0');

  // position(bytes32,address) — precomputed selector: 0x93c52062
  const selector = '0x93c52062';

  const result = await l3RpcCall('eth_call', [
    { to: morpho.contracts.MORPHO, data: selector + marketId + userPadded },
    'latest',
  ]) as string;

  // Returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)
  const hex = result.slice(2);
  return {
    borrowShares: BigInt('0x' + (hex.slice(64, 128) || '0')),
    collateral: BigInt('0x' + (hex.slice(128, 192) || '0')),
  };
}

/**
 * Deposit collateral to Morpho directly via signed L3 TX.
 * Approves max UINT256 first, then calls supplyCollateral.
 */
export async function depositCollateralDirect(
  user: string,
  amount: bigint,
): Promise<string> {
  const morpho = readMorphoDeployment();
  if (!morpho) throw new Error('morpho-deployment.json not found');

  const mp = morpho.marketParams;
  const pad = (addr: string) => addr.replace('0x', '').toLowerCase().padStart(64, '0');
  const uint = (v: bigint) => v.toString(16).padStart(64, '0');

  // approve(address spender, uint256 amount)
  const approveData = '0x095ea7b3'
    + pad(morpho.contracts.MORPHO)
    + 'f'.repeat(64); // max uint256
  await l3SignedSend(mp.collateralToken, approveData);

  // supplyCollateral((address,address,address,address,uint256),uint256,address,bytes)
  // selector = 0x238d6579
  // bytes offset = 8 * 32 = 0x100 (5 MarketParams words + amount + onBehalf + offset pointer)
  const data = '0x238d6579'
    + pad(mp.loanToken)
    + pad(mp.collateralToken)
    + pad(mp.oracle)
    + pad(mp.irm)
    + uint(BigInt(mp.lltv))
    + uint(amount)
    + pad(user)
    + '100'.padStart(64, '0') // bytes offset
    + '0'.padStart(64, '0'); // bytes length = 0

  return l3SignedSend(morpho.contracts.MORPHO, data);
}

/**
 * Borrow USDC from Morpho directly via signed L3 TX.
 * Calls Morpho.borrow(marketParams, amount, 0, user, user).
 */
export async function borrowDirect(
  user: string,
  amount: bigint,
): Promise<string> {
  const morpho = readMorphoDeployment();
  if (!morpho) throw new Error('morpho-deployment.json not found');

  const mp = morpho.marketParams;
  const pad = (addr: string) => addr.replace('0x', '').toLowerCase().padStart(64, '0');
  const uint = (v: bigint) => v.toString(16).padStart(64, '0');

  // borrow(MarketParams,uint256,uint256,address,address) selector = 0x50d8cd4b
  const data = '0x50d8cd4b'
    + pad(mp.loanToken)
    + pad(mp.collateralToken)
    + pad(mp.oracle)
    + pad(mp.irm)
    + uint(BigInt(mp.lltv))
    + uint(amount)
    + uint(0n) // shares = 0 (use amount)
    + pad(user)
    + pad(user); // receiver

  return l3SignedSend(morpho.contracts.MORPHO, data);
}

/**
 * Repay borrowed USDC to Morpho directly via signed L3 TX.
 * Approves USDC first, then calls Morpho.repay(marketParams, amount, 0, user, bytes("")).
 */
export async function repayDirect(
  user: string,
  amount: bigint,
): Promise<string> {
  const morpho = readMorphoDeployment();
  if (!morpho) throw new Error('morpho-deployment.json not found');

  const mp = morpho.marketParams;
  const pad = (addr: string) => addr.replace('0x', '').toLowerCase().padStart(64, '0');
  const uint = (v: bigint) => v.toString(16).padStart(64, '0');

  // approve USDC to Morpho
  const approveData = '0x095ea7b3'
    + pad(morpho.contracts.MORPHO)
    + 'f'.repeat(64);
  await l3SignedSend(mp.loanToken, approveData);

  // repay(MarketParams,uint256,uint256,address,bytes) selector = 0x20b76e81
  const data = '0x20b76e81'
    + pad(mp.loanToken)
    + pad(mp.collateralToken)
    + pad(mp.oracle)
    + pad(mp.irm)
    + uint(BigInt(mp.lltv))
    + uint(amount)
    + uint(0n) // shares = 0 (use amount)
    + pad(user)
    + '120'.padStart(64, '0') // bytes offset (9 words × 32 = 0x120)
    + '0'.padStart(64, '0'); // bytes length = 0

  return l3SignedSend(morpho.contracts.MORPHO, data);
}

/** Expose erc20BalanceOf and contract addresses for direct use in tests */
export { erc20BalanceOf, BRIDGED_ITP, SETTLEMENT_USDC, SETTLEMENT_CUSTODY, BRIDGE_PROXY, L3_WUSDC };
