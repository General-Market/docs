import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { redeemInviteCode } from '@/lib/waitlist-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Submission = {
  twitter?: string
  telegram?: string
  email?: string
  protection_from?: string | string[]
  invite?: string
  volume?: string
  affiliate?: string
  reach?: string
  notes?: string
  wallet?: string
}

const memStore: { rows: unknown[]; emails: Set<string>; twitters: Set<string> } = {
  rows: [],
  emails: new Set(),
  twitters: new Set(),
}

let _pool: Pool | null = null
function getPool(): Pool | null {
  if (_pool) return _pool
  const url = process.env.WAITLIST_DATABASE_URL
  if (!url) return null
  _pool = new Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30_000 })
  _pool.on('error', (err) => console.error('[waitlist] pg pool error', err))
  return _pool
}

function clean(s: unknown): string {
  return typeof s === 'string' ? s.trim().slice(0, 500) : ''
}

function normalizeHandle(s: string): string {
  return s.toLowerCase().replace(/^@/, '')
}

async function maybeRedeem(
  body: Submission,
  ip: string,
  ua: string,
): Promise<boolean> {
  const wallet = (body.wallet || '').trim()
  const code = (body.invite || '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return false
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(code)) return false
  try {
    const result = await redeemInviteCode(wallet, code, { ip, ua })
    return result.ok
  } catch (err) {
    console.error('[waitlist] auto-redeem failed', err)
    return false
  }
}

export async function POST(req: NextRequest) {
  let body: Submission
  try {
    body = (await req.json()) as Submission
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const protection = Array.isArray(body.protection_from)
    ? body.protection_from.map(clean).filter(Boolean).slice(0, 8)
    : body.protection_from
      ? [clean(body.protection_from)].filter(Boolean)
      : []

  const data = {
    twitter: normalizeHandle(clean(body.twitter)),
    telegram: normalizeHandle(clean(body.telegram)),
    email: clean(body.email).toLowerCase(),
    protection_from: protection,
    invite: clean(body.invite),
    volume: clean(body.volume),
    affiliate: clean(body.affiliate),
    reach: clean(body.reach),
    notes: clean(body.notes),
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }
  if (!data.twitter || !data.telegram) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  const ua = req.headers.get('user-agent') || ''

  const pool = getPool()
  try {
    if (pool) {
      const res = await pool.query(
        `INSERT INTO submissions
           (twitter, telegram, email, protection_from, invite, volume, affiliate, reach, notes, ip, ua)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (lower(email)) DO NOTHING
         RETURNING id`,
        [
          data.twitter,
          data.telegram,
          data.email,
          data.protection_from,
          data.invite,
          data.volume,
          data.affiliate,
          data.reach,
          data.notes,
          ip,
          ua,
        ],
      )
      const whitelisted = await maybeRedeem(body, ip, ua)
      return NextResponse.json({ ok: true, dedup: res.rowCount === 0, whitelisted })
    }
    if (memStore.emails.has(data.email) || (data.twitter && memStore.twitters.has(data.twitter))) {
      const whitelisted = await maybeRedeem(body, ip, ua)
      return NextResponse.json({ ok: true, dedup: true, whitelisted })
    }
    memStore.rows.push({ ...data, ip, ua, at: new Date().toISOString() })
    memStore.emails.add(data.email)
    if (data.twitter) memStore.twitters.add(data.twitter)
    const whitelisted = await maybeRedeem(body, ip, ua)
    return NextResponse.json({ ok: true, whitelisted })
  } catch (err) {
    console.error('[waitlist] storage error', err)
    return NextResponse.json({ error: 'storage unavailable' }, { status: 503 })
  }
}
