// Thin Postgres pool wrapper for the event-indexer API routes.
//
// The indexer writes to a schema (default: `prediction_market`) that
// every route here reads from. Connection details come from env — one
// pool per Node process, shared across route invocations.
//
// Keep this file untied to Next.js APIs; it is imported by route
// handlers only, never by client code.

import { Pool, type PoolClient, type QueryResultRow } from 'pg'

const DEFAULT_SCHEMA = 'prediction_market'

let _pool: Pool | null = null

function buildPool(): Pool {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('POSTGRES_URL (or DATABASE_URL) must be set for the event-indexer API')
  }
  return new Pool({
    connectionString,
    // Keep the pool small — Next.js serverless environments recycle
    // processes and a large pool starves other tenants on shared PG.
    max: Number(process.env.POSTGRES_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })
}

export function getPool(): Pool {
  if (!_pool) _pool = buildPool()
  return _pool
}

/** Schema name, validated. The API layer reads from exactly one schema. */
export function getSchema(): string {
  const s = process.env.POSTGRES_SCHEMA || DEFAULT_SCHEMA
  if (!/^[A-Za-z0-9_]+$/.test(s)) {
    throw new Error(`POSTGRES_SCHEMA must match [A-Za-z0-9_]+ — got ${JSON.stringify(s)}`)
  }
  return s
}

/**
 * Run a parameterized query against the indexer schema. The schema name
 * is interpolated directly (Postgres does not accept identifier params),
 * but `getSchema()` validates it against a strict allowlist.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T[]> {
  const text = sql.replace(/__SCHEMA__/g, getSchema())
  const res = await getPool().query<T>(text, params as unknown[])
  return res.rows
}

/**
 * Checkout a dedicated client — needed when a route wants LISTEN across
 * multiple queries on the same session. Caller must `release()` it.
 */
export async function checkout(): Promise<PoolClient> {
  return getPool().connect()
}
