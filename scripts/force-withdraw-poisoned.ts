#!/usr/bin/env npx tsx
/**
 * Force-withdraw poisoned Vision positions.
 *
 * A "poisoned" position was joined with a null or mismatched bitmap hash.
 * The oracle will never resolve it. The USDC sits locked forever unless withdrawn.
 *
 * This script:
 *   1. Reads all 10 bot keys from docker/testnet/vision-swarm/swarm.env
 *   2. For each bot, reads their pnl.json from the VPS (or local if passed as arg)
 *   3. For each poisoned position (flag poisoned=true or null bitmapHash on-chain),
 *      fetches the oracle balance proof
 *   4. If signer_bitmap has popcount >= 2: calls Vision.withdraw()
 *   5. If only 1 oracle signed: logs warning, skips
 *   6. After withdrawal: removes that batch_id from the bot's pnl.json so the bot
 *      rejoins fresh on next cycle
 *
 * Usage:
 *   # Against testnet oracles (VPS must be reachable):
 *   npx tsx scripts/force-withdraw-poisoned.ts
 *
 *   # Supply a directory with local pnl JSON files (pnl-0.json … pnl-9.json):
 *   PNL_DIR=/path/to/pnl-data npx tsx scripts/force-withdraw-poisoned.ts
 *
 *   # Dry-run — read and report without executing transactions:
 *   DRY_RUN=1 npx tsx scripts/force-withdraw-poisoned.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Chain,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// ── Config ──────────────────────────────────────────────────────────────────

const SWARM_ENV_PATH = path.resolve(
  __dirname,
  '../docker/testnet/vision-swarm/swarm.env',
)
const DEPLOYMENT_PATH = path.resolve(
  __dirname,
  '../deployments/active-deployment.json',
)
// pnl-data lives on VPS. Pass PNL_DIR pointing to a local copy, or
// the script will try /app/pnl-data (inside Docker) and then ./pnl-data.
const PNL_DIR =
  process.env.PNL_DIR ||
  path.resolve(__dirname, '../docker/testnet/vision-swarm/pnl-data')
const DRY_RUN = process.env.DRY_RUN === '1'

const L3_CHAIN: Chain = {
  id: 111222333,
  name: 'Index L3',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://142.132.164.24/'] } },
}

// ── ABI fragments ───────────────────────────────────────────────────────────

const VISION_ABI = [
  {
    name: 'getPosition',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    outputs: [
      {
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
          { name: 'isVirtual', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'finalBalance', type: 'uint256' },
      { name: 'blsSignature', type: 'bytes' },
      { name: 'referenceNonce', type: 'uint256' },
      { name: 'signersBitmask', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const ORACLE_REGISTRY_ABI = [
  {
    name: 'lastSnapshotNonce',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// ── Null bitmap hash (keccak256 of empty bytes) ──────────────────────────────
const NULL_BITMAP_HASH =
  'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
const ZERO_HASH = '0'.repeat(64)

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadSwarmEnv(): Record<string, string> {
  const raw = fs.readFileSync(SWARM_ENV_PATH, 'utf8')
  const result: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    result[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  return result
}

function loadDeployment(): { visionAddr: string; oracleRegistryAddr: string; rpcUrl: string } {
  const raw = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, 'utf8'))
  return {
    visionAddr: raw.contracts.Vision,
    oracleRegistryAddr: raw.contracts.OracleRegistry,
    rpcUrl: raw.rpcUrl || 'http://142.132.164.24/',
  }
}

function popcount(n: number): number {
  let count = 0
  while (n) {
    count += n & 1
    n >>= 1
  }
  return count
}

function isNullHash(hash: string): boolean {
  const h = hash.replace('0x', '').toLowerCase()
  return h === NULL_BITMAP_HASH || h === ZERO_HASH
}

async function fetchOracleProof(
  oracleUrl: string,
  batchId: number,
  player: string,
): Promise<{ balance: bigint; blsSig: Hex; referenceNonce: bigint; signerBitmap: number } | null> {
  try {
    const url = `${oracleUrl}/vision/balance/${batchId}/${player}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!resp.ok) return null
    const data = await resp.json() as {
      balance?: string | number
      bls_sig?: string
      signer_bitmap?: string | number
      reference_nonce?: string | number
    }
    if (!data.bls_sig) return null
    return {
      balance: BigInt(data.balance ?? 0),
      blsSig: data.bls_sig as Hex,
      referenceNonce: BigInt(data.reference_nonce ?? 0),
      signerBitmap: Number(data.signer_bitmap ?? 0),
    }
  } catch {
    return null
  }
}

interface PnlFile {
  active: Array<{
    batch_id: number
    poisoned?: boolean
    bitmap_hex?: string
    bitmap_hash_hex?: string
    balance?: number
    deposited?: number
    [k: string]: unknown
  }>
  history: unknown[]
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const env = loadSwarmEnv()
  const deployment = loadDeployment()
  const oracleUrls: string[] = (env.ORACLE_URLS ?? '').split(',').filter(Boolean)
  const rpcUrl = env.L3_RPC_URL || deployment.rpcUrl || 'http://142.132.164.24/'

  console.log(`RPC:          ${rpcUrl}`)
  console.log(`Vision:       ${deployment.visionAddr}`)
  console.log(`OracleReg:    ${deployment.oracleRegistryAddr}`)
  console.log(`Oracles:      ${oracleUrls.join(', ')}`)
  console.log(`PNL_DIR:      ${PNL_DIR}`)
  console.log(`DRY_RUN:      ${DRY_RUN}`)
  console.log()

  const publicClient = createPublicClient({
    chain: { ...L3_CHAIN, rpcUrls: { default: { http: [rpcUrl] } } },
    transport: http(rpcUrl),
  })

  // Snapshot nonce for BLS
  let snapshotNonce = 0n
  try {
    snapshotNonce = await publicClient.readContract({
      address: deployment.oracleRegistryAddr as Hex,
      abi: ORACLE_REGISTRY_ABI,
      functionName: 'lastSnapshotNonce',
    })
    console.log(`Snapshot nonce: ${snapshotNonce}`)
  } catch (e) {
    console.warn(`Could not read snapshot nonce: ${e}. Using 0.`)
  }

  const summary = {
    bots: 0,
    poisonedFound: 0,
    proofReady: 0,
    withdrawn: 0,
    skippedWeakProof: 0,
    skippedNoProof: 0,
    pnlCleaned: 0,
  }

  for (let i = 0; i < 10; i++) {
    const keyEnv = `SWARM_BOT_${i}_KEY`
    const privateKey = env[keyEnv]
    if (!privateKey) {
      console.warn(`Bot ${i}: no private key in swarm.env (${keyEnv}) — skipping`)
      continue
    }

    const account = privateKeyToAccount(privateKey as Hex)
    const botAddr = account.address
    summary.bots++

    const pnlPath = path.join(PNL_DIR, `pnl-${i}.json`)
    if (!fs.existsSync(pnlPath)) {
      console.log(`Bot ${i} (${botAddr.slice(0, 10)}…): no pnl file at ${pnlPath} — skipping`)
      continue
    }

    const pnlRaw = fs.readFileSync(pnlPath, 'utf8')
    const pnl: PnlFile = JSON.parse(pnlRaw)

    // Identify poisoned positions: either flagged in JSON or null hash on-chain
    const poisonedIds: number[] = []

    for (const pos of pnl.active) {
      const batchId = pos.batch_id

      // Already flagged in pnl.json
      if (pos.poisoned) {
        poisonedIds.push(batchId)
        continue
      }

      // Not flagged — check on-chain bitmap hash
      try {
        const onChain = await publicClient.readContract({
          address: deployment.visionAddr as Hex,
          abi: VISION_ABI,
          functionName: 'getPosition',
          args: [BigInt(batchId), botAddr],
        }) as { bitmapHash: Hex; stakePerTick: bigint; joinTimestamp: bigint }

        if (onChain.joinTimestamp === 0n) {
          // Position doesn't exist — stale pnl entry, will be cleaned
          console.log(`Bot ${i} batch ${batchId}: no on-chain position (stale) — will remove from pnl`)
          poisonedIds.push(batchId) // treat as poisoned to remove
          continue
        }

        const hashHex = onChain.bitmapHash.replace('0x', '').toLowerCase()
        if (isNullHash(hashHex)) {
          console.log(`Bot ${i} batch ${batchId}: null bitmap hash on-chain — poisoned`)
          poisonedIds.push(batchId)
        }
      } catch (e) {
        console.warn(`Bot ${i} batch ${batchId}: chain read failed: ${e}`)
      }
    }

    if (poisonedIds.length === 0) {
      console.log(`Bot ${i} (${botAddr.slice(0, 10)}…): no poisoned positions`)
      continue
    }

    console.log(`Bot ${i} (${botAddr.slice(0, 10)}…): ${poisonedIds.length} poisoned — ${poisonedIds.join(', ')}`)
    summary.poisonedFound += poisonedIds.length

    const walletClient = createWalletClient({
      account,
      chain: { ...L3_CHAIN, rpcUrls: { default: { http: [rpcUrl] } } },
      transport: http(rpcUrl),
    })

    const withdrawnIds: number[] = []

    for (const batchId of poisonedIds) {
      // Try each oracle until we get a proof with popcount >= 2
      let proof: Awaited<ReturnType<typeof fetchOracleProof>> = null
      let bestSignerCount = 0

      for (const oracleUrl of oracleUrls) {
        const p = await fetchOracleProof(oracleUrl, batchId, botAddr)
        if (!p) continue
        const signerCount = popcount(p.signerBitmap)
        if (signerCount > bestSignerCount) {
          bestSignerCount = signerCount
          proof = p
        }
        if (bestSignerCount >= 2) break
      }

      if (!proof) {
        console.log(`  Batch ${batchId}: no oracle proof available — skipping`)
        summary.skippedNoProof++
        continue
      }

      summary.proofReady++
      const signerCount = popcount(proof.signerBitmap)

      if (signerCount < 2) {
        console.warn(
          `  Batch ${batchId}: only ${signerCount} oracle(s) signed (bitmap=0x${proof.signerBitmap.toString(16)}) — skipping (need >= 2)`,
        )
        summary.skippedWeakProof++
        continue
      }

      console.log(
        `  Batch ${batchId}: proof ready (signers=${signerCount}, finalBalance=${proof.balance}, nonce=${proof.referenceNonce})`,
      )

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would call Vision.withdraw(${batchId}, ${proof.balance}, ...)`)
        withdrawnIds.push(batchId)
        summary.withdrawn++
        continue
      }

      try {
        const txHash = await walletClient.writeContract({
          address: deployment.visionAddr as Hex,
          abi: VISION_ABI,
          functionName: 'withdraw',
          args: [
            BigInt(batchId),
            proof.balance,
            proof.blsSig as Hex,
            proof.referenceNonce,
            BigInt(proof.signerBitmap),
          ],
          gas: 500_000n,
        })
        console.log(`  Batch ${batchId}: withdraw tx ${txHash}`)
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
        if (receipt.status === 'reverted') {
          console.error(`  Batch ${batchId}: transaction reverted`)
        } else {
          console.log(`  Batch ${batchId}: withdrawn successfully`)
          withdrawnIds.push(batchId)
          summary.withdrawn++
        }
      } catch (e) {
        console.error(`  Batch ${batchId}: withdraw failed: ${e}`)
      }
    }

    // Clean pnl.json — move withdrawn positions to history, remove stale ones
    if (withdrawnIds.length > 0) {
      const cleanedActive = pnl.active.filter((pos) => !withdrawnIds.includes(pos.batch_id))
      const newHistory = [
        ...pnl.history,
        ...pnl.active
          .filter((pos) => withdrawnIds.includes(pos.batch_id))
          .map((pos) => ({ ...pos, withdrawn_by_force_script: true })),
      ]
      const updated: PnlFile = { active: cleanedActive, history: newHistory }
      if (!DRY_RUN) {
        fs.writeFileSync(pnlPath, JSON.stringify(updated, null, 2))
        console.log(`  pnl-${i}.json: removed ${withdrawnIds.length} positions, ${cleanedActive.length} remaining`)
      } else {
        console.log(`  [DRY RUN] Would remove ${withdrawnIds.length} positions from pnl-${i}.json`)
      }
      summary.pnlCleaned += withdrawnIds.length
    }

    console.log()
  }

  console.log('── Summary ─────────────────────────────────────────')
  console.log(`Bots processed:       ${summary.bots}`)
  console.log(`Poisoned positions:   ${summary.poisonedFound}`)
  console.log(`With oracle proof:    ${summary.proofReady}`)
  console.log(`Withdrawn:            ${summary.withdrawn}`)
  console.log(`Skipped (weak proof): ${summary.skippedWeakProof}`)
  console.log(`Skipped (no proof):   ${summary.skippedNoProof}`)
  console.log(`PnL entries cleaned:  ${summary.pnlCleaned}`)

  if (summary.skippedWeakProof > 0) {
    console.log()
    console.log(
      'WARNING: Some positions had only 1 oracle signature. The contract requires >= 2.',
    )
    console.log(
      'Options: (1) wait for more ticks so oracles aggregate, (2) use forceWithdraw via a BLS-signed oracle call.',
    )
  }

  if (summary.withdrawn === 0 && summary.poisonedFound > 0 && !DRY_RUN) {
    console.log()
    console.log(
      'Nothing was withdrawn. If all proofs have 1 signer, the simplest fix is to',
    )
    console.log(
      'delete the pnl.json files directly on the VPS — the USDC stays in Vision.depositBalance,',
    )
    console.log(
      'bots will rejoin fresh, and the stuck USDC is not lost (it remains as their Vision balance).',
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
