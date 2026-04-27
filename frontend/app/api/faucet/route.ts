import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, parseUnits, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

/**
 * Testnet faucet.
 *
 * POST /api/faucet { address, amount?, scope?: 'vision' | 'itp' | 'both' }
 *
 * Scopes are strictly separated — Vision and Index are two different places.
 *   vision: mints L3 USDC (18 dec) + drips L3 GM gas.
 *   itp:    mints Settlement USDC (6 dec) + drips Sonic S gas.
 *   both:   all of the above (used only on pages that bridge both contexts, e.g. portfolio).
 *
 * Default when scope omitted: 'vision'. Legacy `gas: true` maps to 'both' for
 * callers that haven't migrated.
 *
 * Each leg is reported independently in the response. A failure in one leg
 * never silently masks the other — the caller sees `{ error }` on the affected
 * leg and can retry just that context.
 */

import { getL3RpcServer, SETTLEMENT_RPC_URL } from '@/lib/config'

const DEPLOYER_KEY = '0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537' as const

import _deployment from '@/lib/contracts/deployment.json'
const VISION_ADDRESS = (_deployment.contracts.Vision || '0x0000000000000000000000000000000000000000') as `0x${string}`
const L3_WUSDC_FALLBACK = (_deployment.contracts.L3_WUSDC || '0x0511c61c551280cd2598d5a7380f8e9658f4b7db') as `0x${string}`
const L3_CHAIN_ID = (_deployment as any).chainId || 111222333
const SETTLEMENT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_SETTLEMENT_CHAIN_ID) || 421611337
const SETTLEMENT_USDC = (_deployment.contracts.SETTLEMENT_USDC || '0x2775bA795A292A1FfcD91d227d1a1B0889282190') as `0x${string}`
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
  if (body?.gas === true) return 'both'
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
    await pub.waitForTransactionReceipt({ hash, timeout: 30_000 })
    leg.usdc = { hash, amount: `${amount} USDC` }
  } catch (e: any) {
    leg.usdc = { error: e.message ?? 'L3 USDC mint failed' }
  }

  try {
    const drip = parseEther(L3_GAS_DRIP)
    const deployerBal = await pub.getBalance({ address: account.address })
    if (deployerBal > drip * 2n) {
      const hash = await wallet.sendTransaction({ to, value: drip })
      await pub.waitForTransactionReceipt({ hash, timeout: 30_000 })
      leg.gas = { hash, amount: `${L3_GAS_DRIP} GM` }
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

  // The deployer key is shared with the fund-manager and other backend
  // services. Two parallel writes — even with explicit nonce hints —
  // race against any concurrent broadcast from those services and Sonic
  // rejects the loser as "replacement transaction underpriced".
  //
  // Strategy: broadcast USDC mint first (consumes one nonce), then
  // immediately broadcast the gas drip without awaiting its receipt.
  // The mint receipt resolves while the drip propagates; total wall
  // time is dominated by the USDC receipt wait (~4s) instead of two
  // sequential receipts (~9s).
  let usdc: Record<string, any>
  try {
    const parsed = parseUnits(String(amount), 6)
    const hash = await wallet.writeContract({
      address: SETTLEMENT_USDC, abi: MINT_ABI, functionName: 'mint',
      args: [to, parsed],
    })
    // Receipt wait runs in parallel with the gas drip broadcast below.
    const receiptPromise = pub.waitForTransactionReceipt({ hash, timeout: 30_000 })

    let gas: Record<string, any>
    try {
      const drip = parseEther(SONIC_GAS_DRIP)
      const deployerBal = await pub.getBalance({ address: account.address })
      if (deployerBal <= drip * 2n) {
        gas = { error: 'Deployer low on S' }
      } else {
        // Fire-and-forget: viem fetches a fresh nonce now that the mint
        // tx is in the mempool, and we don't wait for the receipt.
        const gasHash = await wallet.sendTransaction({ to, value: drip })
        gas = { hash: gasHash, amount: `${SONIC_GAS_DRIP} S` }
      }
    } catch (e: any) {
      gas = { error: e.message ?? 'S drip failed' }
    }

    await receiptPromise
    usdc = { hash, amount: `${amount} USDC` }
    return { usdc, gas }
  } catch (e: any) {
    return {
      usdc: { error: e.message ?? 'Settlement USDC mint failed' },
      gas: { error: 'Skipped — USDC mint failed' },
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { address, amount: amountStr } = body

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
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
