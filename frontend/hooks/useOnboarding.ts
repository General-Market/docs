'use client'

import { useMemo, useCallback, useEffect, useState } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { indexL3 } from '@/lib/wagmi'
import { useOnChainVaultPositions } from '@/hooks/vaults/useOnChainVaultPositions'

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
        body: JSON.stringify({ address, amount: '1000', scope: 'vision' }),
      })
      if (!res.ok) throw new Error('Faucet failed')
      // Only mark the step done if both L3 USDC mint and GM gas drip delivered.
      // Otherwise the gate locks closed forever and the user can never retry.
      const data = await res.json().catch(() => ({}))
      if (data?.vision?.usdc?.error) throw new Error(data.vision.usdc.error)
      if (data?.vision?.gas?.error) throw new Error(data.vision.gas.error)
      localStorage.setItem(faucetKey, '1')
      setFaucetDone(true)
    } catch {
      // Swallow — user can retry
    } finally {
      setFaucetLoading(false)
    }
  }, [address, faucetDone, faucetLoading, faucetKey])

  // ── Vault step — authoritative on-chain multicall ──
  // Answers "has the user joined any vault across any source?" directly from
  // chain state, via the shared useOnChainVaultPositions hook. SSE was the
  // original source of truth and proved unreliable: the data-node poller
  // runs off fund-branding.json loaded at process start, so freshly-deployed
  // vaults were invisible until a restart.
  const { shares: onChainShares, pending: onChainPending, isChecked: vaultPositionsChecked } =
    useOnChainVaultPositions(address as `0x${string}` | undefined)

  const onChainVaultDone = useMemo(() => {
    if (!address) return false
    for (const v of onChainShares.values()) if (v > 0n) return true
    for (const v of onChainPending.values()) if (v > 0n) return true
    return false
  }, [address, onChainShares, onChainPending])

  // Cache the result in localStorage so revisits render the tutorial
  // immediately instead of waiting for the multicall. '1' = joined, '0' =
  // not joined, absent = unknown (first visit on this device).
  const vaultCacheKey = address ? `onboarding_vault_joined_${address.toLowerCase()}` : ''
  const [cachedVaultJoined, setCachedVaultJoined] = useState<boolean | null>(() => {
    if (typeof window === 'undefined' || !vaultCacheKey) return null
    const v = localStorage.getItem(vaultCacheKey)
    return v === '1' ? true : v === '0' ? false : null
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !vaultCacheKey) return
    const v = localStorage.getItem(vaultCacheKey)
    setCachedVaultJoined(v === '1' ? true : v === '0' ? false : null)
  }, [vaultCacheKey])

  useEffect(() => {
    if (typeof window === 'undefined' || !vaultCacheKey || !vaultPositionsChecked) return
    localStorage.setItem(vaultCacheKey, onChainVaultDone ? '1' : '0')
    setCachedVaultJoined(onChainVaultDone)
  }, [vaultCacheKey, vaultPositionsChecked, onChainVaultDone])

  // Effective vaultDone: prefer on-chain once it resolves, otherwise fall
  // back to cache. Cache-miss users default to "not joined" and see the
  // tutorial immediately — which is correct for first-time users.
  const vaultDone = vaultPositionsChecked ? onChainVaultDone : (cachedVaultJoined === true)

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
  // Show the guide as soon as we have a wallet. Cached vault state keeps us
  // from flashing at returning vault users: if their previous visit resolved
  // "joined", the cache reads '1' and isComplete suppresses the guide before
  // the multicall even fires. First-time users default to not-joined and see
  // the tutorial immediately — no waiting on RPC.
  const isActive = !dismissed && !isComplete && !!address

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
