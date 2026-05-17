'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useTranslations } from 'next-intl'
import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'
import { fmtPnl, fmtRoi, fmtVolume, fmtRounds, truncAddr, rankMedal } from '@/lib/leaderboard/format'
import type { VisionLeaderboardEntry, Tone } from '@/lib/leaderboard/types'

export type LeaderboardVariant = 'full' | 'compact'

/**
 * Default volume floor for the full variant. Anything below is treated as
 * noise (lucky-streak micro-traders) and hidden until the user opts in.
 * Compact variants never filter — they show what the parent asked for.
 */
const DEFAULT_MIN_VOLUME = 100

interface Props {
  variant?: LeaderboardVariant
  sourceId?: string
  /** Highlight this wallet's row (defaults to connected wallet). Pass null to disable. */
  highlightAddress?: string | null
  /** Initial visible row count. Defaults: full=50, compact=5. */
  initialPageSize?: number
  /** Step for "Show more" in full variant. Defaults to initialPageSize. Compact ignores it. */
  pageSize?: number
  /** Bottom "View all" link for compact variant. */
  viewAllHref?: string
  /** Override empty state. */
  emptyTitle?: string
  emptySubtitle?: string
  /** Scope chip ("Filtered: {label}"). Only used in full variant. */
  scopeLabel?: string
  /** Href used by the chip's X to clear the filter. */
  scopeClearHref?: string
}

const TONE_TEXT: Record<Tone, string> = {
  pos: 'text-color-up',
  neg: 'text-color-down',
  neutral: 'text-text-muted',
}

export function Leaderboard({
  variant = 'full',
  sourceId,
  highlightAddress,
  initialPageSize,
  pageSize,
  viewAllHref,
  emptyTitle,
  emptySubtitle,
  scopeLabel,
  scopeClearHref,
}: Props) {
  const t = useTranslations('vision')
  const { address } = useAccount()
  const { leaderboard, isLoading, isError, refetch } = useVisionLeaderboard(undefined, sourceId)
  const router = useRouter()

  const defaultInitial = variant === 'compact' ? 5 : 50
  const step = pageSize ?? initialPageSize ?? defaultInitial
  const [visible, setVisible] = useState(initialPageSize ?? defaultInitial)
  const [showNoise, setShowNoise] = useState(false)

  const highlight = useMemo(() => {
    const target = highlightAddress === undefined ? address : highlightAddress
    return target ? target.toLowerCase() : null
  }, [address, highlightAddress])

  // Full variant filters noise traders by default. Connected wallet survives
  // the filter so a user never disappears from their own board.
  const filtered = useMemo(() => {
    if (variant !== 'full' || showNoise) return leaderboard
    return leaderboard.filter(p =>
      p.totalVolume >= DEFAULT_MIN_VOLUME
      || (highlight !== null && p.walletAddress.toLowerCase() === highlight)
    )
  }, [variant, showNoise, leaderboard, highlight])

  const hiddenCount = leaderboard.length - filtered.length
  const rows = filtered.slice(0, visible)
  const hasMore = variant === 'full' && visible < filtered.length

  return (
    <section
      className="bg-card border border-border-light overflow-hidden"
      style={{ borderRadius: variant === 'full' ? 12 : 6 }}
    >
      {scopeLabel && variant === 'full' && (
        <ScopeChip label={scopeLabel} clearHref={scopeClearHref} />
      )}

      <Header variant={variant} />

      {isLoading && <SkeletonRows variant={variant} count={Math.min(initialPageSize ?? defaultInitial, 8)} />}

      {!isLoading && isError && (
        <EmptyState
          title={t('vision_leaderboard.failed_to_load')}
          subtitle="The board is unreachable. Try again in a moment."
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-[12px] font-semibold text-color-info hover:underline"
            >
              Retry
            </button>
          }
        />
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState
          title={emptyTitle ?? (sourceId
            ? 'No traders here yet.'
            : t('common_labels.no_players_yet'))}
          subtitle={emptySubtitle ?? (sourceId
            ? 'The first settled round on this source writes the ledger.'
            : 'The first round writes the ledger.')}
        />
      )}

      {!isLoading && !isError && rows.map((p, i) => (
        <LeaderboardRow
          key={p.walletAddress || i}
          entry={p}
          variant={variant}
          isLast={i === rows.length - 1}
          highlighted={highlight !== null && p.walletAddress.toLowerCase() === highlight}
          onSelect={() => router.push(`/profile/${p.walletAddress}`)}
        />
      ))}

      {variant === 'full' && hiddenCount > 0 && !hasMore && !isLoading && (
        <button
          type="button"
          onClick={() => setShowNoise(s => !s)}
          className="w-full px-5 py-3 text-[12px] text-text-muted hover:text-text-primary bg-muted border-t border-border-light transition-colors"
        >
          {showNoise
            ? `Hide low-volume traders (under $${DEFAULT_MIN_VOLUME})`
            : `Show ${hiddenCount} hidden trader${hiddenCount === 1 ? '' : 's'} under $${DEFAULT_MIN_VOLUME} volume`}
        </button>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisible(v => v + step)}
          className="w-full px-5 py-3 text-[13px] font-semibold text-color-info bg-muted border-t border-border-light hover:bg-surface transition-colors"
        >
          Show {Math.min(step, filtered.length - visible)} more
        </button>
      )}

      {!hasMore && viewAllHref && variant === 'compact' && rows.length > 0 && (
        <Link
          href={viewAllHref}
          className="block w-full px-5 py-3 text-center text-[12px] font-semibold text-text-secondary border-t border-border-light hover:text-text-primary transition-colors"
        >
          View full leaderboard →
        </Link>
      )}
    </section>
  )
}

// ── Subcomponents ─────────────────────────────────────────

function Header({ variant }: { variant: LeaderboardVariant }) {
  const t = useTranslations('vision')
  const cols = variant === 'full' ? FULL_COLS : COMPACT_COLS
  return (
    <>
      <div
        role="row"
        className="hidden sm:grid items-center px-5 py-3 bg-muted border-b border-border-light"
        style={{ gridTemplateColumns: cols, gap: 16 }}
      >
        <span className={HEADER_CELL}>{t('vision_leaderboard.rank')}</span>
        <span className={HEADER_CELL}>{t('vision_leaderboard.player')}</span>
        <span className={`${HEADER_CELL} text-right`}>{t('vision_leaderboard.rounds')}</span>
        <span className={`${HEADER_CELL} text-right`}>{t('vision_leaderboard.volume')}</span>
        {variant === 'full' && (
          <span className={`${HEADER_CELL} text-right`}>{t('vision_leaderboard.win_pct')}</span>
        )}
        <span className={`${HEADER_CELL} text-right`}>{t('vision_leaderboard.roi')}</span>
        <span className={`${HEADER_CELL} text-right`}>{t('vision_leaderboard.pnl')}</span>
      </div>
      <div
        role="row"
        className="grid sm:hidden items-center px-4 py-2.5 bg-muted border-b border-border-light"
        style={{ gridTemplateColumns: MOBILE_COLS, gap: 8 }}
      >
        <span className={HEADER_CELL}>#</span>
        <span className={HEADER_CELL}>{t('vision_leaderboard.player')}</span>
        <span className={`${HEADER_CELL} text-right`}>{t('vision_leaderboard.roi')}</span>
        <span className={`${HEADER_CELL} text-right`}>{t('vision_leaderboard.pnl')}</span>
      </div>
    </>
  )
}

function LeaderboardRow({
  entry, variant, isLast, highlighted, onSelect,
}: {
  entry: VisionLeaderboardEntry
  variant: LeaderboardVariant
  isLast: boolean
  highlighted: boolean
  onSelect: () => void
}) {
  const pnl = fmtPnl(entry.pnl)
  const roi = fmtRoi(entry.roi)
  const medal = rankMedal(entry.rank)
  const cols = variant === 'full' ? FULL_COLS : COMPACT_COLS
  const rowHeight = variant === 'full' ? 56 : 44

  const baseRow = [
    'w-full text-left block transition-colors cursor-pointer',
    !isLast && 'border-b border-border-light',
    highlighted ? 'bg-brand-light hover:bg-brand-light/80' : 'hover:bg-surface',
  ].filter(Boolean).join(' ')

  return (
    <button type="button" onClick={onSelect} className={baseRow}>
      {/* Desktop */}
      <div
        role="row"
        className="hidden sm:grid items-center px-5"
        style={{ gridTemplateColumns: cols, gap: 16, height: rowHeight }}
      >
        <span className="text-[13px] font-mono tabular-nums font-semibold text-text-secondary">
          {medal ?? entry.rank}
        </span>
        <span className="font-mono text-[13px] text-text-primary truncate flex items-center gap-2">
          {truncAddr(entry.walletAddress)}
          {highlighted && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">You</span>
          )}
        </span>
        <span className="text-[13px] font-mono tabular-nums text-right text-text-secondary">
          {fmtRounds(entry.roundsPlayed)}
        </span>
        <span className="text-[13px] font-mono tabular-nums text-right text-text-secondary">
          {fmtVolume(entry.totalVolume)}
        </span>
        {variant === 'full' && (
          <span className="text-[13px] font-mono tabular-nums text-right text-text-secondary">
            {entry.winRate > 0 ? `${entry.winRate.toFixed(0)}%` : '—'}
          </span>
        )}
        <span className={`text-[13px] font-mono tabular-nums text-right font-semibold ${TONE_TEXT[roi.tone]}`}>
          {roi.text}
        </span>
        <span className={`text-[14px] font-mono tabular-nums text-right font-bold ${TONE_TEXT[pnl.tone]}`}>
          {pnl.text}
        </span>
      </div>

      {/* Mobile */}
      <div
        className="grid sm:hidden items-center px-4"
        style={{ gridTemplateColumns: MOBILE_COLS, gap: 8, height: 52 }}
      >
        <span className="text-[12px] font-mono tabular-nums font-semibold text-text-secondary">
          {medal ?? entry.rank}
        </span>
        <span className="font-mono text-[12px] text-text-primary truncate flex items-center gap-1.5">
          {truncAddr(entry.walletAddress)}
          {highlighted && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-brand">You</span>
          )}
        </span>
        <span className={`text-[12px] font-mono tabular-nums text-right font-semibold ${TONE_TEXT[roi.tone]}`}>
          {roi.text}
        </span>
        <span className={`text-[13px] font-mono tabular-nums text-right font-bold ${TONE_TEXT[pnl.tone]}`}>
          {pnl.text}
        </span>
      </div>
    </button>
  )
}

function ScopeChip({ label, clearHref }: { label: string; clearHref?: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-2.5 bg-surface border-b border-border-light text-[12px]">
      <span className="text-text-muted uppercase tracking-wider text-[10px] font-semibold">
        Filtered
      </span>
      <span className="font-semibold text-text-primary">{label}</span>
      {clearHref && (
        <Link
          href={clearHref}
          aria-label="Clear filter"
          className="ml-auto text-text-muted hover:text-text-primary transition-colors"
        >
          View all →
        </Link>
      )}
    </div>
  )
}

function SkeletonRows({ variant, count }: { variant: LeaderboardVariant; count: number }) {
  const cols = variant === 'full' ? FULL_COLS : COMPACT_COLS
  const rowHeight = variant === 'full' ? 56 : 44
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-b border-border-light" aria-hidden="true">
          <div
            className="hidden sm:grid items-center px-5"
            style={{ gridTemplateColumns: cols, gap: 16, height: rowHeight }}
          >
            <span className="skeleton h-[12px] w-4 rounded" />
            <span className="skeleton h-[12px] w-32 rounded" />
            <span className="skeleton h-[12px] w-8 rounded ml-auto" />
            <span className="skeleton h-[12px] w-14 rounded ml-auto" />
            {variant === 'full' && <span className="skeleton h-[12px] w-10 rounded ml-auto" />}
            <span className="skeleton h-[12px] w-12 rounded ml-auto" />
            <span className="skeleton h-[12px] w-16 rounded ml-auto" />
          </div>
          <div
            className="grid sm:hidden items-center px-4"
            style={{ gridTemplateColumns: MOBILE_COLS, gap: 8, height: 52 }}
          >
            <span className="skeleton h-[12px] w-3 rounded" />
            <span className="skeleton h-[12px] w-24 rounded" />
            <span className="skeleton h-[12px] w-10 rounded ml-auto" />
            <span className="skeleton h-[12px] w-14 rounded ml-auto" />
          </div>
        </div>
      ))}
    </>
  )
}

function EmptyState({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="px-5 py-16 text-center">
      <p className="text-[14px] font-semibold text-text-primary">{title}</p>
      {subtitle && <p className="mt-1 text-[13px] text-text-muted">{subtitle}</p>}
      {action}
    </div>
  )
}

// ── Layout constants ─────────────────────────────────────

const HEADER_CELL =
  'font-text text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted'

// full: rank, player, rounds, volume, win%, roi, pnl
const FULL_COLS = '40px minmax(0,1fr) 80px 90px 70px 90px 110px'
// compact: rank, player, rounds, volume, roi, pnl
const COMPACT_COLS = '36px minmax(0,1fr) 60px 80px 80px 100px'
const MOBILE_COLS = '28px minmax(0,1fr) auto auto'
