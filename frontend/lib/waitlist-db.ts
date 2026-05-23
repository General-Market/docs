import { Pool } from 'pg'
import { randomBytes } from 'crypto'

let _pool: Pool | null = null
let _bootstrapped = false

export function getWaitlistPool(): Pool | null {
  if (_pool) return _pool
  const url = process.env.WAITLIST_DATABASE_URL
  if (!url) return null
  _pool = new Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30_000 })
  _pool.on('error', (err) => console.error('[waitlist-db] pg pool error', err))
  return _pool
}

async function ensureSchema(pool: Pool): Promise<void> {
  if (_bootstrapped) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      code        TEXT PRIMARY KEY,
      max_uses    INT NOT NULL DEFAULT 1,
      used_count  INT NOT NULL DEFAULT 0,
      expires_at  TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes       TEXT
    );
    CREATE TABLE IF NOT EXISTS whitelisted_wallets (
      address     TEXT PRIMARY KEY,
      code        TEXT REFERENCES invite_codes(code),
      redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip          TEXT,
      ua          TEXT
    );
    CREATE TABLE IF NOT EXISTS handle_codes (
      handle      TEXT PRIMARY KEY,
      code        TEXT NOT NULL REFERENCES invite_codes(code),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip          TEXT,
      ua          TEXT
    );
  `)
  _bootstrapped = true
}

export function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase()
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().slice(0, 64)
}

export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/^@+/, '').slice(0, 64)
}

// Crockford base32 minus look-alikes — 8 chars give ~40 bits of entropy,
// formatted as GMW-XXXX-XXXX so the user reads it back fluently.
const CROCKFORD = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function mintCode(): string {
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += CROCKFORD[bytes[i] % CROCKFORD.length]
  }
  return `GMW-${out.slice(0, 4)}-${out.slice(4, 8)}`
}

export type IssueResult =
  | { ok: true; code: string; isNew: boolean }
  | { ok: false; reason: 'unconfigured' }

/**
 * Returns the same code for the same handle on every call. First call inserts
 * a fresh single-use code into `invite_codes` and pins it via `handle_codes`.
 * Concurrent first-time issuances are resolved by the PK on `handle_codes` —
 * the loser re-reads and returns the winner's row.
 */
export async function issueCodeForHandle(
  rawHandle: string,
  meta: { ip?: string; ua?: string } = {},
): Promise<IssueResult> {
  const pool = getWaitlistPool()
  if (!pool) return { ok: false, reason: 'unconfigured' }
  await ensureSchema(pool)
  const handle = normalizeHandle(rawHandle)

  const existing = await pool.query<{ code: string }>(
    `SELECT code FROM handle_codes WHERE handle = $1 LIMIT 1`,
    [handle],
  )
  if (existing.rowCount! > 0) {
    return { ok: true, code: existing.rows[0].code, isNew: false }
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const code = mintCode()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const insertedCode = await client.query(
        `INSERT INTO invite_codes (code, max_uses, notes)
           VALUES ($1, 1, $2)
           ON CONFLICT (code) DO NOTHING
           RETURNING code`,
        [code, `auto:${handle}`],
      )
      if (insertedCode.rowCount === 0) {
        await client.query('ROLLBACK')
        continue
      }
      const pinned = await client.query<{ code: string }>(
        `INSERT INTO handle_codes (handle, code, ip, ua)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (handle) DO NOTHING
           RETURNING code`,
        [handle, code, meta.ip ?? null, meta.ua ?? null],
      )
      if (pinned.rowCount === 0) {
        // Another request issued first — drop our unused code, return theirs.
        await client.query(`DELETE FROM invite_codes WHERE code = $1`, [code])
        await client.query('COMMIT')
        const winner = await pool.query<{ code: string }>(
          `SELECT code FROM handle_codes WHERE handle = $1 LIMIT 1`,
          [handle],
        )
        if (winner.rowCount! > 0) {
          return { ok: true, code: winner.rows[0].code, isNew: false }
        }
        continue
      }
      await client.query('COMMIT')
      return { ok: true, code, isNew: true }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  }
  throw new Error('issueCodeForHandle: exhausted code collisions')
}

export async function isWhitelisted(address: string): Promise<boolean> {
  const pool = getWaitlistPool()
  if (!pool) {
    if (process.env.NODE_ENV !== 'production') return true
    return false
  }
  await ensureSchema(pool)
  const addr = normalizeAddress(address)
  const res = await pool.query<{ address: string }>(
    `SELECT address FROM whitelisted_wallets WHERE address = $1 LIMIT 1`,
    [addr],
  )
  return res.rowCount! > 0
}

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: 'unconfigured' | 'invalid' | 'exhausted' | 'expired' }

export async function checkInviteCode(rawCode: string): Promise<CheckResult> {
  const pool = getWaitlistPool()
  if (!pool) return { ok: false, reason: 'unconfigured' }
  await ensureSchema(pool)
  const code = normalizeCode(rawCode)
  const row = await pool.query<{
    max_uses: number; used_count: number; expires_at: Date | null
  }>(
    `SELECT max_uses, used_count, expires_at FROM invite_codes WHERE code = $1`,
    [code],
  )
  if (row.rowCount === 0) return { ok: false, reason: 'invalid' }
  const r = row.rows[0]
  if (r.expires_at && r.expires_at.getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }
  if (r.used_count >= r.max_uses) return { ok: false, reason: 'exhausted' }
  return { ok: true }
}

export type RedeemResult =
  | { ok: true; alreadyWhitelisted: boolean }
  | { ok: false; reason: 'unconfigured' | 'invalid' | 'exhausted' | 'expired' | 'wallet_taken' }

export async function redeemInviteCode(
  rawAddress: string,
  rawCode: string,
  meta: { ip?: string; ua?: string } = {},
): Promise<RedeemResult> {
  const pool = getWaitlistPool()
  if (!pool) return { ok: false, reason: 'unconfigured' }
  await ensureSchema(pool)
  const address = normalizeAddress(rawAddress)
  const code = normalizeCode(rawCode)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query(
      `SELECT 1 FROM whitelisted_wallets WHERE address = $1 LIMIT 1`,
      [address],
    )
    if (existing.rowCount! > 0) {
      await client.query('COMMIT')
      return { ok: true, alreadyWhitelisted: true }
    }

    const codeRow = await client.query<{
      code: string; max_uses: number; used_count: number; expires_at: Date | null
    }>(
      `SELECT code, max_uses, used_count, expires_at
         FROM invite_codes
         WHERE code = $1
         FOR UPDATE`,
      [code],
    )
    if (codeRow.rowCount === 0) {
      await client.query('ROLLBACK')
      return { ok: false, reason: 'invalid' }
    }
    const row = codeRow.rows[0]
    if (row.expires_at && row.expires_at.getTime() < Date.now()) {
      await client.query('ROLLBACK')
      return { ok: false, reason: 'expired' }
    }
    if (row.used_count >= row.max_uses) {
      await client.query('ROLLBACK')
      return { ok: false, reason: 'exhausted' }
    }

    await client.query(
      `UPDATE invite_codes SET used_count = used_count + 1 WHERE code = $1`,
      [code],
    )
    try {
      await client.query(
        `INSERT INTO whitelisted_wallets (address, code, ip, ua)
           VALUES ($1, $2, $3, $4)`,
        [address, code, meta.ip ?? null, meta.ua ?? null],
      )
    } catch {
      await client.query('ROLLBACK')
      return { ok: false, reason: 'wallet_taken' }
    }
    await client.query('COMMIT')
    return { ok: true, alreadyWhitelisted: false }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
