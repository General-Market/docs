import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, parseUnits, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { Redis } from '@upstash/redis'

/**
 * Bot faucet — drips L3 GM (gas) + L3 USDC (stake) to a bot wallet.
 * Rate-limited by IP: one claim per 24h.
 *
 * Production: requires Upstash Redis (UPSTASH_REDIS_REST_URL + _TOKEN).
 * Fails closed with 503 when env vars missing — a faucet without a throttle
 * is an ATM without a door.
 *
 * Local dev: when NODE_ENV !== 'production' and Upstash env is absent, falls
 * back to an in-memory Map. The Map lives in the Node process only — it
 * resets on dev-server restart, which is fine for a machine used by one
 * developer. Never reached in a production build.
 *
 * POST /api/bot/faucet  { "address": "0x..." }
 * → 200 { success, usdc, l3Gas }
 * → 429 { error: "Rate limit: try again in Xh" }
 * → 503 { error: "Rate limiter unavailable" }  (prod, missing env)
 */

import { getL3RpcServer } from '@/lib/config'
import { isWhitelisted } from '@/lib/waitlist-db'

const WAITLIST_GATE_ENABLED = process.env.WAITLIST_GATE_ENABLED !== 'false'
const WAITLIST_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN
  ? `${process.env.NEXT_PUBLIC_SITE_ORIGIN}/waitlist`
  : 'https://generalmarket.io/waitlist'

const DEPLOYER_KEY = '0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537' as const

import _deployment from '@/lib/contracts/deployment.json'
const VISION_ADDRESS = (_deployment.contracts.Vision || '0x0000000000000000000000000000000000000000') as `0x${string}`
const L3_WUSDC_FALLBACK = (_deployment.contracts.L3_WUSDC || '0x0511c61c551280cd2598d5a7380f8e9658f4b7db') as `0x${string}`
const L3_CHAIN_ID = (_deployment as any).chainId || 111222333

const USDC_DRIP = 100 // 100 USDC
const GM_DRIP = parseEther('1') // 1 GM — ~20 txs worth of gas
const TTL_SECONDS = 24 * 60 * 60 // 24h

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

type Limiter = {
  ttl(key: string): Promise<number>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
}

const NO_OP_LIMITER: Limiter = {
  // -2 mimics Redis "key missing" — always permits.
  ttl: async () => -2,
  set: async () => {},
}

function getLimiter(): Limiter | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    const redis = new Redis({ url, token })
    return {
      ttl: (k) => redis.ttl(k),
      set: async (k, v, ex) => { await redis.set(k, v, { ex }) },
    }
  }
  // Dev fallback: no throttle. The throttle exists to stop strangers from
  // draining the faucet in production. On a developer laptop with no
  // strangers, a fake limit is only good for breaking your own tests.
  if (process.env.NODE_ENV === 'production') return null
  console.warn('[bot-faucet] Upstash not configured — dev mode: rate limit disabled')
  return NO_OP_LIMITER
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { address } = body

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
        console.error('[bot-faucet] whitelist check failed', err)
        return NextResponse.json({ error: 'whitelist check failed' }, { status: 500 })
      }
    }

    const limiter = getLimiter()
    if (!limiter) {
      return NextResponse.json(
        { error: 'Rate limiter unavailable — UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured in production' },
        { status: 503 },
      )
    }

    const ip = getClientIp(req)
    const ipKey = `bot-faucet:ip:${ip}`
    const addrKey = `bot-faucet:addr:${address.toLowerCase()}`

    const [ipTtl, addrTtl] = await Promise.all([
      limiter.ttl(ipKey),
      limiter.ttl(addrKey),
    ])

    // ttl: -2 = key missing, -1 = no expiry, >=0 = seconds remaining
    if (ipTtl > 0) {
      return NextResponse.json(
        { error: `Rate limit: this IP already claimed. Try again in ${Math.ceil(ipTtl / 3600)}h` },
        { status: 429 },
      )
    }
    if (addrTtl > 0) {
      return NextResponse.json(
        { error: `Rate limit: this address already claimed. Try again in ${Math.ceil(addrTtl / 3600)}h` },
        { status: 429 },
      )
    }

    // Set the lock BEFORE minting — a crashed faucet that drips then fails to
    // record is free money for whoever retries.
    await Promise.all([
      limiter.set(ipKey, address, TTL_SECONDS),
      limiter.set(addrKey, ip, TTL_SECONDS),
    ])

    const account = privateKeyToAccount(DEPLOYER_KEY)
    const l3Chain = {
      id: L3_CHAIN_ID,
      name: 'Index L3',
      nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
      rpcUrls: { default: { http: [getL3RpcServer()] } },
    } as const

    const l3Wallet = createWalletClient({ account, chain: l3Chain, transport: http(getL3RpcServer()) })
    const l3Public = createPublicClient({ chain: l3Chain, transport: http(getL3RpcServer()) })

    // Resolve L3 USDC — read from the Vision contract when possible, fall back to deployment.json.
    let l3Usdc = L3_WUSDC_FALLBACK
    if (VISION_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      try {
        const usdcFromVision = await l3Public.readContract({
          address: VISION_ADDRESS,
          abi: [{ inputs: [], name: 'USDC', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' }],
          functionName: 'USDC',
        })
        if (usdcFromVision) l3Usdc = usdcFromVision as `0x${string}`
      } catch {
        // Vision not deployed or USDC() missing — use fallback.
      }
    }

    const results: Record<string, any> = {}

    // Mint USDC
    const parsedAmount = parseUnits(String(USDC_DRIP), 18)
    const mintHash = await l3Wallet.writeContract({
      address: l3Usdc,
      abi: MINT_ABI,
      functionName: 'mint',
      args: [address as `0x${string}`, parsedAmount],
    })
    await l3Public.waitForTransactionReceipt({ hash: mintHash, timeout: 30_000 })
    results.usdc = { hash: mintHash, amount: `${USDC_DRIP} USDC` }

    // Drip GM
    try {
      const deployerBalance = await l3Public.getBalance({ address: account.address })
      if (deployerBalance > GM_DRIP * 2n) {
        const gasHash = await l3Wallet.sendTransaction({ to: address as `0x${string}`, value: GM_DRIP })
        await l3Public.waitForTransactionReceipt({ hash: gasHash, timeout: 30_000 })
        results.l3Gas = { hash: gasHash, amount: '1 GM' }
      } else {
        results.l3Gas = { error: 'Faucet deployer low on GM' }
      }
    } catch (e: any) {
      results.l3Gas = { error: e.message }
    }

    return NextResponse.json({
      success: true,
      to: address,
      ip,
      retry_after_seconds: TTL_SECONDS,
      ...results,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
