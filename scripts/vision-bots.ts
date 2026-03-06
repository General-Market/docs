#!/usr/bin/env npx tsx
/**
 * Vision Trading Bots — 2 bots that enter every batch on every tick with random bets.
 *
 * Usage:
 *   npx tsx scripts/vision-bots.ts
 *
 * Environment:
 *   L3_RPC          — L3 RPC URL (default: http://142.132.164.24/)
 *   ISSUER_BASE     — Base URL for issuers (default: http://116.203.156.98)
 *   DEPOSIT_AMOUNT  — USDC per batch join (default: 10)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  encodeFunctionData,
  keccak256,
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
const ISSUER_BASE = process.env.ISSUER_BASE || 'http://116.203.156.98'
const ISSUER_URLS = [
  `${ISSUER_BASE}/issuer1`,
  `${ISSUER_BASE}/issuer2`,
  `${ISSUER_BASE}/issuer3`,
]
const DEPOSIT_AMOUNT = parseUnits(process.env.DEPOSIT_AMOUNT || '10', 18) // L3 USDC = 18 dec
const STAKE_PER_TICK = DEPOSIT_AMOUNT

// Deployer key (for funding bots with gas + USDC)
const DEPLOYER_KEY = '0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537' as Hex

// Bot keys: Anvil accounts #5 and #6
const BOT_KEYS: Hex[] = [
  '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba', // Anvil #5 → 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc
  '0x92db14e403b83dfe3df233f83dfa3ecda7b66d68f858c9c788b44f8a0a495406', // Anvil #6 → 0x976EA74026E726554dB657fA54763abd0C3a0aa9
]

// Contract addresses
const VISION_ADDRESS = '0x8Abd0FF6B0A71629656164C8371921bc3DD03457' as Hex
const L3_WUSDC = '0xcb6C040bd4E1742840AD5542C6fDDaF74dB73AF6' as Hex

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
    fs.readFileSync(path.join(__dirname, '../deployments/vision-batches.json'), 'utf-8')
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
    if (bets[i]) { // true = UP
      const byteIdx = Math.floor(i / 8)
      const bitIdx = 7 - (i % 8) // big-endian: bit 0 = MSB
      bytes[byteIdx] |= (1 << bitIdx)
    }
  }
  return ('0x' + Buffer.from(bytes).toString('hex')) as Hex
}

function hashBitmap(bitmap: Hex): Hex {
  return keccak256(bitmap)
}

/** Generate random UP/DOWN bets for N markets */
function randomBets(marketCount: number): boolean[] {
  return Array.from({ length: marketCount }, () => Math.random() > 0.5)
}

/** Check if batch is in lock window */
function isLocked(tickDuration: number, lockOffset: number): boolean {
  const epochSec = Math.floor(Date.now() / 1000)
  const elapsed = epochSec % tickDuration
  const remaining = tickDuration - elapsed
  return remaining <= lockOffset
}

/** Wait until lock window passes */
async function waitForUnlock(tickDuration: number, lockOffset: number): Promise<void> {
  while (isLocked(tickDuration, lockOffset)) {
    const epochSec = Math.floor(Date.now() / 1000)
    const elapsed = epochSec % tickDuration
    const remaining = tickDuration - elapsed
    const waitSecs = remaining + 2 // wait past lock + 2s margin
    console.log(`  ⏳ Locked — waiting ${waitSecs}s for next tick`)
    await sleep(waitSecs * 1000)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Get market count for a batch from issuer API */
async function getMarketCount(batchId: number): Promise<number> {
  try {
    const res = await fetch(`${ISSUER_URLS[0]}/vision/batches`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return 20 // fallback
    const data = await res.json() as any
    const batch = data.batches?.find((b: any) => b.id === batchId || b.batch_id === batchId)
    if (batch) {
      return batch.market_count || batch.marketCount || 20
    }
    return 20
  } catch {
    return 20 // fallback
  }
}

/** Submit bitmap to all issuers */
async function submitBitmapToIssuers(
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
    ISSUER_URLS.map(url =>
      fetch(`${url}/vision/bitmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10_000),
      })
    )
  )

  const ok = results.filter(r => r.status === 'fulfilled' && (r.value as Response).ok).length
  const fail = results.length - ok
  if (ok === 0) {
    console.log(`    ⚠️  All ${results.length} issuer bitmap submissions failed`)
  } else if (fail > 0) {
    console.log(`    ⚠️  Bitmap submitted to ${ok}/${results.length} issuers`)
  }
}

// ── Main Bot Logic ──

async function fundBot(
  publicClient: PublicClient,
  deployerWallet: WalletClient,
  botAddress: Hex,
): Promise<void> {
  // Fund with gas ETH
  const balance = await publicClient.getBalance({ address: botAddress })
  if (balance < parseUnits('1', 18)) {
    console.log(`  Funding ${botAddress} with 10 GM (gas)...`)
    const hash = await deployerWallet.sendTransaction({
      to: botAddress,
      value: parseUnits('10', 18),
    })
    await publicClient.waitForTransactionReceipt({ hash })
  }

  // Mint USDC (100k to last a while)
  const usdcBalance = await publicClient.readContract({
    address: L3_WUSDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [botAddress],
  })
  if (usdcBalance < parseUnits('1000', 18)) {
    console.log(`  Minting 100,000 USDC for ${botAddress}...`)
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
  // Approve USDC → Vision
  const hash1 = await botWallet.writeContract({
    address: L3_WUSDC,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [VISION_ADDRESS, amount * 100n], // approve 100x to avoid per-tx approvals
  })
  await publicClient.waitForTransactionReceipt({ hash: hash1 })

  // Deposit into Vision balance
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
    // Check if already has a position
    const position = await publicClient.readContract({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'getPosition',
      args: [BigInt(batch.batchId), botAddress],
    }) as any

    if (position.balance > 0n) {
      // Already in batch with balance, skip
      return false
    }

    // Check Vision balance
    const visionBalance = await publicClient.readContract({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'balanceOf',
      args: [botAddress],
    }) as bigint

    if (visionBalance < DEPOSIT_AMOUNT) {
      // Need to deposit more
      await approveAndDeposit(publicClient, botWallet, botAddress, DEPOSIT_AMOUNT * 50n)
    }

    // Generate random bets
    const bets = randomBets(marketCount)
    const bitmap = encodeBitmap(bets)
    const bmpHash = hashBitmap(bitmap)

    // Wait for unlock if needed (only for short-tick batches)
    if (batch.tickDuration <= 300) {
      await waitForUnlock(batch.tickDuration, batch.lockOffset)
    }

    // Join batch
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

    // Submit bitmap to issuers
    await submitBitmapToIssuers(botAddress, batch.batchId, bitmap, bmpHash)

    const upCount = bets.filter(b => b).length
    console.log(`    ✅ Joined batch #${batch.batchId} (${batch.sourceKey}) — ${upCount}/${marketCount} UP`)
    return true
  } catch (e: any) {
    const msg = e.message?.slice(0, 120) || String(e)
    if (msg.includes('already joined') || msg.includes('AlreadyJoined')) {
      return false // expected
    }
    console.log(`    ❌ Batch #${batch.batchId} (${batch.sourceKey}): ${msg}`)
    return false
  }
}

async function runBot(botIndex: number, botKey: Hex, batches: BatchConfig[]): Promise<void> {
  const account = privateKeyToAccount(botKey)
  const botAddress = account.address as Hex

  console.log(`\n🤖 Bot ${botIndex + 1}: ${botAddress}`)

  const publicClient = createPublicClient({ chain, transport: http(L3_RPC) })
  const botWallet = createWalletClient({ account, chain, transport: http(L3_RPC) })
  const deployerAccount = privateKeyToAccount(DEPLOYER_KEY)
  const deployerWallet = createWalletClient({ account: deployerAccount, chain, transport: http(L3_RPC) })

  // Fund the bot
  await fundBot(publicClient, deployerWallet, botAddress)

  // Initial approve + deposit (large amount)
  console.log(`  Depositing initial USDC into Vision balance...`)
  await approveAndDeposit(publicClient, botWallet, botAddress, DEPOSIT_AMOUNT * BigInt(batches.length))

  // Get market counts for each batch (cache them)
  console.log(`  Fetching market counts...`)
  const marketCounts = new Map<number, number>()
  try {
    const res = await fetch(`${ISSUER_URLS[0]}/vision/batches`, { signal: AbortSignal.timeout(10_000) })
    if (res.ok) {
      const data = await res.json() as any
      for (const b of (data.batches || [])) {
        const id = b.id ?? b.batch_id
        const mc = b.market_count ?? b.marketCount ?? 20
        if (id !== undefined) marketCounts.set(id, mc)
      }
    }
  } catch { /* use fallback */ }

  // Join all batches
  let joined = 0
  for (const batch of batches) {
    const mc = marketCounts.get(batch.batchId) || 20
    const ok = await joinBatchForBot(publicClient, botWallet, botAddress, batch, mc)
    if (ok) joined++
    // Small delay between joins to avoid nonce issues
    await sleep(500)
  }

  console.log(`  Bot ${botIndex + 1} joined ${joined}/${batches.length} batches`)
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  Vision Trading Bots')
  console.log('═══════════════════════════════════════════')
  console.log(`  RPC: ${L3_RPC}`)
  console.log(`  Issuers: ${ISSUER_URLS.join(', ')}`)
  console.log(`  Deposit per batch: ${Number(DEPOSIT_AMOUNT) / 1e18} USDC`)

  const batches = loadBatches()
  console.log(`  Batches: ${batches.length}`)

  // Run both bots sequentially (to avoid nonce races on deployer funding)
  for (let i = 0; i < BOT_KEYS.length; i++) {
    await runBot(i, BOT_KEYS[i], batches)
  }

  console.log('\n═══════════════════════════════════════════')
  console.log('  Initial join complete. Starting loop...')
  console.log('═══════════════════════════════════════════\n')

  // Continuous loop: check every 60s for batches that need re-joining
  // (when balance runs out or position expires)
  while (true) {
    await sleep(60_000)

    for (let i = 0; i < BOT_KEYS.length; i++) {
      const account = privateKeyToAccount(BOT_KEYS[i])
      const botAddress = account.address as Hex
      const publicClient = createPublicClient({ chain, transport: http(L3_RPC) })
      const botWallet = createWalletClient({ account, chain, transport: http(L3_RPC) })

      let rejoined = 0
      for (const batch of batches) {
        try {
          const position = await publicClient.readContract({
            address: VISION_ADDRESS,
            abi: VISION_ABI,
            functionName: 'getPosition',
            args: [BigInt(batch.batchId), botAddress],
          }) as any

          // Re-join if balance is 0 (position expired)
          if (position.balance === 0n || position.stakePerTick === 0n) {
            // Check Vision balance first, top up if needed
            const vBal = await publicClient.readContract({
              address: VISION_ADDRESS,
              abi: VISION_ABI,
              functionName: 'balanceOf',
              args: [botAddress],
            }) as bigint

            if (vBal < DEPOSIT_AMOUNT) {
              const deployerAccount = privateKeyToAccount(DEPLOYER_KEY)
              const deployerWallet = createWalletClient({ account: deployerAccount, chain, transport: http(L3_RPC) })
              await fundBot(publicClient, deployerWallet, botAddress)
              await approveAndDeposit(publicClient, botWallet, botAddress, DEPOSIT_AMOUNT * 50n)
            }

            const mc = 20 // use default for re-joins
            const ok = await joinBatchForBot(publicClient, botWallet, botAddress, batch, mc)
            if (ok) rejoined++
            await sleep(500)
          }
        } catch {
          // skip on error
        }
      }

      if (rejoined > 0) {
        console.log(`🔄 Bot ${i + 1} re-joined ${rejoined} batches`)
      }
    }
  }
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
