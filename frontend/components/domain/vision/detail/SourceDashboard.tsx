'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from '@/i18n/routing'
import { useSharedCountdown } from '@/hooks/useSharedCountdown'
import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'
import { useRecentBets } from '@/hooks/useRecentBets'
import { useBetsSSE } from '@/hooks/useBetsSSE'
import type { RoundInfo } from '@/hooks/vision/useRounds'
import { BatchVaultResults } from './BatchVaultResults'

interface SourceDashboardProps {
  sourceId: string
  verifiedBatch: { id: number; playerCount: number; tvl: string; tickDuration?: number } | null
  bettingRound?: RoundInfo | null
  bettingEnd: string | null
  tickDuration: number
  settlingRound: { bettingEnd?: string | null; timeframeSecs?: number } | null
  rounds: RoundInfo[] | undefined
}

function formatPool(tvl: string): string {
  const raw = parseFloat(tvl)
  if (isNaN(raw) || raw === 0) return '$0'
  const num = raw / 1e18
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

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

/** Re-renders the calling component every `intervalMs` milliseconds. */
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

const HEADER = 'text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted mb-3'
const CARD = 'border border-border-light bg-[var(--surface)] p-5'
const VALUE = 'font-mono text-[14px] font-bold text-black'
const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted'
const CTA_BOX = 'mt-4 bg-terminal-dark rounded-none p-4'
const CTA_TEXT = 'text-[12px] text-white/60'
const CTA_LINK = 'text-[11px] font-bold text-white/90 hover:text-white'

function BotCta({ text }: { text: string }) {
  return (
    <div className={CTA_BOX}>
      <p className={CTA_TEXT}>
        {text}{' '}
        <Link href="/vision/create-strategy" className={CTA_LINK}>
          BUILD YOUR BOT &rarr;
        </Link>
      </p>
    </div>
  )
}

function CurrentRound({
  verifiedBatch,
  bettingRound,
  bettingEnd,
  tickDuration,
}: {
  verifiedBatch: SourceDashboardProps['verifiedBatch']
  bettingRound: RoundInfo | null
  bettingEnd: string | null
  tickDuration: number
}) {
  const secsLeft = useSharedCountdown(bettingEnd)

  // Pick the best display source for round metadata. The rounds API
  // (bettingRound) is authoritative for live state — it carries the real
  // playerCount/tvl/bettingEnd. verifiedBatch is the fallback.
  const roundId = bettingRound?.batchId ?? verifiedBatch?.id ?? null
  const playerCount =
    bettingRound?.playerCount ?? verifiedBatch?.playerCount ?? 0
  const tvl = bettingRound?.tvl ?? verifiedBatch?.tvl ?? '0'

  // The window is "open" only while the countdown to bettingEnd hasn't elapsed.
  // Without a bettingEnd we cannot prove the round is live — fall through to
  // the inter-round placeholder.
  const hasLiveBettingWindow = !!bettingEnd && secsLeft > 0
  const hasRound = roundId !== null && hasLiveBettingWindow

  const settleSecsLeft = useMemo(() => {
    if (!bettingEnd) return 0
    const settleMs = new Date(bettingEnd).getTime() + tickDuration * 1000 - Date.now()
    return Math.max(0, Math.floor(settleMs / 1000))
  }, [bettingEnd, tickDuration, secsLeft])

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className={CARD}>
      <h3 className={HEADER}>Current Round</h3>

      {hasRound ? (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className={VALUE}>#{roundId}</span>
            <span className={`${VALUE} tabular-nums`}>{formatTimer(secsLeft)}</span>
          </div>

          <div className="flex gap-6">
            <div>
              <p className={LABEL}>Players</p>
              <p className={VALUE}>{playerCount}</p>
            </div>
            <div>
              <p className={LABEL}>Pool</p>
              <p className={VALUE}>{formatPool(tvl)}</p>
            </div>
            <div>
              <p className={LABEL}>Settles in</p>
              <p className={VALUE}>{formatTimer(settleSecsLeft)}</p>
            </div>
          </div>

          <BotCta text="Not just betting — managing." />
        </div>
      ) : (
        <div className="flex items-center gap-2 py-4">
          <span className="h-2 w-2 rounded-full bg-text-muted animate-pulse" />
          <span className="text-[13px] text-text-muted">Between rounds</span>
        </div>
      )}
    </div>
  )
}

function RoundSpotlight({ sourceId }: { sourceId: string }) {
  return (
    <div>
      <BatchVaultResults sourceId={sourceId} />
    </div>
  )
}

function Leaderboard({ sourceId }: { sourceId: string }) {
  const { leaderboard } = useVisionLeaderboard(undefined, sourceId)
  const top5 = leaderboard.slice(0, 5)

  return (
    <div className={CARD}>
      <h3 className={HEADER}>Leaderboard</h3>

      {top5.length > 0 ? (
        <div className="space-y-2">
          {top5.map((entry, i) => (
            <div key={entry.walletAddress} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-text-muted w-4">{i + 1}</span>
                <span className="font-mono text-[13px] text-black">
                  {truncAddr(entry.walletAddress)}
                </span>
              </div>
              <span
                className={`font-mono text-[13px] font-bold ${
                  entry.roi >= 0 ? 'text-color-up' : 'text-color-down'
                }`}
              >
                {entry.roi >= 0 ? '+' : ''}
                {entry.roi.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-[13px] text-text-muted">No traders yet</p>
      )}

      <BotCta text="You're not on this list yet." />
    </div>
  )
}

function RecentBets() {
  const { events, isLoading, isError } = useRecentBets(20)
  // SSE for live updates — automatically pushes new events into the query cache
  useBetsSSE()
  const now = useNow(1000)

  // Sort newest-first so freshly-arrived bets land at the top of the list.
  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [events],
  )

  // Track which row keys we've already rendered so only genuinely new entries
  // animate in. The first batch after mount is treated as "already seen" so
  // the entire feed doesn't animate on initial load.
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
            <div key={i} className="h-5 bg-border-light animate-pulse" />
          ))}
        </div>
      ) : showEmpty ? (
        <p className="py-4 text-[13px] text-text-muted">No bets yet</p>
      ) : (
        <div className="space-y-2 [&>*:nth-child(n+6)]:hidden sm:[&>*:nth-child(n+6)]:flex">
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
                    <span className="font-mono text-[12px] text-black">
                      {truncAddr(event.walletAddress)}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase ${
                        event.eventType === 'won'
                          ? 'text-color-up'
                          : event.eventType === 'lost'
                            ? 'text-color-down'
                            : 'text-text-muted'
                      }`}
                    >
                      {event.eventType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[12px] font-bold text-black">
                      ${parseFloat(event.amount).toFixed(2)}
                    </span>
                    <span className="font-mono text-[10px] text-text-muted tabular-nums w-[28px] text-right">
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

export function SourceDashboard({
  sourceId,
  verifiedBatch,
  bettingRound,
  bettingEnd,
  tickDuration,
}: SourceDashboardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="flex flex-col gap-4">
        <CurrentRound
          verifiedBatch={verifiedBatch}
          bettingRound={bettingRound ?? null}
          bettingEnd={bettingEnd}
          tickDuration={tickDuration}
        />
        <RoundSpotlight sourceId={sourceId} />
      </div>

      <div className="flex flex-col gap-4">
        <Leaderboard sourceId={sourceId} />
        <RecentBets />
      </div>
    </div>
  )
}
