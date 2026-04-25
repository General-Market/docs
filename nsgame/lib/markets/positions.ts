'use client'

/**
 * useUserPositions — every bet a wallet has placed, with derived state.
 *
 * The route handler does the heavy join. This hook polls every 15 seconds,
 * coerces the string-encoded BigInts into bigints, and computes a one-tick
 * `justWon` flag the UI uses to fire the celebration animation. The flag
 * latches true only on the FIRST tick a position transitions into a won
 * state, then resets — so the animation runs once per win.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

export type PositionState =
  | 'open'
  | 'settling'
  | 'resolved-won'
  | 'resolved-lost'
  | 'claimed-won'
  | 'claimed-lost'
  | 'stranded-refund'

export interface UserPosition {
  market: string
  sourceId: number
  closeTime: number
  settlementTime: number
  thresholdBps: number
  side: 'yes' | 'no'
  amount: bigint
  state: PositionState
  baselinePrice: bigint | null
  finalPrice: bigint | null
  claimNet: bigint | null
  claimSig: string | null
  betSig: string
  /** Latched true the first tick a state transitions into a won variant. */
  justWon?: boolean
}

interface UserPositionDTO {
  market: string
  sourceId: number
  closeTime: number
  settlementTime: number
  thresholdBps: number
  side: 'yes' | 'no'
  amount: string
  state: PositionState
  baselinePrice: string | null
  finalPrice: string | null
  claimNet: string | null
  claimFee: string | null
  claimSig: string | null
  betSig: string
}

const POSITIONS_POLL_MS = 15_000

function safeBig(v: string | null): bigint | null {
  if (v === null) return null
  try { return BigInt(v) } catch { return null }
}

function isWon(state: PositionState): boolean {
  return state === 'resolved-won' || state === 'claimed-won'
}

export interface UseUserPositionsReturn {
  positions: UserPosition[]
  loading: boolean
}

export function useUserPositions(walletPubkey: string | null): UseUserPositionsReturn {
  const [positions, setPositions] = useState<UserPosition[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  // Last-seen state per market — used to detect won-transitions for one
  // render only. Stored in a ref so updating it doesn't cause re-renders.
  const lastStateRef = useRef<Record<string, PositionState>>({})
  const lastWalletRef = useRef<string | null>(null)

  useEffect(() => {
    if (!walletPubkey) {
      setPositions([])
      setLoading(false)
      lastStateRef.current = {}
      lastWalletRef.current = null
      return
    }

    // Wallet swap wipes the transition map — a different wallet's win is
    // not this wallet's win.
    if (lastWalletRef.current !== walletPubkey) {
      lastStateRef.current = {}
      lastWalletRef.current = walletPubkey
      setPositions([])
      setLoading(true)
    }

    let cancelled = false

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/positions/${walletPubkey}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const payload = (await res.json()) as { positions?: UserPositionDTO[] }
        if (cancelled || lastWalletRef.current !== walletPubkey) return

        const prev = lastStateRef.current
        const nextMap: Record<string, PositionState> = {}
        const next: UserPosition[] = (payload.positions ?? []).map(p => {
          const previous = prev[p.market]
          const justWon = isWon(p.state) && (previous === undefined || !isWon(previous))
          nextMap[p.market] = p.state
          return {
            market: p.market,
            sourceId: p.sourceId,
            closeTime: p.closeTime,
            settlementTime: p.settlementTime,
            thresholdBps: p.thresholdBps,
            side: p.side,
            amount: safeBig(p.amount) ?? 0n,
            state: p.state,
            baselinePrice: safeBig(p.baselinePrice),
            finalPrice: safeBig(p.finalPrice),
            claimNet: safeBig(p.claimNet),
            claimSig: p.claimSig,
            betSig: p.betSig,
            justWon,
          }
        })
        lastStateRef.current = nextMap
        setPositions(next)
      } catch {
        // Indexer offline — keep last snapshot.
      } finally {
        if (!cancelled && lastWalletRef.current === walletPubkey) {
          setLoading(false)
        }
      }
    }

    void fetchOnce()
    const id = window.setInterval(fetchOnce, POSITIONS_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [walletPubkey])

  return useMemo(() => ({ positions, loading }), [positions, loading])
}
