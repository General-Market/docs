'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { UpcomingSlot, MarketState } from '@/lib/markets/hooks'
import {
  windowLabel,
  compactAudience,
  audienceUnit,
  formatLabel,
  deriveYesPct,
  pctToDecimalOdd,
} from '@/lib/markets/hooks'
import { CountdownTimer, useNowSecs } from './CountdownTimer'
import { SourceIcon } from './SourceIcon'

// Card with two competitor rows. The pattern is what every betting
// market converges on: name, score, percent. We dress it in dark fabric
// and keep moving.

export type Side = 'yes' | 'no'

export interface MarketRowProps {
  slot: UpcomingSlot
  state: MarketState | null
  selected: boolean
  selectedSide: Side | null
  onSelectSide: (slot: UpcomingSlot, side: Side) => void
}

const USDC_DECIMALS = 6
const FLASH_MS = 700

// One gradient. Three border/shadow dressings. Selected, live-cam, default.
const CARD_GRADIENT = 'bg-[linear-gradient(180deg,rgb(24,24,27)_0%,rgb(20,20,23)_100%)]'
const CARD_GRADIENT_SELECTED = 'bg-[linear-gradient(180deg,rgb(28,28,32)_0%,rgb(20,20,23)_100%)]'
const CARD_SURFACE_SELECTED = `${CARD_GRADIENT_SELECTED} border-terminal-border-strong shadow-[0_0_0_1px_rgb(82_82_91/0.4),0_12px_28px_-12px_rgb(0_0_0/0.7)]`
const CARD_SURFACE_LIVECAM = `${CARD_GRADIENT} border-red-500/30 hover:border-red-500/50 hover:shadow-[0_8px_24px_-12px_rgb(244_63_94/0.4)]`
const CARD_SURFACE_DEFAULT = `${CARD_GRADIENT} border-terminal-border hover:border-terminal-border-strong hover:shadow-[0_8px_24px_-12px_rgb(0_0_0/0.7)]`

function poolUnitsToFloat(units: bigint): number {
  if (units === 0n) return 0
  // Float division — bigint integer division would truncate sub-dollar
  // amounts to 0 and the footer would falsely read "$0" while the bot
  // was actively betting in cents. 6-decimal USDC stays well within
  // f64's safe integer range.
  return Number(units) / 1e6
}

function formatPoolFloat(n: number): string {
  if (n <= 0) return '0'
  if (n < 1) return '<1'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return Math.round(n).toString()
}

function profileUrl(sourceId: number, slug: string): string {
  if (sourceId === 1) return `https://www.xvideos.com/pornstar-channels/${slug}`
  if (sourceId === 4) return `https://chaturbate.com/${slug}/`
  return '#'
}

// Slug to human label. Industry being what it is, the slugs read like
// internal codes — we surface a name a person can recognize.
function sourceLabel(sourceId: number, sourceName: string): string {
  if (sourceId === 1) return 'XVIDEOS'
  if (sourceId === 4) return 'CHATURBATE'
  return sourceName.replace(/^tubes_/, '').toUpperCase()
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '··'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

function Avatar({
  slug,
  name,
  side,
  dim,
  profileHref,
}: {
  slug: string
  name: string
  side: Side
  dim: boolean
  profileHref: string
}) {
  const yes = side === 'yes'
  const ringTone = yes ? 'ring-emerald-500/40' : 'ring-rose-500/40'
  return (
    <a
      href={profileHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={`Open ${name}'s profile in a new tab`}
      className={[
        'relative inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-md ring-2 transition-transform duration-200 hover:scale-[1.04]',
        ringTone,
        dim ? 'opacity-50' : '',
      ].join(' ')}
    >
      <img
        src={`/models/${slug}.jpg`}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={(e) => {
          // Local fallback chain. JPG → SVG (deterministic gradient
          // generated at build time, checked into /public/models) →
          // static initials tile. Nothing leaves the origin.
          const img = e.currentTarget
          if (!img.dataset.fallback) {
            img.dataset.fallback = 'svg'
            img.src = `/models/${slug}.svg`
            return
          }
          img.style.display = 'none'
          const fallback = img.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <span
        className="absolute inset-0 hidden items-center justify-center bg-terminal-surface-elevated text-body font-semibold tracking-tight text-terminal-fg-muted"
      >
        {initials(name)}
      </span>
    </a>
  )
}

interface CompetitorRowProps {
  side: Side
  name: string
  slug: string
  audience: bigint
  audienceLabel: string
  pct: number
  active: boolean
  inactive: boolean
  resolved: boolean
  isWinner: boolean
  isLoser: boolean
  refund: boolean
  oneSidedRefund: boolean
  profileHref: string
  showAvatar: boolean
  onClick: () => void
}

function CompetitorRow({
  side,
  name,
  slug,
  audience,
  audienceLabel,
  pct,
  active,
  inactive,
  resolved,
  isWinner,
  isLoser,
  refund,
  oneSidedRefund,
  profileHref,
  showAvatar,
  onClick,
}: CompetitorRowProps) {
  const yes = side === 'yes'
  // Side identity is carried by the line under the name. The pill wears
  // one color for both rows — Kalshi's pattern. Active fill takes the
  // side hue so a click still flashes a confirmation.
  const lineColor = yes ? 'bg-emerald-400' : 'bg-rose-400'
  const pillBase = 'border-emerald-400/60 text-emerald-300 group-hover:border-emerald-400'
  const pillActive = yes
    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100 shadow-[0_0_0_1px_rgb(16_185_129/0.6)]'
    : 'border-rose-400 bg-rose-500/20 text-rose-100 shadow-[0_0_0_1px_rgb(244_63_94/0.6)]'

  const rowSurface = active
    ? 'bg-terminal-surface/70'
    : inactive
      ? 'bg-transparent hover:bg-terminal-surface/50'
      : 'bg-transparent hover:bg-terminal-surface/50'

  const dim = resolved && isLoser

  // Audience text — one number, no units inside the box. Kalshi shows
  // just the score; units belong elsewhere.
  void audienceLabel

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={resolved}
      className={[
        'group flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-left transition-colors duration-150',
        rowSurface,
        dim ? 'opacity-60' : '',
      ].join(' ')}
    >
      {showAvatar ? (
        <Avatar slug={slug} name={name} side={side} dim={dim} profileHref={profileHref} />
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-body font-semibold leading-tight tracking-tight text-terminal-fg">
            {name}
          </span>
          {resolved && isWinner ? (
            <span className="inline-flex shrink-0 items-center rounded bg-emerald-500/20 px-1.5 py-0.5 text-label font-medium uppercase tracking-[0.1em] text-emerald-300">
              won
            </span>
          ) : null}
        </span>
        <span aria-hidden className="relative block h-[2px] w-full overflow-hidden rounded-full bg-terminal-border/70">
          <span
            className={[
              'absolute left-0 top-0 h-full w-full origin-left rounded-full transition-transform duration-500 ease-out',
              lineColor,
              dim ? 'opacity-30' : '',
            ].join(' ')}
            style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, pct / 100))})` }}
          />
        </span>
        <span className="text-caption text-terminal-fg-muted sm:hidden">
          {compactAudience(audience)}
        </span>
      </span>

      <span className="hidden shrink-0 sm:inline-flex h-8 min-w-[40px] items-center justify-center rounded-md border border-terminal-border-strong bg-transparent px-2 text-caption font-medium tabular-nums text-terminal-fg">
        {compactAudience(audience)}
      </span>

      {refund ? (
        // Only show the refund pill when the market has actually resolved
        // as a refund (tied / both flat / one-sided post-close). The
        // pre-resolution "this side currently has zero stake" case is
        // not a verdict — the empty side's multiplier shows the
        // audience-prior odds, and the user gets to decide whether to
        // fill it. `oneSidedRefund` is no longer surfaced here; we
        // keep the prop for now to avoid a noisy refactor in the
        // parent, but it stops driving the visual.
        <span className="ml-auto inline-flex h-8 min-w-[60px] items-center justify-center rounded-full border-2 border-terminal-border-strong px-3 text-label italic text-terminal-fg-faint">
          refund
        </span>
      ) : (
        <span className="ml-auto flex shrink-0 items-center">
          <span
            className={[
              'inline-flex h-8 min-w-[64px] items-center justify-center rounded-full border-2 px-3 text-body font-semibold tabular-nums tracking-tight transition-colors duration-150',
              active ? pillActive : pillBase,
            ].join(' ')}
          >
            {(() => {
              const m = pctToDecimalOdd(pct)
              return m === null ? '—' : `${m.toFixed(2)}×`
            })()}
          </span>
        </span>
      )}
    </button>
  )
}

function MarketRowImpl({ slot, state, selected, selectedSide, onSelectSide }: MarketRowProps) {
  const yesPct = useMemo(
    () => deriveYesPct(state, slot.audienceA, slot.audienceB),
    [state, slot.audienceA, slot.audienceB],
  )
  const noPct = 100 - yesPct

  const oneSided = !!state && (
    (state.totalYes === 0n && state.totalNo > 0n) ||
    (state.totalNo === 0n && state.totalYes > 0n)
  )

  const totalPoolFloat = useMemo(
    () => state ? poolUnitsToFloat(state.totalYes + state.totalNo) : 0,
    [state],
  )

  const [poolFlash, setPoolFlash] = useState<'up' | 'down' | null>(null)
  const prevPoolRef = useRef<bigint | null>(null)
  useEffect(() => {
    const cur = state ? state.totalYes + state.totalNo : null
    const prev = prevPoolRef.current
    prevPoolRef.current = cur
    if (cur === null || prev === null || cur === prev) return
    setPoolFlash(cur > prev ? 'up' : 'down')
    const id = window.setTimeout(() => setPoolFlash(null), FLASH_MS)
    return () => window.clearTimeout(id)
  }, [state])

  const now = useNowSecs()
  const closed = now > 0 && slot.closeTime <= now
  const resolved = !!state?.resolved
  const refund = resolved && state?.outcomeYes === null
  const winnerYes = resolved && state?.outcomeYes === true
  const winnerNo = resolved && state?.outcomeYes === false

  const audienceLbl = audienceUnit(slot.board)
  const isLiveCam = slot.board === 'cams' && !resolved && !closed
  const isLive = !resolved && !closed && state && state.totalYes + state.totalNo > 0n

  // Cams (live cams) wear a red side rail. Stars get amber. Resolved fades.
  const accentRail = resolved
    ? 'before:bg-terminal-border-strong'
    : isLiveCam
      ? 'before:bg-red-500'
      : slot.board === 'stars'
        ? 'before:bg-amber-400/80'
        : 'before:bg-terminal-border-strong'

  const cardSurface = selected
    ? CARD_SURFACE_SELECTED
    : isLiveCam
      ? CARD_SURFACE_LIVECAM
      : CARD_SURFACE_DEFAULT

  const cardFlash =
    poolFlash === 'up' ? 'after:bg-emerald-500/10'
    : poolFlash === 'down' ? 'after:bg-rose-500/10'
    : 'after:bg-transparent'

  const sourceIconId = (slot.sourceId === 1 || slot.sourceId === 4
    ? (slot.sourceId as 1 | 4)
    : null)
  const sourceLbl = sourceLabel(slot.sourceId, slot.sourceName)

  // Live means a market accepting money. Cams are theatrically live. The
  // rest are merely open. The distinction is small but worth a different word.
  const showLive = !resolved && !closed && (isLive || isLiveCam)

  return (
    <article
      className={[
        'relative overflow-hidden rounded-xl border p-3 pl-4 sm:p-4 sm:pl-5',
        'transition-[border-color,transform] duration-300 ease-out',
        'before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:rounded-r-full before:opacity-90',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:transition-[background] after:duration-700 after:ease-out',
        accentRail,
        cardSurface,
        cardFlash,
      ].join(' ')}
      aria-label={slot.label}
    >
      <header className="relative flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          {sourceIconId ? (
            <SourceIcon sourceId={sourceIconId} className="h-6 w-6 rounded-md" />
          ) : null}
          <span className="truncate text-label font-semibold uppercase tracking-[0.12em] text-terminal-fg">
            {sourceLbl}
          </span>
        </span>

        <span className="shrink-0 text-caption text-terminal-fg-faint">
          {windowLabel(slot.windowSecs)} {formatLabel(slot.format)}
        </span>
      </header>

      <h3 className="relative mt-2 text-base font-semibold leading-snug tracking-tight text-terminal-fg">
        {slot.label}
      </h3>

      {slot.hook ? (
        <p className="relative mt-1 text-caption leading-snug text-terminal-fg-faint">
          {slot.hook}
        </p>
      ) : null}

      <div className="relative mt-1.5 flex items-center gap-2">
        {showLive ? (
          <>
            <span className="relative inline-flex h-[7px] w-[7px] shrink-0" aria-hidden>
              <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-red-500" />
            </span>
            <span className="text-label font-bold uppercase tracking-[0.1em] text-red-400">
              live
            </span>
            <span className="text-caption tabular-nums text-terminal-fg-faint">
              · Closes in <CountdownTimer target={slot.closeTime} closedLabel="0:00" />
            </span>
          </>
        ) : resolved ? (
          <span className="text-caption text-terminal-fg-faint">Resolved</span>
        ) : closed ? (
          <span className="text-caption text-terminal-fg-faint">Settling</span>
        ) : (
          <span className="text-caption tabular-nums text-terminal-fg-faint">
            Closes in <CountdownTimer target={slot.closeTime} closedLabel="0:00" />
          </span>
        )}
      </div>

      <div className="relative mt-1.5 flex flex-col">
        <CompetitorRow
          side="yes"
          name={slot.displayA}
          slug={slot.slugA}
          audience={slot.audienceA}
          audienceLabel={audienceLbl}
          pct={yesPct}
          active={selected && selectedSide === 'yes'}
          inactive={selected && selectedSide !== 'yes'}
          resolved={resolved}
          isWinner={winnerYes}
          isLoser={winnerNo}
          refund={refund}
          oneSidedRefund={oneSided && state?.totalYes === 0n}
          profileHref={profileUrl(slot.sourceId, slot.slugA)}
          showAvatar={slot.sourceId !== 4}
          onClick={() => onSelectSide(slot, 'yes')}
        />
        <CompetitorRow
          side="no"
          name={slot.displayB}
          slug={slot.slugB}
          audience={slot.audienceB}
          audienceLabel={audienceLbl}
          pct={noPct}
          active={selected && selectedSide === 'no'}
          inactive={selected && selectedSide !== 'no'}
          resolved={resolved}
          isWinner={winnerNo}
          isLoser={winnerYes}
          refund={refund}
          oneSidedRefund={oneSided && state?.totalNo === 0n}
          profileHref={profileUrl(slot.sourceId, slot.slugB)}
          showAvatar={slot.sourceId !== 4}
          onClick={() => onSelectSide(slot, 'no')}
        />
      </div>

      <footer className="relative mt-2 flex items-center justify-between gap-3 pt-2 text-label text-terminal-fg-faint">
        <span>
          <span className="tabular-nums text-terminal-fg-muted">${formatPoolFloat(totalPoolFloat)}</span> pool
        </span>
        {!resolved && !closed ? (
          <span className="text-terminal-fg-faint">{windowLabel(slot.windowSecs)} window</span>
        ) : null}
      </footer>
    </article>
  )
}

// Memoised. Props are primitives, refs, or stable references handed
// down by MarketList — the parent already pins onSelectSide upstream.
export const MarketRow = memo(MarketRowImpl)
