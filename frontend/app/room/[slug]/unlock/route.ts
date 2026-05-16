import { NextRequest, NextResponse } from 'next/server'
import { getRoom } from '@/lib/dataroom/db'
import { verifyCode } from '@/lib/dataroom/codes'
import { issueSession, SESSION_COOKIE } from '@/lib/dataroom/session'
import { rateLimit, clearRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

const IP_LIMIT = 10
const IP_WINDOW = 15 * 60
const GLOBAL_LIMIT = 200
const GLOBAL_WINDOW = 15 * 60

interface UnlockBody {
  code?: unknown
}

function clientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const xri = request.headers.get('x-real-ip')
  if (xri) return xri.trim()
  return 'unknown'
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function constantTimeFail(
  status: number,
  body: { error: string },
  startedAt: number,
): Promise<NextResponse> {
  const elapsed = Date.now() - startedAt
  const minDuration = 300
  if (elapsed < minDuration) await sleep(minDuration - elapsed)
  return NextResponse.json(body, { status })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const startedAt = Date.now()
  const { slug } = await params
  const ip = clientIp(request)

  const ipKey = `dataroom:unlock:ip:${ip}:${slug}`
  const globalKey = `dataroom:unlock:global:${slug}`

  const [ipRl, globalRl] = await Promise.all([
    rateLimit(ipKey, IP_LIMIT, IP_WINDOW),
    rateLimit(globalKey, GLOBAL_LIMIT, GLOBAL_WINDOW),
  ])

  if (!ipRl.allowed || !globalRl.allowed) {
    const retry = Math.max(ipRl.resetSeconds, globalRl.resetSeconds)
    const res = await constantTimeFail(
      429,
      { error: 'Too many attempts. Wait a few minutes.' },
      startedAt,
    )
    res.headers.set('Retry-After', String(retry))
    return res
  }

  let body: UnlockBody
  try {
    body = (await request.json()) as UnlockBody
  } catch {
    return constantTimeFail(400, { error: 'Invalid request body.' }, startedAt)
  }
  const code = typeof body.code === 'string' ? body.code : ''
  if (!code) {
    return constantTimeFail(400, { error: 'Code is required.' }, startedAt)
  }

  const room = await getRoom(slug)
  if (!room) {
    return constantTimeFail(401, { error: 'Invalid code.' }, startedAt)
  }
  if (room.expires_at && room.expires_at.getTime() < Date.now()) {
    return constantTimeFail(410, { error: 'This room has expired.' }, startedAt)
  }

  const ok = await verifyCode(code, room.code_hash, room.code_salt)
  if (!ok) {
    return constantTimeFail(401, { error: 'Invalid code.' }, startedAt)
  }

  // Clear the IP rate-limit counter on success so legit investors don't
  // accidentally lock themselves out by mistyping a few times.
  await clearRateLimit(ipKey).catch(() => {})

  const token = await issueSession(slug, SESSION_TTL_SECONDS)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/room',
    maxAge: SESSION_TTL_SECONDS,
  })
  return res
}
