'use client'

import { useCallback } from 'react'
import { useRouter } from '@/i18n/routing'
import { useOnboarding } from '@/hooks/useOnboarding'
import { OnboardingCompass } from './detail/OnboardingCompass'

/**
 * Homepage mount of the onboarding compass. The 'select' step shows here
 * with an arrow that rotates through visible market cards. Once the user
 * lands on a /source/* page the step auto-completes, so revisiting the
 * homepage advances through wallet/faucet/vault/bot just like the source
 * page.
 *
 * The vault step from the homepage doesn't have a vault showcase to
 * scroll to — instead the CTA scrolls the source grid into view, since
 * vaults are reached *through* a market source. The standalone /vaults
 * page is gone.
 */
export function HomeOnboardingCompass() {
  const onboarding = useOnboarding('')
  const router = useRouter()

  // Route the vault CTA to the Twitch source page — that's where vaults
  // are actually offered after wiping /vaults. The standalone vault index
  // is gone; vaults live inside each market source page.
  const handleVaultDeposit = useCallback(() => {
    router.push('/source/twitch')
  }, [router])

  const handleBotDeploy = useCallback(() => {
    router.push('/build-bot')
  }, [router])

  return (
    <OnboardingCompass
      state={onboarding}
      onVaultDeposit={handleVaultDeposit}
      onBotDeploy={handleBotDeploy}
    />
  )
}
