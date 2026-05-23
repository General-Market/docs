import { NextRequest, NextResponse } from 'next/server'
import { issueCodeForHandle, normalizeHandle } from '@/lib/waitlist-db'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HANDLE_RE = /^[a-z0-9_]{1,32}$/

const IP_LIMIT = 30
const HANDLE_LIMIT = 5
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
  let body: { handle?: string }
  try {
    body = (await req.json()) as { handle?: string }
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 })
  }

  const handle = normalizeHandle(body.handle ?? '')
  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json({ ok: false, reason: 'invalid_handle' }, { status: 400 })
  }

  const ip = pickIp(req)
  const ua = req.headers.get('user-agent') || ''
  const [ipLimit, handleLimit] = await Promise.all([
    rateLimit(`wl:issue:ip:${ip}`, IP_LIMIT, WINDOW_SECONDS),
    rateLimit(`wl:issue:handle:${handle}`, HANDLE_LIMIT, WINDOW_SECONDS),
  ])
  if (!ipLimit.allowed || !handleLimit.allowed) {
    const retryAfter = Math.max(ipLimit.resetSeconds, handleLimit.resetSeconds)
    return NextResponse.json(
      { ok: false, reason: 'rate_limited', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  try {
    const result = await issueCodeForHandle(handle, { ip, ua })
    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 503 })
    }
    return NextResponse.json({ ok: true, code: result.code, isNew: result.isNew })
  } catch (err) {
    console.error('[waitlist/issue-code] failed', err)
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}
