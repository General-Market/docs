/**
 * Vision Fast Joiner — event-driven, no iteration.
 *
 * Watches Vision.BatchCreated events. For each new batch on a source we know
 * about, picks one of that source's five vaults by `batchId mod 5` and fires
 * `vault.joinBatch(batchId, configHash, deposit, bitmapHash)` immediately.
 *
 * No bitmap submission. No strategy. No predictions. Just participation.
 * The fund-manager handles the slow-path strategy work; this daemon exists
 * so 60-second-tick markets do not silently expire with zero participants.
 *
 * Read-only env:
 *   L3_RPC_URL         (default: https://rpc.generalmarket.io/)
 *   DEPLOYMENT_JSON    (default: ../deployments/active-deployment.json)
 *
 * Required env:
 *   MANAGER_PRIVATE_KEY — manager of every vault (=deployer in current setup)
 *
 * Optional env:
 *   POLL_INTERVAL_MS   default 3000 — how often to query latestBatchForSource
 *   DEPOSIT_USDC       default 10  — USDC per join, in human units
 *   FAST_JOINER_HEALTH_PORT  default 9202
 */
import { createPublicClient, createWalletClient, http, parseUnits, getAddress, keccak256, stringToHex, bytesToHex, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))

const L3_RPC = process.env.L3_RPC_URL || 'https://rpc.generalmarket.io/'
const DEPLOYMENT_JSON = process.env.DEPLOYMENT_JSON || resolve(__dirname, '../../deployments/active-deployment.json')
const PK = process.env.MANAGER_PRIVATE_KEY as Hex | undefined
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '3000', 10)
const DEPOSIT_USDC = parseFloat(process.env.DEPOSIT_USDC || '10')
const HEALTH_PORT = parseInt(process.env.FAST_JOINER_HEALTH_PORT || '9202', 10)
const VAULT_VERSION = process.env.BATCH_VERSION || 'v2'
const ORACLE_URLS = (process.env.ORACLE_URLS || 'http://localhost:10001,http://localhost:10002,http://localhost:10003').split(',').map((s) => s.trim()).filter(Boolean)
const MAX_BITMAP_BYTES = 1024 // matches vision-bot/framework/core.py

if (!PK) {
  console.error('[fatal] MANAGER_PRIVATE_KEY not set')
  process.exit(1)
}

const deployment = JSON.parse(readFileSync(DEPLOYMENT_JSON, 'utf8')) as {
  contracts: { Vision: string; L3_WUSDC?: string; USDC?: string }
  sourceVaults?: Record<string, string[]>
  chainId: number
}

if (!deployment.sourceVaults || Object.keys(deployment.sourceVaults).length === 0) {
  console.error(
    `[fatal] ${DEPLOYMENT_JSON} has no sourceVaults map. ` +
      `This file is the stripped envs/<env>/deployment.json instead of active-deployment.json. ` +
      `Re-run ./switch-env.sh <env> from the repo root to repopulate it, ` +
      `or point DEPLOYMENT_JSON at envs/<env>/active-deployment.json.`,
  )
  process.exit(1)
}

const VISION = getAddress(deployment.contracts.Vision)
const USDC = getAddress(deployment.contracts.L3_WUSDC || deployment.contracts.USDC || '0x0')
const SOURCES = Object.keys(deployment.sourceVaults)
// `vs.map(getAddress)` passes the array index as second arg, which viem
// treats as a chainId for EIP-1191 — produces a different case-checksum per
// position. Wrap to single-arg so EIP-55 (chain-agnostic) wins.
const VAULTS_BY_SOURCE: Record<string, `0x${string}`[]> = Object.fromEntries(
  Object.entries(deployment.sourceVaults).map(([s, vs]) => [s, vs.map((v) => getAddress(v))]),
)
// sourceId is keccak256("<name>_<version>") per DeployAllVisionBatches.s.sol
const SOURCE_ID_TO_NAME: Record<string, string> = Object.fromEntries(
  SOURCES.map((s) => [keccak256(stringToHex(`${s}_${VAULT_VERSION}`)).toLowerCase(), s]),
)

const chain = {
  id: deployment.chainId,
  name: 'L3',
  nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
  rpcUrls: { default: { http: [L3_RPC] } },
} as const

const account = privateKeyToAccount(PK)
// Batch JSON-RPC collapses every per-source read fan-out (latestBatchForSource,
// getBatch, getPosition, idleUSDC) into a handful of HTTP requests per tick
// instead of hundreds. Without it this daemon opens ~73 sockets and burns
// ~6% CPU re-handshaking against rpc.generalmarket.io every 3s.
const transport = http(L3_RPC, { timeout: 15_000, batch: { batchSize: 200, wait: 10 } })
const publicClient = createPublicClient({ chain, transport })
const walletClient = createWalletClient({ chain, transport, account })

const VISION_ABI = [
  {
    type: 'function',
    name: 'latestBatchForSource',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getBatch',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'sourceId', type: 'bytes32' },
          { name: 'configHash', type: 'bytes32' },
          { name: 'tickDuration', type: 'uint256' },
          { name: 'lockOffset', type: 'uint256' },
          { name: 'settlementGrace', type: 'uint256' },
          { name: 'createdAtTick', type: 'uint256' },
          { name: 'paused', type: 'bool' },
          { name: 'settled', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getPosition',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }, { type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'bitmapHash', type: 'bytes32' },
          { name: 'configHash', type: 'bytes32' },
          { name: 'joinTimestamp', type: 'uint256' },
          { name: 'totalDeposited', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'batchExpirationTime',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const VAULT_ABI = [
  {
    type: 'function',
    name: 'joinBatch',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'configHash', type: 'bytes32' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'bitmapHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'idleUSDC',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

interface Health {
  bootedAt: number
  lastTickAt: number
  joinedTotal: number
  joinedThisRun: number
  lastError: string | null
}
const health: Health = {
  bootedAt: Date.now(),
  lastTickAt: 0,
  joinedTotal: 0,
  joinedThisRun: 0,
  lastError: null,
}

createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, ...health, vaultCount: Object.values(VAULTS_BY_SOURCE).flat().length }))
  } else {
    res.writeHead(404)
    res.end()
  }
}).listen(HEALTH_PORT, () => console.log(`[health] :${HEALTH_PORT}`))

console.log(`[boot] manager=${account.address} vision=${VISION} sources=${SOURCES.length} version=${VAULT_VERSION}`)

// Track which (source, batchId) we've already attempted this run so we don't
// fire duplicate joins. Vision rejects double-joins on its own (AlreadyJoined),
// but the duplicate tx still costs gas.
const attempted = new Set<string>()

const DEPOSIT_WEI = parseUnits(DEPOSIT_USDC.toString(), 18)

// Build a fresh random bitmap + its keccak hash. The full 1024-byte buffer
// gets posted to oracles so they have actual predictions to settle against;
// the hash goes on chain as the player's commitment. Random bits give the
// oracle an honest "I bet on a coin flip" — payouts move the vault NAV in
// tiny amounts on every settlement instead of zero-PnL break-evens.
function newBitmap(): { bitmap: Uint8Array; hash: Hex } {
  const bitmap = new Uint8Array(MAX_BITMAP_BYTES)
  bitmap.set(randomBytes(MAX_BITMAP_BYTES))
  return { bitmap, hash: keccak256(bytesToHex(bitmap)) }
}

async function submitBitmapToOracles(player: `0x${string}`, batchId: bigint, bitmap: Uint8Array, hash: Hex): Promise<number> {
  const payload = {
    player,
    batch_id: Number(batchId),
    bitmap_hex: bytesToHex(bitmap),
    expected_hash: hash,
  }
  // Oracle's chain_listener has a polling delay before it sees PlayerJoined.
  // Bitmap submissions before that fail with "Player ... not found in batch".
  // Retry with backoff: 2s, 4s, 8s — gives the listener time to catch up.
  const delays = [2_000, 4_000, 8_000]
  let accepted = 0
  for (const delay of delays) {
    await new Promise((r) => setTimeout(r, delay))
    accepted = 0
    await Promise.all(
      ORACLE_URLS.map(async (url) => {
        try {
          const res = await fetch(`${url}/vision/bitmap`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5_000),
          })
          if (res.ok) accepted += 1
        } catch {
          // best effort — oracle may be down or restarting
        }
      }),
    )
    if (accepted >= 2) return accepted // BFT quorum reached, no need to retry
  }
  return accepted
}

// Both reads AND writes run in parallel. Nonces are pre-allocated from a
// single counter so concurrent writes get N, N+1, N+2... in order; the chain
// processes them in nonce order regardless of submission order. The deployer
// key is shared with fund-manager/keeper, so we refresh from pending count
// once per tick before allocating that tick's writes.
let nonceFloor = 0
async function refreshNonceFloor(): Promise<void> {
  try {
    const pending = Number(
      await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' }),
    )
    if (pending > nonceFloor) nonceFloor = pending
  } catch {
    // keep current floor on RPC error
  }
}
function takeNonce(): number {
  const n = nonceFloor
  nonceFloor += 1
  return n
}

// Per-source verbose tracing for debugging. Set DEBUG_SOURCES=foo,bar to
// enable; default off.
const DEBUG_SOURCES = new Set((process.env.DEBUG_SOURCES || '').split(',').map((s) => s.trim()).filter(Boolean))
function dbg(source: string, msg: string) {
  if (DEBUG_SOURCES.has(source)) console.log(`[dbg] source=${source} ${msg}`)
}

async function processSource(source: string) {
  const sourceId = keccak256(stringToHex(`${source}_${VAULT_VERSION}`))
  let batchId: bigint
  try {
    batchId = await publicClient.readContract({
      address: VISION,
      abi: VISION_ABI,
      functionName: 'latestBatchForSource',
      args: [sourceId],
    })
  } catch (e) {
    dbg(source, `latestBatchForSource error: ${e instanceof Error ? e.message : e}`)
    return
  }
  if (batchId === 0n) return

  const vaults = VAULTS_BY_SOURCE[source]
  if (!vaults || vaults.length === 0) return

  let configHash: Hex
  let expiration: bigint
  try {
    const batch = await publicClient.readContract({
      address: VISION,
      abi: VISION_ABI,
      functionName: 'getBatch',
      args: [batchId],
    })
    if (batch.settled || batch.paused) return
    configHash = batch.configHash
    expiration = (batch.createdAtTick + 1n) * batch.tickDuration + batch.settlementGrace
  } catch {
    return
  }
  const nowSec = BigInt(Math.floor(Date.now() / 1000))
  if (nowSec >= expiration) return

  // Try every vault for this source on this batch — markets only show
  // participants from joined vaults, so we want all five visible.
  for (const vault of vaults) {
    const key = `${source}:${batchId}:${vault.toLowerCase()}`
    if (attempted.has(key)) {
      dbg(source, `vault=${vault} already attempted`)
      continue
    }

    try {
      const pos = await publicClient.readContract({
        address: VISION,
        abi: VISION_ABI,
        functionName: 'getPosition',
        args: [batchId, vault],
      })
      if (pos.totalDeposited > 0n) {
        dbg(source, `vault=${vault} already has position deposit=${pos.totalDeposited}`)
        attempted.add(key)
        continue
      }
    } catch (e) {
      dbg(source, `vault=${vault} getPosition error: ${e instanceof Error ? e.message.slice(0, 80) : e}`)
    }
    try {
      const idle = await publicClient.readContract({
        address: vault,
        abi: VAULT_ABI,
        functionName: 'idleUSDC',
      })
      if (idle < DEPOSIT_WEI) {
        dbg(source, `vault=${vault} insufficient idle=${idle}`)
        attempted.add(key)
        continue
      }
    } catch (e) {
      dbg(source, `vault=${vault} idleUSDC error: ${e instanceof Error ? e.message.slice(0, 80) : e}`)
      continue
    }

    attempted.add(key)
    pendingWrites.push({ source, batchId, vault, configHash })
    dbg(source, `vault=${vault} queued`)
  }
}

interface PendingWrite {
  source: string
  batchId: bigint
  vault: `0x${string}`
  configHash: Hex
}
const pendingWrites: PendingWrite[] = []

async function flushWrites() {
  if (pendingWrites.length === 0) return
  await refreshNonceFloor()
  const batch = pendingWrites.splice(0, pendingWrites.length)
  // Allocate sequential nonces, fire all writes in parallel. Chain orders
  // them by nonce. Bitmap submission is fire-and-forget.
  await Promise.allSettled(
    batch.map(async ({ source, batchId, vault, configHash }) => {
      const { bitmap, hash: bitmapHash } = newBitmap()
      const nonce = takeNonce()
      try {
        const txHash = await walletClient.writeContract({
          address: vault,
          abi: VAULT_ABI,
          functionName: 'joinBatch',
          args: [batchId, configHash, DEPOSIT_WEI, bitmapHash],
          nonce,
        })
        health.joinedTotal += 1
        health.joinedThisRun += 1
        console.log(`[join] source=${source} batch=${batchId} vault=${vault} nonce=${nonce} tx=${txHash}`)
        submitBitmapToOracles(vault, batchId, bitmap, bitmapHash)
          .then((accepted) => {
            console.log(`[bitmap] source=${source} batch=${batchId} vault=${vault} accepted=${accepted}/${ORACLE_URLS.length}`)
          })
          .catch((e) => {
            console.warn(`[bitmap-fail] source=${source} batch=${batchId} vault=${vault} ${e instanceof Error ? e.message : String(e)}`)
          })
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 140) : String(err).slice(0, 140)
        health.lastError = `${source}/${batchId}/${vault}: ${msg}`
        console.warn(`[skip] source=${source} batch=${batchId} vault=${vault} nonce=${nonce} ${msg}`)
      }
    }),
  )
}

async function tick() {
  health.lastTickAt = Date.now()
  await Promise.allSettled(SOURCES.map((s) => processSource(s)))
  await flushWrites()
}

async function loop() {
  while (true) {
    try {
      await tick()
    } catch (e) {
      health.lastError = e instanceof Error ? e.message : String(e)
      console.warn('[tick] error', health.lastError)
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

loop().catch((e) => {
  console.error('[fatal]', e)
  process.exit(1)
})
