/**
 * Vision E2E helpers.
 * Direct L3 RPC + issuer API calls for testing Vision contract interactions.
 * Vision lives on L3 (port 8545) and uses L3_WUSDC (18 decimals).
 */

import { keccak256, encodeFunctionData, toHex } from 'viem'

// ── Constants ────────────────────────────────────────────────

const L3_RPC = 'http://localhost:8545'
const VISION_API = 'http://localhost:10001'

/** Safely parse a hex RPC result to BigInt. Returns 0n for empty/null results. */
function safeBigInt(hex: unknown): bigint {
  if (!hex || hex === '0x' || hex === '0x0') return 0n
  return BigInt(hex as string)
}

/** Test user — funded + impersonated on both chains by start.sh */
export const PLAYER1 = '0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4'

/** Vision bot 1 — funded + impersonated on both chains by start.sh */
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

/** Vision uses L3_WUSDC (18 decimals) on L3 */
export function getL3UsdcAddress(): string {
  return getDeployment().contracts.L3_WUSDC
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
      { name: 'sourceId', type: 'bytes32' },
      { name: 'configHash', type: 'bytes32' },
      { name: 'nextConfigHash', type: 'bytes32' },
      { name: 'tickDuration', type: 'uint256' },
      { name: 'lockOffset', type: 'uint256' },
      { name: 'nextLockOffset', type: 'uint256' },
      { name: 'createdAtTick', type: 'uint256' },
      { name: 'lastPromotionTick', type: 'uint256' },
      { name: 'paused', type: 'bool' },
    ],
  }],
}] as const

const VISION_JOIN_ABI = [{
  name: 'joinBatch',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'batchId', type: 'uint256' },
    { name: 'configHash', type: 'bytes32' },
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
      { name: 'configHash', type: 'bytes32' },
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
        // Try to get revert reason via eth_call simulation
        let revertReason = 'unknown'
        try {
          await l3RpcCall('eth_call', [{ from, to, data, gas: '0x200000' }, 'latest'])
        } catch (e: unknown) {
          revertReason = e instanceof Error ? e.message : String(e)
        }
        throw new Error(`Transaction reverted: ${txHash} (from=${from}, to=${to}, reason=${revertReason})`)
      }
      return txHash
    }
    await new Promise(r => setTimeout(r, 200))
  }

  return txHash
}

// ── Anvil impersonation ──────────────────────────────────────

export async function impersonateAccount(address: string): Promise<void> {
  await l3RpcCall('anvil_impersonateAccount', [address])
}

// ── USDC minting (via deployer) ─────────────────────────────

/** Anvil deployer — can call mint() on test ERC20 contracts */
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

/**
 * Wait until the batch's tick lock window passes.
 * Vision batches lock the last `lockOffset` seconds of each `tickDuration` tick.
 * On Anvil (auto-mine), block.timestamp = wall clock, so just sleep past the lock.
 */
async function waitForUnlock(batchId: number): Promise<void> {
  const data = encodeFunctionData({
    abi: VISION_GET_BATCH_ABI,
    functionName: 'getBatch',
    args: [BigInt(batchId)],
  })
  const result = await l3EthCall(getVisionAddress(), data)
  const hex = result.replace('0x', '')
  const words: string[] = []
  for (let w = 0; w < hex.length; w += 64) words.push(hex.slice(w, w + 64))

  const tickDuration = Number(BigInt('0x' + words[4]))
  const lockOffset = Number(BigInt('0x' + words[5]))
  if (tickDuration === 0 || lockOffset === 0) return

  const SAFETY_MARGIN = 3 // seconds before lock window to also wait (tx mining delay)
  const now = Math.floor(Date.now() / 1000)
  const posInTick = now % tickDuration
  const lockStart = tickDuration - lockOffset

  if (posInTick >= lockStart - SAFETY_MARGIN) {
    const waitSecs = tickDuration - posInTick + 2 // wait until next tick + 2s safety
    await new Promise(r => setTimeout(r, waitSecs * 1000))
  }
}

/**
 * Clear a player's position on-chain via Anvil storage manipulation.
 * _positions is at storage slot 4.  For _positions[batchId][player]:
 *   baseSlot = keccak256(abi.encode(player, keccak256(abi.encode(batchId, 4))))
 * PlayerPosition has 9 fields = 9 consecutive storage slots.
 */
async function clearPosition(batchId: number, player: string): Promise<void> {
  const visionAddr = getVisionAddress()
  // keccak256(abi.encode(batchId, 4))
  const innerSlot = keccak256(
    ('0x' +
      BigInt(batchId).toString(16).padStart(64, '0') +
      BigInt(4).toString(16).padStart(64, '0')) as `0x${string}`,
  )
  // keccak256(abi.encode(player, innerSlot))
  const baseSlot = keccak256(
    ('0x' +
      player.replace('0x', '').toLowerCase().padStart(64, '0') +
      innerSlot.replace('0x', '')) as `0x${string}`,
  )
  const base = BigInt(baseSlot)
  const zero = '0x' + '0'.repeat(64)
  for (let i = 0; i < 9; i++) {
    const slot = '0x' + (base + BigInt(i)).toString(16).padStart(64, '0')
    await l3RpcCall('anvil_setStorageAt', [visionAddr, slot, zero])
  }
}

/** Mint ARB_USDC to an address via deployer. Ensures player has enough for deposits. */
export async function ensureUsdcBalance(address: string, minAmount: bigint): Promise<void> {
  const balance = await getL3UsdcBalance(address)
  if (balance >= minAmount) return

  const mintAmount = minAmount * 10n // Mint 10x the minimum to avoid repeated mints
  const addrPadded = address.replace('0x', '').toLowerCase().padStart(64, '0')
  const amountHex = mintAmount.toString(16).padStart(64, '0')
  const data = `0x40c10f19${addrPadded}${amountHex}` // mint(address,uint256)

  await l3SendTx(DEPLOYER, getL3UsdcAddress(), data)
}

// ── ERC20 helpers ────────────────────────────────────────────

export async function getL3UsdcBalance(address: string): Promise<bigint> {
  const data = encodeFunctionData({
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  })
  const result = await l3EthCall(getL3UsdcAddress(), data)
  return safeBigInt(result)
}

export async function approveVision(from: string, _amount: bigint): Promise<void> {
  // Approve max uint256 to avoid race conditions when parallel tests share the same player
  const MAX_UINT256 = (1n << 256n) - 1n
  const data = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: 'approve',
    args: [getVisionAddress() as `0x${string}`, MAX_UINT256],
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
  configHash: `0x${string}`,
  depositAmount: bigint,
  stakePerTick: bigint,
  bitmapHash: `0x${string}`,
): Promise<void> {
  const data = encodeFunctionData({
    abi: VISION_JOIN_ABI,
    functionName: 'joinBatch',
    args: [BigInt(batchId), configHash, depositAmount, stakePerTick, bitmapHash],
  })
  await l3SendTx(from, getVisionAddress(), data)
}

export interface PlayerPosition {
  bitmapHash: string
  configHash: string
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

  // Decode: 9 words of 32 bytes each (configHash added between bitmapHash and stakePerTick)
  const hex = result.replace('0x', '')
  const words = []
  for (let i = 0; i < hex.length; i += 64) {
    words.push(hex.slice(i, i + 64))
  }

  return {
    bitmapHash: '0x' + words[0],
    configHash: '0x' + words[1],
    stakePerTick: BigInt('0x' + words[2]),
    startTick: BigInt('0x' + words[3]),
    balance: BigInt('0x' + words[4]),
    lastClaimedTick: BigInt('0x' + words[5]),
    joinTimestamp: BigInt('0x' + words[6]),
    totalDeposited: BigInt('0x' + words[7]),
    totalClaimed: BigInt('0x' + words[8]),
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
 * Complete join flow: deposit USDC to Vision balance → joinBatch on-chain → submit bitmap to issuers.
 * With the dual-balance architecture, joinBatch debits from Vision balance (not direct USDC transfer).
 * @param configHash  Active configHash for the batch (read from chain or vision-batches.json)
 */
export async function fullJoinBatch(
  player: string,
  batchId: number,
  configHash: `0x${string}`,
  depositAmount: bigint,
  stakePerTick: bigint,
  bets: BetDirection[],
  marketCount: number,
): Promise<JoinResult> {
  // 0. Ensure player is impersonated on Anvil
  await impersonateAccount(player)

  // 0.1. Clear any existing position (idempotent across test re-runs)
  await clearPosition(batchId, player)

  // 0.5. Ensure player has enough USDC (mint via deployer if needed)
  await ensureUsdcBalance(player, depositAmount)

  // 1. Encode bitmap
  const bitmap = encodeBitmap(bets, marketCount)
  const bmHash = hashBitmap(bitmap)
  const bmHex = bitmapToHex(bitmap)

  // 2. Approve USDC and deposit to Vision balance (dual-balance architecture)
  await approveVision(player, depositAmount)
  const depositBalanceData = encodeFunctionData({
    abi: [{
      name: 'depositBalance',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'amount', type: 'uint256' }],
      outputs: [],
    }] as const,
    functionName: 'depositBalance',
    args: [depositAmount],
  })
  await l3SendTx(player, getVisionAddress(), depositBalanceData)

  // 3. Wait for tick lock window to pass (last lockOffset seconds of each tick are locked)
  await waitForUnlock(batchId)

  // 4. Join batch on-chain (debits from Vision balance, requires configHash binding)
  await joinBatch(player, batchId, configHash, depositAmount, stakePerTick, bmHash)

  // 5. Submit bitmap to issuers
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
 * The new Batch struct is all fixed-size fields (no dynamic arrays):
 *   creator, sourceId, configHash, nextConfigHash, tickDuration,
 *   lockOffset, nextLockOffset, createdAtTick, lastPromotionTick, paused
 */
export async function getBatchesFromChain(): Promise<BatchInfo[]> {
  const data = encodeFunctionData({
    abi: VISION_NEXT_BATCH_ID_ABI,
    functionName: 'nextBatchId',
    args: [],
  })
  const result = await l3EthCall(getVisionAddress(), data)
  const count = Number(safeBigInt(result))
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
      const hex = batchResult.replace('0x', '')
      const words: string[] = []
      for (let w = 0; w < hex.length; w += 64) words.push(hex.slice(w, w + 64))
      // ABI decode: struct with all fixed-size fields is returned inline (no offset pointer)
      // Tuple: creator(0), sourceId(1), configHash(2), nextConfigHash(3),
      //        tickDuration(4), lockOffset(5), nextLockOffset(6),
      //        createdAtTick(7), lastPromotionTick(8), paused(9)
      const tupleBase = 0
      const creator = '0x' + words[tupleBase + 0].slice(24)
      const tickDuration = Number(BigInt('0x' + words[tupleBase + 4]))
      const paused = BigInt('0x' + words[tupleBase + 9]) !== 0n

      if (creator !== '0x' + '0'.repeat(40)) {
        batches.push({
          id: i,
          creator,
          market_count: 0, // market detail is off-chain in hash-based design
          tick_duration: tickDuration,
          player_count: 0,
          tvl: '0',
          paused,
        })
      }
    } catch {
      // Skip unreadable batches
    }
  }
  return batches
}

/**
 * Read the configHash of a batch from the Vision contract.
 * Needed for joinBatch which requires configHash binding.
 */
export async function getBatchConfigHash(batchId: number): Promise<`0x${string}`> {
  const data = encodeFunctionData({
    abi: VISION_GET_BATCH_ABI,
    functionName: 'getBatch',
    args: [BigInt(batchId)],
  })
  const result = await l3EthCall(getVisionAddress(), data)
  const hex = result.replace('0x', '')
  const words: string[] = []
  for (let w = 0; w < hex.length; w += 64) words.push(hex.slice(w, w + 64))
  // configHash is at tuple index 2 (struct fields: creator, sourceId, configHash, ...)
  return ('0x' + words[2]) as `0x${string}`
}

/**
 * Find a pre-created E2E test batch that nobody has joined yet.
 * The deploy script creates e2e_test_0..e2e_test_4 batches specifically for tests.
 * Returns { batchId, configHash } of the first available one.
 */
export async function findAvailableE2eBatch(): Promise<{ batchId: number; configHash: `0x${string}` }> {
  // Read vision-batches.json for pre-created batch mappings
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const batches = require('../../../deployments/vision-batches.json')
    for (let i = 0; i <= 4; i++) {
      const key = `e2e_test_${i}`
      const entry = batches.batches?.[key]
      if (entry) {
        // Check if anyone has joined this batch
        try {
          const pos = await getPosition(entry.batchId, PLAYER1)
          if (pos.stakePerTick === 0n) {
            return { batchId: entry.batchId, configHash: entry.configHash as `0x${string}` }
          }
        } catch {
          // Position read failed = nobody joined
          return { batchId: entry.batchId, configHash: entry.configHash as `0x${string}` }
        }
      }
    }
  } catch {
    // vision-batches.json not available, fall back to on-chain scan
  }

  // Fallback: scan batches from chain, pick one with high ID (likely unused)
  const allBatches = await getBatchesFromChain()
  if (allBatches.length === 0) throw new Error('No batches found on chain')
  const batch = allBatches[allBatches.length - 1]
  const configHash = await getBatchConfigHash(batch.id)
  return { batchId: batch.id, configHash }
}

/**
 * Ensure at least one batch exists.
 * Checks API first, then falls back to on-chain reading.
 * Batches should be pre-created by DeployAllVisionBatches.s.sol.
 */
export async function ensureBatchExists(): Promise<BatchInfo[]> {
  // Try API first
  let batches = await getBatches()
  if (batches.length > 0) return batches

  // Check on-chain — batches may exist but issuers aren't indexing them
  batches = await getBatchesFromChain()
  if (batches.length > 0) return batches

  throw new Error('No batches found — run DeployAllVisionBatches.s.sol first')
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

// ── Vision balance helpers ──────────────────────────────────

const VISION_DEPOSIT_BALANCE_ABI = [{
  name: 'depositBalance',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'amount', type: 'uint256' }],
  outputs: [],
}] as const

const VISION_WITHDRAW_BALANCE_ABI = [{
  name: 'withdrawBalance',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'amount', type: 'uint256' }],
  outputs: [],
}] as const

const VISION_BALANCE_OF_ABI = [{
  name: 'balanceOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'user', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const

const VISION_REAL_BALANCE_ABI = [{
  name: 'realBalance',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: '', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const

/**
 * Deposit L3 USDC into Vision realBalance for a player.
 * Mints USDC if needed, approves Vision, then calls depositBalance().
 */
export async function depositToVisionBalance(player: string, amount: bigint): Promise<void> {
  await impersonateAccount(player)
  await ensureUsdcBalance(player, amount)
  await approveVision(player, amount)
  const data = encodeFunctionData({
    abi: VISION_DEPOSIT_BALANCE_ABI,
    functionName: 'depositBalance',
    args: [amount],
  })
  await l3SendTx(player, getVisionAddress(), data)
}

/**
 * Read a player's total Vision balance (real + virtual).
 */
export async function getVisionPlayerBalance(player: string): Promise<bigint> {
  const data = encodeFunctionData({
    abi: VISION_BALANCE_OF_ABI,
    functionName: 'balanceOf',
    args: [player as `0x${string}`],
  })
  const result = await l3EthCall(getVisionAddress(), data)
  return safeBigInt(result)
}

/**
 * Read a player's real balance on Vision.
 */
export async function getVisionRealBalance(player: string): Promise<bigint> {
  const data = encodeFunctionData({
    abi: VISION_REAL_BALANCE_ABI,
    functionName: 'realBalance',
    args: [player as `0x${string}`],
  })
  const result = await l3EthCall(getVisionAddress(), data)
  return safeBigInt(result)
}

const VISION_VIRTUAL_BALANCE_ABI = [{
  name: 'virtualBalance',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: '', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const

/**
 * Read a player's virtual balance on Vision (credited by issuers from Arb deposits).
 */
export async function getVisionVirtualBalance(player: string): Promise<bigint> {
  const data = encodeFunctionData({
    abi: VISION_VIRTUAL_BALANCE_ABI,
    functionName: 'virtualBalance',
    args: [player as `0x${string}`],
  })
  const result = await l3EthCall(getVisionAddress(), data)
  return safeBigInt(result)
}

// ── Arb-side helpers for bridge deposit/withdraw E2E ──────

const ARB_RPC = 'http://localhost:8546'

async function arbRpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(ARB_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(15_000),
  })
  const json = await res.json()
  if (json.error) throw new Error(`Arb RPC ${method}: ${json.error.message}`)
  return json.result
}

function getArbCustodyAddress(): string {
  return getDeployment().contracts.ArbBridgeCustody
}

function getArbUsdcAddress(): string {
  return getDeployment().contracts.ARB_USDC
}

/**
 * Mint Arb USDC (6 decimals) to a player on Arb Anvil.
 */
export async function mintArbUsdc(player: string, amount: bigint): Promise<void> {
  const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
  const userPadded = player.replace('0x', '').toLowerCase().padStart(64, '0')
  const amountHex = amount.toString(16).padStart(64, '0')
  const data = `0x40c10f19${userPadded}${amountHex}`
  await arbRpcCall('eth_sendTransaction', [{
    from: DEPLOYER,
    to: getArbUsdcAddress(),
    data,
    gas: '0x100000',
  }])
}

/**
 * Read Arb USDC balance (6 decimals).
 */
export async function getArbUsdcBalance(player: string): Promise<bigint> {
  const paddedAddr = player.replace('0x', '').toLowerCase().padStart(64, '0')
  const data = `0x70a08231${paddedAddr}`
  const result = await arbRpcCall('eth_call', [{ to: getArbUsdcAddress(), data }, 'latest']) as string
  return safeBigInt(result)
}

/**
 * Deposit Arb USDC to Vision via ArbBridgeCustody.depositToVision(amount).
 * This is the on-chain Arb side of the bridge deposit.
 */
export async function depositToVisionViaArb(player: string, arbUsdcAmount: bigint): Promise<void> {
  await arbRpcCall('anvil_setBalance', [player, '0x56BC75E2D63100000']) // 100 ETH
  await arbRpcCall('anvil_impersonateAccount', [player])

  // Approve ARB_USDC to ArbBridgeCustody
  const custody = getArbCustodyAddress()
  const usdcAddr = getArbUsdcAddress()
  const approvePadded = custody.replace('0x', '').toLowerCase().padStart(64, '0')
  const amtHex = arbUsdcAmount.toString(16).padStart(64, '0')
  const approveData = `0x095ea7b3${approvePadded}${amtHex}`
  await arbRpcCall('eth_sendTransaction', [{
    from: player,
    to: usdcAddr,
    data: approveData,
    gas: '0x100000',
  }])

  // depositToVision(uint256 usdcAmount)
  const depositData = encodeFunctionData({
    abi: [{
      name: 'depositToVision',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'usdcAmount', type: 'uint256' }],
      outputs: [{ name: '', type: 'bytes32' }],
    }] as const,
    functionName: 'depositToVision',
    args: [arbUsdcAmount],
  })
  await arbRpcCall('eth_sendTransaction', [{
    from: player,
    to: custody,
    data: depositData,
    gas: '0x200000',
  }])

  // Mine Arb blocks so issuers see the event
  await arbRpcCall('anvil_mine', ['0x5'])
}
