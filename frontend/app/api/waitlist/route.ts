import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Submission = {
  twitter?: string
  telegram?: string
  email?: string
  protection_from?: string
  invite?: string
  volume?: string
  affiliate?: string
  reach?: string
  notes?: string
}

const KEY_LIST = 'waitlist:submissions'
const KEY_EMAIL_SET = 'waitlist:emails'
const KEY_TWITTER_SET = 'waitlist:twitters'

const memStore: { submissions: unknown[]; emails: Set<string>; twitters: Set<string> } = {
  submissions: [],
  emails: new Set(),
  twitters: new Set(),
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function clean(s: unknown): string {
  return typeof s === 'string' ? s.trim().slice(0, 500) : ''
}

function normalizeHandle(s: string): string {
  return s.toLowerCase().replace(/^@/, '')
}

export async function POST(req: NextRequest) {
  let body: Submission
  try {
    body = (await req.json()) as Submission
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const data: Submission = {
    twitter: clean(body.twitter),
    telegram: clean(body.telegram),
    email: clean(body.email).toLowerCase(),
    protection_from: clean(body.protection_from),
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

  const record = {
    ...data,
    twitter: normalizeHandle(data.twitter || ''),
    telegram: normalizeHandle(data.telegram || ''),
    ip,
    ua,
    at: new Date().toISOString(),
  }

  const redis = getRedis()
  try {
    if (redis) {
      const emailDup = await redis.sismember(KEY_EMAIL_SET, record.email!)
      const twitterDup = record.twitter ? await redis.sismember(KEY_TWITTER_SET, record.twitter) : 0
      if (emailDup || twitterDup) {
        return NextResponse.json({ ok: true, dedup: true })
      }
      await redis.lpush(KEY_LIST, JSON.stringify(record))
      await redis.sadd(KEY_EMAIL_SET, record.email!)
      if (record.twitter) await redis.sadd(KEY_TWITTER_SET, record.twitter)
    } else {
      if (memStore.emails.has(record.email!) || (record.twitter && memStore.twitters.has(record.twitter))) {
        return NextResponse.json({ ok: true, dedup: true })
      }
      memStore.submissions.push(record)
      memStore.emails.add(record.email!)
      if (record.twitter) memStore.twitters.add(record.twitter)
    }
  } catch (err) {
    console.error('[waitlist] storage error', err)
    return NextResponse.json({ error: 'storage unavailable' }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}
