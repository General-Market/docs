import { NextRequest, NextResponse } from 'next/server'
import { checkInviteCode } from '@/lib/waitlist-db'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CODE_RE = /^[A-Za-z0-9_-]{3,64}$/
const IP_LIMIT = 60
const WINDOW_SECONDS = 60

function pickIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get('code') || '').trim()
  if (!CODE_RE.test(code)) {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 })
  }

  const ip = pickIp(req)
  const limit = await rateLimit(`wl:check:ip:${ip}`, IP_LIMIT, WINDOW_SECONDS)
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, reason: 'rate_limited', retryAfter: limit.resetSeconds },
      { status: 429, headers: { 'Retry-After': String(limit.resetSeconds) } },
    )
  }

  try {
    const result = await checkInviteCode(code)
    if (result.ok) return NextResponse.json({ ok: true })
    if (result.reason === 'unconfigured') {
      return NextResponse.json({ ok: false, reason: 'unconfigured' }, { status: 503 })
    }
    return NextResponse.json({ ok: false, reason: result.reason })
  } catch (err) {
    console.error('[waitlist/check-code] failed', err)
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}
