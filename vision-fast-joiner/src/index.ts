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
import { createPublicClient, createWalletClient, http, parseUnits, getAddress, keccak256, stringToHex, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'

const __dirname = dirname(fileURLToPath(import.meta.url))

const L3_RPC = process.env.L3_RPC_URL || 'https://rpc.generalmarket.io/'
const DEPLOYMENT_JSON = process.env.DEPLOYMENT_JSON || resolve(__dirname, '../../deployments/active-deployment.json')
const PK = process.env.MANAGER_PRIVATE_KEY as Hex | undefined
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '3000', 10)
const DEPOSIT_USDC = parseFloat(process.env.DEPOSIT_USDC || '10')
const HEALTH_PORT = parseInt(process.env.FAST_JOINER_HEALTH_PORT || '9202', 10)
const VAULT_VERSION = process.env.BATCH_VERSION || 'v2'

if (!PK) {
  console.error('[fatal] MANAGER_PRIVATE_KEY not set')
  process.exit(1)
}

const deployment = JSON.parse(readFileSync(DEPLOYMENT_JSON, 'utf8')) as {
  contracts: { Vision: string; L3_WUSDC?: string; USDC?: string }
  sourceVaults: Record<string, string[]>
  chainId: number
}

const VISION = getAddress(deployment.contracts.Vision)
const USDC = getAddress(deployment.contracts.L3_WUSDC || deployment.contracts.USDC || '0x0')
const SOURCES = Object.keys(deployment.sourceVaults)
const VAULTS_BY_SOURCE: Record<string, `0x${string}`[]> = Object.fromEntries(
  Object.entries(deployment.sourceVaults).map(([s, vs]) => [s, vs.map(getAddress)]),
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
const publicClient = createPublicClient({ chain, transport: http(L3_RPC, { timeout: 15_000 }) })
const walletClient = createWalletClient({ chain, transport: http(L3_RPC, { timeout: 15_000 }), account })

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
const ZERO_BITMAP_HASH = keccak256(stringToHex('fast-joiner')) as Hex

async function tick() {
  health.lastTickAt = Date.now()
  for (const source of SOURCES) {
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
      continue
    }
    if (batchId === 0n) continue

    const key = `${source}:${batchId}`
    if (attempted.has(key)) continue

    const vaults = VAULTS_BY_SOURCE[source]
    if (!vaults || vaults.length === 0) continue
    const vault = vaults[Number(batchId % BigInt(vaults.length))]

    let configHash: Hex
    let expiration: bigint
    try {
      const batch = await publicClient.readContract({
        address: VISION,
        abi: VISION_ABI,
        functionName: 'getBatch',
        args: [batchId],
      })
      if (batch.settled || batch.paused) {
        attempted.add(key)
        continue
      }
      configHash = batch.configHash
      expiration = (batch.createdAtTick + 1n) * batch.tickDuration + batch.settlementGrace
    } catch {
      continue
    }
    const nowSec = BigInt(Math.floor(Date.now() / 1000))
    if (nowSec >= expiration) {
      attempted.add(key)
      continue
    }
    // Already joined? Skip.
    try {
      const pos = await publicClient.readContract({
        address: VISION,
        abi: VISION_ABI,
        functionName: 'getPosition',
        args: [batchId, vault],
      })
      if (pos.totalDeposited > 0n) {
        attempted.add(key)
        continue
      }
    } catch {}

    // Idle USDC check.
    try {
      const idle = await publicClient.readContract({
        address: vault,
        abi: VAULT_ABI,
        functionName: 'idleUSDC',
      })
      if (idle < DEPOSIT_WEI) {
        attempted.add(key)
        continue
      }
    } catch {
      continue
    }

    attempted.add(key)
    try {
      const txHash = await walletClient.writeContract({
        address: vault,
        abi: VAULT_ABI,
        functionName: 'joinBatch',
        args: [batchId, configHash, DEPOSIT_WEI, ZERO_BITMAP_HASH],
      })
      health.joinedTotal += 1
      health.joinedThisRun += 1
      console.log(`[join] source=${source} batch=${batchId} vault=${vault} tx=${txHash}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 140) : String(err).slice(0, 140)
      health.lastError = `${source}/${batchId}: ${msg}`
      // Don't unblock on error — usually nonce/gas/already-joined; future ticks can retry once expiration changes.
      console.warn(`[skip] source=${source} batch=${batchId} ${msg}`)
    }
  }
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
