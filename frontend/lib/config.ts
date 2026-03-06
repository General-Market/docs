// Centralized runtime URL configuration
// All hooks/components import from here instead of redeclaring env vars locally.

// ── Server-side URLs (API routes, next.config.ts rewrites) ──
export const REWRITES_BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'
export const AA_DATA_NODE_URL = process.env.AA_DATA_NODE_URL || 'http://localhost:8200'
export const L3_RPC_SERVER = process.env.L3_RPC_URL || process.env.NEXT_PUBLIC_L3_RPC_URL || 'http://localhost:8545'
export const DATA_NODE_SERVER = process.env.DATA_NODE_URL || process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'
export const ISSUER_VISION_URL = process.env.ISSUER_VISION_URL || 'http://localhost:10001'
export const CSP_CONNECT_EXTRA = process.env.CSP_CONNECT_EXTRA || ''

// ── Client-side URLs (NEXT_PUBLIC_ prefix for browser exposure) ──
// In production, use /dn proxy (Next.js rewrite) to avoid mixed content (HTTP data-node on HTTPS page)
export const DATA_NODE_URL = typeof window !== 'undefined' && window.location.protocol === 'https:'
  ? '/dn'
  : (process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200')
export const L3_RPC_URL = process.env.NEXT_PUBLIC_L3_RPC_URL || 'http://localhost:8545'
export const ARB_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546'
export const AP_URL = process.env.NEXT_PUBLIC_AP_URL || 'http://localhost:9100'
export const L3_EXPLORER_URL = process.env.NEXT_PUBLIC_L3_EXPLORER_URL || ''
export const ARB_EXPLORER_URL = process.env.NEXT_PUBLIC_ARB_EXPLORER_URL || 'https://sepolia.arbiscan.io'

// Vision API — proxied through Next.js rewrites to avoid CORS.
// In dev: /api/vision/* → localhost:10001/vision/*
// In prod: /api/vision/* → issuer health port
export const VISION_API_URL = '/api'

// Vision issuer URLs — for bitmap submission, balance proofs, withdrawals.
// These point to each issuer's health port (Vision routes merged in).
export const VISION_ISSUER_URLS = (
  process.env.NEXT_PUBLIC_ISSUER_URLS ||
  'http://localhost:10001,http://localhost:10002,http://localhost:10003'
).split(',').map(s => s.trim())
