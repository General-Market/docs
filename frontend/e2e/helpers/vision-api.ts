/**
 * Vision E2E helpers.
 * Direct Arb RPC + issuer API calls for testing Vision contract interactions.
 * Vision lives on Arbitrum (same chain as frontend wallet).
 */

import { keccak256, encodeFunctionData, toHex } from 'viem'

// ── Constants ────────────────────────────────────────────────

const L3_RPC = 'http://localhost:8546'
const VISION_API = 'http://localhost:10001'

/** Test user — funded + impersonated on Arb by start.sh */
export const PLAYER1 = '0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4'

/** Vision bot — funded + impersonated on Arb by start.sh */
/** Vision bot 1 — funded + impersonated on Arb by start.sh */
export const PLAYER2 = '0x71bE63f3384f5fb98995898A86B02Fb2426c5788'

// Read addresses from deployment.json (copied by start.sh step 7)
let _deploymentCache: any = null
function getDeployment() {
  if (!_deploymentCache) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _deploymentCache = require('../../lib/contracts/deployment.json')
  }
  return _deploymentCache
}

export function getVisionAddress(): string {
  return getDeployment().contracts.Vision
}

export function getL3UsdcAddress(): string {
  return getDeployment().contracts.ARB_USDC
}

// ── ABI fragments ────────────────────────────────────────────

const ERC20_APPROVE_ABI = [{
  name: 'approve',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'spender', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [{ name: '', type: 'bool' }],
}] as const

const ERC20_BALANCE_ABI = [{
  name: 'balanceOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const

const VISION_NEXT_BATCH_ID_ABI = [{
  name: 'nextBatchId',
  type: 'function',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ name: '', type: 'uint256' }],
}] as const

const VISION_GET_BATCH_ABI = [{
  name: 'getBatch',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'batchId', type: 'uint256' }],
  outputs: [{
    name: '',
    type: 'tuple',
    components: [
      { name: 'creator', type: 'address' },
      { name: 'marketIds', type: 'bytes32[]' },
      { name: 'resolutionTypes', type: 'uint8[]' },
      { name: 'tickDuration', type: 'uint256' },
      { name: 'customThresholds', type: 'uint256[]' },
      { name: 'createdAtTick', type: 'uint256' },
      { name: 'paused', type: 'bool' },
    ],
  }],
}] as const

const VISION_CREATE_BATCH_ABI = [{
  name: 'createBatch',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'marketIds', type: 'bytes32[]' },
    { name: 'resolutionTypes', type: 'uint8[]' },
    { name: 'tickDuration', type: 'uint256' },
    { name: 'customThresholds', type: 'uint256[]' },
  ],
  outputs: [{ name: 'batchId', type: 'uint256' }],
}] as const

const VISION_JOIN_ABI = [{
  name: 'joinBatch',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'batchId', type: 'uint256' },
    { name: 'depositAmount', type: 'uint256' },
    { name: 'stakePerTick', type: 'uint256' },
    { name: 'bitmapHash', type: 'bytes32' },
  ],
  outputs: [],
}] as const

const VISION_POSITION_ABI = [{
  name: 'getPosition',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'batchId', type: 'uint256' },
    { name: 'player', type: 'address' },
  ],
  outputs: [{
    name: '',
    type: 'tuple',
    components: [
      { name: 'bitmapHash', type: 'bytes32' },
      { name: 'stakePerTick', type: 'uint256' },
      { name: 'startTick', type: 'uint256' },
      { name: 'balance', type: 'uint256' },
      { name: 'lastClaimedTick', type: 'uint256' },
      { name: 'joinTimestamp', type: 'uint256' },
      { name: 'totalDeposited', type: 'uint256' },
      { name: 'totalClaimed', type: 'uint256' },
    ],
  }],
}] as const

// ── L3 RPC ───────────────────────────────────────────────────

async function l3RpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(L3_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(15_000),
  })
  const json = await res.json()
  if (json.error) throw new Error(`L3 RPC ${method}: ${json.error.message} (data: ${json.error.data ?? 'none'})`)
  return json.result
}

async function l3EthCall(to: string, data: string): Promise<string> {
  return await l3RpcCall('eth_call', [{ to, data }, 'latest']) as string
}

async function l3SendTx(from: string, to: string, data: string): Promise<string> {
  const txHash = await l3RpcCall('eth_sendTransaction', [{
    from,
    to,
    data,
    gas: '0x200000', // 2M gas
  }]) as string

  // Poll for receipt (Anvil auto-mines but receipt may not be immediate)
  for (let i = 0; i < 10; i++) {
    const receipt = await l3RpcCall('eth_getTransactionReceipt', [txHash]) as { status: string } | null
    if (receipt) {
      if (receipt.status === '0x0') {
        throw new Error(`Transaction reverted: ${txHash} (from=${from}, to=${to})`)
      }
      return txHash
    }
    await new Promise(r => setTimeout(r, 200))
  }

  return txHash
}

// ── Anvil impersonation ──────────────────────────────────────

async function impersonateAccount(address: string): Promise<void> {
  await l3RpcCall('anvil_impersonateAccount', [address])
}

// ── ERC20 helpers ────────────────────────────────────────────

export async function getL3UsdcBalance(address: string): Promise<bigint> {
  const data = encodeFunctionData({
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  })
  const result = await l3EthCall(getL3UsdcAddress(), data)
  return BigInt(result)
}

export async function approveVision(from: string, amount: bigint): Promise<void> {
  const data = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: 'approve',
    args: [getVisionAddress() as `0x${string}`, amount],
  })
  await l3SendTx(from, getL3UsdcAddress(), data)
}

// ── Bitmap encoding (matches frontend/lib/vision/bitmap.ts) ──

export type BetDirection = 'UP' | 'DOWN'

export function encodeBitmap(bets: BetDirection[], marketCount: number): Uint8Array {
  const byteCount = Math.ceil(marketCount / 8)
  const bitmap = new Uint8Array(byteCount)
  for (let i = 0; i < marketCount; i++) {
    if (i < bets.length && bets[i] === 'UP') {
      const byteIdx = Math.floor(i / 8)
      const bitIdx = 7 - (i % 8) // big-endian: bit 0 = MSB
      bitmap[byteIdx] |= (1 << bitIdx)
    }
  }
  return bitmap
}

export function hashBitmap(bitmap: Uint8Array): `0x${string}` {
  return keccak256(bitmap)
}

export function bitmapToHex(bitmap: Uint8Array): `0x${string}` {
  return toHex(bitmap)
}

/** Generate random bets for N markets */
export function randomBets(marketCount: number): BetDirection[] {
  return Array.from({ length: marketCount }, () =>
    Math.random() > 0.5 ? 'UP' : 'DOWN'
  )
}

/** Generate opposite bets */
export function oppositeBets(bets: BetDirection[]): BetDirection[] {
  return bets.map(b => b === 'UP' ? 'DOWN' : 'UP')
}

// ── Vision contract interaction ──────────────────────────────

export async function joinBatch(
  from: string,
  batchId: number,
  depositAmount: bigint,
  stakePerTick: bigint,
  bitmapHash: `0x${string}`,
): Promise<void> {
  const data = encodeFunctionData({
    abi: VISION_JOIN_ABI,
    functionName: 'joinBatch',
    args: [BigInt(batchId), depositAmount, stakePerTick, bitmapHash],
  })
  await l3SendTx(from, getVisionAddress(), data)
}

export interface PlayerPosition {
  bitmapHash: string
  stakePerTick: bigint
  startTick: bigint
  balance: bigint
  lastClaimedTick: bigint
  joinTimestamp: bigint
  totalDeposited: bigint
  totalClaimed: bigint
}

export async function getPosition(batchId: number, player: string): Promise<PlayerPosition> {
  const data = encodeFunctionData({
    abi: VISION_POSITION_ABI,
    functionName: 'getPosition',
    args: [BigInt(batchId), player as `0x${string}`],
  })
  const result = await l3EthCall(getVisionAddress(), data)

  // Decode: 8 words of 32 bytes each
  const hex = result.replace('0x', '')
  const words = []
  for (let i = 0; i < hex.length; i += 64) {
    words.push(hex.slice(i, i + 64))
  }

  return {
    bitmapHash: '0x' + words[0],
    stakePerTick: BigInt('0x' + words[1]),
    startTick: BigInt('0x' + words[2]),
    balance: BigInt('0x' + words[3]),
    lastClaimedTick: BigInt('0x' + words[4]),
    joinTimestamp: BigInt('0x' + words[5]),
    totalDeposited: BigInt('0x' + words[6]),
    totalClaimed: BigInt('0x' + words[7]),
  }
}

// ── Vision issuer API ────────────────────────────────────────

export interface BatchInfo {
  id: number
  creator: string
  market_count: number
  tick_duration: number
  player_count: number
  tvl: string
  paused: boolean
}

export async function getBatches(): Promise<BatchInfo[]> {
  const res = await fetch(`${VISION_API}/vision/batches`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.batches || data || []
}

export interface BatchState {
  id: number
  market_ids: string[]
  tick_duration: number
  player_count: number
  players: Array<{
    address: string
    stake_per_tick: string
    balance: string
    has_bitmap: boolean
  }>
}

export async function getBatchState(batchId: number): Promise<BatchState> {
  const res = await fetch(`${VISION_API}/vision/batch/${batchId}/state`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`getBatchState: ${res.status}`)
  return res.json()
}

export async function submitBitmapToIssuers(
  player: string,
  batchId: number,
  bitmapHex: string,
  expectedHash: string,
): Promise<{ accepted: number; total: number }> {
  const issuerUrls = [
    'http://localhost:10001',
    'http://localhost:10002',
    'http://localhost:10003',
  ]

  const results = await Promise.allSettled(
    issuerUrls.map(async (url) => {
      const res = await fetch(`${url}/vision/bitmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player,
          batch_id: batchId,
          bitmap_hex: bitmapHex,
          expected_hash: expectedHash,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      return res.ok
    })
  )

  const accepted = results.filter(r => r.status === 'fulfilled' && r.value).length
  return { accepted, total: issuerUrls.length }
}

// ── Convenience: full join flow ──────────────────────────────

export interface JoinResult {
  bitmap: Uint8Array
  bitmapHash: `0x${string}`
  bitmapHex: `0x${string}`
  bitmapAccepted: number
}

/**
 * Complete join flow: approve USDC → joinBatch on-chain → submit bitmap to issuers.
 */
export async function fullJoinBatch(
  player: string,
  batchId: number,
  depositAmount: bigint,
  stakePerTick: bigint,
  bets: BetDirection[],
  marketCount: number,
): Promise<JoinResult> {
  // 0. Ensure player is impersonated on Anvil
  await impersonateAccount(player)

  // 1. Encode bitmap
  const bitmap = encodeBitmap(bets, marketCount)
  const bmHash = hashBitmap(bitmap)
  const bmHex = bitmapToHex(bitmap)

  // 2. Approve USDC
  await approveVision(player, depositAmount)

  // 3. Join batch on-chain
  await joinBatch(player, batchId, depositAmount, stakePerTick, bmHash)

  // 4. Submit bitmap to issuers
  const { accepted } = await submitBitmapToIssuers(player, batchId, bmHex, bmHash)

  return { bitmap, bitmapHash: bmHash, bitmapHex: bmHex, bitmapAccepted: accepted }
}

/**
 * Get Vision contract's USDC balance on L3 (total locked value).
 */
export async function getVisionUsdcBalance(): Promise<bigint> {
  return getL3UsdcBalance(getVisionAddress())
}

/**
 * Read batch count and info directly from the Vision contract (bypasses issuer API).
 */
export async function getBatchesFromChain(): Promise<BatchInfo[]> {
  const data = encodeFunctionData({
    abi: VISION_NEXT_BATCH_ID_ABI,
    functionName: 'nextBatchId',
    args: [],
  })
  const result = await l3EthCall(getVisionAddress(), data)
  const count = Number(BigInt(result))
  if (count === 0) return []

  const batches: BatchInfo[] = []
  for (let i = 0; i < count; i++) {
    try {
      const batchData = encodeFunctionData({
        abi: VISION_GET_BATCH_ABI,
        functionName: 'getBatch',
        args: [BigInt(i)],
      })
      const batchResult = await l3EthCall(getVisionAddress(), batchData)
      // Parse creator from the first 32-byte word (padded address)
      const hex = batchResult.replace('0x', '')
      const creator = '0x' + hex.slice(24, 64)
      // The struct has dynamic arrays so full decoding is complex.
      // For BatchInfo we just need id and market_count.
      // tickDuration is at a fixed offset (word index 3 in the struct header).
      // Market count: read marketIds array length.
      // The struct is ABI-encoded as a tuple with offset pointers for dynamic fields.
      // Word 0: offset to tuple data (0x20)
      // Tuple data starts at word 1:
      //   word 1: creator (address, padded)
      //   word 2: offset to marketIds (relative to tuple start)
      //   word 3: offset to resolutionTypes
      //   word 4: tickDuration
      //   word 5: offset to customThresholds
      //   word 6: createdAtTick
      //   word 7: paused
      // Then dynamic arrays follow
      const words: string[] = []
      for (let w = 0; w < hex.length; w += 64) words.push(hex.slice(w, w + 64))
      // Tuple starts at word 1 (after offset pointer at word 0)
      const tupleBase = 1
      const tickDuration = Number(BigInt('0x' + words[tupleBase + 3]))
      // marketIds offset is at word tupleBase+1, relative to tuple start
      const marketIdsOffset = Number(BigInt('0x' + words[tupleBase + 1])) / 32
      const marketCount = Number(BigInt('0x' + words[tupleBase + marketIdsOffset]))

      if (creator !== '0x' + '0'.repeat(40)) {
        batches.push({
          id: i,
          creator,
          market_count: marketCount,
          tick_duration: tickDuration,
          player_count: 0,
          tvl: '0',
          paused: BigInt('0x' + words[tupleBase + 6]) !== 0n,
        })
      }
    } catch {
      // Skip unreadable batches
    }
  }
  return batches
}

/**
 * Create a batch on the Vision contract via Anvil impersonation.
 * Uses deployer account (Anvil account 0) to call createBatch directly.
 */
export async function createBatchOnChain(marketCount = 5, tickDuration = 30): Promise<void> {
  const deployer = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

  // Generate dummy market IDs (keccak hashes of "market_0", "market_1", etc.)
  const marketIds: `0x${string}`[] = []
  for (let i = 0; i < marketCount; i++) {
    marketIds.push(keccak256(toHex(`e2e_market_${i}`)))
  }

  const resolutionTypes = new Array(marketCount).fill(0)
  const customThresholds = new Array(marketCount).fill(BigInt(0))

  const data = encodeFunctionData({
    abi: VISION_CREATE_BATCH_ABI,
    functionName: 'createBatch',
    args: [
      marketIds,
      resolutionTypes,
      BigInt(tickDuration),
      customThresholds,
    ],
  })

  await l3SendTx(deployer, getVisionAddress(), data)

  // Wait for issuers to index the event
  await new Promise(r => setTimeout(r, 5_000))
}

/**
 * Ensure at least one batch exists; create one if needed.
 * Checks API first, then falls back to on-chain reading.
 */
export async function ensureBatchExists(): Promise<BatchInfo[]> {
  // Try API first
  let batches = await getBatches()
  if (batches.length > 0) return batches

  // Check on-chain — batches may exist but issuers aren't indexing them
  batches = await getBatchesFromChain()
  if (batches.length > 0) return batches

  // No batches anywhere — create one on-chain
  await createBatchOnChain()

  // Read from chain directly (don't rely on issuer API)
  batches = await getBatchesFromChain()
  if (batches.length > 0) return batches

  throw new Error('Failed to create batch on Vision contract')
}

/**
 * Poll until Vision API has at least one batch.
 */
export async function waitForBatches(timeoutMs = 30_000): Promise<BatchInfo[]> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const batches = await getBatches()
    if (batches.length > 0) return batches
    await new Promise(r => setTimeout(r, 2_000))
  }
  throw new Error(`No batches found after ${timeoutMs}ms`)
}
