import { Pool, type PoolClient } from 'pg'

let _pool: Pool | null = null
let _bootstrapped = false

export function getDataroomPool(): Pool | null {
  if (_pool) return _pool
  const url = process.env.DATAROOM_DATABASE_URL || process.env.WAITLIST_DATABASE_URL
  if (!url) return null
  _pool = new Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30_000 })
  _pool.on('error', (err) => console.error('[dataroom-db] pg pool error', err))
  return _pool
}

async function ensureSchema(pool: Pool): Promise<void> {
  if (_bootstrapped) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dataroom_rooms (
      slug         TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      code_hash    TEXT NOT NULL,
      code_salt    TEXT NOT NULL,
      expires_at   TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes        TEXT
    );
    CREATE TABLE IF NOT EXISTS dataroom_views (
      id           BIGSERIAL PRIMARY KEY,
      slug         TEXT NOT NULL,
      page         TEXT,
      jti          TEXT,
      viewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_hash      TEXT,
      ua_hash      TEXT
    );
    CREATE INDEX IF NOT EXISTS dataroom_views_slug_viewed_idx
      ON dataroom_views (slug, viewed_at DESC);
  `)
  _bootstrapped = true
}

export interface DataroomRow {
  slug: string
  title: string
  code_hash: string
  code_salt: string
  expires_at: Date | null
}

export async function getRoom(slug: string): Promise<DataroomRow | null> {
  const pool = getDataroomPool()
  if (!pool) return null
  await ensureSchema(pool)
  const res = await pool.query<DataroomRow>(
    `SELECT slug, title, code_hash, code_salt, expires_at
       FROM dataroom_rooms WHERE slug = $1 LIMIT 1`,
    [slug],
  )
  return res.rows[0] ?? null
}

export async function insertRoom(row: {
  slug: string
  title: string
  code_hash: string
  code_salt: string
  expires_at: Date | null
  notes?: string
}): Promise<void> {
  const pool = getDataroomPool()
  if (!pool) throw new Error('dataroom DB not configured')
  await ensureSchema(pool)
  await pool.query(
    `INSERT INTO dataroom_rooms (slug, title, code_hash, code_salt, expires_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title,
             code_hash = EXCLUDED.code_hash,
             code_salt = EXCLUDED.code_salt,
             expires_at = EXCLUDED.expires_at,
             notes = EXCLUDED.notes`,
    [row.slug, row.title, row.code_hash, row.code_salt, row.expires_at, row.notes ?? null],
  )
}

export async function logView(args: {
  slug: string
  page: string | null
  jti: string | null
  ipHash: string | null
  uaHash: string | null
}): Promise<void> {
  const pool = getDataroomPool()
  if (!pool) return
  await ensureSchema(pool)
  await pool.query(
    `INSERT INTO dataroom_views (slug, page, jti, ip_hash, ua_hash)
       VALUES ($1, $2, $3, $4, $5)`,
    [args.slug, args.page, args.jti, args.ipHash, args.uaHash],
  )
}

export async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const pool = getDataroomPool()
  if (!pool) throw new Error('dataroom DB not configured')
  await ensureSchema(pool)
  const c = await pool.connect()
  try {
    return await fn(c)
  } finally {
    c.release()
  }
}
