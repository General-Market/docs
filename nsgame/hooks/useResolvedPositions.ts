'use client'

/**
 * useResolvedPositions — local-only memory of which positions resolved
 * since the wallet last saw the app.
 *
 * The on-chain positions feed is the source of truth. This hook does not
 * fetch — it reads `useUserPositions(address)` and compares each
 * resolved position's settlement timestamp against a `nsgame_last_seen_at`
 * watermark held in localStorage.
 *
 * The watermark advances only when `markAllSeen()` runs. Until then,
 * any position that resolved after the watermark is "unviewed". The
 * count powers the BottomNav badge; the array powers the toast.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useUserPositions, type UserPosition, type PositionState } from '@/lib/markets/positions'

const LAST_SEEN_KEY = 'nsgame_last_seen_at'

function isResolved(state: PositionState): boolean {
  return (
    state === 'resolved-won' ||
    state === 'resolved-lost' ||
    state === 'claimed-won' ||
    state === 'claimed-lost' ||
    state === 'stranded-refund'
  )
}

function readLastSeen(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_KEY)
    if (!raw) return 0
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed < 0) return 0
    return parsed
  } catch {
    return 0
  }
}

function writeLastSeen(value: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, String(value))
  } catch {
    // Quota or privacy mode. The hook degrades gracefully — every visit
    // looks like the first.
  }
}

export interface UseResolvedPositionsReturn {
  /** Positions that resolved after the stored watermark. */
  resolvedSinceLastSeen: UserPosition[]
  /** Length of `resolvedSinceLastSeen`. */
  unviewedCount: number
  /** Move the watermark to `Date.now()`. */
  markAllSeen: () => void
}

export function useResolvedPositions(): UseResolvedPositionsReturn {
  const { address } = useWallet()
  const { positions } = useUserPositions(address)

  // Hydrate the watermark from localStorage on mount. The first paint on
  // the server has no access; the second on the client reads the value.
  const [lastSeenAt, setLastSeenAt] = useState<number>(0)
  useEffect(() => {
    setLastSeenAt(readLastSeen())
  }, [])

  const resolvedSinceLastSeen = useMemo<UserPosition[]>(() => {
    if (!address) return []
    if (lastSeenAt === 0) return []
    return positions.filter(p => {
      if (!isResolved(p.state)) return false
      // settlementTime is unix seconds; compare in the same unit.
      const settlementMs = p.settlementTime * 1000
      return settlementMs > lastSeenAt
    })
  }, [address, lastSeenAt, positions])

  const markAllSeen = useCallback(() => {
    const now = Date.now()
    writeLastSeen(now)
    setLastSeenAt(now)
  }, [])

  return useMemo(
    () => ({
      resolvedSinceLastSeen,
      unviewedCount: resolvedSinceLastSeen.length,
      markAllSeen,
    }),
    [resolvedSinceLastSeen, markAllSeen],
  )
}
