/**
 * Backend API helpers for E2E test verification.
 * These call the data-node backend directly to verify on-chain state,
 * rather than relying on the UI's polling which may be stale.
 */

import { encodeFunctionData, decodeFunctionResult } from 'viem';
import { INDEX_ABI, BRIDGE_PROXY_ABI } from '../../lib/contracts/index-protocol-abi';

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
  return fetchJson<OrderData>(`/order?id=${orderId}`);
}

// ── Direct RPC helpers (fallback when backend endpoints unavailable) ─────

const ARB_RPC = 'http://localhost:8546';
const BRIDGED_ITP = '0x8D308d3D699A85472d874DBDBbffd16bc9fBD856';
const ARB_USDC = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
const BRIDGE_PROXY = '0x59b670e9fA9D0A427751Af201D676719a970857b';
/** Anvil deployer account (auto-accepted for eth_sendTransaction) */
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

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
const L3_INDEX = '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6';
const L3_ISSUER_REGISTRY = '0x610178dA211FEF7D417bC0e6FeD39F05609AD788';

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
 * Rebalance an ITP via bridge: Step 1 = requestRebalance on Arb BridgeProxy,
 * Step 2 = execute rebalance on L3 Index (simulating issuer consensus).
 * Shifts 0.5% weight from asset[0] to asset[1].
 *
 * Temporarily clears the BLS pubkey on L3 to bypass verification,
 * then restores it after the rebalance completes.
 */
export async function rebalanceItp(itpId: string): Promise<void> {
  const state = await getItpStateL3(itpId);

  // Shift weight between asset[0] and asset[1], staying above minimum (2.5e15)
  const newWeights = [...state.weights];
  const MIN_WEIGHT = 2500000000000000n; // 2.5e15 = 0.25%
  const DESIRED_SHIFT = 5000000000000000n; // 5e15 = 0.5%
  // Compute max shift that keeps asset[0] above minimum
  const maxShift = newWeights[0] - MIN_WEIGHT;
  const shift = maxShift > 0n ? (maxShift < DESIRED_SHIFT ? maxShift : DESIRED_SHIFT) : 0n;
  if (shift === 0n) {
    // Can't shift from asset[0] anymore, swap direction
    const reverseMax = newWeights[1] - MIN_WEIGHT;
    const reverseShift = reverseMax > 0n ? (reverseMax < DESIRED_SHIFT ? reverseMax : DESIRED_SHIFT) : 0n;
    if (reverseShift === 0n) throw new Error('Both assets at minimum weight, cannot rebalance');
    newWeights[1] = newWeights[1] - reverseShift;
    newWeights[0] = newWeights[0] + reverseShift;
  } else {
    newWeights[0] = newWeights[0] - shift;
    newWeights[1] = newWeights[1] + shift;
  }

  // ── Step 1: requestRebalance on Arb BridgeProxy ──────────
  const requestCalldata = encodeFunctionData({
    abi: BRIDGE_PROXY_ABI,
    functionName: 'requestRebalance',
    args: [
      itpId as `0x${string}`,
      [],            // removeIndices
      [],            // addAssets
      newWeights,
      'E2E rebalance test',
    ],
  });

  await rpcCall('eth_sendTransaction', [{
    from: DEPLOYER,
    to: BRIDGE_PROXY,
    data: requestCalldata,
    gas: '0x200000', // 2M gas
  }]);

  // ── Step 2: execute rebalance on L3 Index ─────────────────
  // Temporarily clear BLS pubkey to bypass verification (restored after)
  const savedPubkey = await clearL3AggPubkey();

  try {
    // Fetch current prices from data-node
    const addresses = state.assets.join(',');
    const priceRes = await fetch(
      `${BACKEND_URL}/fast-prices-by-address?addresses=${addresses}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!priceRes.ok) throw new Error(`Failed to fetch prices: ${priceRes.status}`);
    const priceJson = await priceRes.json() as {
      prices: Record<string, { price: string; symbol: string }>;
    };

    // Prices from /fast-prices-by-address are already in wei (1e18 scaled)
    const prices: bigint[] = state.assets.map(addr => {
      const entry = priceJson.prices[addr.toLowerCase()] ?? priceJson.prices[addr];
      if (!entry) throw new Error(`No price for asset ${addr} — cannot rebalance with unknown prices`);
      return BigInt(entry.price);
    });

    // Encode Index.rebalance(itpId, [], [], newWeights, prices, 0x)
    const rebalanceCalldata = encodeFunctionData({
      abi: INDEX_ABI,
      functionName: 'rebalance',
      args: [
        itpId as `0x${string}`,
        [],            // removeIndices
        [] as readonly `0x${string}`[], // addAssets
        newWeights,
        prices,
        [] as readonly `0x${string}`[], // quoteTokens
        '0x' as `0x${string}`, // empty BLS signature (pubkey temporarily cleared)
      ],
    });

    const txHash = await l3RpcCall('eth_sendTransaction', [{
      from: DEPLOYER,
      to: L3_INDEX,
      data: rebalanceCalldata,
      gas: '0x500000', // 5M gas (100 assets)
    }]);

    // Verify the tx was mined successfully
    const receipt = await l3RpcCall('eth_getTransactionReceipt', [txHash]) as any;
    if (receipt && receipt.status === '0x0') {
      throw new Error('Rebalance transaction reverted');
    }
  } finally {
    // Always restore BLS pubkey
    await restoreL3AggPubkey(savedPubkey);
  }
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
