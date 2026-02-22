// Centralized runtime URL configuration
// All hooks/components import from here instead of redeclaring env vars locally.

// Server-side URLs (only used in next.config.ts / API routes — no NEXT_PUBLIC_ prefix)
export const REWRITES_BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'
export const AA_DATA_NODE_URL = process.env.AA_DATA_NODE_URL || 'http://localhost:8200'

// Client-side URLs (NEXT_PUBLIC_ prefix required for Next.js browser exposure)
export const DATA_NODE_URL = process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'
export const L3_RPC_URL = process.env.NEXT_PUBLIC_L3_RPC_URL || 'http://localhost:8545'
export const ARB_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546'
export const AP_URL = process.env.NEXT_PUBLIC_AP_URL || 'http://localhost:9100'
export const L3_EXPLORER_URL = process.env.NEXT_PUBLIC_L3_EXPLORER_URL || ''
export const ARB_EXPLORER_URL = process.env.NEXT_PUBLIC_ARB_EXPLORER_URL || 'https://sepolia.arbiscan.io'

// P2Pool API — runs on issuer health port (same port as /health).
// Batch/history/backtest/bitmap/balance endpoints all served on health port.
export const P2POOL_API_URL = process.env.NEXT_PUBLIC_P2POOL_API_URL || 'http://localhost:10001'

// P2Pool issuer URLs — for bitmap submission, balance proofs, withdrawals.
// These point to each issuer's health port (P2Pool routes merged in).
export const P2POOL_ISSUER_URLS = (
  process.env.NEXT_PUBLIC_ISSUER_URLS ||
  'http://localhost:10001,http://localhost:10002,http://localhost:10003'
).split(',').map(s => s.trim())
