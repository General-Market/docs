import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/dataroom/session'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL('/room', request.url), { status: 303 })
  res.cookies.delete({ name: SESSION_COOKIE, path: '/room' })
  return res
}
