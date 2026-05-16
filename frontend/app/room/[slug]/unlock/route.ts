import { NextRequest, NextResponse } from 'next/server'
import { getRoom } from '@/lib/dataroom/db'
import { verifyCode } from '@/lib/dataroom/codes'
import { issueSession, SESSION_COOKIE } from '@/lib/dataroom/session'

export const runtime = 'nodejs'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

interface UnlockBody {
  code?: unknown
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  let body: UnlockBody
  try {
    body = (await request.json()) as UnlockBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const code = typeof body.code === 'string' ? body.code : ''
  if (!code) {
    return NextResponse.json({ error: 'Code is required.' }, { status: 400 })
  }

  const room = await getRoom(slug)
  if (!room) {
    return NextResponse.json({ error: 'Invalid code.' }, { status: 401 })
  }
  if (room.expires_at && room.expires_at.getTime() < Date.now()) {
    return NextResponse.json({ error: 'This room has expired.' }, { status: 410 })
  }

  const ok = await verifyCode(code, room.code_hash, room.code_salt)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid code.' }, { status: 401 })
  }

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
