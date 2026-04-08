'use client'

import { useMemo, useCallback, useEffect, useState } from 'react'
import { useAccount, useConnect, useReadContracts } from 'wagmi'
import { indexL3 } from '@/lib/wagmi'
import { useSSEUserVaultPositions } from '@/hooks/useSSE'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import fundData from '@/data/fund-branding.json'

// wagmi's multicall has a ~50 call safety cap per batch.
const CHUNK_SIZE = 50

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

  // ── Vault step — authoritative on-chain multicall ──
  // The onboarding check must answer "has the user joined *any* vault across
  // *any* source?" with zero perceived delay. SSE was the single source of
  // truth and it was unreliable — data-node's vault-position poller runs on
  // a 3s cadence and the list of vaults it polls comes from a file loaded at
  // process start, so any freshly-deployed vault is invisible until restart.
  //
  // Instead we multicall `balanceOf(user)` directly on every vault listed in
  // fund-branding.json (checked-in at build time, always current). Any
  // non-zero balance flips the step to done. SSE is kept as a warm-start
  // fallback so the first paint isn't empty while the multicall is in flight.
  const allVaultAddresses = useMemo(
    () =>
      (fundData as { funds: Array<{ vault?: string }> }).funds
        .filter((f) => !!f.vault)
        .map((f) => (f.vault as `0x${string}`).toLowerCase() as `0x${string}`),
    [],
  )

  const balanceCalls = useMemo(() => {
    if (!address || allVaultAddresses.length === 0) return []
    return allVaultAddresses.map((vaultAddr) => ({
      address: vaultAddr,
      abi: VISION_VAULT_ABI,
      functionName: 'balanceOf' as const,
      args: [address as `0x${string}`],
      chainId: indexL3.id,
    }))
  }, [address, allVaultAddresses])

  // Chunk into batches that fit the multicall safety cap.
  const chunk0Calls = balanceCalls.slice(0, CHUNK_SIZE)
  const chunk1Calls = balanceCalls.slice(CHUNK_SIZE, CHUNK_SIZE * 2)
  const chunk2Calls = balanceCalls.slice(CHUNK_SIZE * 2, CHUNK_SIZE * 3)
  const chunk3Calls = balanceCalls.slice(CHUNK_SIZE * 3, CHUNK_SIZE * 4)

  const chunk0 = useReadContracts({
    contracts: chunk0Calls as any,
    allowFailure: true,
    query: { enabled: chunk0Calls.length > 0, refetchInterval: 6000 },
  })
  const chunk1 = useReadContracts({
    contracts: chunk1Calls as any,
    allowFailure: true,
    query: { enabled: chunk1Calls.length > 0, refetchInterval: 6000 },
  })
  const chunk2 = useReadContracts({
    contracts: chunk2Calls as any,
    allowFailure: true,
    query: { enabled: chunk2Calls.length > 0, refetchInterval: 6000 },
  })
  const chunk3 = useReadContracts({
    contracts: chunk3Calls as any,
    allowFailure: true,
    query: { enabled: chunk3Calls.length > 0, refetchInterval: 6000 },
  })

  // Zero-latency instant-refetch on deposit success. useVaultDeposit fires a
  // window event the instant the claim tx confirms, so we don't wait for the
  // 6s poll. Listeners are cheap and the refetches are deduped by React Query.
  const refetch0 = chunk0.refetch
  const refetch1 = chunk1.refetch
  const refetch2 = chunk2.refetch
  const refetch3 = chunk3.refetch
  useEffect(() => {
    const handler = () => {
      refetch0()
      refetch1()
      refetch2()
      refetch3()
    }
    window.addEventListener('vault-deposit-success', handler)
    return () => window.removeEventListener('vault-deposit-success', handler)
  }, [refetch0, refetch1, refetch2, refetch3])

  const onChainHasPosition = useMemo(() => {
    for (const chunk of [chunk0, chunk1, chunk2, chunk3]) {
      if (!chunk.data) continue
      for (const r of chunk.data as Array<{ status: string; result?: unknown }>) {
        if (r?.status !== 'success') continue
        const bal = r.result as bigint | undefined
        if (bal !== undefined && bal > 0n) return true
      }
    }
    return false
  }, [chunk0.data, chunk1.data, chunk2.data, chunk3.data])

  // SSE fallback — only used until the multicall's first result lands.
  const vaultPositions = useSSEUserVaultPositions()
  const sseHasPosition = useMemo(() => {
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

  const vaultDone = !!address && (onChainHasPosition || sseHasPosition)

  // "Have we conclusively checked the user's vault positions?" — true once
  // every enabled multicall chunk has completed its first fetch (success or
  // error). Gates the tutorial so we never flash it at returning users whose
  // positions haven't loaded yet.
  const vaultPositionsChecked =
    (chunk0Calls.length === 0 || chunk0.isFetched) &&
    (chunk1Calls.length === 0 || chunk1.isFetched) &&
    (chunk2Calls.length === 0 || chunk2.isFetched) &&
    (chunk3Calls.length === 0 || chunk3.isFetched)

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
  // Hidden by default. Only appears once we have confirmed on-chain that the
  // user truly has no vault positions anywhere. No wallet → no tutorial
  // (nothing to teach yet). Positions still loading → no tutorial (would
  // flash at returning users mid-fetch). Has any position → no tutorial
  // (they've already done this dance).
  const isActive =
    !dismissed &&
    !isComplete &&
    !!address &&
    vaultPositionsChecked

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
