'use client'

import { useAutoFaucet } from '@/hooks/useAutoFaucet'

/**
 * Headless mount that runs the auto-faucet hook inside the wagmi/query tree.
 * Renders nothing — the entire UX is "tx happens, balance appears."
 */
export function AutoFaucet() {
  useAutoFaucet()
  return null
}
