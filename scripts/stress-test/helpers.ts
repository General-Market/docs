/**
 * RPC helpers, timing, nonce management, token setup.
 * Mirrors patterns from frontend/e2e/helpers/backend-api.ts.
 *
 * Uses raw ABI encoding (no viem dependency) for portability.
 * All calldata is hand-encoded using function selectors + padded args.
 */

import {
  L3_RPC, ARB_RPC, L3_INDEX, ARB_BRIDGE_PROXY, ARB_USDC,
  DEPLOYER, ANVIL_ACCOUNTS, WEIGHT_SUM,
  Side, OrderStatus,
  BACKEND_URL,
  MorphoConfig,
} from './config';
// ── Types ────────────────────────────────────────────────────────────

export interface TxReceipt {
  transactionHash: string;
  status: string;
  gasUsed: string;
  blockNumber: string;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}

export interface ItpState {
  creator: string;
  totalSupply: bigint;
  nav: bigint;
  assets: string[];
  weights: bigint[];
  inventory: bigint[];
}

export interface OrderData {
  id: bigint;
  user: string;
  pairId: string;
  side: number;
  amount: bigint;
  limitPrice: bigint;
  slippageTier: bigint;
  deadline: bigint;
  itpId: string;
  timestamp: bigint;
  status: number;
}

export interface TimerResult {
  label: string;
  ms: number;
}

// ── Precomputed function selectors (keccak256, via `cast sig`) ───────

const SEL = {
  'getITPState(bytes32)': '7bfb3953',
  'submitOrder(bytes32,uint8,uint256,uint256,uint256,uint256)': 'b61afbdb',
  'getOrder(uint256)': 'd09ef241',
  'nextOrderId()': '2a58b330',
  'createITP(string,string,uint256[],address[],uint256[],uint256)': '6e33917d',
  'getUserShares(bytes32,address)': 'd6df3741',
  'requestCreateItp(string,string,uint256[],address[],uint256[])': '9ff4657b',
  'isPending(uint256)': 'ca8836d2',
  'nextCreationNonce()': '321bb03f',
  'requestRebalance(bytes32,uint256[],address[],uint256[],string)': '60267044',
  'rebalance(bytes32,uint256[],address[],uint256[],uint256[],bytes)': '86614fd7',
  'usdc()': '3e413bee',
  'collateral()': 'd8dfeb45',
  'getItpCount()': '2fa9f978',
  // Morpho selectors (Phase 6)
  'supplyCollateral((address,address,address,address,uint256),uint256,address,bytes)': '238d6579',
  'borrow((address,address,address,address,uint256),uint256,uint256,address,address)': '50d8cd4b',
  'liquidate((address,address,address,address,uint256),address,uint256,uint256,bytes)': 'd8eabcb8',
  'position(bytes32,address)': '93c52062',
  'market(bytes32)': '5c60e39a',
  'setPrice(uint256)': '91b7f5ed',
  'pendingOrderCount()': '34e47714',
  'failedFillEscrow(uint256)': '6c1f3e62',
} as const;

// Precomputed event topic hashes (keccak256 of event signatures, via `cast keccak`)
export const EVENT_TOPICS = {
  AssetTradeRequest: '0x655b132997dc915177708589329ff12dc2e2bf9b3838951039d725f56a87971f',
  TradeRequest: '0xce1d92007c417e020617618635f2cb188a383de2632e89e67197ccff2776360a',
  // Phase 6 event topics
  OrderSubmitted: '0x8b649e198a5f1e1b898d8bda4b33418a16371812f8561492397ac812f8715e82',
  FillConfirmed: '0x08e6463ea6e0bfaab8f937a60bb73528d67669e7209e068d47a0bdb8d843c0a9',
  ITPCreated: '0xbba0667c6402e9f70353f0de36efd24ce36369adf198a25d85e2af3f619f09c9',
  Rebalanced: '0x91863210e2a8aec70b1badf4ca60fb7bc344247e15f5f5598333d1516b0939dd',
  FeeCharged: '0xf51bfdad998553937d6f2cc65b0cc422ae3c90a66827b9b2d8344a76a3320107',
} as const;

function sel(sig: string): string {
  const s = SEL[sig as keyof typeof SEL];
  if (!s) throw new Error(`Unknown function selector: ${sig}`);
  return s;
}

function pad32(hex: string): string {
  return hex.replace('0x', '').padStart(64, '0');
}

function padAddr(addr: string): string {
  return addr.replace('0x', '').toLowerCase().padStart(64, '0');
}

function padUint(val: bigint | number): string {
  return BigInt(val).toString(16).padStart(64, '0');
}

/** Encode a uint256[] as ABI dynamic array (offset + length + elements). */
function encodeUint256Array(arr: bigint[]): string {
  let out = padUint(arr.length);
  for (const v of arr) out += padUint(v);
  return out;
}

/** Encode an address[] as ABI dynamic array. */
function encodeAddressArray(arr: string[]): string {
  let out = padUint(arr.length);
  for (const a of arr) out += padAddr(a);
  return out;
}

/** Encode a string as ABI bytes (length-prefixed, right-padded to 32). */
function encodeString(s: string): string {
  const utf8 = Buffer.from(s, 'utf8');
  const len = padUint(utf8.length);
  const hex = utf8.toString('hex');
  const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
  return len + padded;
}

/** Decode a uint256 from a 64-char hex chunk. */
function decodeUint(hex: string): bigint {
  return BigInt('0x' + hex);
}

/** Decode an address from a 64-char hex chunk. */
function decodeAddr(hex: string): string {
  return '0x' + hex.slice(24);
}

/** Decode a dynamic array of uint256 from ABI data starting at a word offset. */
function decodeUint256Array(data: string, wordOffset: number): bigint[] {
  const dataOffset = Number(decodeUint(data.slice(wordOffset * 64, wordOffset * 64 + 64)));
  const arrayStart = dataOffset * 2; // offset is in bytes, data is hex
  const length = Number(decodeUint(data.slice(arrayStart, arrayStart + 64)));
  const result: bigint[] = [];
  for (let i = 0; i < length; i++) {
    result.push(decodeUint(data.slice(arrayStart + 64 + i * 64, arrayStart + 64 + (i + 1) * 64)));
  }
  return result;
}

/** Decode a dynamic array of addresses from ABI data starting at a word offset. */
function decodeAddressArray(data: string, wordOffset: number): string[] {
  const dataOffset = Number(decodeUint(data.slice(wordOffset * 64, wordOffset * 64 + 64)));
  const arrayStart = dataOffset * 2;
  const length = Number(decodeUint(data.slice(arrayStart, arrayStart + 64)));
  const result: string[] = [];
  for (let i = 0; i < length; i++) {
    result.push(decodeAddr(data.slice(arrayStart + 64 + i * 64, arrayStart + 64 + (i + 1) * 64)));
  }
  return result;
}

// ── Raw RPC ──────────────────────────────────────────────────────────

let rpcIdCounter = 1;

export async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcIdCounter++, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const json = await res.json() as any;
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message} (data: ${json.error.data ?? 'none'})`);
  return json.result;
}

export const l3Rpc = (method: string, params: unknown[]) => rpcCall(L3_RPC, method, params);
export const arbRpc = (method: string, params: unknown[]) => rpcCall(ARB_RPC, method, params);

// ── Nonce management ─────────────────────────────────────────────────

/** Per-account nonce tracker: key = `${rpcUrl}:${from.toLowerCase()}` */
const _nonceMap = new Map<string, number>();
const _nonceLocks = new Map<string, Promise<void>>();

async function getAndIncrementNonce(rpcUrl: string, from: string): Promise<string> {
  const key = `${rpcUrl}:${from.toLowerCase()}`;

  // Serialize nonce access per account to prevent races
  while (_nonceLocks.has(key)) {
    await _nonceLocks.get(key);
  }

  let resolve: () => void;
  _nonceLocks.set(key, new Promise<void>(r => { resolve = r; }));

  try {
    let nonce = _nonceMap.get(key);
    if (nonce === undefined) {
      const result = await rpcCall(rpcUrl, 'eth_getTransactionCount', [from, 'pending']) as string;
      nonce = Number(BigInt(result));
    }
    _nonceMap.set(key, nonce + 1);
    return '0x' + nonce.toString(16);
  } finally {
    _nonceLocks.delete(key);
    resolve!();
  }
}

/** Reset nonce cache for an account (call after errors or when nonce gets out of sync). */
export function resetNonce(rpcUrl: string, from: string): void {
  _nonceMap.delete(`${rpcUrl}:${from.toLowerCase()}`);
}

/** Reset all cached nonces. */
export function resetAllNonces(): void {
  _nonceMap.clear();
}

// ── Transaction helpers ──────────────────────────────────────────────

export async function sendTx(
  rpcUrl: string,
  to: string,
  data: string,
  from: string = DEPLOYER,
  gas: string = '0x500000',
  retries: number = 3,
): Promise<TxReceipt> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const nonce = await getAndIncrementNonce(rpcUrl, from);
    try {
      const txHash = await rpcCall(rpcUrl, 'eth_sendTransaction', [{
        from, to, data, gas, nonce,
      }]) as string;
      return await waitForReceipt(rpcUrl, txHash, 60_000);
    } catch (err: any) {
      const msg = err.message || '';
      if ((msg.includes('nonce too low') || msg.includes('replacement transaction underpriced') || msg.includes('Receipt timeout')) && attempt < retries - 1) {
        // Nonce was stale or receipt timed out — reset cache and retry
        resetNonce(rpcUrl, from);
        continue;
      }
      throw err;
    }
  }
  throw new Error('sendTx: max retries exceeded');
}

export async function waitForReceipt(rpcUrl: string, txHash: string, timeoutMs = 30_000): Promise<TxReceipt> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await rpcCall(rpcUrl, 'eth_getTransactionReceipt', [txHash]) as TxReceipt | null;
    if (receipt) {
      if (receipt.status === '0x0') {
        throw new Error(`Transaction reverted: ${txHash}`);
      }
      return receipt;
    }
    await sleep(200);
  }
  throw new Error(`Receipt timeout for ${txHash}`);
}

/** Send multiple txs concurrently with proper nonce management. */
export async function batchSendTx(
  rpcUrl: string,
  txs: Array<{ to: string; data: string; from?: string; gas?: string }>,
): Promise<TxReceipt[]> {
  return Promise.all(txs.map(tx =>
    sendTx(rpcUrl, tx.to, tx.data, tx.from ?? DEPLOYER, tx.gas ?? '0x500000')
  ));
}

// ── ERC20 helpers (raw selectors) ────────────────────────────────────

// balanceOf(address) = 0x70a08231
// mint(address,uint256) = 0x40c10f19
// approve(address,uint256) = 0x095ea7b3

export async function erc20BalanceOf(rpcUrl: string, token: string, account: string): Promise<bigint> {
  const data = `0x70a08231${padAddr(account)}`;
  const result = await rpcCall(rpcUrl, 'eth_call', [{ to: token, data }, 'latest']) as string;
  return BigInt(result);
}

export async function mintErc20(
  rpcUrl: string, token: string, to: string, amount: bigint, from: string = DEPLOYER,
): Promise<TxReceipt> {
  const data = `0x40c10f19${padAddr(to)}${padUint(amount)}`;
  return sendTx(rpcUrl, token, data, from);
}

export async function approveErc20(
  rpcUrl: string, token: string, spender: string, amount: bigint, from: string = DEPLOYER,
): Promise<TxReceipt> {
  const data = `0x095ea7b3${padAddr(spender)}${padUint(amount)}`;
  return sendTx(rpcUrl, token, data, from);
}

// ── Token deployment (via forge) ─────────────────────────────────────

export async function deployMockToken(
  name: string,
  symbol: string,
  decimals: number = 18,
): Promise<string> {
  const { execSync } = await import('child_process');
  const projectRoot = new URL('../../', import.meta.url).pathname;
  const result = execSync(
    `cd "${projectRoot}/contracts" && forge create --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 ` +
    `--rpc-url ${L3_RPC} src/mocks/MockERC20.sol:MockERC20 ` +
    `--constructor-args "${name}" "${symbol}" ${decimals} 2>&1`,
    { encoding: 'utf8' },
  );
  // Parse "Deployed to: 0x..." from text output
  const match = result.match(/Deployed to:\s*(0x[0-9a-fA-F]{40})/);
  if (!match) throw new Error(`Failed to parse forge output: ${result.slice(0, 200)}`);
  return match[1];
}

// ── ITP helpers ──────────────────────────────────────────────────────

/**
 * getITPState(bytes32 itpId) → (address creator, uint256 totalSupply, uint256 nav, address[] assets, uint256[] weights, uint256[] inventory)
 * Selector: we compute it from the signature.
 */
export async function getItpState(itpId: string): Promise<ItpState> {
  const data = `0x${sel('getITPState(bytes32)')}${pad32(itpId)}`;
  const result = await l3Rpc('eth_call', [{ to: L3_INDEX, data }, 'latest']) as string;
  const hex = result.replace('0x', '');

  // Return layout: (address, uint256, uint256, address[], uint256[], uint256[])
  // Static slots: creator(0), totalSupply(1), nav(2), assets_offset(3), weights_offset(4), inventory_offset(5)
  return {
    creator: decodeAddr(hex.slice(0, 64)),
    totalSupply: decodeUint(hex.slice(64, 128)),
    nav: decodeUint(hex.slice(128, 192)),
    assets: decodeAddressArray(hex, 3),
    weights: decodeUint256Array(hex, 4),
    inventory: decodeUint256Array(hex, 5),
  };
}

/** getItpCount() → uint256. Selector: 0x2fa9f978 */
export async function getItpCount(): Promise<number> {
  const result = await l3Rpc('eth_call', [{ to: L3_INDEX, data: '0x2fa9f978' }, 'latest']) as string;
  return Number(BigInt(result));
}

export async function getNextOrderId(): Promise<number> {
  const data = `0x${sel('nextOrderId()')}`;
  const result = await l3Rpc('eth_call', [{ to: L3_INDEX, data }, 'latest']) as string;
  return Number(BigInt(result));
}

/**
 * createITP(string,string,uint256[],address[],uint256[],uint256) → bytes32
 * Complex dynamic encoding: 6 params, 3 dynamic (string, string, arrays).
 */
export async function createItpDirect(
  name: string,
  symbol: string,
  weights: bigint[],
  assets: string[],
  prices: bigint[],
  bridgeNonce: bigint = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),
): Promise<{ receipt: TxReceipt; itpId: string }> {
  const fnSel = sel('createITP(string,string,uint256[],address[],uint256[],uint256)');

  // All 6 params: first 6 words are either values or offsets
  // Param layout: name(dynamic), symbol(dynamic), weights(dynamic), assets(dynamic), prices(dynamic), bridgeNonce(static)
  // Head: 6 words of offsets/values, then tail with actual dynamic data
  let currentOffset = 6 * 32; // start after 6 head words (in bytes)

  // Param 0: name (dynamic → offset)
  const nameEncoded = encodeString(name);
  const nameOffset = padUint(currentOffset);
  currentOffset += (nameEncoded.length / 2); // bytes

  // Param 1: symbol (dynamic → offset)
  const symbolEncoded = encodeString(symbol);
  const symbolOffset = padUint(currentOffset);
  currentOffset += (symbolEncoded.length / 2);

  // Param 2: weights (dynamic → offset)
  const weightsEncoded = encodeUint256Array(weights);
  const weightsOffset = padUint(currentOffset);
  currentOffset += (weightsEncoded.length / 2);

  // Param 3: assets (dynamic → offset)
  const assetsEncoded = encodeAddressArray(assets);
  const assetsOffset = padUint(currentOffset);
  currentOffset += (assetsEncoded.length / 2);

  // Param 4: prices (dynamic → offset)
  const pricesEncoded = encodeUint256Array(prices);
  const pricesOffset = padUint(currentOffset);

  // Param 5: bridgeNonce (static)
  const nonceEncoded = padUint(bridgeNonce);

  const calldata = `0x${fnSel}${nameOffset}${symbolOffset}${weightsOffset}${assetsOffset}${pricesOffset}${nonceEncoded}${nameEncoded}${symbolEncoded}${weightsEncoded}${assetsEncoded}${pricesEncoded}`;

  // Gas scales with asset count: ~200k base + ~200k per asset, capped at 29M (block limit = 30M)
  const gasEstimate = Math.min(200_000 + assets.length * 200_000, 29_000_000);
  const receipt = await sendTx(L3_RPC, L3_INDEX, calldata, DEPLOYER, '0x' + gasEstimate.toString(16));
  const count = await getItpCount();
  const itpId = '0x' + count.toString(16).padStart(64, '0');
  return { receipt, itpId };
}

/**
 * submitOrder(bytes32,uint8,uint256,uint256,uint256,uint256) → uint256
 * All static types — straightforward encoding.
 */
export async function submitOrder(
  itpId: string,
  side: number,
  amount: bigint,
  limitPrice: bigint,
  slippageTier: bigint = 0n,
  deadline?: bigint,
  from: string = DEPLOYER,
): Promise<{ receipt: TxReceipt; orderId: number }> {
  const nextId = await getNextOrderId();

  if (!deadline) {
    const blockNum = await l3Rpc('eth_blockNumber', []) as string;
    const block = await l3Rpc('eth_getBlockByNumber', [blockNum, false]) as any;
    deadline = BigInt(block.timestamp) + 3600n;
  }

  const fnSel = sel('submitOrder(bytes32,uint8,uint256,uint256,uint256,uint256)');
  const calldata = `0x${fnSel}${pad32(itpId)}${padUint(side)}${padUint(amount)}${padUint(limitPrice)}${padUint(slippageTier)}${padUint(deadline)}`;

  const receipt = await sendTx(L3_RPC, L3_INDEX, calldata, from);
  return { receipt, orderId: nextId };
}

/**
 * getOrder(uint256) → LimitOrder tuple
 * Returns: (id, user, pairId, side, amount, limitPrice, slippageTier, deadline, itpId, timestamp, status)
 */
export async function getOrder(orderId: number): Promise<OrderData> {
  const fnSel = sel('getOrder(uint256)');
  const data = `0x${fnSel}${padUint(orderId)}`;
  const result = await l3Rpc('eth_call', [{ to: L3_INDEX, data }, 'latest']) as string;
  const hex = result.replace('0x', '');

  // Tuple is returned as 11 consecutive static words
  return {
    id: decodeUint(hex.slice(0, 64)),
    user: decodeAddr(hex.slice(64, 128)),
    pairId: '0x' + hex.slice(128, 192),
    side: Number(decodeUint(hex.slice(192, 256))),
    amount: decodeUint(hex.slice(256, 320)),
    limitPrice: decodeUint(hex.slice(320, 384)),
    slippageTier: decodeUint(hex.slice(384, 448)),
    deadline: decodeUint(hex.slice(448, 512)),
    itpId: '0x' + hex.slice(512, 576),
    timestamp: decodeUint(hex.slice(576, 640)),
    status: Number(decodeUint(hex.slice(640, 704))),
  };
}

/** Poll until order reaches target status. */
export async function pollOrderStatus(
  orderId: number,
  targetStatus: number,
  timeoutMs = 120_000,
  intervalMs = 2_000,
): Promise<OrderData> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const order = await getOrder(orderId);
    if (order.status >= targetStatus) return order;
    await sleep(intervalMs);
  }
  const finalOrder = await getOrder(orderId);
  if (finalOrder.status >= targetStatus) return finalOrder;
  throw new Error(`Order ${orderId} did not reach status ${targetStatus} within ${timeoutMs}ms (current: ${finalOrder.status})`);
}

/** Mint ITP shares via BridgeProxy.mintBridgedShares (BLS bypassed on Anvil). */
export async function mintItpShares(
  itpId: string, user: string, amount: bigint,
): Promise<TxReceipt> {
  // mintBridgedShares(bytes32,address,uint256,bytes)
  const sel = '5185e53a';
  const bytesOffset = padUint(4 * 32); // 0x80
  const bytesLength = padUint(0);
  const data = `0x${sel}${pad32(itpId)}${padAddr(user)}${padUint(amount)}${bytesOffset}${bytesLength}`;
  return sendTx(ARB_RPC, ARB_BRIDGE_PROXY, data, DEPLOYER, '0x200000');
}

/** Fund a test account with L3 USDC and approve Index contract. */
export async function fundAccountUsdc(
  account: string,
  amount: bigint,
  rpcUrl: string = L3_RPC,
  usdcAddress?: string,
  spender: string = L3_INDEX,
): Promise<void> {
  const usdc = usdcAddress ?? await getL3Usdc();
  await mintErc20(rpcUrl, usdc, account, amount);
  await approveErc20(rpcUrl, usdc, spender, amount, account);
}

/** Get L3 USDC address from Index contract. usdc() → address. */
let _l3UsdcCache: string | null = null;
export async function getL3Usdc(): Promise<string> {
  if (_l3UsdcCache) return _l3UsdcCache;
  // Try "usdc()" selector
  const sel1 = '0x' + sel('usdc()');
  try {
    const result = await l3Rpc('eth_call', [{ to: L3_INDEX, data: sel1 }, 'latest']) as string;
    if (result && result !== '0x' && BigInt(result) !== 0n) {
      _l3UsdcCache = '0x' + result.replace('0x', '').slice(-40);
      return _l3UsdcCache;
    }
  } catch {}
  // Try "collateral()" selector
  const sel2 = '0x' + sel('collateral()');
  try {
    const result = await l3Rpc('eth_call', [{ to: L3_INDEX, data: sel2 }, 'latest']) as string;
    if (result && result !== '0x' && BigInt(result) !== 0n) {
      _l3UsdcCache = '0x' + result.replace('0x', '').slice(-40);
      return _l3UsdcCache;
    }
  } catch {}
  throw new Error('Could not read L3 USDC/collateral address from Index contract');
}

/** getUserShares(bytes32,address) → uint256 */
export async function getUserShares(itpId: string, user: string): Promise<bigint> {
  const fnSel = sel('getUserShares(bytes32,address)');
  const data = `0x${fnSel}${pad32(itpId)}${padAddr(user)}`;
  const result = await l3Rpc('eth_call', [{ to: L3_INDEX, data }, 'latest']) as string;
  return BigInt(result);
}

/** requestCreateItp(string,string,uint256[],address[],uint256[]) on BridgeProxy */
export async function requestCreateItp(
  name: string, symbol: string, weights: bigint[], assets: string[], prices: bigint[],
  from: string = DEPLOYER,
): Promise<TxReceipt> {
  const fnSel = sel('requestCreateItp(string,string,uint256[],address[],uint256[])');

  // 5 dynamic params — all offsets
  let currentOffset = 5 * 32;

  const nameEnc = encodeString(name);
  const nameOff = padUint(currentOffset);
  currentOffset += nameEnc.length / 2;

  const symbolEnc = encodeString(symbol);
  const symbolOff = padUint(currentOffset);
  currentOffset += symbolEnc.length / 2;

  const weightsEnc = encodeUint256Array(weights);
  const weightsOff = padUint(currentOffset);
  currentOffset += weightsEnc.length / 2;

  const assetsEnc = encodeAddressArray(assets);
  const assetsOff = padUint(currentOffset);
  currentOffset += assetsEnc.length / 2;

  const pricesEnc = encodeUint256Array(prices);
  const pricesOff = padUint(currentOffset);

  const calldata = `0x${fnSel}${nameOff}${symbolOff}${weightsOff}${assetsOff}${pricesOff}${nameEnc}${symbolEnc}${weightsEnc}${assetsEnc}${pricesEnc}`;
  return sendTx(ARB_RPC, ARB_BRIDGE_PROXY, calldata, from, '0x500000');
}

/** isPending(uint256) → bool on BridgeProxy */
export async function isPending(nonce: bigint): Promise<boolean> {
  const fnSel = sel('isPending(uint256)');
  const data = `0x${fnSel}${padUint(nonce)}`;
  const result = await arbRpc('eth_call', [{ to: ARB_BRIDGE_PROXY, data }, 'latest']) as string;
  return BigInt(result) !== 0n;
}

/** nextCreationNonce() → uint256 on BridgeProxy */
export async function getNextCreationNonce(): Promise<bigint> {
  const fnSel = sel('nextCreationNonce()');
  const data = `0x${fnSel}`;
  const result = await arbRpc('eth_call', [{ to: ARB_BRIDGE_PROXY, data }, 'latest']) as string;
  return BigInt(result);
}

/** requestRebalance(bytes32,uint256[],address[],uint256[],string) on BridgeProxy */
export async function requestRebalance(
  itpId: string, newWeights: bigint[], note: string = 'stress-test rebalance',
  from: string = DEPLOYER,
): Promise<TxReceipt> {
  const fnSel = sel('requestRebalance(bytes32,uint256[],address[],uint256[],string)');

  // 5 params: itpId(static), removeIndices(dynamic), addAssets(dynamic), newWeights(dynamic), note(dynamic)
  let currentOffset = 5 * 32;

  const itpIdEnc = pad32(itpId);

  // removeIndices = empty uint256[]
  const removeEnc = encodeUint256Array([]);
  const removeOff = padUint(currentOffset);
  currentOffset += removeEnc.length / 2;

  // addAssets = empty address[]
  const addEnc = encodeAddressArray([]);
  const addOff = padUint(currentOffset);
  currentOffset += addEnc.length / 2;

  // newWeights
  const weightsEnc = encodeUint256Array(newWeights);
  const weightsOff = padUint(currentOffset);
  currentOffset += weightsEnc.length / 2;

  // note
  const noteEnc = encodeString(note);
  const noteOff = padUint(currentOffset);

  const calldata = `0x${fnSel}${itpIdEnc}${removeOff}${addOff}${weightsOff}${noteOff}${removeEnc}${addEnc}${weightsEnc}${noteEnc}`;
  // Gas scales with weight count: base ~500k + ~30k per weight entry
  const gasNeeded = Math.min(500_000 + newWeights.length * 30_000, 29_000_000);
  return sendTx(ARB_RPC, ARB_BRIDGE_PROXY, calldata, from, '0x' + gasNeeded.toString(16));
}

/** rebalance(bytes32,uint256[],address[],uint256[],uint256[],bytes) on L3 Index */
export async function executeRebalance(
  itpId: string, newWeights: bigint[], prices: bigint[],
): Promise<TxReceipt> {
  const fnSel = sel('rebalance(bytes32,uint256[],address[],uint256[],uint256[],bytes)');

  // 6 params: itpId(static), removeIndices(dynamic), addAssets(dynamic), newWeights(dynamic), prices(dynamic), blsSignature(dynamic)
  let currentOffset = 6 * 32;

  const itpIdEnc = pad32(itpId);

  const removeEnc = encodeUint256Array([]);
  const removeOff = padUint(currentOffset);
  currentOffset += removeEnc.length / 2;

  const addEnc = encodeAddressArray([]);
  const addOff = padUint(currentOffset);
  currentOffset += addEnc.length / 2;

  const weightsEnc = encodeUint256Array(newWeights);
  const weightsOff = padUint(currentOffset);
  currentOffset += weightsEnc.length / 2;

  const pricesEnc = encodeUint256Array(prices);
  const pricesOff = padUint(currentOffset);
  currentOffset += pricesEnc.length / 2;

  // Empty bytes for BLS signature
  const blsEnc = padUint(0); // length = 0
  const blsOff = padUint(currentOffset);

  const calldata = `0x${fnSel}${itpIdEnc}${removeOff}${addOff}${weightsOff}${pricesOff}${blsOff}${removeEnc}${addEnc}${weightsEnc}${pricesEnc}${blsEnc}`;
  return sendTx(L3_RPC, L3_INDEX, calldata, DEPLOYER, '0x500000');
}

/** Fetch prices from the data-node backend. */
export async function fetchPrices(assets: string[]): Promise<bigint[]> {
  const addresses = assets.join(',');
  const res = await fetch(
    `${BACKEND_URL}/fast-prices-by-address?addresses=${addresses}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) throw new Error(`Failed to fetch prices: ${res.status}`);
  const json = await res.json() as {
    prices: Record<string, { price: string; symbol: string }>;
  };
  return assets.map(addr => {
    const entry = json.prices[addr.toLowerCase()] ?? json.prices[addr];
    if (!entry) return 10n ** 18n;
    return BigInt(entry.price);
  });
}

/** Read on-chain event logs. */
export async function getLogs(
  rpcUrl: string,
  address: string,
  topics: (string | null)[],
  fromBlock: string = '0x0',
  toBlock: string = 'latest',
): Promise<Array<{ topics: string[]; data: string; transactionHash: string; logIndex: string; blockNumber: string }>> {
  return await rpcCall(rpcUrl, 'eth_getLogs', [{
    address, topics, fromBlock, toBlock,
  }]) as any[];
}

/** Get current block number. */
export async function getBlockNumber(rpcUrl: string): Promise<number> {
  const result = await rpcCall(rpcUrl, 'eth_blockNumber', []) as string;
  return Number(BigInt(result));
}

// ── Timing ───────────────────────────────────────────────────────────

export function timer(label: string): { stop: () => TimerResult } {
  const start = performance.now();
  return {
    stop: () => {
      const ms = performance.now() - start;
      return { label, ms };
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Polling ──────────────────────────────────────────────────────────

export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  timeoutMs = 90_000,
  intervalMs = 2_000,
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await fn();
      if (predicate(result)) return result;
    } catch { /* retry */ }
    await sleep(intervalMs);
  }
  const result = await fn();
  if (predicate(result)) return result;
  throw new Error(`pollUntil timed out after ${timeoutMs}ms`);
}

// ── Logging ──────────────────────────────────────────────────────────

export let verbose = false;
export function setVerbose(v: boolean) { verbose = v; }

export function log(msg: string) {
  console.log(`  ${msg}`);
}

export function logVerbose(msg: string) {
  if (verbose) console.log(`    [v] ${msg}`);
}

export function logSection(title: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(60)}`);
}

// ── Morpho helpers (Phase 6) ─────────────────────────────────────────

/** Encode MarketParams tuple (address,address,address,address,uint256) inline. */
function encodeMorphoMarketParams(cfg: MorphoConfig): string {
  return padAddr(cfg.loanToken) +
    padAddr(cfg.collateralToken) +
    padAddr(cfg.mockOracle) +
    padAddr(cfg.adaptiveIrm) +
    padUint(cfg.lltv);
}

/** supplyCollateral(MarketParams,uint256,address,bytes) */
export async function morphoSupplyCollateral(
  cfg: MorphoConfig, user: string, amount: bigint,
): Promise<TxReceipt> {
  const fnSel = sel('supplyCollateral((address,address,address,address,uint256),uint256,address,bytes)');
  // MarketParams (5 words) + amount + onBehalf + bytes offset + bytes length
  const bytesOffset = padUint(8 * 32); // 8 head words → offset in bytes = 256
  const bytesLen = padUint(0);
  const calldata = `0x${fnSel}${encodeMorphoMarketParams(cfg)}${padUint(amount)}${padAddr(user)}${bytesOffset}${bytesLen}`;
  return sendTx(ARB_RPC, cfg.morpho, calldata, user, '0x500000');
}

/** borrow(MarketParams,uint256,uint256,address,address) */
export async function morphoBorrow(
  cfg: MorphoConfig, user: string, amount: bigint,
): Promise<TxReceipt> {
  const fnSel = sel('borrow((address,address,address,address,uint256),uint256,uint256,address,address)');
  // MarketParams (5 words) + assets + shares + onBehalf + receiver
  const calldata = `0x${fnSel}${encodeMorphoMarketParams(cfg)}${padUint(amount)}${padUint(0)}${padAddr(user)}${padAddr(user)}`;
  return sendTx(ARB_RPC, cfg.morpho, calldata, user, '0x500000');
}

/** liquidate(MarketParams,address,uint256,uint256,bytes) */
export async function morphoLiquidate(
  cfg: MorphoConfig, liquidator: string, borrower: string, seizedAssets: bigint,
): Promise<TxReceipt> {
  const fnSel = sel('liquidate((address,address,address,address,uint256),address,uint256,uint256,bytes)');
  // MarketParams (5 words) + borrower + seizedAssets + repaidShares + bytes offset + bytes length
  const bytesOffset = padUint(9 * 32);
  const bytesLen = padUint(0);
  const calldata = `0x${fnSel}${encodeMorphoMarketParams(cfg)}${padAddr(borrower)}${padUint(seizedAssets)}${padUint(0)}${bytesOffset}${bytesLen}`;
  return sendTx(ARB_RPC, cfg.morpho, calldata, liquidator, '0x500000');
}

/** setPrice(uint256) on MockMorphoOracle */
export async function setMorphoOraclePrice(
  oracleAddr: string, newPrice: bigint,
): Promise<TxReceipt> {
  const fnSel = sel('setPrice(uint256)');
  const calldata = `0x${fnSel}${padUint(newPrice)}`;
  return sendTx(ARB_RPC, oracleAddr, calldata, DEPLOYER, '0x100000');
}

/** position(bytes32,address) → (supplyShares, borrowShares, collateral) */
export async function getMorphoPosition(
  cfg: MorphoConfig, user: string,
): Promise<{ supplyShares: bigint; borrowShares: bigint; collateral: bigint }> {
  const fnSel = sel('position(bytes32,address)');
  const data = `0x${fnSel}${pad32(cfg.marketId)}${padAddr(user)}`;
  const result = await arbRpc('eth_call', [{ to: cfg.morpho, data }, 'latest']) as string;
  const hex = result.replace('0x', '');
  return {
    supplyShares: decodeUint(hex.slice(0, 64)),
    borrowShares: decodeUint(hex.slice(64, 128)),
    collateral: decodeUint(hex.slice(128, 192)),
  };
}

/** pendingOrderCount() → uint256 on L3 Index */
export async function getPendingOrderCount(): Promise<number> {
  const fnSel = sel('pendingOrderCount()');
  const result = await l3Rpc('eth_call', [{ to: L3_INDEX, data: `0x${fnSel}` }, 'latest']) as string;
  return Number(BigInt(result));
}

/** failedFillEscrow(uint256) → uint256 on L3 Index */
export async function getFailedFillEscrow(orderId: number): Promise<bigint> {
  const fnSel = sel('failedFillEscrow(uint256)');
  const data = `0x${fnSel}${padUint(orderId)}`;
  const result = await l3Rpc('eth_call', [{ to: L3_INDEX, data }, 'latest']) as string;
  return BigInt(result);
}

/**
 * Setup a Morpho borrow position: approve collateral → supply → borrow.
 * Requires user to have BridgedITP tokens on Arb.
 */
export async function setupBorrowPosition(
  cfg: MorphoConfig, user: string, collateralAmount: bigint, borrowAmount: bigint,
): Promise<void> {
  // Approve Morpho to spend collateral
  await approveErc20(ARB_RPC, cfg.collateralToken, cfg.morpho, collateralAmount, user);
  // Supply collateral
  await morphoSupplyCollateral(cfg, user, collateralAmount);
  // Borrow
  await morphoBorrow(cfg, user, borrowAmount);
}

/** Drop oracle price to trigger undercollateralization. priceFactor < 1e18 = drop. */
export async function triggerUndercollateralization(
  oracleAddr: string, priceFactor: bigint,
): Promise<TxReceipt> {
  // Default oracle price is 100e24 (1e26). Scale by priceFactor / 1e18.
  const defaultPrice = 100n * 10n ** 24n;
  const newPrice = (defaultPrice * priceFactor) / (10n ** 18n);
  return setMorphoOraclePrice(oracleAddr, newPrice);
}

/** Restore oracle price to default (100e24). */
export async function restoreOraclePrice(oracleAddr: string): Promise<TxReceipt> {
  return setMorphoOraclePrice(oracleAddr, 100n * 10n ** 24n);
}
