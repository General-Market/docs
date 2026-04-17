'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { useAgentHighlight } from '@/hooks/useAgentHighlight'
import { AgentSearchBox } from '@/components/domain/AgentSearchBox'
import { LeaderboardWrapper } from '@/components/domain/LeaderboardWrapper'
import { scrollToAgentRow } from '@/lib/utils/scroll'

/**
 * LeaderboardWithSearch component
 * Combines AgentSearchBox with LeaderboardWrapper
 * Handles search, highlight, scroll, and not-found state
 * AC1, AC2, AC3, AC4, AC5, AC6: Full search integration
 */
export function LeaderboardWithSearch() {
  const { leaderboard } = useLeaderboard()
  const { highlightedAddress, setHighlightedAddress } = useAgentHighlight()
  const [isNotFound, setIsNotFound] = useState(false)

  // Track if we've handled the initial URL highlight to prevent infinite loops
  const initialHighlightHandledRef = useRef(false)
  // Track the last highlighted address to prevent re-processing same highlight
  const lastProcessedHighlightRef = useRef<string | null>(null)

  // Handle URL-based highlight on load (runs only once per unique highlight)
  useEffect(() => {
    // Skip if no highlight or leaderboard not loaded yet
    if (!highlightedAddress || leaderboard.length === 0) {
      return
    }

    // Skip if we've already processed this highlight
    if (lastProcessedHighlightRef.current === highlightedAddress) {
      return
    }

    // Mark this highlight as processed
    lastProcessedHighlightRef.current = highlightedAddress

    // Check if address exists in leaderboard (case-insensitive)
    const agentExists = leaderboard.some(
      (a) => a.walletAddress.toLowerCase() === highlightedAddress.toLowerCase()
    )

    if (agentExists) {
      // Use requestAnimationFrame + setTimeout for more reliable DOM timing
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToAgentRow(highlightedAddress)
        }, 50)
      })
    } else {
      setIsNotFound(true)
      setHighlightedAddress(null)
      // Reset processed ref since we cleared the highlight
      lastProcessedHighlightRef.current = null
    }
  }, [highlightedAddress, leaderboard, setHighlightedAddress])

  // Handle search
  const handleSearch = useCallback((address: string) => {
    // Check if address exists in leaderboard (case-insensitive)
    const agentExists = leaderboard.some(
      (a) => a.walletAddress.toLowerCase() === address.toLowerCase()
    )

    if (agentExists) {
      setIsNotFound(false)
      // Update the processed ref before setting highlight to prevent re-processing
      lastProcessedHighlightRef.current = address
      setHighlightedAddress(address)
      // Use requestAnimationFrame + setTimeout for more reliable DOM timing
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToAgentRow(address)
        }, 50)
      })
    } else {
      setIsNotFound(true)
      setHighlightedAddress(null)
      lastProcessedHighlightRef.current = null
    }
  }, [leaderboard, setHighlightedAddress])

  // Handle dismiss not found
  const handleDismissNotFound = useCallback(() => {
    setIsNotFound(false)
  }, [])

  return (
    <div>
      <AgentSearchBox
        onSearch={handleSearch}
        isNotFound={isNotFound}
        onDismissNotFound={handleDismissNotFound}
      />
      <LeaderboardWrapper highlightedAddress={highlightedAddress} />
    </div>
  )
}
