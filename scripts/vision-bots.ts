#!/usr/bin/env npx tsx
/**
 * Vision Trading Bots — 10 bots that enter every batch, bet randomly,
 * and claim their gains after each tick resolution.
 *
 * Usage:
 *   npx tsx scripts/vision-bots.ts
 *
 * Environment:
 *   L3_RPC          — L3 RPC URL (default: http://142.132.164.24/)
 *   ORACLE_BASE     — Base URL for oracles (default: http://116.203.156.98)
 *   DEPOSIT_AMOUNT  — USDC per batch join (default: 10)
 *   BOT_COUNT       — Number of bots (default: 10)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  keccak256,
  toHex,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Chain,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import * as fs from 'fs'
import * as path from 'path'

// ── Config ──

const L3_RPC = process.env.L3_RPC || 'http://142.132.164.24/'
const ORACLE_BASE = process.env.ORACLE_BASE || 'http://116.203.156.98'
const ORACLE_URLS = [
  `${ORACLE_BASE}/oracle1`,
  `${ORACLE_BASE}/oracle2`,
  `${ORACLE_BASE}/oracle3`,
]
const DEPOSIT_AMOUNT = parseUnits(process.env.DEPOSIT_AMOUNT || '10', 18) // L3 USDC = 18 dec
const STAKE_PER_TICK = DEPOSIT_AMOUNT
const BOT_COUNT = parseInt(process.env.BOT_COUNT || '10', 10)
const CLAIM_INTERVAL_MS = 90_000 // claim every 90s
const REJOIN_INTERVAL_MS = 60_000 // check re-joins every 60s

// Load contract addresses from deployment files
const activeDeployment = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../deployments/active-deployment.json'), 'utf-8'),
)
const VISION_ADDRESS = activeDeployment.contracts.Vision as Hex
const L3_WUSDC = activeDeployment.contracts.L3_WUSDC as Hex
const ORACLE_REGISTRY = activeDeployment.contracts.OracleRegistry as Hex

// Deployer key (for funding bots with gas + USDC)
const DEPLOYER_KEY = '0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537' as Hex

// Generate 10 deterministic bot keys from seed
const BOT_KEYS: Hex[] = Array.from({ length: BOT_COUNT }, (_, i) =>
  keccak256(toHex(`vision-bot-${i}`)),
)

const chain: Chain = {
  id: 111222333,
  name: 'Index L3',
  nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
  rpcUrls: { default: { http: [L3_RPC] } },
}

// ── ABIs ──

const ERC20_ABI = [
  {
    name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'mint', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const

const VISION_ABI = [
  {
    name: 'getBatch', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'uint256' }],
    outputs: [{
      name: '', type: 'tuple',
      components: [
        { name: 'creator', type: 'address' },
        { name: 'sourceId', type: 'string' },
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
  },
  {
    name: 'getPosition', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{
      name: '', type: 'tuple',
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
  },
  {
    name: 'joinBatch', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'configHash', type: 'bytes32' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'stakePerTick', type: 'uint256' },
      { name: 'bitmapHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'claimRewards', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'fromTick', type: 'uint256' },
      { name: 'toTick', type: 'uint256' },
      { name: 'newBalance', type: 'uint256' },
      { name: 'blsSignature', type: 'bytes' },
      { name: 'referenceNonce', type: 'uint256' },
      { name: 'signersBitmask', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'withdraw', type: 'function', stateMutability: 'nonpayable',
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
    name: 'depositBalance', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'nextBatchId', type: 'function', stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const ORACLE_REGISTRY_ABI = [
  {
    name: 'lastSnapshotNonce', type: 'function', stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// ── Helpers ──

interface BatchConfig {
  batchId: number
  configHash: Hex
  tickDuration: number
  lockOffset: number
  sourceKey: string
}

function loadBatches(): BatchConfig[] {
  const raw = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../deployments/vision-batches.json'), 'utf-8'),
  )
  return Object.entries(raw.batches).map(([key, v]: [string, any]) => ({
    batchId: v.batchId,
    configHash: v.configHash as Hex,
    tickDuration: v.tickDuration,
    lockOffset: v.lockOffset,
    sourceKey: key,
  }))
}

/** Encode UP/DOWN bets as big-endian bitmap bytes */
function encodeBitmap(bets: boolean[]): Hex {
  const byteCount = Math.ceil(bets.length / 8)
  const bytes = new Uint8Array(byteCount)
  for (let i = 0; i < bets.length; i++) {
    if (bets[i]) {
      const byteIdx = Math.floor(i / 8)
      const bitIdx = 7 - (i % 8)
      bytes[byteIdx] |= (1 << bitIdx)
    }
  }
  return ('0x' + Buffer.from(bytes).toString('hex')) as Hex
}

function hashBitmap(bitmap: Hex): Hex {
  return keccak256(bitmap)
}

function randomBets(marketCount: number): boolean[] {
  return Array.from({ length: marketCount }, () => Math.random() > 0.5)
}

function isLocked(tickDuration: number, lockOffset: number): boolean {
  const epochSec = Math.floor(Date.now() / 1000)
  const elapsed = epochSec % tickDuration
  const remaining = tickDuration - elapsed
  return remaining <= lockOffset
}

async function waitForUnlock(tickDuration: number, lockOffset: number): Promise<void> {
  while (isLocked(tickDuration, lockOffset)) {
    const epochSec = Math.floor(Date.now() / 1000)
    const elapsed = epochSec % tickDuration
    const remaining = tickDuration - elapsed
    const waitSecs = remaining + 2
    console.log(`  ... Locked — waiting ${waitSecs}s`)
    await sleep(waitSecs * 1000)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/** Fetch market count for all batches from oracle API */
async function fetchMarketCounts(): Promise<Map<number, number>> {
  const counts = new Map<number, number>()
  try {
    const res = await fetch(`${ORACLE_URLS[0]}/vision/batches`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      const data = await res.json() as any
      for (const b of (data.batches || [])) {
        const id = b.id ?? b.batch_id
        const mc = b.market_count ?? b.marketCount ?? 20
        if (id !== undefined) counts.set(id, mc)
      }
    }
  } catch { /* fallback to defaults */ }
  return counts
}

/** Submit bitmap to all oracles */
async function submitBitmapToOracles(
  player: string,
  batchId: number,
  bitmap: Hex,
  bitmapHash: Hex,
): Promise<void> {
  const body = JSON.stringify({
    player,
    batch_id: batchId,
    bitmap_hex: bitmap,
    expected_hash: bitmapHash,
  })

  const results = await Promise.allSettled(
    ORACLE_URLS.map(url =>
      fetch(`${url}/vision/bitmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10_000),
      }),
    ),
  )

  const ok = results.filter(r => r.status === 'fulfilled' && (r.value as Response).ok).length
  if (ok === 0) {
    console.log(`    [!] All oracle bitmap submissions failed`)
  }
}

interface BalanceProof {
  batch_id: number
  player: string
  balance: string
  bls_sig: string
  signer_bitmap: string
  tick_id: number
}

/** Fetch BLS balance proof from oracle for claiming */
async function fetchBalanceProof(batchId: number, player: string): Promise<BalanceProof | null> {
  for (const url of ORACLE_URLS) {
    try {
      const res = await fetch(`${url}/vision/balance/${batchId}/${player}`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue
      const data = await res.json() as BalanceProof
      // Only return if we have a real BLS signature (not empty fallback)
      if (data.bls_sig && data.bls_sig.length > 10 && data.tick_id > 0) {
        return data
      }
    } catch { /* try next oracle */ }
  }
  return null
}

// ── Bot Operations ──

async function fundBot(
  publicClient: PublicClient,
  deployerWallet: WalletClient,
  botAddress: Hex,
): Promise<void> {
  const balance = await publicClient.getBalance({ address: botAddress })
  if (balance < parseUnits('1', 18)) {
    console.log(`  Funding ${shortAddr(botAddress)} with 10 GM (gas)...`)
    const hash = await deployerWallet.sendTransaction({
      to: botAddress,
      value: parseUnits('10', 18),
    })
    await publicClient.waitForTransactionReceipt({ hash })
  }

  const usdcBalance = await publicClient.readContract({
    address: L3_WUSDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [botAddress],
  })
  if (usdcBalance < parseUnits('1000', 18)) {
    console.log(`  Minting 100,000 USDC for ${shortAddr(botAddress)}...`)
    const hash = await deployerWallet.writeContract({
      address: L3_WUSDC,
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [botAddress, parseUnits('100000', 18)],
    })
    await publicClient.waitForTransactionReceipt({ hash })
  }
}

async function approveAndDeposit(
  publicClient: PublicClient,
  botWallet: WalletClient,
  botAddress: Hex,
  amount: bigint,
): Promise<void> {
  const hash1 = await botWallet.writeContract({
    address: L3_WUSDC,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [VISION_ADDRESS, amount * 100n],
  })
  await publicClient.waitForTransactionReceipt({ hash: hash1 })

  const hash2 = await botWallet.writeContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'depositBalance',
    args: [amount],
  })
  await publicClient.waitForTransactionReceipt({ hash: hash2 })
}

async function joinBatchForBot(
  publicClient: PublicClient,
  botWallet: WalletClient,
  botAddress: Hex,
  batch: BatchConfig,
  marketCount: number,
): Promise<boolean> {
  try {
    const position = await publicClient.readContract({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'getPosition',
      args: [BigInt(batch.batchId), botAddress],
    }) as any

    if (position.balance > 0n) {
      return false // already in batch with active balance
    }

    // Check Vision balance, top up if needed
    const visionBalance = await publicClient.readContract({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'balanceOf',
      args: [botAddress],
    }) as bigint

    if (visionBalance < DEPOSIT_AMOUNT) {
      await approveAndDeposit(publicClient, botWallet, botAddress, DEPOSIT_AMOUNT * 50n)
    }

    const bets = randomBets(marketCount)
    const bitmap = encodeBitmap(bets)
    const bmpHash = hashBitmap(bitmap)

    if (batch.tickDuration <= 300 && batch.lockOffset > 0) {
      await waitForUnlock(batch.tickDuration, batch.lockOffset)
    }

    const hash = await botWallet.writeContract({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'joinBatch',
      args: [
        BigInt(batch.batchId),
        batch.configHash,
        DEPOSIT_AMOUNT,
        STAKE_PER_TICK,
        bmpHash,
      ],
    })
    await publicClient.waitForTransactionReceipt({ hash })

    await submitBitmapToOracles(botAddress, batch.batchId, bitmap, bmpHash)

    const upCount = bets.filter(b => b).length
    console.log(`    [+] Joined #${batch.batchId} (${batch.sourceKey}) — ${upCount}/${marketCount} UP`)
    return true
  } catch (e: any) {
    const msg = e.message?.slice(0, 120) || String(e)
    if (msg.includes('already joined') || msg.includes('AlreadyJoined')) {
      return false
    }
    console.log(`    [-] Batch #${batch.batchId} (${batch.sourceKey}): ${msg}`)
    return false
  }
}

/** Claim rewards for a bot on a specific batch using BLS balance proof */
async function claimForBot(
  publicClient: PublicClient,
  botWallet: WalletClient,
  botAddress: Hex,
  batchId: number,
): Promise<boolean> {
  try {
    // 1. Get current on-chain position
    const position = await publicClient.readContract({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'getPosition',
      args: [BigInt(batchId), botAddress],
    }) as any

    if (position.stakePerTick === 0n) return false // not joined

    // 2. Fetch balance proof from oracle
    const proof = await fetchBalanceProof(batchId, botAddress)
    if (!proof) return false

    const proofBalance = BigInt(proof.balance)
    const proofTickId = BigInt(proof.tick_id)

    // 3. Determine tick range for claim
    const lastClaimed = position.lastClaimedTick as bigint
    const startTick = position.startTick as bigint
    const fromTick = lastClaimed === 0n ? startTick + 1n : lastClaimed + 1n
    const toTick = proofTickId

    if (toTick < fromTick) return false // nothing new to claim

    // 4. Get referenceNonce from OracleRegistry
    const referenceNonce = await publicClient.readContract({
      address: ORACLE_REGISTRY,
      abi: ORACLE_REGISTRY_ABI,
      functionName: 'lastSnapshotNonce',
    })

    // 5. Parse BLS sig and signer bitmap
    const blsSig = (`0x${proof.bls_sig}`) as Hex
    const signersBitmask = BigInt(proof.signer_bitmap)

    if (signersBitmask === 0n) return false // no valid signers

    // 6. Call claimRewards
    const hash = await botWallet.writeContract({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'claimRewards',
      args: [
        BigInt(batchId),
        fromTick,
        toTick,
        proofBalance,
        blsSig,
        referenceNonce,
        signersBitmask,
      ],
    })
    await publicClient.waitForTransactionReceipt({ hash })

    // Log PnL
    const currentBalance = position.balance as bigint
    const delta = proofBalance - currentBalance
    const deltaFormatted = Number(delta) / 1e18
    const sign = delta >= 0n ? '+' : ''
    console.log(`    [C] Batch #${batchId} claimed ticks ${fromTick}-${toTick}: ${sign}${deltaFormatted.toFixed(2)} USDC`)
    return true
  } catch (e: any) {
    const msg = e.message?.slice(0, 150) || String(e)
    // Don't log expected failures
    if (msg.includes('TickAlreadyClaimed') || msg.includes('NotJoined')) return false
    if (msg.includes('BLSVerifier')) {
      // BLS verification failure — proof might be stale or from different nonce
      return false
    }
    console.log(`    [!] Claim batch #${batchId}: ${msg}`)
    return false
  }
}

// ── Main ──

async function runBot(
  botIndex: number,
  botKey: Hex,
  batches: BatchConfig[],
  marketCounts: Map<number, number>,
  deployerWallet: WalletClient,
): Promise<{
  publicClient: PublicClient
  botWallet: WalletClient
  botAddress: Hex
}> {
  const account = privateKeyToAccount(botKey)
  const botAddress = account.address as Hex

  console.log(`\n  Bot ${botIndex + 1}: ${botAddress}`)

  const publicClient = createPublicClient({ chain, transport: http(L3_RPC) })
  const botWallet = createWalletClient({ account, chain, transport: http(L3_RPC) })

  // Fund
  await fundBot(publicClient, deployerWallet, botAddress)

  // Deposit into Vision balance
  console.log(`  Depositing USDC into Vision...`)
  await approveAndDeposit(publicClient, botWallet, botAddress, DEPOSIT_AMOUNT * BigInt(batches.length))

  // Join all batches
  let joined = 0
  for (const batch of batches) {
    const mc = marketCounts.get(batch.batchId) || 20
    const ok = await joinBatchForBot(publicClient, botWallet, botAddress, batch, mc)
    if (ok) joined++
    await sleep(300) // small delay to avoid nonce issues
  }

  console.log(`  Bot ${botIndex + 1} joined ${joined}/${batches.length} batches`)

  return { publicClient, botWallet, botAddress }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  Vision Trading Bots')
  console.log('═══════════════════════════════════════════')
  console.log(`  RPC:     ${L3_RPC}`)
  console.log(`  Oracles: ${ORACLE_BASE}`)
  console.log(`  Vision:  ${VISION_ADDRESS}`)
  console.log(`  WUSDC:   ${L3_WUSDC}`)
  console.log(`  Registry:${ORACLE_REGISTRY}`)
  console.log(`  Deposit: ${Number(DEPOSIT_AMOUNT) / 1e18} USDC`)
  console.log(`  Bots:    ${BOT_COUNT}`)

  const batches = loadBatches()
  console.log(`  Batches: ${batches.length}`)

  const marketCounts = await fetchMarketCounts()
  console.log(`  Markets fetched for ${marketCounts.size} batches`)

  const deployerAccount = privateKeyToAccount(DEPLOYER_KEY)
  const deployerWallet = createWalletClient({
    account: deployerAccount,
    chain,
    transport: http(L3_RPC),
  })

  // Initialize all bots sequentially (deployer funding creates nonce deps)
  const bots: Array<{
    publicClient: PublicClient
    botWallet: WalletClient
    botAddress: Hex
    index: number
  }> = []

  for (let i = 0; i < BOT_COUNT; i++) {
    const bot = await runBot(i, BOT_KEYS[i], batches, marketCounts, deployerWallet)
    bots.push({ ...bot, index: i })
  }

  console.log('\n═══════════════════════════════════════════')
  console.log('  All bots initialized. Starting main loop.')
  console.log('  Claims every 90s, re-joins every 60s.')
  console.log('═══════════════════════════════════════════\n')

  let lastClaimTime = 0
  let iteration = 0

  while (true) {
    iteration++
    const now = Date.now()

    // ── Claim rewards ──
    if (now - lastClaimTime >= CLAIM_INTERVAL_MS) {
      lastClaimTime = now
      let totalClaimed = 0

      for (const bot of bots) {
        let claimed = 0
        for (const batch of batches) {
          const ok = await claimForBot(
            bot.publicClient,
            bot.botWallet,
            bot.botAddress,
            batch.batchId,
          )
          if (ok) claimed++
          // Tiny delay between claim txs
          if (ok) await sleep(200)
        }
        if (claimed > 0) {
          console.log(`  Bot ${bot.index + 1} (${shortAddr(bot.botAddress)}): claimed ${claimed} batches`)
          totalClaimed += claimed
        }
      }

      if (totalClaimed > 0) {
        console.log(`  --- Claim cycle #${iteration}: ${totalClaimed} claims total ---`)
      }
    }

    // ── Re-join expired positions ──
    for (const bot of bots) {
      let rejoined = 0

      for (const batch of batches) {
        try {
          const position = await bot.publicClient.readContract({
            address: VISION_ADDRESS,
            abi: VISION_ABI,
            functionName: 'getPosition',
            args: [BigInt(batch.batchId), bot.botAddress],
          }) as any

          if (position.balance === 0n || position.stakePerTick === 0n) {
            // Position expired or empty — re-join
            const vBal = await bot.publicClient.readContract({
              address: VISION_ADDRESS,
              abi: VISION_ABI,
              functionName: 'balanceOf',
              args: [bot.botAddress],
            }) as bigint

            if (vBal < DEPOSIT_AMOUNT) {
              await fundBot(bot.publicClient, deployerWallet, bot.botAddress)
              await approveAndDeposit(bot.publicClient, bot.botWallet, bot.botAddress, DEPOSIT_AMOUNT * 50n)
            }

            const mc = marketCounts.get(batch.batchId) || 20
            const ok = await joinBatchForBot(
              bot.publicClient,
              bot.botWallet,
              bot.botAddress,
              batch,
              mc,
            )
            if (ok) rejoined++
            await sleep(300)
          }
        } catch { /* skip on error */ }
      }

      if (rejoined > 0) {
        console.log(`  Bot ${bot.index + 1} re-joined ${rejoined} batches`)
      }
    }

    await sleep(REJOIN_INTERVAL_MS)
  }
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
