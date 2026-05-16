import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/dataroom/session'

export const runtime = 'nodejs'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const res = NextResponse.redirect(new URL(`/room/${slug}`, _request.url), { status: 303 })
  res.cookies.delete({ name: SESSION_COOKIE, path: '/room' })
  return res
}
