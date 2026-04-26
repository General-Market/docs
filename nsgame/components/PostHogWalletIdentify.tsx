'use client'

import { useEffect, useRef } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { posthog } from '@/lib/posthog'

// Bridges Solana wallet state to PostHog identity. Without this, session
// replays and events stay anonymous because lib/posthog.ts runs with
// person_profiles: 'identified_only'. We identify on connect and reset on
// disconnect so a shared device doesn't bleed sessions across wallets.
export function PostHogWalletIdentify() {
  const { address, walletName } = useWallet()
  const lastIdentified = useRef<string | null>(null)

  useEffect(() => {
    if (!posthog.__loaded) return

    if (address) {
      if (lastIdentified.current === address) return
      posthog.identify(address, {
        wallet: walletName ?? undefined,
        cluster: 'solana',
      })
      lastIdentified.current = address
    } else if (lastIdentified.current) {
      posthog.reset()
      lastIdentified.current = null
    }
  }, [address, walletName])

  return null
}
