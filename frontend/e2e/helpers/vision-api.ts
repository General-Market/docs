/**
 * Vision E2E helpers.
 * Direct L3 RPC + issuer API calls for testing Vision contract interactions.
 * Vision lives on L3 (port 8545) and uses L3_WUSDC (18 decimals).
 */

import { keccak256, encodeFunctionData, toHex, createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mkdirSync, rmdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'

/** Wrap viem http transport to include Accept header (nginx requires it) */
const rpcHttp = (url: string) => http(url, { fetchOptions: { headers: { Accept: 'application/json' } } })

import {
  IS_ANVIL, L3_RPC as ENV_L3_RPC, VISION_API as ENV_VISION_API,
  CHAIN_ID as ENV_CHAIN_ID, SETTLEMENT_CHAIN_ID as ENV_SETTLEMENT_CHAIN_ID, SETTLEMENT_RPC as ENV_SETTLEMENT_RPC,
  DEPLOYER_KEY, PLAYER2_KEY, CONTRACTS, DEPLOYER_ADDRESS, ANVIL_DEPLOYER, ISSUER_URLS,
  RPC_TIMEOUT,
} from '../env'

/** Retry wrapper for flaky network calls (testnet RPCs). */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 2000): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) {
        console.warn(`[vision withRetry] attempt ${i + 1}/${attempts} failed: ${(err as Error).message}`)
        await new Promise(r => setTimeout(r, delayMs))
      }
    }
  }
  throw lastError
}

/**
 * Cross-process nonce lock using filesystem mkdir (atomic on all OSes).
 * Playwright workers run in separate Node processes, so the in-process async mutex
 * isn't sufficient. Uses per-address lock dirs in /tmp.
 */
const LOCK_BASE = '/tmp/e2e-l3-nonce'
const LOCK_STALE_MS = 30_000

async function withL3NonceLock<T>(fn: () => Promise<T>, address?: string): Promise<T> {
  // On Anvil, use simple in-process lock (no cross-worker issue with single-process)
  if (IS_ANVIL) {
    const prev = _l3InProcLock
    let resolve: () => void
    _l3InProcLock = new Promise(r => { resolve = r })
    return prev.then(fn).finally(() => resolve!())
  }

  const lockDir = address
    ? `${LOCK_BASE}-${address.toLowerCase().slice(2, 10)}`
    : `${LOCK_BASE}-global`
  const lockMeta = `${lockDir}.meta`
  const start = Date.now()

  // Acquire lock
  while (true) {
    try {
      mkdirSync(lockDir)
      // Write PID + timestamp for stale detection
      try { writeFileSync(lockMeta, JSON.stringify({ pid: process.pid, time: Date.now() })) } catch {}
      break
    } catch {
      // Lock exists — check if stale
      try {
        const meta = JSON.parse(readFileSync(lockMeta, 'utf-8'))
        const isStale = Date.now() - meta.time > LOCK_STALE_MS
        let pidDead = false
        try { process.kill(meta.pid, 0) } catch { pidDead = true }
        if (isStale || pidDead) {
          try { rmdirSync(lockDir) } catch {}
          try { unlinkSync(lockMeta) } catch {}
          continue // Retry immediately
        }
      } catch {
        // Can't read meta — force cleanup after 5s
        if (Date.now() - start > 5000) {
          try { rmdirSync(lockDir) } catch {}
          continue
        }
      }
      // Wait and retry
      if (Date.now() - start > 60_000) throw new Error(`L3 nonce lock timeout for ${lockDir}`)
      await new Promise(r => setTimeout(r, 50 + Math.random() * 150))
    }
  }

  // Execute with lock held
  try {
    return await fn()
  } finally {
    try { rmdirSync(lockDir) } catch {}
    try { unlinkSync(lockMeta) } catch {}
  }
}

/** In-process fallback for Anvil mode */
let _l3InProcLock: Promise<void> = Promise.resolve()

// Cleanup stale locks on process exit
process.on('exit', () => {
  const { readdirSync } = require('fs')
  try {
    for (const f of readdirSync('/tmp')) {
      if (f.startsWith('e2e-l3-nonce')) {
        const p = `/tmp/${f}`
        try { rmdirSync(p) } catch { try { unlinkSync(p) } catch {} }
      }
    }
  } catch {}
})

// ── Constants ────────────────────────────────────────────────

const L3_RPC = ENV_L3_RPC
const VISION_API = ENV_VISION_API

/** Safely parse a hex RPC result to BigInt. Returns 0n for empty/null results. */
function safeBigInt(hex: unknown): bigint {
  if (!hex || hex === '0x' || hex === '0x0') return 0n
  return BigInt(hex as string)
}

// ── Test accounts ────────────────────────────────────────────
// PLAYER1 uses VISION_PLAYER_KEY — separate nonce space from DEPLOYER_KEY
// so vision-data and itp-data can run in parallel without nonce collisions.
import { VISION_PLAYER_KEY, VISION_PLAYER_ADDRESS } from '../env'

/** Vision test user — uses VISION_PLAYER_KEY, separate from ITP deployer */
export const PLAYER1 = VISION_PLAYER_ADDRESS

/** Vision bot 1 — on testnet uses Anvil #9 key (funded by deployer) */
export const PLAYER2 = IS_ANVIL
  ? '0x71bE63f3384f5fb98995898A86B02Fb2426c5788'
  : '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720' // Anvil #9

/** Map of address → private key for testnet signing */
const TEST_KEYS: Record<string, `0x${string}`> = {
  [PLAYER1.toLowerCase()]: VISION_PLAYER_KEY,
  [PLAYER2.toLowerCase()]: PLAYER2_KEY,
}

function getKeyForAddress(addr: string): `0x${string}` {
  const key = TEST_KEYS[addr.toLowerCase()]
  if (!key) throw new Error(`No private key configured for address ${addr}`)
  return key
}

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
    || process.env.NEXT_PUBLIC_VISION_ADDRESS
    || ''
}

/** Vision uses L3_WUSDC (18 decimals) on L3.
 *  On testnet, Vision may have been deployed with a different USDC than what's in deployment.json.
 *  Use getVisionUsdcAddress() for Vision-related approve/deposit operations. */
function getL3UsdcAddress(): string {
  return getDeployment().contracts.L3_WUSDC
}

/** Cache for the USDC address that Vision actually uses (read from contract) */
let _visionUsdcAddress: string | null = null
export async function getVisionUsdcAddress(): Promise<string> {
  if (_visionUsdcAddress) return _visionUsdcAddress
  if (IS_ANVIL) {
    _visionUsdcAddress = getL3UsdcAddress()
    return _visionUsdcAddress
  }
  // Read from Vision contract's USDC() immutable
  const data = encodeFunctionData({
    abi: [{ name: 'USDC', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const,
    functionName: 'USDC',
    args: [],
  })
  const raw = await l3EthCall(getVisionAddress(), data)
  _visionUsdcAddress = '0x' + raw.replace('0x', '').slice(24)
  return _visionUsdcAddress
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
  return withRetry(async () => {
    const res = await fetch(L3_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    })
    const json = await res.json()
    if (json.error) throw new Error(`L3 RPC ${method}: ${json.error.message} (data: ${json.error.data ?? 'none'})`)
    return json.result
  })
}

async function l3EthCall(to: string, data: string): Promise<string> {
  return await l3RpcCall('eth_call', [{ to, data }, 'latest']) as string
}

async function l3SendTx(from: string, to: string, data: string): Promise<string> {
  // On testnet, serialize signed transactions per-address to prevent nonce conflicts
  if (!IS_ANVIL) {
    return withL3NonceLock(async () => {
      const key = getKeyForAddress(from)
      const account = privateKeyToAccount(key)
      const chain = defineChain({
        id: ENV_CHAIN_ID,
        name: 'Index L3',
        nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
        rpcUrls: { default: { http: [L3_RPC] } },
      })
      const client = createWalletClient({ account, chain, transport: rpcHttp(L3_RPC) })
      const txHash = await client.sendTransaction({
        to: to as `0x${string}`,
        data: data as `0x${string}`,
        gas: 2_000_000n,
      })
      return waitForReceipt(txHash, from, to, data)
    }, from)
  }

  // On Anvil, use in-process lock
  return withL3NonceLock(async () => {
    const txHash = await l3RpcCall('eth_sendTransaction', [{
      from, to, data, gas: '0x200000',
    }]) as string
    return waitForReceipt(txHash, from, to, data)
  }, from)
}

/** Poll for transaction receipt and throw on revert. */
async function waitForReceipt(txHash: string, from: string, to: string, data: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const receipt = await l3RpcCall('eth_getTransactionReceipt', [txHash]) as { status: string } | null
    if (receipt) {
      if (receipt.status === '0x0') {
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
    await new Promise(r => setTimeout(r, IS_ANVIL ? 200 : 1000))
  }
  return txHash
}

// ── Anvil impersonation / testnet account setup ──────────────

export async function impersonateAccount(address: string): Promise<void> {
  if (!IS_ANVIL) {
    // On testnet, ensure the account has ETH for gas (funded by deployer)
    const balance = await l3RpcCall('eth_getBalance', [address, 'latest']) as string
    if (BigInt(balance) < 10n ** 18n) {
      // Send 10 ETH from deployer — lock deployer's nonce across processes
      await withL3NonceLock(async () => {
        const account = privateKeyToAccount(DEPLOYER_KEY)
        const chain = defineChain({
          id: ENV_CHAIN_ID,
          name: 'Index L3',
          nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
          rpcUrls: { default: { http: [L3_RPC] } },
        })
        const client = createWalletClient({ account, chain, transport: rpcHttp(L3_RPC) })
        const txHash = await client.sendTransaction({
          to: address as `0x${string}`,
          value: 10n * 10n ** 18n,
        })
        // Wait for confirmation
        for (let i = 0; i < 10; i++) {
          const receipt = await l3RpcCall('eth_getTransactionReceipt', [txHash]) as { status: string } | null
          if (receipt) return
          await new Promise(r => setTimeout(r, 1000))
        }
      }, DEPLOYER_ADDRESS)
    }
    return
  }
  await l3RpcCall('anvil_impersonateAccount', [address])
}

// ── USDC minting (via deployer) ─────────────────────────────

/** Deployer — can call mint() on test ERC20 contracts */
const DEPLOYER = IS_ANVIL ? ANVIL_DEPLOYER : DEPLOYER_ADDRESS

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
 * On testnet: no-op (fresh deployment, positions should be clean).
 */
async function clearPosition(batchId: number, player: string): Promise<void> {
  if (!IS_ANVIL) return // Cannot manipulate storage on real chain

  const visionAddr = getVisionAddress()
  const innerSlot = keccak256(
    ('0x' +
      BigInt(batchId).toString(16).padStart(64, '0') +
      BigInt(4).toString(16).padStart(64, '0')) as `0x${string}`,
  )
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

/** Mint L3_WUSDC to an address via deployer. Ensures player has enough for deposits.
 *  @param usdcOverride  Use a specific USDC address (e.g. Vision's USDC) instead of deployment default */
export async function ensureUsdcBalance(address: string, minAmount: bigint, usdcOverride?: string): Promise<void> {
  const usdc = usdcOverride || getL3UsdcAddress()
  const balance = await getL3UsdcBalance(address, usdcOverride)
  if (balance >= minAmount) return

  const mintAmount = minAmount * 10n // Mint 10x the minimum to avoid repeated mints
  const addrPadded = address.replace('0x', '').toLowerCase().padStart(64, '0')
  const amountHex = mintAmount.toString(16).padStart(64, '0')
  const data = `0x40c10f19${addrPadded}${amountHex}` // mint(address,uint256)

  // On testnet, deployer = PLAYER1 which has a private key in TEST_KEYS
  await l3SendTx(DEPLOYER, usdc, data)
}

// ── ERC20 helpers ────────────────────────────────────────────

export async function getL3UsdcBalance(address: string, usdcOverride?: string): Promise<bigint> {
  const usdc = usdcOverride || getL3UsdcAddress()
  const data = encodeFunctionData({
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  })
  const result = await l3EthCall(usdc, data)
  return safeBigInt(result)
}

async function approveVision(from: string, _amount: bigint): Promise<void> {
  // Approve max uint256 to avoid race conditions when parallel tests share the same player
  const MAX_UINT256 = (1n << 256n) - 1n
  const usdcAddr = await getVisionUsdcAddress()
  const data = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: 'approve',
    args: [getVisionAddress() as `0x${string}`, MAX_UINT256],
  })
  await l3SendTx(from, usdcAddr, data)
}

// ── Bitmap encoding (matches frontend/lib/vision/bitmap.ts) ──

export type BetDirection = 'UP' | 'DOWN'

function encodeBitmap(bets: BetDirection[], marketCount: number): Uint8Array {
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

function hashBitmap(bitmap: Uint8Array): `0x${string}` {
  return keccak256(bitmap)
}

function bitmapToHex(bitmap: Uint8Array): `0x${string}` {
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

async function joinBatch(
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
    signal: AbortSignal.timeout(RPC_TIMEOUT),
  })
  if (!res.ok) throw new Error(`getBatches: ${res.status} ${res.statusText}`)
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
    signal: AbortSignal.timeout(RPC_TIMEOUT),
  })
  if (!res.ok) throw new Error(`getBatchState: ${res.status}`)
  return res.json()
}

async function submitBitmapToIssuers(
  player: string,
  batchId: number,
  bitmapHex: string,
  expectedHash: string,
): Promise<{ accepted: number; total: number }> {
  const issuerUrls = ISSUER_URLS
  const maxAttempts = 5

  // Retry loop: issuers need time to index PlayerJoined event from L3
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 3_000))

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
          signal: AbortSignal.timeout(RPC_TIMEOUT),
        })
        return res.ok
      })
    )

    const accepted = results.filter(r => r.status === 'fulfilled' && r.value).length
    if (accepted >= 2 || attempt === maxAttempts - 1) return { accepted, total: issuerUrls.length }
    console.log(`Bitmap attempt ${attempt + 1}: ${accepted}/${issuerUrls.length} accepted, retrying...`)
  }

  return { accepted: 0, total: issuerUrls.length }
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
  // 0. Ensure player account is ready (impersonate on Anvil, fund on testnet)
  await impersonateAccount(player)

  // 0.1. Clear any existing position (Anvil only — cannot clear on testnet)
  await clearPosition(batchId, player)

  // 0.5. Ensure player has enough of Vision's USDC (may differ from deployment L3_WUSDC)
  const visionUsdc = await getVisionUsdcAddress()
  await ensureUsdcBalance(player, depositAmount, visionUsdc)

  // 1. Encode bitmap
  const bitmap = encodeBitmap(bets, marketCount)
  const bmHash = hashBitmap(bitmap)
  const bmHex = bitmapToHex(bitmap)

  // 2. Approve Vision's USDC and deposit to Vision balance (dual-balance architecture)
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
  const visionUsdc = await getVisionUsdcAddress()
  return getL3UsdcBalance(getVisionAddress(), visionUsdc)
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
 * Find a batch that the given player hasn't joined yet.
 * Scans vision-batches.json (deployed by testnet.sh refresh-batches) for unjoined batches.
 * Falls back to on-chain scan if JSON is unavailable.
 *
 * Run `./testnet.sh refresh-batches` to create fresh batches with a new version
 * when all existing batches have been joined by previous E2E runs.
 */
export async function findAvailableE2eBatch(player: string = PLAYER1): Promise<{ batchId: number; configHash: `0x${string}` }> {
  // Read vision-batches.json for batch mappings (refreshed by testnet.sh refresh-batches)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const batches = require('../../../deployments/vision-batches.json')
    const entries = Object.values(batches.batches || {}) as Array<{ batchId: number; configHash: string }>
    // Sort by batchId descending (newest first = most likely unjoined)
    entries.sort((a, b) => b.batchId - a.batchId)
    for (const entry of entries) {
      try {
        const pos = await getPosition(entry.batchId, player)
        // Use joinTimestamp to detect past joins — stakePerTick resets to 0 after withdraw
        // but the contract still flags the player as AlreadyJoined
        if (pos.joinTimestamp === 0n) {
          return { batchId: entry.batchId, configHash: entry.configHash as `0x${string}` }
        }
      } catch {
        // Position read failed = nobody joined
        return { batchId: entry.batchId, configHash: entry.configHash as `0x${string}` }
      }
    }
  } catch {
    // vision-batches.json not available, fall back to on-chain scan
  }

  // Fallback: scan batches from chain backwards
  const allBatches = await getBatchesFromChain()
  if (allBatches.length === 0) throw new Error('No batches found on chain')
  for (let i = allBatches.length - 1; i >= 0; i--) {
    const batch = allBatches[i]
    try {
      const pos = await getPosition(batch.id, player)
      if (pos.joinTimestamp === 0n) {
        const configHash = await getBatchConfigHash(batch.id)
        return { batchId: batch.id, configHash }
      }
    } catch {
      const configHash = await getBatchConfigHash(batch.id)
      return { batchId: batch.id, configHash }
    }
  }
  throw new Error(`All batches already joined by ${player} — run: ./testnet.sh refresh-batches`)
}

/**
 * Ensure at least one batch exists.
 * Checks API first, then falls back to on-chain reading.
 * Batches should be pre-created by DeployAllVisionBatches.s.sol.
 */
export async function ensureBatchExists(): Promise<BatchInfo[]> {
  // Try API first
  try {
    const batches = await getBatches()
    if (batches.length > 0) return batches
  } catch {
    // API unavailable — fall through to on-chain check
  }

  // Check on-chain — batches may exist but issuers aren't indexing them
  const batches = await getBatchesFromChain()
  if (batches.length > 0) return batches

  throw new Error('No batches found — run DeployAllVisionBatches.s.sol first')
}

/**
 * Poll until Vision API has at least one batch.
 */
export async function waitForBatches(timeoutMs = 30_000): Promise<BatchInfo[]> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const batches = await getBatches()
      if (batches.length > 0) return batches
    } catch (err) {
      console.warn(`[waitForBatches] ${(err as Error).message}`)
    }
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
 * Read a player's virtual balance on Vision (credited by issuers from Settlement deposits).
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

// ── Settlement-side helpers for bridge deposit/withdraw E2E ──────

const SETTLEMENT_RPC = ENV_SETTLEMENT_RPC

async function settlementRpcCall(method: string, params: unknown[]): Promise<unknown> {
  return withRetry(async () => {
    const res = await fetch(SETTLEMENT_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    })
    const json = await res.json()
    if (json.error) throw new Error(`Settlement RPC ${method}: ${json.error.message}`)
    return json.result
  })
}

function getSettlementCustodyAddress(): string {
  return getDeployment().contracts.SettlementBridgeCustody
}

function getSettlementUsdcAddress(): string {
  return getDeployment().contracts.SETTLEMENT_USDC
}

/**
 * Mint Settlement USDC to a player.
 * On testnet: L3 and Settlement are the same chain, uses signed tx.
 */
export async function mintSettlementUsdc(player: string, amount: bigint): Promise<void> {
  const deployer = IS_ANVIL ? ANVIL_DEPLOYER : DEPLOYER_ADDRESS
  const userPadded = player.replace('0x', '').toLowerCase().padStart(64, '0')
  const amountHex = amount.toString(16).padStart(64, '0')
  const data = `0x40c10f19${userPadded}${amountHex}`

  if (!IS_ANVIL) {
    const account = privateKeyToAccount(DEPLOYER_KEY)
    const chain = defineChain({
      id: ENV_SETTLEMENT_CHAIN_ID,
      name: 'Index Settlement',
      nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
      rpcUrls: { default: { http: [SETTLEMENT_RPC] } },
    })
    const client = createWalletClient({ account, chain, transport: rpcHttp(SETTLEMENT_RPC) })
    await client.sendTransaction({
      to: getSettlementUsdcAddress() as `0x${string}`,
      data: data as `0x${string}`,
      gas: 1_000_000n,
    })
  } else {
    await settlementRpcCall('eth_sendTransaction', [{
      from: deployer,
      to: getSettlementUsdcAddress(),
      data,
      gas: '0x100000',
    }])
  }
}

/**
 * Read Settlement USDC balance (6 decimals).
 */
export async function getSettlementUsdcBalance(player: string): Promise<bigint> {
  const paddedAddr = player.replace('0x', '').toLowerCase().padStart(64, '0')
  const data = `0x70a08231${paddedAddr}`
  const result = await settlementRpcCall('eth_call', [{ to: getSettlementUsdcAddress(), data }, 'latest']) as string
  return safeBigInt(result)
}

/**
 * Deposit Settlement USDC to Vision via SettlementBridgeCustody.depositToVision(amount).
 * On testnet: uses signed transactions, no block mining needed.
 */
export async function depositToVisionViaSettlement(player: string, settlementUsdcAmount: bigint): Promise<void> {
  const custody = getSettlementCustodyAddress()
  const usdcAddr = getSettlementUsdcAddress()
  const approvePadded = custody.replace('0x', '').toLowerCase().padStart(64, '0')
  const amtHex = settlementUsdcAmount.toString(16).padStart(64, '0')
  const approveData = `0x095ea7b3${approvePadded}${amtHex}`

  const depositData = encodeFunctionData({
    abi: [{
      name: 'depositToVision',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'usdcAmount', type: 'uint256' }],
      outputs: [{ name: '', type: 'bytes32' }],
    }] as const,
    functionName: 'depositToVision',
    args: [settlementUsdcAmount],
  })

  if (!IS_ANVIL) {
    const key = getKeyForAddress(player)
    const account = privateKeyToAccount(key)
    const chain = defineChain({
      id: ENV_SETTLEMENT_CHAIN_ID,
      name: 'Index Settlement',
      nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
      rpcUrls: { default: { http: [SETTLEMENT_RPC] } },
    })
    const client = createWalletClient({ account, chain, transport: rpcHttp(SETTLEMENT_RPC) })
    await client.sendTransaction({ to: usdcAddr as `0x${string}`, data: approveData as `0x${string}`, gas: 1_000_000n })
    await client.sendTransaction({ to: custody as `0x${string}`, data: depositData as `0x${string}`, gas: 2_000_000n })
  } else {
    await settlementRpcCall('anvil_setBalance', [player, '0x56BC75E2D63100000'])
    await settlementRpcCall('anvil_impersonateAccount', [player])
    await settlementRpcCall('eth_sendTransaction', [{ from: player, to: usdcAddr, data: approveData, gas: '0x100000' }])
    await settlementRpcCall('eth_sendTransaction', [{ from: player, to: custody, data: depositData, gas: '0x200000' }])
    await settlementRpcCall('anvil_mine', ['0x5'])
  }
}
