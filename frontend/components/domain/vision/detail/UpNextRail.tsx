'use client'

/**
 * UpNextRail — four stacked cards, 1/3-width column on lg+.
 *
 * Card 1: round closes in Xm — countdown from useRounds (betting status).
 * Card 2: newest vault — most recently deployed vault for this source.
 *         "Most recently deployed" is approximated as the last entry in
 *         fund-branding.json for this source; no deployment timestamp is
 *         exposed by data-node yet. Replace the sort key when it lands.
 * Card 3: top bot 7d — reads useTrendingBots(sourceId) from Slice 4.
 *         sparkline7d is always null for now (performance data is a follow-up).
 * Card 4: your open round — only visible when the wallet holds a position
 *         in the current betting round for this source.
 */

import { useMemo, useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import fundData from '@/data/fund-branding.json'
import { useRounds } from '@/hooks/vision/useRounds'
import { usePlayerPosition } from '@/hooks/vision/usePlayerPosition'
import { useBatches } from '@/hooks/vision/useBatches'
import { useTrendingBots } from '@/hooks/vision/useTrendingBots'

/* ─── helpers ─────────────────────────────────────────────────── */

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'now'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

function useSecondsUntil(isoString: string | null): number {
  const [remaining, setRemaining] = useState(() => {
    if (!isoString) return 0
    return Math.max(0, (new Date(isoString).getTime() - Date.now()) / 1000)
  })

  useEffect(() => {
    if (!isoString) return
    const tick = () => {
      setRemaining(Math.max(0, (new Date(isoString).getTime() - Date.now()) / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isoString])

  return remaining
}

/* ─── shared card shell ─────────────────────────────────────────── */

function RailCard({
  label,
  children,
  href,
  external,
}: {
  label: string
  children: React.ReactNode
  href?: string
  external?: boolean
}) {
  const inner = (
    <div
      className="apple-card flex flex-col gap-2 p-4"
      style={{ background: 'var(--apple-panel)' }}
    >
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-12)',
          letterSpacing: 'var(--apple-track-loose)',
          color: 'var(--apple-text-tertiary)',
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  )

  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        {inner}
      </a>
    )
  }

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none' }}>
        {inner}
      </Link>
    )
  }

  return inner
}

/* ─── card: round closes in ──────────────────────────────────────── */

function RoundClosesCard({ sourceId }: { sourceId: string }) {
  const { data: rounds } = useRounds(sourceId)

  const bettingRound = useMemo(
    () => rounds?.find(r => r.status === 'betting') ?? null,
    [rounds],
  )

  const remaining = useSecondsUntil(bettingRound?.bettingEnd ?? null)

  if (!bettingRound) return null

  const closed = remaining <= 0

  return (
    <RailCard label="current round" href={`/source/${sourceId}`}>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-21)',
          letterSpacing: 'var(--apple-track-tight)',
          lineHeight: 1.1904,
          fontWeight: 600,
          color: closed ? 'var(--apple-text-secondary)' : 'var(--apple-text)',
        }}
      >
        {closed ? 'round closed' : `closes in ${formatCountdown(remaining)}`}
      </span>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-14)',
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text-secondary)',
        }}
      >
        {bettingRound.marketCount} market{bettingRound.marketCount !== 1 ? 's' : ''} ·{' '}
        {bettingRound.playerCount} player{bettingRound.playerCount !== 1 ? 's' : ''}
      </span>
    </RailCard>
  )
}

/* ─── card: newest vault ─────────────────────────────────────────── */

function NewestVaultCard({ sourceId }: { sourceId: string }) {
  const fund = useMemo(() => {
    const all = (fundData as any).funds.filter((f: any) => f.source === sourceId && f.vault)
    return all.length > 0 ? all[all.length - 1] : null
  }, [sourceId])

  if (!fund) return null

  const href = `/source/${sourceId}/vault/${(fund.vault as string).toLowerCase()}`

  return (
    <RailCard label="newest vault" href={href}>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-21)',
          letterSpacing: 'var(--apple-track-tight)',
          lineHeight: 1.1904,
          fontWeight: 600,
          color: 'var(--apple-text)',
        }}
      >
        {fund.name}
      </span>
      {fund.tagline && (
        <span
          className="line-clamp-2"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-14)',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text-secondary)',
            lineHeight: 1.2857,
          }}
        >
          {fund.tagline}
        </span>
      )}
    </RailCard>
  )
}

/* ─── card: top bot 7d ───────────────────────────────────────────── */

function TopBotCard({ sourceId }: { sourceId: string }) {
  const { bots, isLoading } = useTrendingBots(sourceId)
  const top = bots[0] ?? null

  if (isLoading) {
    return (
      <RailCard label="top bot 7d">
        <div className="skeleton h-6 w-32 rounded" aria-hidden="true" />
        <div className="skeleton h-4 w-full rounded" aria-hidden="true" />
      </RailCard>
    )
  }

  if (!top) {
    return (
      <RailCard
        label="top bot 7d"
        href={`https://github.com/General-Market/vision-bot-examples`}
        external
      >
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-17)',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text-secondary)',
          }}
        >
          no bots yet
        </span>
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-14)',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-accent)',
          }}
        >
          view on GitHub →
        </span>
      </RailCard>
    )
  }

  // sparkline7d is always null for now (performance data is a follow-up from Slice 4).
  return (
    <RailCard label="top bot 7d" href={top.htmlUrl} external>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-21)',
          letterSpacing: 'var(--apple-track-tight)',
          lineHeight: 1.1904,
          fontWeight: 600,
          color: 'var(--apple-text)',
        }}
      >
        {top.name}
      </span>
      {top.description && (
        <span
          className="line-clamp-2"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-14)',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text-secondary)',
            lineHeight: 1.2857,
          }}
        >
          {top.description}
        </span>
      )}
      {top.lastCommitAt && (
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-12)',
            letterSpacing: 'var(--apple-track-loose)',
            color: 'var(--apple-text-tertiary)',
          }}
        >
          {formatLastEdited(top.lastCommitAt)}
        </span>
      )}
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-14)',
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-accent)',
        }}
      >
        view on GitHub →
      </span>
    </RailCard>
  )
}

function formatLastEdited(isoString: string): string {
  const then = new Date(isoString).getTime()
  const diffMs = Date.now() - then
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays === 0) return 'last edited today'
  if (diffDays === 1) return 'last edited yesterday'
  if (diffDays < 30) return `last edited ${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  return `last edited ${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`
}

/* ─── card: your open round ──────────────────────────────────────── */

function YourRoundCard({ sourceId }: { sourceId: string }) {
  const { data: batches } = useBatches()

  const activeBatch = useMemo(
    () => batches?.find(b => b.sourceId === sourceId && !b.paused) ?? null,
    [batches, sourceId],
  )

  const { isJoined, position } = usePlayerPosition(activeBatch?.id)

  if (!isJoined || !position) return null

  const deposited = Number(position.totalDeposited) / 1e18
  const depositedStr =
    deposited >= 1000
      ? `$${(deposited / 1000).toFixed(1)}K`
      : `$${deposited.toFixed(2)}`

  return (
    <RailCard label="your open round" href={`/source/${sourceId}`}>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-21)',
          letterSpacing: 'var(--apple-track-tight)',
          lineHeight: 1.1904,
          fontWeight: 600,
          color: 'var(--apple-text)',
        }}
      >
        {depositedStr} deployed
      </span>
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-14)',
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text-secondary)',
        }}
      >
        round #{activeBatch?.id} · view positions →
      </span>
    </RailCard>
  )
}

/* ─── orchestrator ───────────────────────────────────────────────── */

interface UpNextRailProps {
  sourceId: string
}

export function UpNextRail({ sourceId }: UpNextRailProps) {
  return (
    <div className="flex flex-col gap-3">
      <RoundClosesCard sourceId={sourceId} />
      <NewestVaultCard sourceId={sourceId} />
      <TopBotCard sourceId={sourceId} />
      <YourRoundCard sourceId={sourceId} />
    </div>
  )
}
