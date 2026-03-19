#!/usr/bin/env npx tsx
/**
 * Buy all ITPs with random amounts between $1 and $100.
 * Benchmarks: order placement, fill time, NAV accuracy.
 *
 * Usage: npx tsx scripts/buy-all-itps.ts [--dry-run] [--max-itps 10]
 */

import { createPublicClient, createWalletClient, http, encodeFunctionData, parseUnits, formatUnits, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const L3_RPC = process.env.L3_RPC || 'http://142.132.164.24/'
const DEPLOYER_KEY = (process.env.DEPLOYER_KEY || '0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537') as Hex
const INDEX = (process.env.INDEX_ADDRESS || '0x61988A72e2c898702bf634D5D2A0278694CC731C') as Hex
const L3_USDC = (process.env.L3_USDC || '0x4c782452e7fA2AE5f11d498a0B43a44B5d97906B') as Hex

const DRY_RUN = process.argv.includes('--dry-run')
const MAX_ITPS = parseInt(process.argv.find(a => a.startsWith('--max-itps='))?.split('=')[1] || '77')

const chain = { id: 111222333, name: 'Index L3', nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 }, rpcUrls: { default: { http: [L3_RPC] } } }
const account = privateKeyToAccount(DEPLOYER_KEY)
const publicClient = createPublicClient({ chain, transport: http(L3_RPC) })
const walletClient = createWalletClient({ chain, account, transport: http(L3_RPC) })

const INDEX_ABI = [
  { name: 'submitOrder', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'itpId', type: 'bytes32' },
      { name: 'side', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
      { name: 'limitPrice', type: 'uint256' },
      { name: 'slippageTier', type: 'uint8' },
    ],
    outputs: [{ type: 'uint256' }] },
  { name: 'getITPState', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'itpId', type: 'bytes32' }],
    outputs: [
      { name: 'assets', type: 'address[]' },
      { name: 'weights', type: 'uint256[]' },
      { name: 'inventory', type: 'uint256[]' },
      { name: 'totalSupply', type: 'uint256' },
      { name: 'totalValue', type: 'uint256' },
    ] },
  { name: 'getUserShares', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }, { name: 'itpId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'getOrder', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [
      { name: 'id', type: 'uint256' }, { name: 'user', type: 'address' },
      { name: 'pairId', type: 'bytes32' }, { name: 'side', type: 'uint8' },
      { name: 'amount', type: 'uint256' }, { name: 'limitPrice', type: 'uint256' },
      { name: 'slippageTier', type: 'uint8' }, { name: 'deadline', type: 'uint256' },
      { name: 'itpId', type: 'bytes32' }, { name: 'timestamp', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ] },
] as const

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
] as const

interface Benchmark {
  itpId: number
  amount: string
  orderPlaceMs: number
  fillMs: number | null
  status: string
  orderId: number | null
  sharesBefore: string
  sharesAfter: string | null
}

function itpIdToBytes32(id: number): Hex {
  return ('0x' + id.toString(16).padStart(64, '0')) as Hex
}

function randomAmount(): bigint {
  const dollars = Math.floor(Math.random() * 99) + 1 // 1-100
  return parseUnits(dollars.toString(), 18)
}

async function getItpIds(): Promise<number[]> {
  const ids: number[] = []
  for (let i = 1; i <= MAX_ITPS; i++) {
    try {
      await publicClient.readContract({
        address: INDEX, abi: INDEX_ABI, functionName: 'getITPState',
        args: [itpIdToBytes32(i)],
      })
      ids.push(i)
    } catch {
      // ITP doesn't exist
    }
  }
  return ids
}

async function main() {
  console.log('=== BUY ALL ITPs — Load Test + Benchmark ===')
  console.log(`RPC: ${L3_RPC}`)
  console.log(`Index: ${INDEX}`)
  console.log(`Deployer: ${account.address}`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log('')

  // 1. Get USDC balance
  const usdcBal = await publicClient.readContract({
    address: L3_USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
  })
  console.log(`USDC balance: ${formatUnits(usdcBal, 18)}`)

  // 2. Discover ITPs
  console.log('Scanning ITPs...')
  const startScan = Date.now()
  const itpIds = await getItpIds()
  console.log(`Found ${itpIds.length} ITPs in ${Date.now() - startScan}ms`)

  // 3. Approve USDC for Index (unlimited)
  if (!DRY_RUN) {
    console.log('Approving USDC...')
    const approveTx = await walletClient.writeContract({
      address: L3_USDC, abi: ERC20_ABI, functionName: 'approve',
      args: [INDEX, parseUnits('999999999', 18)],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
    console.log('Approved')
  }

  // 4. Buy each ITP
  const benchmarks: Benchmark[] = []
  let totalPlaceMs = 0
  let totalFillMs = 0
  let filled = 0
  let failed = 0

  for (const itpId of itpIds) {
    const amount = randomAmount()
    const amountStr = formatUnits(amount, 18)
    const bytes32 = itpIdToBytes32(itpId)

    // Get shares before
    let sharesBefore = '0'
    try {
      const s = await publicClient.readContract({
        address: INDEX, abi: INDEX_ABI, functionName: 'getUserShares',
        args: [account.address, bytes32],
      })
      sharesBefore = formatUnits(s, 18)
    } catch {}

    if (DRY_RUN) {
      console.log(`[DRY] ITP #${itpId}: would buy $${amountStr}`)
      benchmarks.push({
        itpId, amount: amountStr, orderPlaceMs: 0, fillMs: null,
        status: 'dry-run', orderId: null, sharesBefore, sharesAfter: null,
      })
      continue
    }

    // Place buy order
    const limitPrice = parseUnits('20', 18) // $20 limit — covers any NAV
    const placeStart = Date.now()
    let orderId: number | null = null

    try {
      const tx = await walletClient.writeContract({
        address: INDEX, abi: INDEX_ABI, functionName: 'submitOrder',
        args: [bytes32, 0, amount, limitPrice, 0],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })
      const placeMs = Date.now() - placeStart
      totalPlaceMs += placeMs

      // Extract order ID from logs
      const orderLog = receipt.logs.find(l => l.topics[0] === '0x' + 'a]')
      orderId = receipt.logs.length > 0 ? Number(receipt.logs[0].topics[1] || 0) : null

      console.log(`ITP #${itpId}: placed $${amountStr} in ${placeMs}ms (tx: ${tx.slice(0, 12)}...)`)

      // Poll for fill (max 30s)
      const fillStart = Date.now()
      let fillMs: number | null = null
      let sharesAfter = sharesBefore
      let status = 'pending'

      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        try {
          const s = await publicClient.readContract({
            address: INDEX, abi: INDEX_ABI, functionName: 'getUserShares',
            args: [account.address, bytes32],
          })
          const newShares = formatUnits(s, 18)
          if (parseFloat(newShares) > parseFloat(sharesBefore)) {
            fillMs = Date.now() - fillStart
            totalFillMs += fillMs
            sharesAfter = newShares
            status = 'filled'
            filled++
            break
          }
        } catch {}
        await new Promise(r => setTimeout(r, 2000))
      }

      if (status !== 'filled') {
        status = 'timeout'
        failed++
      }

      benchmarks.push({ itpId, amount: amountStr, orderPlaceMs: placeMs, fillMs, status, orderId, sharesBefore, sharesAfter })
      console.log(`  → ${status}${fillMs ? ` in ${fillMs}ms` : ''} shares: ${sharesBefore} → ${sharesAfter}`)

    } catch (e: any) {
      const placeMs = Date.now() - placeStart
      console.log(`ITP #${itpId}: FAILED in ${placeMs}ms — ${e.message?.slice(0, 80)}`)
      benchmarks.push({
        itpId, amount: amountStr, orderPlaceMs: placeMs, fillMs: null,
        status: 'error', orderId: null, sharesBefore, sharesAfter: null,
      })
      failed++
    }
  }

  // 5. Print benchmarks
  console.log('\n=== BENCHMARK RESULTS ===')
  console.log(`ITPs: ${itpIds.length}`)
  console.log(`Filled: ${filled}`)
  console.log(`Failed: ${failed}`)
  console.log(`Avg order placement: ${filled > 0 ? (totalPlaceMs / (filled + failed)).toFixed(0) : 'N/A'}ms`)
  console.log(`Avg fill time: ${filled > 0 ? (totalFillMs / filled).toFixed(0) : 'N/A'}ms`)
  console.log('')

  // Table
  console.log('ITP | Amount | Place(ms) | Fill(ms) | Status')
  console.log('----|--------|-----------|----------|-------')
  for (const b of benchmarks) {
    console.log(
      `#${String(b.itpId).padStart(2)} | $${b.amount.padStart(6)} | ${String(b.orderPlaceMs).padStart(9)} | ${(b.fillMs?.toString() || '—').padStart(8)} | ${b.status}`
    )
  }

  // Final USDC balance
  if (!DRY_RUN) {
    const finalBal = await publicClient.readContract({
      address: L3_USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    })
    console.log(`\nUSDC: ${formatUnits(usdcBal, 18)} → ${formatUnits(finalBal, 18)} (spent: ${formatUnits(usdcBal - finalBal, 18)})`)
  }
}

main().catch(console.error)
