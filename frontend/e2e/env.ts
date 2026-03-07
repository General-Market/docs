/**
 * Centralized E2E environment configuration.
 * All E2E helpers and test specs import from here instead of
 * redeclaring env vars and IS_TESTNET ternaries locally.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

// ── Behavioral flag ─────────────────────────────────────────
/** true when running against local Anvil (not a real testnet) */
export const IS_ANVIL = process.env.E2E_TESTNET !== '1'

// ── URLs ────────────────────────────────────────────────────
export const L3_RPC = process.env.E2E_L3_RPC_URL || 'http://localhost:8545'
export const SETTLEMENT_RPC = process.env.E2E_SETTLEMENT_RPC_URL || 'http://localhost:8546'
export const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:8200'
export const VISION_API = process.env.E2E_VISION_API_URL || 'http://localhost:10001'
export const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000'
export const ISSUER_URLS = (
  process.env.E2E_ISSUER_URLS || 'http://localhost:10001,http://localhost:10002,http://localhost:10003'
).split(',').map(s => s.trim())
export const AP_URL = process.env.E2E_AP_URL || process.env.NEXT_PUBLIC_AP_URL || 'http://localhost:9100'

// ── Chain IDs ───────────────────────────────────────────────
export const CHAIN_ID = Number(process.env.E2E_CHAIN_ID || 111222333)
export const SETTLEMENT_CHAIN_ID = Number(process.env.E2E_SETTLEMENT_CHAIN_ID || 421611337)

// ── Keys ────────────────────────────────────────────────────
export const DEPLOYER_KEY = (
  process.env.E2E_PRIVATE_KEY || '0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537'
) as `0x${string}`
export const PLAYER2_KEY = (
  process.env.E2E_PLAYER2_KEY || '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6'
) as `0x${string}`

// ── Deployment — single load, crash if missing ──────────────
export const DEPLOYMENT = (() => {
  const path = join(__dirname, '..', '..', 'deployments', 'active-deployment.json')
  return JSON.parse(readFileSync(path, 'utf-8'))
})()

export const CONTRACTS = DEPLOYMENT.contracts ?? {}
export const DEPLOYER_ADDRESS = DEPLOYMENT.accounts?.admin ?? '0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4'

/** Anvil deployer (account #0) — used for impersonated txs on local Anvil */
export const ANVIL_DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

// ── Testnet-aware timeouts ──────────────────────────────────
export const POLL_TIMEOUT = IS_ANVIL ? 60_000 : 180_000
export const CONSENSUS_TIMEOUT = IS_ANVIL ? 90_000 : 240_000
export const RPC_TIMEOUT = IS_ANVIL ? 10_000 : 30_000
