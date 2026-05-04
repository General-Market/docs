'use client'

// Activity tab — round history + recent bets.
// Round history: BatchVaultResults (already fetches its own data from /api/vision/batches/history).
// Recent bets: copied from SourceDashboard.RecentBets (do NOT edit SourceDashboard.tsx).
// Wiring pass will add SourceSidebarApple + SourceTabNav once Slice 1 ships.
//
// NOTE: This is a Client Component because the copied RecentBets block uses
// hooks (useRecentBets, useBetsSSE, useEffect) that require a client boundary.
// generateMetadata lives in a sibling layout or is handled by the parent page.
// The tab nav below is a plain anchor list — no router needed.

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BatchVaultResults } from '@/components/domain/vision/detail/BatchVaultResults'
import { useRecentBets } from '@/hooks/useRecentBets'
import { useBetsSSE } from '@/hooks/useBetsSSE'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

// TODO: import SourceSidebarApple from '@/components/domain/vision/detail/SourceSidebarApple'
// TODO: import SourceTabNav from '@/components/domain/vision/detail/SourceTabNav'

// ── Copied helpers from SourceDashboard (do not modify SourceDashboard.tsx) ──

function timeAgo(timestamp: string, nowMs: number): string {
  const t = new Date(timestamp).getTime()
  if (isNaN(t)) return '—'
  const diff = Math.max(0, Math.floor((nowMs - t) / 1000))
  if (diff < 5) return 'now'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}..${addr.slice(-4)}`
}

const CARD = 'border border-[var(--apple-border,rgba(0,0,0,0.08))] bg-[var(--surface,#fff)] p-5 rounded-[var(--apple-r-md,12px)]'
const HEADER = 'text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--apple-text-tertiary,#86868b)] mb-3'

function RecentBets() {
  const { events, isLoading, isError } = useRecentBets(20)
  useBetsSSE()
  const now = useNow(1000)

  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [events],
  )

  const seenKeysRef = useRef<Set<string> | null>(null)
  const newKeys = useMemo(() => {
    const keys = sorted.map(
      (e) => `${e.betId}-${e.eventType}-${e.walletAddress}-${e.timestamp}`,
    )
    if (seenKeysRef.current === null) {
      seenKeysRef.current = new Set(keys)
      return new Set<string>()
    }
    const fresh = new Set<string>()
    for (const k of keys) {
      if (!seenKeysRef.current.has(k)) {
        fresh.add(k)
        seenKeysRef.current.add(k)
      }
    }
    return fresh
  }, [sorted])

  const showEmpty = !isLoading && (isError || !sorted.length)

  return (
    <div className={CARD}>
      <h3 className={HEADER}>Recent Bets</h3>

      {isLoading && !sorted.length ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 bg-[var(--apple-divider,#e8e8ed)] animate-pulse rounded" />
          ))}
        </div>
      ) : showEmpty ? (
        <p className="py-4 text-[13px] text-[var(--apple-text-secondary,#6e6e73)]">No bets yet.</p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {sorted.map((event) => {
              const key = `${event.betId}-${event.eventType}-${event.walletAddress}-${event.timestamp}`
              const isNew = newKeys.has(key)
              return (
                <motion.div
                  key={key}
                  layout
                  initial={isNew ? { opacity: 0, y: -8 } : false}
                  animate={{
                    opacity: 1,
                    y: 0,
                    backgroundColor: isNew
                      ? ['rgba(34,197,94,0.18)', 'rgba(34,197,94,0)']
                      : 'rgba(34,197,94,0)',
                  }}
                  transition={{
                    duration: 0.3,
                    ease: 'easeOut',
                    backgroundColor: { duration: 1.2, ease: 'easeOut' },
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[12px] text-[var(--apple-text,#1d1d1f)]">
                      {truncAddr(event.walletAddress)}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase ${
                        event.eventType === 'won'
                          ? 'text-color-up'
                          : event.eventType === 'lost'
                            ? 'text-color-down'
                            : 'text-[var(--apple-text-tertiary,#86868b)]'
                      }`}
                    >
                      {event.eventType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[12px] font-bold text-[var(--apple-text,#1d1d1f)]">
                      ${parseFloat(event.amount).toFixed(2)}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--apple-text-tertiary,#86868b)] tabular-nums w-[28px] text-right">
                      {timeAgo(event.timestamp, now)}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface PageProps {
  params: { locale: string; sourceId: string }
}

export default function ActivityPage({ params }: PageProps) {
  const { sourceId } = params

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      <div className="flex-1 overflow-x-clip">
        {/* TODO: Replace with SourceSidebarApple + SourceTabNav shell once Slice 1 exists */}
        <div className="mx-auto max-w-[var(--apple-content-max,1680px)] px-5 lg:px-10">
          {/* Tab nav stub */}
          <nav
            aria-label="Source tabs"
            className="flex gap-6 pt-6 pb-0 border-b border-[var(--apple-divider,#e8e8ed)] mb-8"
            style={{ fontFamily: 'var(--apple-font-text,"SF Pro Text",Helvetica,Arial,sans-serif)', fontSize: 14 }}
          >
            {(['Overview', 'Vaults', 'Bots', 'Markets', 'Activity', 'Leaderboard'] as const).map((tab) => (
              <a
                key={tab}
                href={
                  tab === 'Overview'
                    ? `/source/${sourceId}`
                    : tab === 'Vaults'
                      ? `/source/${sourceId}/vaults`
                      : tab === 'Bots'
                        ? `/source/${sourceId}/bots`
                        : `/source/${sourceId}/${tab.toLowerCase()}`
                }
                aria-current={tab === 'Activity' ? 'page' : undefined}
                className={
                  tab === 'Activity'
                    ? 'pb-3 text-[var(--apple-text,#1d1d1f)] font-semibold border-b-[1.5px] border-[var(--apple-text,#1d1d1f)] -mb-px'
                    : 'pb-3 text-[var(--apple-text-secondary,#6e6e73)] hover:text-[var(--apple-text,#1d1d1f)] transition-colors'
                }
                style={{ letterSpacing: 'var(--apple-track-tight,-0.022em)' }}
              >
                {tab}
              </a>
            ))}
          </nav>

          {/* Page heading */}
          <div className="py-10 lg:py-12">
            <h1
              className="text-[var(--apple-text,#1d1d1f)] font-semibold"
              style={{
                fontFamily: 'var(--apple-font-display,"SF Pro Display",Helvetica,Arial,sans-serif)',
                fontSize: 'clamp(32px, 3.5vw, 40px)',
                letterSpacing: 'var(--apple-track-tighter,-0.016em)',
                lineHeight: 1.1,
              }}
            >
              Activity
            </h1>
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-16">
            {/* Round history */}
            <div className={CARD}>
              <h2 className={HEADER}>Round History</h2>
              <BatchVaultResults sourceId={sourceId} />
            </div>

            {/* Recent bets */}
            <RecentBets />
          </div>
        </div>
      </div>

      <Footer />
    </main>
  )
}
