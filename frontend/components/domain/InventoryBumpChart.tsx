'use client'

import { useState, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useInventoryRanking, RankingSnapshot, RankedAsset } from '@/hooks/useInventoryRanking'

// 15-color palette — muted institutional tones for white backgrounds
const PALETTE = [
  '#2563EB', // blue
  '#16A34A', // green
  '#DC2626', // red
  '#D97706', // amber
  '#7C3AED', // violet
  '#DB2777', // pink
  '#0891B2', // cyan
  '#EA580C', // orange
  '#0D9488', // teal
  '#9333EA', // purple
  '#65A30D', // lime
  '#C026D3', // fuchsia
  '#CA8A04', // yellow
  '#4F46E5', // indigo
  '#E11D48', // rose
]

// SVG layout constants
const MARGIN = { top: 32, right: 120, bottom: 40, left: 40 }
const ROW_HEIGHT = 36
const COL_MIN_WIDTH = 140
const RIBBON_OPACITY = 0.7
const RIBBON_HOVER_OPACITY = 1.0
const RIBBON_DIM_OPACITY = 0.15

interface TooltipData {
  x: number
  y: number
  snapshot: RankingSnapshot
}

function formatAum(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

function eventLabel(eventType: string): string {
  switch (eventType) {
    case 'created':
      return 'CREATE'
    case 'rebalanced':
      return 'REBAL'
    case 'fill':
      return 'FILL'
    case 'init':
      return 'INIT'
    default:
      return eventType.toUpperCase()
  }
}

export function InventoryBumpChart() {
  const t = useTranslations('system')
  const { snapshots, allAssets, maxRank, isLoading, error } = useInventoryRanking()
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null)
  const [hoveredCol, setHoveredCol] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Collect all unique assets across all snapshots for stable color assignment
  const assetColorMap = useMemo(() => {
    const map = new Map<string, string>()
    const seen: string[] = []
    // Use final snapshot's ranking order for primary color assignment
    if (snapshots.length > 0) {
      const last = snapshots[snapshots.length - 1]
      for (const asset of last.ranked) {
        if (!seen.includes(asset.address)) seen.push(asset.address)
      }
    }
    // Add any assets from earlier snapshots not in the final
    for (const snap of snapshots) {
      for (const asset of snap.ranked) {
        if (!seen.includes(asset.address)) seen.push(asset.address)
      }
    }
    seen.forEach((addr, i) => map.set(addr, PALETTE[i % PALETTE.length]))
    return map
  }, [snapshots])

  // Compute SVG dimensions
  const numCols = snapshots.length
  const numRows = maxRank || 1
  const chartWidth = Math.max(numCols * COL_MIN_WIDTH, 400)
  const chartHeight = numRows * ROW_HEIGHT
  const svgWidth = MARGIN.left + chartWidth + MARGIN.right
  const svgHeight = MARGIN.top + chartHeight + MARGIN.bottom

  // Column x positions (evenly spaced)
  const colX = useMemo(() => {
    if (numCols <= 1) return [MARGIN.left + chartWidth / 2]
    return Array.from({ length: numCols }, (_, i) =>
      MARGIN.left + (i / (numCols - 1)) * chartWidth
    )
  }, [numCols, chartWidth])

  // Rank y position (center of row)
  const rankY = (rank: number) => MARGIN.top + (rank - 1) * ROW_HEIGHT + ROW_HEIGHT / 2

  // Total AUM from latest snapshot
  const latestTotalAum = snapshots.length > 0
    ? snapshots[snapshots.length - 1].totalAum
    : 0

  // Build ribbon paths: for each asset, connect its rank across consecutive columns
  const ribbons = useMemo(() => {
    if (snapshots.length < 2) return []

    const result: {
      address: string
      symbol: string
      path: string
      colStart: number
      colEnd: number
    }[] = []

    // Collect all unique asset addresses
    const allAddrs = new Set<string>()
    for (const snap of snapshots) {
      for (const a of snap.ranked) allAddrs.add(a.address)
    }

    for (const addr of allAddrs) {
      // Find the columns where this asset has a rank
      const appearances: { col: number; rank: number; symbol: string }[] = []
      for (let c = 0; c < snapshots.length; c++) {
        const found = snapshots[c].ranked.find(a => a.address === addr)
        if (found) appearances.push({ col: c, rank: found.rank, symbol: found.symbol })
      }

      // Draw ribbon segments between consecutive appearances
      for (let i = 0; i < appearances.length - 1; i++) {
        const a = appearances[i]
        const b = appearances[i + 1]
        const x1 = colX[a.col]
        const x2 = colX[b.col]
        const y1 = rankY(a.rank)
        const y2 = rankY(b.rank)
        const h = ROW_HEIGHT * 0.35 // half-height of ribbon
        const cp = (x2 - x1) * 0.4 // control point offset

        // Ribbon shape: top edge forward, bottom edge back
        const path = [
          `M ${x1},${y1 - h}`,
          `C ${x1 + cp},${y1 - h} ${x2 - cp},${y2 - h} ${x2},${y2 - h}`,
          `L ${x2},${y2 + h}`,
          `C ${x2 - cp},${y2 + h} ${x1 + cp},${y1 + h} ${x1},${y1 + h}`,
          'Z',
        ].join(' ')

        result.push({ address: addr, symbol: a.symbol, path, colStart: a.col, colEnd: b.col })
      }
    }

    return result
  }, [snapshots, colX])

  const handleColHover = (colIdx: number, e: React.MouseEvent) => {
    setHoveredCol(colIdx)
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        snapshot: snapshots[colIdx],
      })
    }
  }

  const handleColLeave = () => {
    setHoveredCol(null)
    setTooltip(null)
  }

  // Render states
  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-card p-6">
        <h2 className="text-xl font-bold text-text-primary mb-2">{t('aum_ranking.title')}</h2>
        <div className="text-color-down text-sm">{error}</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-card p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">{t('aum_ranking.title')}</h2>
        <div className="h-64 flex items-center justify-center text-text-secondary">
          {t('aum_ranking.loading')}
        </div>
      </div>
    )
  }

  if (snapshots.length < 2) {
    return (
      <div className="bg-white rounded-xl shadow-card p-6">
        <h2 className="text-xl font-bold text-text-primary mb-2">{t('aum_ranking.title')}</h2>
        <p className="text-sm text-text-secondary mb-4">
          {t('aum_ranking.description')}
        </p>
        <div className="h-48 flex items-center justify-center text-text-secondary border border-border-light rounded-lg">
          {t('aum_ranking.need_events')}
          {snapshots.length === 1 && ` ${t('aum_ranking.showing_event')}`}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-card p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">{t('aum_ranking.title')}</h2>
          <p className="text-sm text-text-secondary">
            {t('aum_ranking.description')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-zinc-900 font-mono tabular-nums">{formatAum(latestTotalAum)}</p>
          <p className="text-xs text-text-secondary">{t('aum_ranking.total_aum')}</p>
        </div>
      </div>

      <div
        ref={containerRef}
        className="overflow-x-auto relative"
        style={{ maxHeight: svgHeight + 20 }}
      >
        <svg
          width={svgWidth}
          height={svgHeight}
          className="block"
          onMouseLeave={handleColLeave}
        >
          {/* Row backgrounds (alternating) */}
          {Array.from({ length: numRows }, (_, i) => (
            <rect
              key={`row-${i}`}
              x={MARGIN.left}
              y={MARGIN.top + i * ROW_HEIGHT}
              width={chartWidth}
              height={ROW_HEIGHT}
              fill={i % 2 === 0 ? '#F4F4F5' : 'transparent'}
            />
          ))}

          {/* Rank labels on left */}
          {Array.from({ length: numRows }, (_, i) => (
            <text
              key={`rank-${i}`}
              x={MARGIN.left - 12}
              y={rankY(i + 1)}
              textAnchor="end"
              dominantBaseline="central"
              fill="#A1A1AA"
              fontSize={11}
              fontFamily="var(--font-jetbrains-mono), monospace"
            >
              #{i + 1}
            </text>
          ))}

          {/* Column hover zones */}
          {colX.map((x, i) => (
            <rect
              key={`colzone-${i}`}
              x={i === 0 ? MARGIN.left : (colX[i - 1] + x) / 2}
              y={MARGIN.top}
              width={
                i === 0
                  ? (numCols > 1 ? (colX[1] - colX[0]) / 2 + (x - MARGIN.left) : chartWidth)
                  : i === numCols - 1
                    ? (x - colX[i - 1]) / 2 + (MARGIN.left + chartWidth - x)
                    : (colX[i + 1] - colX[i - 1]) / 2
              }
              height={chartHeight}
              fill={hoveredCol === i ? 'rgba(0,0,0,0.03)' : 'transparent'}
              onMouseEnter={(e) => handleColHover(i, e)}
              onMouseMove={(e) => handleColHover(i, e)}
              style={{ cursor: 'crosshair' }}
            />
          ))}

          {/* Column lines */}
          {colX.map((x, i) => (
            <line
              key={`col-${i}`}
              x1={x}
              y1={MARGIN.top}
              x2={x}
              y2={MARGIN.top + chartHeight}
              stroke={hoveredCol === i ? '#D4D4D8' : '#E4E4E7'}
              strokeWidth={1}
            />
          ))}

          {/* Ribbons */}
          {ribbons.map((ribbon, i) => {
            const isHovered = hoveredAsset === ribbon.address
            const isDimmed = hoveredAsset !== null && !isHovered
            const opacity = isDimmed
              ? RIBBON_DIM_OPACITY
              : isHovered
                ? RIBBON_HOVER_OPACITY
                : RIBBON_OPACITY

            return (
              <path
                key={`ribbon-${i}`}
                d={ribbon.path}
                fill={assetColorMap.get(ribbon.address) || PALETTE[0]}
                opacity={opacity}
                onMouseEnter={() => setHoveredAsset(ribbon.address)}
                onMouseLeave={() => setHoveredAsset(null)}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              />
            )
          })}

          {/* Dots at each rank position */}
          {snapshots.map((snap, colIdx) =>
            snap.ranked.map((asset) => {
              const isHovered = hoveredAsset === asset.address
              const isDimmed = hoveredAsset !== null && !isHovered
              return (
                <circle
                  key={`dot-${colIdx}-${asset.address}`}
                  cx={colX[colIdx]}
                  cy={rankY(asset.rank)}
                  r={isHovered ? 5 : 4}
                  fill={assetColorMap.get(asset.address) || PALETTE[0]}
                  opacity={isDimmed ? 0.2 : 1}
                  stroke={isHovered ? '#18181B' : 'none'}
                  strokeWidth={1.5}
                  onMouseEnter={() => setHoveredAsset(asset.address)}
                  onMouseLeave={() => setHoveredAsset(null)}
                  style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                />
              )
            })
          )}

          {/* Asset labels on first column */}
          {snapshots[0].ranked.map((asset) => (
            <text
              key={`label-first-${asset.address}`}
              x={colX[0] - 8}
              y={rankY(asset.rank)}
              textAnchor="end"
              dominantBaseline="central"
              fill={
                hoveredAsset === null || hoveredAsset === asset.address
                  ? (assetColorMap.get(asset.address) || '#18181B')
                  : '#D4D4D8'
              }
              fontSize={10}
              fontFamily="var(--font-jetbrains-mono), monospace"
              fontWeight={hoveredAsset === asset.address ? 'bold' : 'normal'}
              style={{ transition: 'fill 0.15s' }}
            >
              {asset.symbol}
            </text>
          ))}

          {/* Asset labels on last column */}
          {snapshots[snapshots.length - 1].ranked.map((asset) => (
            <text
              key={`label-last-${asset.address}`}
              x={colX[colX.length - 1] + 8}
              y={rankY(asset.rank)}
              textAnchor="start"
              dominantBaseline="central"
              fill={
                hoveredAsset === null || hoveredAsset === asset.address
                  ? (assetColorMap.get(asset.address) || '#18181B')
                  : '#D4D4D8'
              }
              fontSize={10}
              fontFamily="var(--font-jetbrains-mono), monospace"
              fontWeight={hoveredAsset === asset.address ? 'bold' : 'normal'}
              style={{ transition: 'fill 0.15s' }}
            >
              {asset.symbol}
            </text>
          ))}

          {/* Time labels on x-axis */}
          {snapshots.map((snap, i) => (
            <g key={`xlabel-${i}`}>
              <text
                x={colX[i]}
                y={MARGIN.top + chartHeight + 16}
                textAnchor="middle"
                fill="#52525B"
                fontSize={10}
                fontFamily="var(--font-jetbrains-mono), monospace"
              >
                {snap.label}
              </text>
              <text
                x={colX[i]}
                y={MARGIN.top + chartHeight + 28}
                textAnchor="middle"
                fill="#A1A1AA"
                fontSize={9}
                fontFamily="var(--font-jetbrains-mono), monospace"
              >
                {eventLabel(snap.eventType)}
              </text>
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth || 400) - 220),
              top: Math.max(tooltip.y - 10, 0),
            }}
          >
            <div
              className="rounded-xl p-3 text-xs font-mono shadow-card-hover"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E4E4E7',
                minWidth: 200,
              }}
            >
              <div className="text-text-secondary mb-1">
                {tooltip.snapshot.label} — {eventLabel(tooltip.snapshot.eventType)}
              </div>
              <div className="text-zinc-900 font-semibold mb-2">
                Total AUM: {formatAum(tooltip.snapshot.totalAum)}
              </div>
              {tooltip.snapshot.ranked.map((asset) => (
                <div key={asset.address} className="flex items-center gap-2 py-0.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: assetColorMap.get(asset.address) || PALETTE[0] }}
                  />
                  <span className="text-text-secondary">#{asset.rank}</span>
                  <span className="text-text-primary font-medium">{asset.symbol}</span>
                  <span className="text-text-muted ml-auto">
                    {formatAum(asset.aum)} ({asset.weightPct.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-4 border-t border-border-light text-xs text-text-secondary">
        {snapshots.length > 0 &&
          snapshots[snapshots.length - 1].ranked.map((asset) => (
            <div
              key={asset.address}
              className="flex items-center gap-1.5 cursor-pointer"
              onMouseEnter={() => setHoveredAsset(asset.address)}
              onMouseLeave={() => setHoveredAsset(null)}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: assetColorMap.get(asset.address) || PALETTE[0] }}
              />
              <span className={hoveredAsset === asset.address ? 'text-text-primary font-medium' : ''}>
                {asset.symbol}
              </span>
            </div>
          ))}
        <span className="ml-auto font-mono tabular-nums">{t('aum_ranking.snapshots_count', { count: snapshots.length })}</span>
      </div>
    </div>
  )
}
