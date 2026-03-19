// Centralized runtime URL configuration.
// All hooks/components import from here instead of redeclaring env vars locally.
// Browser-side URLs go through /api/* catch-all proxies — no mixed-content, no CORS.

// ── Server-only URLs (used by next.config.ts, API route handlers) ──
export const REWRITES_BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'
export const AA_DATA_NODE_URL = process.env.AA_DATA_NODE_URL || 'http://localhost:8200'
export const DATA_NODE_SERVER = process.env.DATA_NODE_URL || 'http://localhost:8200'
export const ISSUER_VISION_URL = process.env.ISSUER_VISION_URL || process.env.ORACLE_VISION_URL || 'http://localhost:10001'
export const CSP_CONNECT_EXTRA = (process.env.CSP_CONNECT_EXTRA || '').trim()

// ── Isomorphic URLs (browser → proxy, server → direct) ──
export const DATA_NODE_URL = typeof window !== 'undefined'
  ? '/api/dn'
  : (process.env.DATA_NODE_URL || 'http://localhost:8200')

export const ORACLE_URL = typeof window !== 'undefined'
  ? '/api/oracle'
  : (process.env.ORACLE_URL || 'http://localhost:9001')

// Vision API — browser goes through catch-all proxy, server goes direct.
// Accepts VISION_API_URL or ORACLE_VISION_URL (post issuer→oracle rename).
export const VISION_API_URL = typeof window !== 'undefined'
  ? '/api'
  : (process.env.VISION_API_URL || process.env.ORACLE_VISION_URL || 'http://localhost:10001')

// ── Client-side URLs ──
export const L3_RPC_URL = process.env.NEXT_PUBLIC_L3_RPC_URL || 'http://localhost:8545'
export const L3_RPC_SERVER = process.env.L3_RPC_URL || process.env.NEXT_PUBLIC_L3_RPC_URL || 'http://localhost:8545'
export const SETTLEMENT_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546'
export const AP_URL = process.env.NEXT_PUBLIC_AP_URL || 'http://localhost:9100'
export const L3_EXPLORER_URL = process.env.NEXT_PUBLIC_L3_EXPLORER_URL || ''
export const SETTLEMENT_EXPLORER_URL = process.env.NEXT_PUBLIC_SETTLEMENT_EXPLORER_URL || 'https://testnet.sonicscan.org'

// Vision oracle URLs — for bitmap submission, balance proofs, withdrawals.
// Accepts NEXT_PUBLIC_ISSUER_URLS or NEXT_PUBLIC_ORACLE_URLS (post rename).
export const VISION_ISSUER_URLS = (
  process.env.NEXT_PUBLIC_ISSUER_URLS ||
  process.env.NEXT_PUBLIC_ORACLE_URLS ||
  'http://localhost:10001,http://localhost:10002,http://localhost:10003'
).split(',').map(s => s.trim())
