import { NextRequest, NextResponse } from 'next/server'
import { redeemInviteCode } from '@/lib/waitlist-db'
import { rateLimit, clearRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/
const CODE_RE = /^[A-Za-z0-9_-]{3,64}$/

const IP_LIMIT = 10
const WALLET_LIMIT = 5
const WINDOW_SECONDS = 60 * 60

function pickIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  let body: { address?: string; code?: string }
  try {
    body = (await req.json()) as { address?: string; code?: string }
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const address = (body.address || '').trim()
  const code = (body.code || '').trim()
  if (!ADDR_RE.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 })
  }
  if (!CODE_RE.test(code)) {
    return NextResponse.json({ error: 'invalid code' }, { status: 400 })
  }

  const ip = pickIp(req)
  const ua = req.headers.get('user-agent') || ''
  const ipKey = `wl:redeem:ip:${ip}`
  const walletKey = `wl:redeem:addr:${address.toLowerCase()}`

  const [ipLimit, walletLimit] = await Promise.all([
    rateLimit(ipKey, IP_LIMIT, WINDOW_SECONDS),
    rateLimit(walletKey, WALLET_LIMIT, WINDOW_SECONDS),
  ])
  if (!ipLimit.allowed || !walletLimit.allowed) {
    const retryAfter = Math.max(ipLimit.resetSeconds, walletLimit.resetSeconds)
    return NextResponse.json(
      { error: 'rate_limited', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  try {
    const result = await redeemInviteCode(address, code, { ip, ua })
    if (result.ok) {
      // Successful redemption clears the wallet counter — no point penalizing
      // a wallet that's now whitelisted. The IP counter stays as a coarse
      // brake on someone seeding many wallets from one machine.
      await clearRateLimit(walletKey).catch(() => {})
      return NextResponse.json({
        ok: true,
        whitelisted: true,
        alreadyWhitelisted: result.alreadyWhitelisted,
      })
    }
    if (result.reason === 'unconfigured') {
      return NextResponse.json({ error: 'waitlist storage unavailable' }, { status: 503 })
    }
    const status = result.reason === 'wallet_taken' ? 409 : 400
    return NextResponse.json({ ok: false, reason: result.reason }, { status })
  } catch (err) {
    console.error('[waitlist/redeem] failed', err)
    return NextResponse.json({ error: 'redeem failed' }, { status: 500 })
  }
}
