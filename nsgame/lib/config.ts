// Centralized runtime URL configuration.
// All hooks/components import from here instead of redeclaring env vars locally.
// Browser-side URLs go through /api/* catch-all proxies — no mixed-content, no CORS.
//
// IMPORTANT: Server-only URLs are exported as getter functions, not constants.
// Next.js webpack inlines `process.env.LITERAL` at build time — if a var is
// absent during the build, the compiled bundle has `undefined` baked in and
// falls through to the localhost default forever. Getter functions read
// process.env at call time, so the Vercel runtime value is always used.

// ── Build-time safe (used by next.config.ts at config load) ──
export const REWRITES_BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'
export const CSP_CONNECT_EXTRA = (process.env.CSP_CONNECT_EXTRA || '').trim()

// ── Server-only URLs (API route handlers) ──
// Exported as functions — call them, don't reference them as bare values.
export function getAaDataNodeUrl(): string {
  return (
    process.env['AA_DATA_NODE_URL'] ||
    process.env['DATA_NODE_URL'] ||
    process.env['NEXT_PUBLIC_DATA_NODE_URL'] ||
    'http://localhost:8200'
  )
}

export function getDataNodeServer(): string {
  return process.env['DATA_NODE_URL'] || 'http://localhost:8200'
}

// Backward-compat aliases — kept for any remaining import sites.
export const AA_DATA_NODE_URL = process.env['AA_DATA_NODE_URL'] || 'http://localhost:8200'
export const DATA_NODE_SERVER = process.env['DATA_NODE_URL'] || 'http://localhost:8200'

// ── Isomorphic URLs (browser → proxy, server → direct) ──
export const DATA_NODE_URL = typeof window !== 'undefined'
  ? '/api/dn'
  : (process.env['DATA_NODE_URL'] || 'http://localhost:8200')

export const ORACLE_URL = typeof window !== 'undefined'
  ? '/api/oracle'
  : (process.env['ORACLE_URL'] || 'http://localhost:9001')
