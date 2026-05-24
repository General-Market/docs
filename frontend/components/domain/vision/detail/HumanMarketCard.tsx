'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { getAssetMeta } from '@/lib/vision/asset-images'
import { toInternalId } from '@/lib/vision/source-ids'
import type { SnapshotPrice } from '@/hooks/vision/useMarketSnapshot'
import type { HistoryPoint } from '@/hooks/vision/useBulkMarketHistory'

// ── Apple tokens ─────────────────────────────────────────────────────────────

const APPLE_GREEN = '#28CD41'
const APPLE_RED = '#FF3B30'
const APPLE_TEXT = '#1D1D1F'
const APPLE_TEXT_SECONDARY = '#86868B'
const APPLE_PANEL = '#FFFFFF'
const APPLE_CHIP_BG = '#F5F5F7'
const EASE_DEFAULT = 'cubic-bezier(0.4, 0, 0.6, 1)'
const EASE_OUT = 'cubic-bezier(0.25, 0.1, 0.3, 1)'
const FONT_DISPLAY = 'var(--apple-font-display), "SF Pro Display", Helvetica, Arial, sans-serif'
const FONT_TEXT = 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif'
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

// Sparkline height. Kept compact so the candle chart plus both rows of cards
// land inside one laptop screen. Loading/empty placeholders match it exactly.
const SPARK_H = 84

// ── Types ────────────────────────────────────────────────────────────────────

type Pick = 'up' | 'down'

interface HumanMarketCardProps {
  sourceId: string
  source: {
    logo: string
    brandBg: string
    prefixes: string[]
    isPrice: boolean
    valueLabel: string
  }
  market: SnapshotPrice
  pick: Pick | undefined
  onPick: (marketId: string, direction: Pick) => void
  locked: boolean
  revealFailed: boolean
  onRetryReveal: () => void
  roundSettling: boolean
  /** Round-window open timestamp in ms epoch. null while no round is active. */
  roundOpenAt: number | null
  /** Round-window close timestamp in ms epoch. null while no round is active. */
  roundCloseAt: number | null
  /** True once `now >= roundCloseAt` — chart shows the settled outcome. */
  resolved: boolean
  /** Whether this tile is the one driving the big candle chart on top. */
  selected?: boolean
  /** Called when the user clicks the tile body (not a pick button). */
  onSelect?: () => void
  /**
   * Called on first hover/touch — used by the parent to warm the big chart's
   * history cache so clicking the tile feels instant.
   */
  onPrefetch?: () => void
  /**
   * Pre-fetched 24h history. When provided, the card skips its own network
   * call — the parent has already loaded the series via the bulk endpoint.
   * Pass `undefined` while loading; pass `[]` when there is no data.
   */
  points?: HistoryPoint[]
  /**
   * The market's resolution side for this batch — UP_X / DOWN_X / UP_0 /
   * DOWN_0. Combined with `thresholdBps`, drives the colored settlement
   * square: green for UP_X, red for DOWN_X. UP_0/DOWN_0 carry no threshold
   * and so render no square.
   */
  resolutionType?: string | null
  /** Bps move that decides the binary. Threshold = open × (1 ± bps/10000). */
  thresholdBps?: number | null
}

// ── Formatters ───────────────────────────────────────────────────────────────

function formatBigUsd(value: string | number | null): string {
  if (value == null) return '—'
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function formatPct(n: number, opts: { sign?: boolean } = {}): string {
  if (!isFinite(n)) return '—'
  const sign = opts.sign && n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

// ── Component ────────────────────────────────────────────────────────────────

export function HumanMarketCard({
  sourceId,
  source,
  market,
  pick,
  onPick,
  locked,
  revealFailed,
  onRetryReveal,
  roundSettling,
  roundOpenAt,
  roundCloseAt,
  resolved,
  selected = false,
  onSelect,
  onPrefetch,
  points,
  resolutionType,
  thresholdBps,
}: HumanMarketCardProps) {
  const [imgErr, setImgErr] = useState(false)
  const name = market.name || market.symbol || market.assetId
  const value = formatBigUsd(market.value)
  const subLabel = source.isPrice ? 'price' : (source.valueLabel || '').toLowerCase()
  const assetMeta = useMemo(
    () => getAssetMeta(sourceId, market.assetId, source.prefixes),
    [sourceId, market.assetId, source.prefixes],
  )
  const imgSrc = !imgErr && (market.imageUrl || assetMeta.logo)
  const website = assetMeta.website
  const twitterHandle = assetMeta.twitter
  const twitterUrl = twitterHandle
    ? (twitterHandle.startsWith('http')
        ? twitterHandle
        : `https://x.com/${twitterHandle.replace(/^@/, '')}`)
    : null

  return (
    <article
      data-onboarding-target="market-card"
      style={{
        background: APPLE_PANEL,
        borderRadius: 14,
        boxShadow: selected
          ? '0 0 0 2px #0071E3, 0 1px 2px rgba(0,0,0,0.03)'
          : '0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)',
        padding: '10px 12px 9px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: `box-shadow 250ms ${EASE_DEFAULT}`,
        cursor: onSelect ? 'pointer' : 'default',
      }}
      onClick={onSelect}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
    >
      {/* Header: logo / name / value */}
      <header className="flex items-center gap-2">
        <div
          className="shrink-0 inline-flex items-center justify-center overflow-hidden"
          style={{
            width: 28,
            height: 28,
            background: APPLE_CHIP_BG,
            borderRadius: 7,
          }}
          aria-hidden
        >
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt=""
              width={28}
              height={28}
              className="object-cover w-full h-full"
              loading="lazy"
              onError={() => setImgErr(true)}
            />
          ) : (
            <span
              style={{
                fontFamily: FONT_TEXT,
                fontSize: 13,
                fontWeight: 600,
                color: APPLE_TEXT,
              }}
            >
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="truncate"
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '-0.016em',
              color: APPLE_TEXT,
              lineHeight: 1.2,
            }}
          >
            {name}
          </div>
          <div
            className="truncate"
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '-0.016em',
              color: APPLE_TEXT_SECONDARY,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}
          >
            {value}
          </div>
        </div>

        {(website || twitterUrl) && (
          <div
            className="shrink-0 flex items-center gap-1"
            onClick={e => e.stopPropagation()}
          >
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                title={website}
                aria-label={`${name} website`}
                className="inline-flex items-center justify-center"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  color: APPLE_TEXT_SECONDARY,
                  transition: `color 200ms ${EASE_DEFAULT}, background 200ms ${EASE_DEFAULT}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = APPLE_TEXT; e.currentTarget.style.background = APPLE_CHIP_BG }}
                onMouseLeave={e => { e.currentTarget.style.color = APPLE_TEXT_SECONDARY; e.currentTarget.style.background = 'transparent' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </a>
            )}
            {twitterUrl && (
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={twitterHandle ?? 'X / Twitter'}
                aria-label={`${name} on X`}
                className="inline-flex items-center justify-center"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  color: APPLE_TEXT_SECONDARY,
                  transition: `color 200ms ${EASE_DEFAULT}, background 200ms ${EASE_DEFAULT}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = APPLE_TEXT; e.currentTarget.style.background = APPLE_CHIP_BG }}
                onMouseLeave={e => { e.currentTarget.style.color = APPLE_TEXT_SECONDARY; e.currentTarget.style.background = 'transparent' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.244 2H21.5l-7.06 8.069L23 22h-6.59l-5.16-6.74L5.36 22H2.1l7.55-8.628L1.5 2h6.75l4.66 6.165L18.244 2zm-2.31 18h1.82L7.18 4H5.24l10.694 16z" />
                </svg>
              </a>
            )}
          </div>
        )}
      </header>

      {/* Chart with overlays */}
      <MarketChart
        sourceId={sourceId}
        assetId={market.assetId}
        pick={pick}
        roundOpenAt={roundOpenAt}
        roundCloseAt={roundCloseAt}
        resolved={resolved}
        externalPoints={points}
        resolutionType={resolutionType ?? null}
        thresholdBps={thresholdBps ?? null}
        latestValue={(() => {
          const v = parseFloat(market.value)
          return isFinite(v) ? v : null
        })()}
      />

      {/* Pick buttons — click here must not bubble up to onSelect */}
      <div className="grid grid-cols-2 gap-1.5" onClick={e => e.stopPropagation()}>
        <PickButton
          direction="up"
          active={pick === 'up'}
          inactive={pick === 'down'}
          disabled={locked || roundSettling}
          onClick={() => onPick(market.assetId, 'up')}
        />
        <PickButton
          direction="down"
          active={pick === 'down'}
          inactive={pick === 'up'}
          disabled={locked || roundSettling}
          onClick={() => onPick(market.assetId, 'down')}
        />
      </div>

      {/* Footer: locked / retry. `locked` is also passed when there is no
          active round at all — in that case it means "picks closed", not
          "you've committed". The roundOpenAt being null is how we tell.
          The committed-and-open case shows no footer text — the locked row
          state already conveys it. */}
      {locked && !revealFailed && (roundOpenAt == null || resolved) && (
        <p
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 11,
            color: APPLE_TEXT_SECONDARY,
            letterSpacing: '-0.016em',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {roundOpenAt == null ? 'Picks open with the next round' : 'Round closed'}
        </p>
      )}
      {revealFailed && (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onRetryReveal}
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 11,
              color: '#8A5A00',
              background: '#FFF6E5',
              border: '1px solid #F5C26B',
              borderRadius: 980,
              padding: '4px 10px',
              cursor: 'pointer',
              letterSpacing: '-0.016em',
            }}
          >
            Retry reveal
          </button>
        </div>
      )}
    </article>
  )
}

// ── Chart (line + open marker + resolved rectangle) ─────────────────────────

interface MarketChartProps {
  sourceId: string
  assetId: string
  pick: Pick | undefined
  roundOpenAt: number | null
  roundCloseAt: number | null
  resolved: boolean
  /** Pre-fetched 24h history from the parent's bulk hook. Skips local fetch. */
  externalPoints?: HistoryPoint[]
  resolutionType?: string | null
  thresholdBps?: number | null
  /** Latest snapshot price. Used as the threshold reference when no round is
   *  active and we have no openPrice yet. */
  latestValue?: number | null
}

function MarketChart({
  sourceId,
  assetId,
  pick,
  roundOpenAt,
  roundCloseAt,
  resolved,
  externalPoints,
  resolutionType,
  thresholdBps,
  latestValue,
}: MarketChartProps) {
  // Local fetch is only the fallback path for callers that don't pre-fetch.
  // The Vision human-trading page passes `externalPoints` so this effect is a no-op.
  const [points, setPoints] = useState<HistoryPoint[] | null>(externalPoints ?? null)
  const [loading, setLoading] = useState(externalPoints === undefined)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (externalPoints !== undefined) {
      setPoints(externalPoints)
      setLoading(false)
      setError(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    const to = new Date()
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000)
    const dataNodeId = toInternalId(sourceId)
    const url = `/api/market/history?source=${encodeURIComponent(dataNodeId)}&asset=${encodeURIComponent(assetId)}&from=${from.toISOString()}&to=${to.toISOString()}`
    fetch(url, { signal: AbortSignal.timeout(12_000) })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { prices?: Array<{ fetchedAt?: string; value?: string | number }> }) => {
        if (cancelled) return
        const raw = data.prices ?? []
        const parsed: HistoryPoint[] = raw
          .map(p => ({
            ts: p.fetchedAt ? new Date(p.fetchedAt).getTime() : 0,
            value:
              typeof p.value === 'string'
                ? parseFloat(p.value)
                : typeof p.value === 'number'
                  ? p.value
                  : NaN,
          }))
          .filter(p => isFinite(p.value) && p.ts > 0)
        setPoints(parsed)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sourceId, assetId, externalPoints])

  // Compute open / close prices inside the round window, plus the colored
  // settlement square at (roundCloseAt, threshold). UP_X paints green at
  // open × (1 + bps/10000); DOWN_X paints red at open × (1 − bps/10000).
  // UP_0/DOWN_0 carry no threshold and render no square.
  const { openPrice, closePrice, changePct, chartData, yDomain, settlement, lastPoint, runwayRight } = useMemo(() => {
    if (!points || points.length < 2) {
      return {
        openPrice: null,
        closePrice: null,
        changePct: null,
        chartData: [],
        yDomain: undefined as [number, number] | undefined,
        settlement: null as { color: string; price: number; time: number } | null,
        lastPoint: null as { ts: number; value: number } | null,
        runwayRight: null as number | null,
      }
    }
    const sorted = [...points].sort((a, b) => a.ts - b.ts)
    const data =
      sorted.length > 240
        ? sorted.filter((_, i) => i % Math.ceil(sorted.length / 240) === 0)
        : sorted

    let open: number | null = null
    let close: number | null = null
    if (roundOpenAt != null) {
      const openPoint = sorted.find(p => p.ts >= roundOpenAt) ?? sorted[0]
      open = openPoint.value
      if (resolved && roundCloseAt != null) {
        // last point at or before roundCloseAt
        let lastInWindow = openPoint
        for (const p of sorted) {
          if (p.ts <= roundCloseAt) lastInWindow = p
          else break
        }
        close = lastInWindow.value
      } else {
        close = sorted[sorted.length - 1].value
      }
    }
    const pct = open && close ? ((close - open) / open) * 100 : null

    // During an active round, the threshold is anchored to that round's
    // open price. Between rounds, fall back to the latest snapshot value so
    // the square previews where the threshold will sit when the next round
    // opens. The x position uses roundCloseAt when known, else dataMax.
    const refPrice = open ?? (latestValue != null && isFinite(latestValue) ? latestValue : null)
    const refTime = roundCloseAt ?? (data.length > 0 ? data[data.length - 1].ts : null)
    let sq: { color: string; price: number; time: number } | null = null
    if (refPrice != null && refTime != null) {
      const bps = thresholdBps ?? 0
      const type = (resolutionType ?? '').toUpperCase()
      if (type === 'UP_X' && bps > 0) {
        sq = { color: APPLE_GREEN, price: refPrice * (1 + bps / 10000), time: refTime }
      } else if (type === 'DOWN_X' && bps > 0) {
        sq = { color: APPLE_RED, price: refPrice * (1 - bps / 10000), time: refTime }
      } else if (type === 'UP_0') {
        sq = { color: APPLE_GREEN, price: refPrice, time: refTime }
      } else if (type === 'DOWN_0') {
        sq = { color: APPLE_RED, price: refPrice, time: refTime }
      }
    }

    // Pad y-domain so the open line, threshold line, and target zone don't
    // kiss the edges of the chart.
    const values = data.map(d => d.value)
    if (open != null) values.push(open)
    if (close != null) values.push(close)
    if (sq != null) values.push(sq.price)
    const minV = Math.min(...values)
    const maxV = Math.max(...values)
    const pad = (maxV - minV) * 0.12 || maxV * 0.01 || 1
    const domain: [number, number] = [minV - pad, maxV + pad]

    // The runway: the gap from the last point to the settlement edge is held
    // at a fixed 15% of the full x-range, regardless of how far off the real
    // settle time is. History fills the left 85%; settlement pins to the edge.
    const firstTs = data[0].ts
    const lastTs = data[data.length - 1].ts
    const lastVal = data[data.length - 1].value
    const span = lastTs - firstTs
    const RUNWAY_FRAC = 0.15
    const right = span > 0 ? lastTs + span * (RUNWAY_FRAC / (1 - RUNWAY_FRAC)) : lastTs

    return {
      openPrice: open,
      closePrice: close,
      changePct: pct,
      chartData: data,
      yDomain: domain,
      settlement: sq,
      lastPoint: { ts: lastTs, value: lastVal },
      runwayRight: right,
    }
  }, [points, roundOpenAt, roundCloseAt, resolved, resolutionType, thresholdBps, latestValue])

  if (loading) {
    return (
      <div
        style={{
          height: SPARK_H,
          background: APPLE_CHIP_BG,
          borderRadius: 8,
          opacity: 0.5,
        }}
      />
    )
  }

  if (error || !points || points.length < 2) {
    return (
      <div
        style={{
          height: SPARK_H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: APPLE_CHIP_BG,
          borderRadius: 8,
        }}
      >
        <span
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 12,
            color: APPLE_TEXT_SECONDARY,
            letterSpacing: '-0.016em',
          }}
        >
          No recent series.
        </span>
      </div>
    )
  }

  // Line stroke follows the pick during betting; freezes at resolution.
  const strokeColor =
    resolved
      ? (changePct != null && changePct >= 0 ? APPLE_GREEN : APPLE_RED)
      : pick === 'up'
        ? APPLE_GREEN
        : pick === 'down'
          ? APPLE_RED
          : APPLE_TEXT_SECONDARY

  // Rectangle: only after resolution, drawn from open→close on Y, and across the round window on X.
  const showRect =
    resolved && openPrice != null && closePrice != null && roundOpenAt != null && roundCloseAt != null
  const rectColor = openPrice != null && closePrice != null && closePrice >= openPrice ? APPLE_GREEN : APPLE_RED

  // Live round: there is a threshold ahead and the round hasn't closed. This is
  // when the target zone — the runway from the last price to the crossing —
  // gets drawn.
  const live = !resolved && settlement != null && lastPoint != null && runwayRight != null

  const formatXTick = (ts: number) => {
    const d = new Date(ts)
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  }
  const formatYTick = (v: number) => {
    const a = Math.abs(v)
    if (a >= 1e12) return `${(v / 1e12).toFixed(1)}T`
    if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`
    if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`
    if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`
    if (a >= 1) return v.toFixed(1)
    if (a >= 0.01) return v.toFixed(3)
    return v.toFixed(5)
  }

  return (
    <div style={{ position: 'relative', height: SPARK_H, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 4, left: 12, bottom: 0 }}>
          {/* X domain reserves a fixed 15% runway on the right for the gap
              from the last price to the settlement edge. History fills the
              left 85%; the crossing pins to the right edge. */}
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', live ? runwayRight! : 'dataMax']}
            tick={{ fill: APPLE_TEXT_SECONDARY, fontSize: 9, fontFamily: FONT_MONO }}
            tickFormatter={formatXTick}
            tickLine={false}
            axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
            interval="preserveStartEnd"
            minTickGap={28}
            height={16}
            padding={{ left: 8, right: 0 }}
          />
          <YAxis
            type="number"
            domain={yDomain ?? ['auto', 'auto']}
            tick={{ fill: APPLE_TEXT_SECONDARY, fontSize: 9, fontFamily: FONT_MONO }}
            tickFormatter={formatYTick}
            tickLine={false}
            axisLine={false}
            orientation="right"
            width={36}
            tickCount={3}
          />
          <RechartsTooltip
            content={<ChartTooltip />}
            cursor={{ stroke: 'rgba(0,0,0,0.10)', strokeWidth: 1 }}
          />

          {/* Target zone: the blue rectangle spanning from the last price to
              the threshold crossing — across the 15% runway on X, and from the
              last value to the threshold on Y. "Here is where it has to land." */}
          {live && (
            <ReferenceArea
              x1={lastPoint!.ts}
              x2={runwayRight!}
              y1={lastPoint!.value}
              y2={settlement!.price}
              fill="#0071E3"
              fillOpacity={0.1}
              stroke="#0071E3"
              strokeOpacity={0.22}
              strokeWidth={1}
              isFront={false}
            />
          )}

          {/* Horizontal threshold line: the price the round settles against,
              full width. Green for UP, red for DOWN. */}
          {live && (
            <ReferenceLine
              y={settlement!.price}
              stroke={settlement!.color}
              strokeDasharray="4 3"
              strokeWidth={1.25}
              isFront={false}
            />
          )}

          {/* Vertical settle line: the settlement moment, pinned to the right
              edge of the runway, full height. */}
          {live && (
            <ReferenceLine
              x={runwayRight!}
              stroke={APPLE_TEXT_SECONDARY}
              strokeDasharray="4 3"
              strokeWidth={1}
              isFront={false}
            />
          )}

          {/* Round-open horizontal marker (the threshold for UP/DOWN) */}
          {openPrice != null && (
            <ReferenceLine
              y={openPrice}
              stroke="#86868B"
              strokeDasharray="3 3"
              strokeWidth={1}
              isFront={false}
              label={{
                value: `Open ${formatBigUsd(openPrice)}`,
                position: 'insideTopRight',
                fill: '#1D1D1F',
                fontSize: 10,
                fontFamily: FONT_MONO,
                offset: 4,
              }}
            />
          )}

          {/* Resolved rectangle: open → close on Y, round-window on X */}
          {showRect && (
            <ReferenceArea
              x1={roundOpenAt!}
              x2={roundCloseAt!}
              y1={Math.min(openPrice!, closePrice!)}
              y2={Math.max(openPrice!, closePrice!)}
              fill={rectColor}
              fillOpacity={0.18}
              stroke={rectColor}
              strokeOpacity={0.45}
              strokeWidth={1}
              isFront={false}
            />
          )}

          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.75}
            strokeLinecap="round"
            dot={false}
            isAnimationActive={false}
            style={{ transition: `stroke 250ms ${EASE_DEFAULT}` }}
          />

          {/* Crossing marker: a small square where the threshold meets the
              settle edge — the corner of the target zone. */}
          {live && (
            <ReferenceDot
              x={runwayRight!}
              y={settlement!.price}
              r={4}
              fill={settlement!.color}
              stroke="#FFFFFF"
              strokeWidth={1.5}
              isFront
              ifOverflow="visible"
              shape={(props: { cx?: number; cy?: number }) => (
                <rect
                  x={(props.cx ?? 0) - 4}
                  y={(props.cy ?? 0) - 4}
                  width={8}
                  height={8}
                  fill={settlement!.color}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  rx={1.5}
                  ry={1.5}
                />
              )}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Resolved badge — top-right corner of the chart */}
      {resolved && changePct != null && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 10,
            background: '#FFFFFF',
            border: `1px solid ${changePct >= 0 ? 'rgba(40,205,65,0.35)' : 'rgba(255,59,48,0.35)'}`,
            color: changePct >= 0 ? '#1A9D34' : '#C92A1F',
            borderRadius: 980,
            padding: '2px 8px',
            fontFamily: FONT_MONO,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '+0.011em',
            fontVariantNumeric: 'tabular-nums',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
          aria-label={`Resolved ${formatPct(changePct, { sign: true })}`}
        >
          {formatPct(changePct, { sign: true })}
        </div>
      )}
    </div>
  )
}

function ChartTooltip(props: {
  active?: boolean
  payload?: Array<{ payload?: HistoryPoint; value?: number }>
}) {
  if (!props.active || !props.payload || props.payload.length === 0) return null
  const item = props.payload[0]
  if (!item || item.payload === undefined) return null
  const v = item.value ?? item.payload.value
  const ts = item.payload.ts
  if (typeof v !== 'number') return null
  const d = new Date(ts)
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 8,
        padding: '6px 10px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        fontFamily: FONT_TEXT,
        fontSize: 11,
        color: APPLE_TEXT,
      }}
    >
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          color: APPLE_TEXT,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatBigUsd(v)}
      </div>
      <div
        style={{
          fontSize: 10,
          color: APPLE_TEXT_SECONDARY,
          marginTop: 2,
        }}
      >
        {d.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </div>
    </div>
  )
}

// ── PickButton (inlined — matches parent style intentionally) ────────────────

function PickButton({
  direction,
  active,
  inactive,
  disabled,
  onClick,
}: {
  direction: Pick
  active: boolean
  inactive: boolean
  disabled: boolean
  onClick: () => void
}) {
  const [pressed, setPressed] = useState(false)
  const isUp = direction === 'up'
  const accent = isUp ? APPLE_GREEN : APPLE_RED
  const glyph = isUp ? '▲' : '▼'
  const label = isUp ? 'UP' : 'DOWN'

  let bg = APPLE_CHIP_BG
  let color = APPLE_TEXT
  let border = '1px solid transparent'
  let boxShadow: string | undefined

  if (active) {
    bg = accent
    color = '#FFFFFF'
    boxShadow = 'inset 0 -2px 0 rgba(0,0,0,0.12)'
  } else if (inactive) {
    bg = '#FFFFFF'
    color = APPLE_TEXT_SECONDARY
    border = '1px solid rgba(0,0,0,0.12)'
  }

  const opacity = disabled && !active ? 0.4 : 1

  const style: CSSProperties = {
    height: 32,
    borderRadius: 8,
    background: bg,
    color,
    border,
    boxShadow,
    fontFamily: FONT_TEXT,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '-0.016em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: `background 250ms ${EASE_DEFAULT}, color 250ms ${EASE_DEFAULT}, border-color 250ms ${EASE_DEFAULT}, transform 200ms ${EASE_OUT}`,
    transform: pressed ? 'scale(0.97)' : 'scale(1)',
    opacity,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    userSelect: 'none',
    pointerEvents: disabled ? 'none' : 'auto',
  }

  return (
    <button
      type="button"
      style={style}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label} — ${active ? 'selected' : 'select'}`}
    >
      <span aria-hidden style={{ fontSize: 12, lineHeight: 1 }}>
        {glyph}
      </span>
      {label}
    </button>
  )
}
