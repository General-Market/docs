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
import { useVaultHistory } from '@/hooks/vaults/useVaultHistory'
import { useSSEVisionVaults } from '@/hooks/useSSE'
import { Sparkline } from '@/components/domain/home/Sparkline'

function safeBigInt(v: string | undefined): bigint {
  if (!v) return 0n
  try { return BigInt(v) } catch { return 0n }
}

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
  const interactive = Boolean(href)
  const inner = (
    <div
      className={`rail-card flex flex-col gap-2 p-5${interactive ? ' rail-card--link' : ''}`}
    >
      <span
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
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

      <style jsx>{`
        .rail-card {
          background: var(--apple-panel, #ffffff);
          border: 1px solid var(--apple-line, rgba(0, 0, 0, 0.08));
          border-radius: var(--apple-r-md, 12px);
          transition:
            transform 240ms cubic-bezier(0.4, 0, 0.6, 1),
            box-shadow 240ms cubic-bezier(0.4, 0, 0.6, 1),
            border-color 240ms cubic-bezier(0.4, 0, 0.6, 1);
        }
        .rail-card--link:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
          border-color: rgba(0, 0, 0, 0.16);
        }
      `}</style>
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

  // A betting round with no markets is just a clock — and the clock already
  // lives in the settlement strip and the featured-hero countdown. Skip until
  // the round actually has something to bet on.
  const bettingRound = useMemo(
    () => rounds?.find(r => r.status === 'betting' && r.marketCount > 0) ?? null,
    [rounds],
  )

  const remaining = useSecondsUntil(bettingRound?.bettingEnd ?? null)

  if (!bettingRound) return null

  const closed = remaining <= 0

  return (
    <RailCard label="Current round" href={`/source/${sourceId}`}>
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
        {closed ? 'Round closed' : `Closes in ${formatCountdown(remaining)}`}
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
  const sseVaults = useSSEVisionVaults()
  const sseByAddress = useMemo(() => {
    const map: Record<string, typeof sseVaults[number]> = {}
    for (const v of sseVaults) map[v.address.toLowerCase()] = v
    return map
  }, [sseVaults])

  // Walk the source's funds from newest to oldest; pick the most recent
  // entry whose contract has any state. Branded addresses without code (or
  // never deposited into) drop out — the rail is silent rather than fake.
  const fund = useMemo(() => {
    const all = (fundData as any).funds.filter((f: any) => f.source === sourceId && f.vault)
    for (let i = all.length - 1; i >= 0; i--) {
      const key = (all[i].vault as string).toLowerCase()
      const sse = sseByAddress[key]
      if (sse && (safeBigInt(sse.total_assets) > 0n || safeBigInt(sse.total_supply) > 0n)) {
        return all[i]
      }
    }
    return null
  }, [sourceId, sseByAddress])

  // Real NAV history. The card showed no chart for months — the comment in
  // this file admitted "performance data is a follow-up". Now it isn't.
  const vaultAddress = (fund?.vault as string | undefined) ?? ''
  const { snapshots } = useVaultHistory(vaultAddress)
  const navData = useMemo(() => snapshots.map(s => s.nav), [snapshots])
  const isPositive = navData.length < 2 ? true : navData[navData.length - 1] >= navData[0]
  const sparkColor = isPositive ? 'rgb(52,199,89)' : 'rgb(255,59,48)'

  if (!fund || !fund.vault) return null

  const href = `/source/${sourceId}/vault/${(fund.vault as string).toLowerCase()}`

  return (
    <RailCard label="Newest vault" href={href}>
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
      {navData.length >= 2 && (
        <div className="w-full" style={{ height: 24, marginTop: 4 }}>
          <Sparkline series={navData} width={240} height={24} stroke={sparkColor} />
        </div>
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
      <RailCard label="Top bot · 7d">
        <div className="skeleton h-6 w-32 rounded" aria-hidden="true" />
        <div className="skeleton h-4 w-full rounded" aria-hidden="true" />
      </RailCard>
    )
  }

  // No top bot? Render nothing. Empty placeholders are not company.
  if (!top) return null

  // sparkline7d is always null for now (performance data is a follow-up from Slice 4).
  return (
    <RailCard label="Top bot · 7d" href={top.htmlUrl} external>
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
        View on GitHub →
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
    <RailCard label="Your open round" href={`/source/${sourceId}`}>
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
