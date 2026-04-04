'use client'

import { useMemo } from 'react'
import { Link } from '@/i18n/routing'
import { useSharedCountdown } from '@/hooks/useSharedCountdown'
import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'
import { useRecentBets } from '@/hooks/useRecentBets'
import { useBetsSSE } from '@/hooks/useBetsSSE'
import { BatchVaultResults } from './BatchVaultResults'

interface SourceDashboardProps {
  sourceId: string
  verifiedBatch: { id: number; playerCount: number; tvl: string; tickDuration?: number } | null
  bettingEnd: string | null
  tickDuration: number
  settlingRound: { bettingEnd?: string | null; timeframeSecs?: number } | null
  rounds: any[] | undefined
}

function formatPool(tvl: string): string {
  const raw = parseFloat(tvl)
  if (isNaN(raw) || raw === 0) return '$0'
  const num = raw / 1e18
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

function timeAgo(timestamp: string): string {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
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
  bettingEnd,
  tickDuration,
}: {
  verifiedBatch: SourceDashboardProps['verifiedBatch']
  bettingEnd: string | null
  tickDuration: number
}) {
  const secsLeft = useSharedCountdown(bettingEnd)

  const settleSecsLeft = useMemo(() => {
    if (!bettingEnd) return 0
    const settleMs = new Date(bettingEnd).getTime() + tickDuration * 1000 - Date.now()
    return Math.max(0, Math.floor(settleMs / 1000))
  }, [bettingEnd, tickDuration])

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className={CARD}>
      <h3 className={HEADER}>Current Round</h3>

      {verifiedBatch ? (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className={VALUE}>#{verifiedBatch.id}</span>
            <span className={`${VALUE} tabular-nums`}>{formatTimer(secsLeft)}</span>
          </div>

          <div className="flex gap-6">
            <div>
              <p className={LABEL}>Players</p>
              <p className={VALUE}>{verifiedBatch.playerCount}</p>
            </div>
            <div>
              <p className={LABEL}>Pool</p>
              <p className={VALUE}>{formatPool(verifiedBatch.tvl)}</p>
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

  const showEmpty = !isLoading && (isError || !events.length)

  return (
    <div className={CARD}>
      <h3 className={HEADER}>Recent Bets</h3>

      {isLoading && !events.length ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 bg-border-light animate-pulse" />
          ))}
        </div>
      ) : showEmpty ? (
        <p className="py-4 text-[13px] text-text-muted">No bets yet</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.betId} className="flex items-center justify-between">
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
                <span className="text-[10px] text-text-muted">{timeAgo(event.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SourceDashboard({
  sourceId,
  verifiedBatch,
  bettingEnd,
  tickDuration,
  rounds,
}: SourceDashboardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="flex flex-col gap-4">
        <CurrentRound
          verifiedBatch={verifiedBatch}
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
