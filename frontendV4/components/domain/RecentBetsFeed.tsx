'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { ConnectionStatus } from '@/components/ui/ConnectionStatus'
import { AnimatedBetFeedItem } from '@/components/domain/AnimatedBetFeedItem'
import { BotTradingNotice } from '@/components/domain/BotTradingNotice'
import { useBetsSSE } from '@/hooks/useBetsSSE'
import { useRecentBets } from '@/hooks/useRecentBets'
import { usePrefersReducedMotion, useIsMobile } from '@/hooks/useMediaQueries'
import { getBackendUrl } from '@/lib/contracts/addresses'

/**
 * Loading skeleton for feed items
 */
function FeedSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-white/10 last:border-b-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-24 bg-white/10 rounded" />
            <div className="h-4 w-32 bg-white/10 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-16 bg-white/10 rounded" />
            <div className="h-3 w-20 bg-white/10 rounded" />
            <div className="h-3 w-14 bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Empty state when no bets exist
 */
function EmptyState() {
  return (
    <div className="p-8 text-center">
      <p className="text-white/60 font-mono">No recent bets</p>
      <p className="text-white/40 text-sm font-mono mt-1">
        Portfolio bets will appear here as they are placed
      </p>
    </div>
  )
}

/**
 * Loading spinner for infinite scroll
 */
function LoadingSpinner() {
  return (
    <div className="flex justify-center py-4">
      <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
    </div>
  )
}

/**
 * RecentBetsFeed component
 *
 * AC1: Subscribes to /api/sse/bets endpoint via useBetsSSE hook
 * AC2: New bets animate in from top with fade and slide
 * AC5: Virtual scrolling via CSS content-visibility for performance
 * AC6: Infinite scroll loads older bets on scroll to bottom
 * AC7: Animations disabled on mobile and prefers-reduced-motion
 * AC9: ConnectionStatus shows Live/Polling/Offline
 * AC10: SSE updates TanStack Query cache via useBetsSSE hook
 */
export function RecentBetsFeed() {
  const { events, isLoading, isError } = useRecentBets(20)
  const { isConnected, isPolling } = useBetsSSE()
  const prefersReducedMotion = usePrefersReducedMotion()
  const isMobile = useIsMobile()

  // Track which items are "new" (added via SSE) for animation triggers
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set())

  // AC6: Infinite scroll state
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadedEvents, setLoadedEvents] = useState<typeof events>([])

  // Combine initial events with loaded events (avoiding duplicates)
  const allEvents = useCallback(() => {
    const eventMap = new Map<string, (typeof events)[0]>()

    // Add initial events first
    events.forEach(e => eventMap.set(e.betId, e))

    // Add loaded events (older ones)
    loadedEvents.forEach(e => {
      if (!eventMap.has(e.betId)) {
        eventMap.set(e.betId, e)
      }
    })

    // Sort by timestamp descending (newest first)
    return Array.from(eventMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }, [events, loadedEvents])

  const displayEvents = allEvents()

  // Listen for new bet events from SSE for animation triggers
  useEffect(() => {
    const handler = (e: CustomEvent<{ betId: string; portfolioSize: number }>) => {
      setNewItemIds(prev => new Set(prev).add(e.detail.betId))

      // Clear "new" status after animation completes (1 second)
      setTimeout(() => {
        setNewItemIds(prev => {
          const next = new Set(prev)
          next.delete(e.detail.betId)
          return next
        })
      }, 1000)
    }

    window.addEventListener('bet-feed-new-bet', handler as EventListener)
    return () => window.removeEventListener('bet-feed-new-bet', handler as EventListener)
  }, [])

  // AC6: Infinite scroll - load more when sentinel is visible
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isLoadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadMoreBets()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore])

  /**
   * Load older bets for infinite scroll
   * AC6: Append to existing events without triggering new-item animations
   */
  async function loadMoreBets() {
    setIsLoadingMore(true)
    try {
      // Get backend URL
      let backendUrl: string
      try {
        backendUrl = getBackendUrl()
      } catch {
        // Backend not configured, no more to load
        setHasMore(false)
        return
      }

      const offset = displayEvents.length
      const response = await fetch(`${backendUrl}/api/bets/recent?limit=20&offset=${offset}`)

      if (!response.ok) {
        setHasMore(false)
        return
      }

      const data = await response.json()

      if (data.events.length < 20) {
        setHasMore(false)
      }

      if (data.events.length > 0) {
        // Append to loaded events without marking as new
        setLoadedEvents(prev => [...prev, ...data.events])
      }
    } catch {
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Show all loaded events (infinite scroll grows this list)
  const visibleEvents = displayEvents

  return (
    <Card className="border-white/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Recent Portfolio Bets</CardTitle>
          <ConnectionStatus isConnected={isConnected} isPolling={isPolling} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* AC5: Scrollable container with CSS content-visibility for virtualization */}
        <div
          className="h-[300px] md:h-[400px] overflow-y-auto"
          role="list"
          aria-label="Recent portfolio bets"
          style={{ contentVisibility: 'auto', containIntrinsicSize: '0 500px' }}
        >
          {isLoading ? (
            <FeedSkeleton />
          ) : visibleEvents.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* AC2: AnimatePresence for enter/exit animations */}
              <AnimatePresence initial={false} mode="popLayout">
                {visibleEvents.map((event) => (
                  <AnimatedBetFeedItem
                    key={`${event.betId}-${event.timestamp}`}
                    event={event}
                    isNew={newItemIds.has(event.betId)}
                    prefersReducedMotion={prefersReducedMotion}
                    isMobile={isMobile}
                  />
                ))}
              </AnimatePresence>

              {/* AC6: Infinite scroll sentinel */}
              {hasMore && (
                <div ref={sentinelRef} className="h-4">
                  {isLoadingMore && <LoadingSpinner />}
                </div>
              )}

              {/* End of data indicator */}
              {!hasMore && displayEvents.length > 0 && (
                <div className="py-3 text-center text-xs text-white/40 font-mono">
                  End of feed
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Wrapper component for homepage integration
 * Includes section spacing, responsive layout, and bot trading notice
 * AC5: Add explanatory UI about AI-powered trading
 */
export function RecentBetsFeedWrapper() {
  return (
    <section className="w-full space-y-4">
      {/* TODO: Bot trading notice - AI agents only (see architecture-change-asymmetric-odds.md) */}
      <BotTradingNotice dismissible />
      <RecentBetsFeed />
    </section>
  )
}
