import { Pool } from 'pg'

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
  `)
  _bootstrapped = true
}

export function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase()
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().slice(0, 64)
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
