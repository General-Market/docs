'use client'

import { useMemo, useCallback, useEffect, useState } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { indexL3 } from '@/lib/wagmi'
import { useSSEUserVaultPositions } from '@/hooks/useSSE'
import fundData from '@/data/fund-branding.json'

export type OnboardingStep = 'wallet' | 'faucet' | 'vault' | 'bot'

const STEPS: OnboardingStep[] = ['wallet', 'faucet', 'vault', 'bot']
const DISMISSED_KEY = 'onboarding_dismissed'

export interface OnboardingState {
  /** Current step the user should complete */
  currentStep: OnboardingStep
  /** Which steps are done */
  completed: Record<OnboardingStep, boolean>
  /** Whether user dismissed the whole guide */
  dismissed: boolean
  /** Whether all steps are done */
  isComplete: boolean
  /** Whether onboarding is active (not dismissed, not complete) */
  isActive: boolean
  /** Step index (0-3) */
  stepIndex: number
  /** Total steps */
  totalSteps: number
  /** Dismiss the guide */
  dismiss: () => void
  /** Reset (show again) */
  reset: () => void
  /** Actions */
  connectWallet: () => void
  claimFaucet: () => Promise<void>
  /** Whether faucet is currently loading */
  faucetLoading: boolean
}

export function useOnboarding(sourceId: string): OnboardingState {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()

  // ── Dismissed state ──
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISSED_KEY) === '1'
  })

  const dismiss = useCallback(() => {
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, '1')
  }, [])

  const reset = useCallback(() => {
    setDismissed(false)
    localStorage.removeItem(DISMISSED_KEY)
  }, [])

  // ── Wallet step ──
  const walletDone = isConnected && !!address

  // ── Faucet step ──
  const faucetKey = address ? `faucet_used_${address.toLowerCase()}` : ''
  const [faucetDone, setFaucetDone] = useState(() => {
    if (typeof window === 'undefined' || !faucetKey) return false
    return !!localStorage.getItem(faucetKey)
  })
  const [faucetLoading, setFaucetLoading] = useState(false)

  // Re-check faucet state when address changes
  useEffect(() => {
    if (faucetKey && typeof window !== 'undefined') {
      setFaucetDone(!!localStorage.getItem(faucetKey))
    }
  }, [faucetKey])

  const claimFaucet = useCallback(async () => {
    if (!address || faucetDone || faucetLoading) return
    setFaucetLoading(true)
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: '1000', gas: true }),
      })
      if (!res.ok) throw new Error('Faucet failed')
      // Only mark the step done if the L3 gas drip actually delivered.
      // Otherwise the gate locks closed forever and the user can never retry.
      const data = await res.json().catch(() => ({}))
      if (data?.l3Gas?.error) throw new Error(data.l3Gas.error)
      localStorage.setItem(faucetKey, '1')
      setFaucetDone(true)
    } catch {
      // Swallow — user can retry
    } finally {
      setFaucetLoading(false)
    }
  }, [address, faucetDone, faucetLoading, faucetKey])

  // ── Vault step — read user positions from the SSE context ──
  // The data-node emits `user-vault-positions` whenever the user's shares or
  // pending deposit changes. Any non-zero entry across ANY vault counts as
  // "joined a vault" — the onboarding step isn't source-scoped. A deposit into
  // a Twitch vault satisfies "Join a Vault" on the Steam source page too.
  const allVaultAddresses = useMemo(
    () =>
      (fundData as { funds: Array<{ vault?: string }> }).funds
        .filter((f) => !!f.vault)
        .map((f) => (f.vault as `0x${string}`).toLowerCase()),
    [],
  )

  const vaultPositions = useSSEUserVaultPositions()

  const vaultDone = useMemo(() => {
    if (!address) return false
    for (const addr of allVaultAddresses) {
      const pos = vaultPositions[addr]
      if (!pos) continue
      try {
        if (BigInt(pos.shares) > 0n || BigInt(pos.pending_deposit) > 0n) return true
      } catch { /* ignore malformed */ }
    }
    return false
  }, [address, allVaultAddresses, vaultPositions])
  // sourceId is retained for future per-source logic; currently unused here.
  void sourceId

  // ── Bot step — considered done once vault is done (it's a CTA, not gated) ──
  // We track it separately so the UI can show the final step
  const [botClicked, setBotClicked] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('onboarding_bot_clicked') === '1'
  })

  // Auto-mark bot as seen once vault is done and user clicks deploy
  useEffect(() => {
    if (typeof window !== 'undefined' && botClicked) {
      localStorage.setItem('onboarding_bot_clicked', '1')
    }
  }, [botClicked])

  // ── Wallet connect action ──
  const connectWallet = useCallback(async () => {
    const hasWallet = typeof window !== 'undefined' && !!(window as any).ethereum
    if (!hasWallet) {
      const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (isMobile) {
        const stripped = window.location.href.replace(/^https?:\/\//, '')
        window.location.href = `https://metamask.app.link/dapp/${stripped}`
      } else {
        window.open('https://metamask.io/download/', '_blank', 'noopener,noreferrer')
      }
      return
    }

    const injected = connectors.find(c => c.id === 'injected')
    if (!injected) return

    const chainIdHex = `0x${indexL3.id.toString(16)}`
    const provider = (window as any).ethereum
    if (provider) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: indexL3.name,
            nativeCurrency: indexL3.nativeCurrency,
            rpcUrls: [indexL3.rpcUrls.default.http[0]],
          }],
        })
      } catch { /* chain may already exist */ }
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        })
      } catch { /* user rejected */ }
    }
    connect({ connector: injected, chainId: indexL3.id })
  }, [connect, connectors])

  // ── Derive current step ──
  const completed: Record<OnboardingStep, boolean> = {
    wallet: walletDone,
    faucet: faucetDone,
    vault: vaultDone,
    bot: botClicked,
  }

  const currentStep = useMemo(() => {
    for (const step of STEPS) {
      if (!completed[step]) return step
    }
    return 'bot' // all done
  }, [completed.wallet, completed.faucet, completed.vault, completed.bot])

  const stepIndex = STEPS.indexOf(currentStep)
  const isComplete = STEPS.every(s => completed[s])
  const isActive = !dismissed && !isComplete

  return {
    currentStep,
    completed,
    dismissed,
    isComplete,
    isActive,
    stepIndex,
    totalSteps: STEPS.length,
    dismiss,
    reset,
    connectWallet,
    claimFaucet,
    faucetLoading,
  }
}
