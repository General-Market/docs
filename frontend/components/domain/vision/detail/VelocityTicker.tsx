'use client'

/**
 * VelocityTicker — top movers for a source, displayed as a horizontal
 * strip. Bets are sealed for the day; the underlying metric keeps
 * moving. This is the line in the page that shows the metric is alive
 * even when the bet isn't.
 *
 * For github (24h tick): updates whenever the data-node refreshes its
 * star-velocity snapshots (every ~71 minutes — the upstream GitHub API
 * rate limit dictates the cadence, not us).
 * For short-tick sources: updates every 30s.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@/i18n/routing'
import { toInternalId } from '@/lib/vision/source-ids'

interface SnapshotPrice {
  source: string
  assetId: string
  symbol: string
  name: string
  value: string | null
  prevClose: string | null
  changePct: string | null
  volume24h: string | null
  marketCap: string | null
  fetchedAt: string | null
  imageUrl?: string | null
}

interface SnapshotResponse {
  generatedAt: string
  maxAgeSecs: number
  totalAssets: number
  sources: string[]
  prices: SnapshotPrice[]
}

interface Props {
  sourceId: string
  limit?: number
}

export function VelocityTicker({ sourceId, limit = 14 }: Props) {
  const internalId = toInternalId(sourceId)
  const router = useRouter()

  const { data } = useQuery<SnapshotResponse | null>({
    queryKey: ['velocity-ticker', internalId],
    queryFn: async () => {
      const res = await fetch(`/api/vision/snapshot?source=${encodeURIComponent(internalId)}`)
      if (!res.ok) return null
      return res.json()
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  })

  const movers = useMemo(() => {
    if (!data?.prices) return []
    return data.prices
      .map(p => ({
        assetId: p.assetId,
        name: p.name || p.symbol || p.assetId,
        symbol: p.symbol,
        changePct: parseFloat(p.changePct ?? '0'),
        value: parseFloat(p.value ?? '0'),
      }))
      // Derivative assets (github's _velocity, "/d") are computed as deltas
      // of deltas — a repo going from 1 star/day to 50 stars/day prints as
      // "+4900%" and crowds out every real signal. Cumulative metrics only.
      .filter(p => {
        if (p.assetId.endsWith('_velocity')) return false
        if (p.symbol.endsWith('/d')) return false
        return true
      })
      // Cap the absolute change at 100% — anything beyond that is almost
      // always an upstream prevClose=0 or an asset that just listed, both
      // of which produce visually loud but meaningless rows.
      .filter(p => Number.isFinite(p.changePct) && p.changePct !== 0 && Math.abs(p.changePct) <= 1)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, limit)
  }, [data, limit])

  if (movers.length === 0) return null

  return (
    <section
      aria-label="Top movers"
      style={{
        position: 'relative',
      }}
    >
      <header className="mb-3 flex items-baseline gap-3">
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-loose)',
            color: 'var(--apple-text-tertiary)',
            textTransform: 'uppercase',
          }}
        >
          movers
        </span>
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text-secondary)',
          }}
        >
          The bet is sealed. The data is not.
        </span>
      </header>

      <div
        className="flex gap-2 overflow-x-auto"
        style={{
          scrollSnapType: 'x proximity',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 4,
          // Hide scrollbar via Tailwind-free CSS (we don't add a global utility for one strip).
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--apple-line) transparent',
        }}
      >
        {movers.map(m => (
          <MoverChip
            key={m.assetId}
            // symbol is the structured form ("GH:3b1b/manim"); name is the
            // human description ("Animation engine for explanatory math
            // videos"). We want the structured form in the chip, the
            // description in the tooltip.
            label={prettyName(m.symbol || m.assetId)}
            tooltip={m.name}
            changePct={m.changePct}
            onClick={() => {
              // Asset detail pages live at /source/{sourceId}/market/{assetId}.
              const path = `/source/${sourceId}/market/${encodeURIComponent(m.assetId)}`
              router.push(path)
            }}
          />
        ))}
      </div>
    </section>
  )
}

function MoverChip({
  label,
  tooltip,
  changePct,
  onClick,
}: {
  label: string
  tooltip: string
  changePct: number
  onClick: () => void
}) {
  const up = changePct > 0
  const pctAbs = Math.abs(changePct * 100)
  // Apple uses dim-but-readable signal colors: green ≈ #34c759, red ≈ #ff3b30.
  // Slightly desaturated so they don't shout in a dense strip.
  const tone = up ? '#1f8a3f' : '#c0392b'

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className="shrink-0 text-left transition-colors hover:bg-[var(--apple-panel-hover,#f5f5f7)]"
      style={{
        scrollSnapAlign: 'start',
        background: 'var(--apple-panel)',
        border: '1px solid var(--apple-line)',
        borderRadius: 12,
        padding: '10px 14px',
        minWidth: 168,
        cursor: 'pointer',
      }}
    >
      <div
        className="truncate"
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text)',
          lineHeight: 1.2,
          maxWidth: 220,
        }}
      >
        {label}
      </div>
      <div
        className="mt-1"
        style={{
          fontFamily: '"SF Mono","JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace',
          fontSize: 13,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
          color: tone,
          lineHeight: 1.2,
        }}
      >
        {up ? '+' : '−'}
        {pctAbs.toFixed(pctAbs >= 10 ? 1 : 2)}%
      </div>
    </button>
  )
}

/**
 * Strip the source prefix from a symbol so "GH:3b1b/manim" reads as
 * "3b1b/manim". Other prefixes (POLY:, DEFI:, etc.) follow the same
 * "PREFIX:rest" form, so a single regex covers them all.
 */
function prettyName(symbol: string): string {
  return symbol.replace(/^[A-Z]+:/, '').trim()
}
