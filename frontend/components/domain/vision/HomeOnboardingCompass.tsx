'use client'

import { useCallback } from 'react'
import { useRouter } from '@/i18n/routing'
import { useOnboarding } from '@/hooks/useOnboarding'
import { OnboardingCompass } from './detail/OnboardingCompass'

/**
 * Homepage mount of the onboarding compass. The 'select' step shows here
 * with an arrow that always tracks the nearest market card. Once the user
 * lands on a /source/* page the step auto-completes, so revisiting the
 * homepage advances to wallet/faucet/vault/bot just like the source page.
 *
 * The vault and bot handlers route to dedicated pages — there is no vault
 * showcase to scroll to from the homepage.
 */
export function HomeOnboardingCompass() {
  const onboarding = useOnboarding('')
  const router = useRouter()

  const handleVaultDeposit = useCallback(() => {
    router.push('/vaults')
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
