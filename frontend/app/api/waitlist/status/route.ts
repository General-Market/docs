import { NextRequest, NextResponse } from 'next/server'
import { isWhitelisted } from '@/lib/waitlist-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet') || ''
  if (!ADDR_RE.test(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
  }
  try {
    const whitelisted = await isWhitelisted(wallet)
    const res = NextResponse.json({ whitelisted })
    res.headers.set('Cache-Control', 'private, max-age=30')
    return res
  } catch (err) {
    console.error('[waitlist/status] failed', err)
    return NextResponse.json({ error: 'status check failed' }, { status: 500 })
  }
}
