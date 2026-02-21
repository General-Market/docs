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
