import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, parseUnits, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

/**
 * Testnet faucet.
 *
 * POST /api/faucet { address, amount?, scope?: 'vision' | 'itp' | 'both' }
 *
 * The user-facing buy on both Vision and Index runs on L3 USDC (18 dec) —
 * the bridge handles Settlement USDC internally, the user wallet never holds it.
 * So default scope is 'vision': mint L3 USDC + drip L3 GM gas, one currency,
 * good for both products.
 *
 * 'itp' and 'both' remain for admin/E2E tooling that needs to top up Settlement
 * USDC + Sonic gas (e.g. AP keeper rehydration). Not used by the UI.
 *
 * Each leg reports independently. A failure in one leg never silently masks
 * the other — the caller sees `{ error }` on the affected leg.
 */

import { getL3RpcServer, SETTLEMENT_RPC_URL } from '@/lib/config'
import { isWhitelisted } from '@/lib/waitlist-db'

const WAITLIST_GATE_ENABLED = process.env.WAITLIST_GATE_ENABLED !== 'false'
const WAITLIST_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN
  ? `${process.env.NEXT_PUBLIC_SITE_ORIGIN}/waitlist`
  : 'https://generalmarket.io/waitlist'

const DEPLOYER_KEY = '0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537' as const

import _deployment from '@/lib/contracts/deployment.json'
// Lowercase every address — viem rejects mis-cased EIP-55 checksums and the
// JSON is written by tools that don't always emit valid checksums.
const lc = (a: string): `0x${string}` => a.toLowerCase() as `0x${string}`
const VISION_ADDRESS = lc(_deployment.contracts.Vision || '0x0000000000000000000000000000000000000000')
const L3_WUSDC_FALLBACK = lc(_deployment.contracts.L3_WUSDC || '0x0511c61c551280cd2598d5a7380f8e9658f4b7db')
const L3_CHAIN_ID = (_deployment as any).chainId || 111222333
const SETTLEMENT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_SETTLEMENT_CHAIN_ID) || 421611337
const SETTLEMENT_USDC = lc(_deployment.contracts.SETTLEMENT_USDC || '0x2775bA795A292A1FfcD91d227d1a1B0889282190')
const MAX_MINT = 10_000
const SONIC_GAS_DRIP = '0.5'
const L3_GAS_DRIP = '1'

const MINT_ABI = [{
  name: 'mint',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [],
}] as const

const USDC_GETTER_ABI = [{
  inputs: [], name: 'USDC',
  outputs: [{ name: '', type: 'address' }],
  stateMutability: 'view', type: 'function',
}] as const

type Scope = 'vision' | 'itp' | 'both'

function resolveScope(body: any): Scope {
  const s = body?.scope
  if (s === 'vision' || s === 'itp' || s === 'both') return s
  return 'vision'
}

async function runVisionLeg(to: `0x${string}`, amount: number) {
  const leg: Record<string, any> = {}
  const chain = {
    id: L3_CHAIN_ID,
    name: 'Index L3',
    nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
    rpcUrls: { default: { http: [getL3RpcServer()] } },
  } as const

  const account = privateKeyToAccount(DEPLOYER_KEY)
  const wallet = createWalletClient({ account, chain, transport: http(getL3RpcServer()) })
  const pub = createPublicClient({ chain, transport: http(getL3RpcServer()) })

  let l3Usdc = L3_WUSDC_FALLBACK
  if (VISION_ADDRESS !== '0x0000000000000000000000000000000000000000') {
    try {
      const fromVision = await pub.readContract({
        address: VISION_ADDRESS, abi: USDC_GETTER_ABI, functionName: 'USDC',
      })
      if (fromVision) l3Usdc = fromVision as `0x${string}`
    } catch {
      // Vision missing — fall back to deployment JSON.
    }
  }

  try {
    const parsed = parseUnits(String(amount), 18)
    const hash = await wallet.writeContract({
      address: l3Usdc, abi: MINT_ABI, functionName: 'mint',
      args: [to, parsed],
    })
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 30_000 })
    if (receipt.status !== 'success') {
      leg.usdc = { error: `Mint reverted (status=${receipt.status})`, hash }
    } else {
      leg.usdc = { hash, amount: `${amount} USDC` }
    }
  } catch (e: any) {
    leg.usdc = { error: e.message ?? 'L3 USDC mint failed' }
  }

  try {
    const drip = parseEther(L3_GAS_DRIP)
    const deployerBal = await pub.getBalance({ address: account.address })
    if (deployerBal > drip * 2n) {
      const hash = await wallet.sendTransaction({ to, value: drip })
      const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 30_000 })
      if (receipt.status !== 'success') {
        leg.gas = { error: `GM drip reverted (status=${receipt.status})`, hash }
      } else {
        leg.gas = { hash, amount: `${L3_GAS_DRIP} GM` }
      }
    } else {
      leg.gas = { error: 'Deployer low on GM' }
    }
  } catch (e: any) {
    leg.gas = { error: e.message ?? 'GM drip failed' }
  }

  return leg
}

async function runItpLeg(to: `0x${string}`, amount: number) {
  const chain = {
    id: SETTLEMENT_CHAIN_ID,
    name: 'Settlement',
    nativeCurrency: { name: 'Sonic', symbol: 'S', decimals: 18 },
    rpcUrls: { default: { http: [SETTLEMENT_RPC_URL] } },
  } as const

  const account = privateKeyToAccount(DEPLOYER_KEY)
  const wallet = createWalletClient({ account, chain, transport: http(SETTLEMENT_RPC_URL) })
  const pub = createPublicClient({ chain, transport: http(SETTLEMENT_RPC_URL) })

  // The deployer key is shared with backend services, so any auto-nonce
  // strategy (parallel, sequential-with-stale-pending) eventually loses
  // a race to "replacement transaction underpriced". Take the nonce
  // ourselves at the start, hand the mint nonce N and the drip nonce
  // N+1, and broadcast both before awaiting either receipt. The mint
  // receipt wait is the dominant cost (~4s on Sonic) and runs while
  // the drip is in flight.
  const startNonce = await pub.getTransactionCount({
    address: account.address,
    blockTag: 'pending',
  })

  let usdcResult: Record<string, any>
  let gasResult: Record<string, any>
  let receiptPromise: ReturnType<typeof pub.waitForTransactionReceipt> | null = null

  try {
    const parsed = parseUnits(String(amount), 6)
    const usdcHash = await wallet.writeContract({
      address: SETTLEMENT_USDC, abi: MINT_ABI, functionName: 'mint',
      args: [to, parsed],
      nonce: startNonce,
    })
    receiptPromise = pub.waitForTransactionReceipt({ hash: usdcHash, timeout: 30_000 })
    usdcResult = { hash: usdcHash, amount: `${amount} USDC` }
  } catch (e: any) {
    return {
      usdc: { error: e.message ?? 'Settlement USDC mint failed' },
      gas: { error: 'Skipped — USDC mint failed' },
    }
  }

  try {
    const drip = parseEther(SONIC_GAS_DRIP)
    const deployerBal = await pub.getBalance({ address: account.address })
    if (deployerBal <= drip * 2n) {
      gasResult = { error: 'Deployer low on S' }
    } else {
      const gasHash = await wallet.sendTransaction({
        to,
        value: drip,
        nonce: startNonce + 1,
      })
      gasResult = { hash: gasHash, amount: `${SONIC_GAS_DRIP} S` }
    }
  } catch (e: any) {
    gasResult = { error: e.message ?? 'S drip failed' }
  }

  if (receiptPromise) {
    try {
      const receipt = await receiptPromise
      if (receipt.status !== 'success') {
        usdcResult = { error: `Settlement mint reverted (status=${receipt.status})`, hash: usdcResult.hash }
      }
    } catch (e: any) {
      // Receipt timed out. We don't know status. Be honest about it.
      usdcResult = { error: e.message ?? 'Settlement receipt timeout', hash: usdcResult.hash }
    }
  }
  return { usdc: usdcResult, gas: gasResult }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { address, amount: amountStr } = body

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    if (WAITLIST_GATE_ENABLED) {
      try {
        const allowed = await isWhitelisted(address)
        if (!allowed) {
          return NextResponse.json(
            { error: 'WAITLIST_REQUIRED', waitlistUrl: WAITLIST_URL },
            { status: 403 },
          )
        }
      } catch (err) {
        console.error('[faucet] whitelist check failed', err)
        return NextResponse.json({ error: 'whitelist check failed' }, { status: 500 })
      }
    }

    const amount = Math.min(parseFloat(amountStr || '100'), MAX_MINT)
    if (!(amount > 0)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const scope = resolveScope(body)
    const to = address as `0x${string}`

    const results: Record<string, any> = { scope }

    if (scope === 'vision' || scope === 'both') {
      results.vision = await runVisionLeg(to, amount)
    }
    if (scope === 'itp' || scope === 'both') {
      results.itp = await runItpLeg(to, amount)
    }

    return NextResponse.json({ success: true, to: address, ...results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
