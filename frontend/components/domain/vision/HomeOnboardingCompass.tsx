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

  const handleVaultDeposit = useCallback(() => {
    if (typeof document === 'undefined') return
    const grid =
      document.querySelector('[data-onboarding-target="market-card"]') ??
      document.querySelector('main')
    grid?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

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
