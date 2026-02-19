'use client'

import { useEffect, useState, useRef } from 'react'
import { RankChangeEvent } from '@/hooks/useLeaderboardSSE'

/**
 * Return type for useRankChangeAnimation hook
 */
export interface UseRankChangeAnimationReturn {
  /** Whether the row is currently animating */
  isAnimating: boolean
  /** The change in rank (positive = moved up, negative = moved down) */
  rankDelta: number
  /** Whether the rank change was positive (moved up in rankings) */
  isPositive: boolean
  /** The old rank before the change */
  oldRank: number | null
  /** The new rank after the change */
  newRank: number | null
}

/** Animation duration in milliseconds */
const ANIMATION_DURATION = 2000

/**
 * Hook for tracking and animating rank changes for a specific agent
 *
 * Listens for 'leaderboard-rank-change' custom events emitted by useLeaderboardSSE
 * and triggers animation state when the specified wallet address has a rank change.
 *
 * @param walletAddress - The wallet address to track rank changes for
 * @returns Animation state including isAnimating, rankDelta, and position change info
 */
export function useRankChangeAnimation(walletAddress: string): UseRankChangeAnimationReturn {
  const [isAnimating, setIsAnimating] = useState(false)
  const [rankDelta, setRankDelta] = useState(0)
  const [oldRank, setOldRank] = useState<number | null>(null)
  const [newRank, setNewRank] = useState<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    /**
     * Handle rank change events from SSE
     */
    function handleRankChange(event: CustomEvent<RankChangeEvent>) {
      const { address, oldRank: prevRank, newRank: nextRank } = event.detail

      // Check if this event is for our wallet address (case-insensitive)
      if (address.toLowerCase() !== walletAddress.toLowerCase()) {
        return
      }

      // Clear any existing animation timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Calculate rank delta (positive = moved up in rankings, e.g., 5 -> 3 = +2)
      const delta = prevRank - nextRank

      // Set animation state
      setRankDelta(delta)
      setOldRank(prevRank)
      setNewRank(nextRank)
      setIsAnimating(true)

      // Clear animation after duration
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false)
        setRankDelta(0)
        setOldRank(null)
        setNewRank(null)
      }, ANIMATION_DURATION)
    }

    // Add event listener for rank changes
    window.addEventListener(
      'leaderboard-rank-change',
      handleRankChange as EventListener
    )

    // Cleanup
    return () => {
      window.removeEventListener(
        'leaderboard-rank-change',
        handleRankChange as EventListener
      )
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [walletAddress])

  return {
    isAnimating,
    rankDelta,
    isPositive: rankDelta > 0,
    oldRank,
    newRank
  }
}
