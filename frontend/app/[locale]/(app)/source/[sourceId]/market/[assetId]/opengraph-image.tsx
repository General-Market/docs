import { ImageResponse } from 'next/og'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getAaDataNodeUrl } from '@/lib/config'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { allInternalIds } from '@/lib/vision/source-ids'

export const runtime = 'nodejs'
export const alt = 'Vision Market'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface PricePoint {
  fetchedAt: string
  value: number
}

interface CurrentMarket {
  value: string
  changePct: string | null
  name: string
  symbol: string
}

function formatPrice(value: string, asCurrency: boolean): string {
  const num = parseFloat(value)
  if (isNaN(num)) return '--'
  const prefix = asCurrency ? '$' : ''
  if (num >= 1_000_000_000) return `${prefix}${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `${prefix}${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${prefix}${(num / 1_000).toFixed(2)}K`
  if (num >= 1) return `${prefix}${num.toFixed(2)}`
  if (num >= 0.01) return `${prefix}${num.toFixed(4)}`
  return `${prefix}${num.toFixed(6)}`
}

function extractSolidColor(brandBg: string): string {
  if (brandBg.startsWith('#')) return brandBg
  const match = brandBg.match(/#[0-9a-fA-F]{3,8}/)
  return match ? match[0] : '#6366f1'
}

function lighten(hex: string, amount: number): string {
  const c = hex.replace('#', '')
  const r = Math.min(255, parseInt(c.substring(0, 2), 16) + amount)
  const g = Math.min(255, parseInt(c.substring(2, 4), 16) + amount)
  const b = Math.min(255, parseInt(c.substring(4, 6), 16) + amount)
  return `rgb(${r}, ${g}, ${b})`
}

function cleanName(name: string, prefixes: string[]): string {
  for (const p of prefixes) {
    if (name.toLowerCase().startsWith(p)) {
      return name.slice(p.length).replace(/_/g, ' ')
    }
  }
  return name.replace(/_/g, ' ')
}

/** Fetch 7-day price history for a specific asset. */
async function fetchHistory(sourceId: string, assetId: string): Promise<PricePoint[]> {
  try {
    const now = new Date()
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    for (const internalId of allInternalIds(sourceId)) {
      const url = `${getAaDataNodeUrl()}/market/prices/${encodeURIComponent(internalId)}/${encodeURIComponent(assetId)}/history?from=${from.toISOString()}&to=${now.toISOString()}`
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
      if (!res.ok) continue
      const data = await res.json()
      const prices: PricePoint[] = (data.prices ?? []).map((p: Record<string, unknown>) => ({
        fetchedAt: p.fetchedAt as string,
        value: typeof p.value === 'string' ? parseFloat(p.value as string) : (p.value as number),
      }))
      if (prices.length > 0) return prices
    }
    return []
  } catch {
    return []
  }
}

/** Fetch current snapshot for a specific asset. */
async function fetchCurrent(sourceId: string, assetId: string): Promise<CurrentMarket | null> {
  try {
    for (const internalId of allInternalIds(sourceId)) {
      const res = await fetch(
        `${getAaDataNodeUrl()}/vision/snapshot?source=${encodeURIComponent(internalId)}&limit=500`,
        { signal: AbortSignal.timeout(8_000) },
      )
      if (!res.ok) continue
      const raw = await res.json()
      const found = (raw.snapshots ?? []).find((s: Record<string, unknown>) => s.assetId === assetId)
      if (found) {
        return {
          value: String(found.value ?? '0'),
          changePct: found.changePct != null ? String(found.changePct) : null,
          name: String(found.name ?? ''),
          symbol: String(found.symbol ?? ''),
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/** Build an SVG polyline path from price points, scaled to fit a box. */
function buildSparklinePath(points: PricePoint[], w: number, h: number, padding: number): string {
  if (points.length < 2) return ''
  const values = points.map(p => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const innerW = w - padding * 2
  const innerH = h - padding * 2

  return points
    .map((p, i) => {
      const x = padding + (i / (points.length - 1)) * innerW
      const y = padding + innerH - ((p.value - min) / range) * innerH
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** Build a filled area path for the gradient fill under the sparkline. */
function buildAreaPath(points: PricePoint[], w: number, h: number, padding: number): string {
  if (points.length < 2) return ''
  const linePath = buildSparklinePath(points, w, h, padding)
  const lastX = padding + ((points.length - 1) / (points.length - 1)) * (w - padding * 2)
  const firstX = padding
  const bottom = h
  return `${linePath} L${lastX.toFixed(1)},${bottom} L${firstX.toFixed(1)},${bottom} Z`
}

export default async function Image({ params }: { params: Promise<{ sourceId: string; assetId: string }> }) {
  const { sourceId, assetId } = await params
  const decodedAssetId = decodeURIComponent(assetId)
  const source = await getSourceDisplayServer(sourceId)

  if (!source) {
    return new ImageResponse(
      (
        <div style={{ display: 'flex', width: '100%', height: '100%', background: '#09090b', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 48, fontFamily: 'sans-serif' }}>
          Market not found
        </div>
      ),
      { ...size },
    )
  }

  const [history, current] = await Promise.all([
    fetchHistory(sourceId, decodedAssetId),
    fetchCurrent(sourceId, decodedAssetId),
  ])

  const brandColor = extractSolidColor(source.brandBg)
  const brandLight = lighten(brandColor, 80)
  const logoUrl = source.logo.startsWith('http') ? source.logo : `https://www.generalmarket.io${source.logo}`
  const category = getCategoryLabel(source.category)

  const marketName = cleanName(current?.name || current?.symbol || decodedAssetId, source.prefixes)
  const priceStr = current ? formatPrice(current.value, source.isPrice) : '--'
  const changePct = current?.changePct ? parseFloat(current.changePct) : null
  const changeStr = changePct != null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '--'
  const isPositive = changePct == null || changePct >= 0
  const lineColor = isPositive ? '#4ade80' : '#f87171'

  // Sparkline dimensions
  const chartW = 1080
  const chartH = 280
  const chartPad = 8

  // Downsample for cleaner SVG
  const displayPoints = history.length > 120
    ? history.filter((_, i) => i % Math.ceil(history.length / 120) === 0 || i === history.length - 1)
    : history

  const sparkPath = buildSparklinePath(displayPoints, chartW, chartH, chartPad)
  const areaPath = buildAreaPath(displayPoints, chartW, chartH, chartPad)

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#09090b',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Brand accent top edge */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: brandColor }} />

        {/* Header row: source + market info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '44px 56px 0' }}>
          {/* Left: source + market name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={logoUrl} width={32} height={32} style={{ objectFit: 'contain', borderRadius: 4 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {source.name}
              </div>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: brandLight,
                background: `${brandColor}30`,
                padding: '2px 8px',
                borderRadius: 3,
              }}>
                {category}
              </div>
            </div>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
              {marketName.length > 30 ? marketName.slice(0, 29) + '\u2026' : marketName}
            </div>
          </div>

          {/* Right: price + change */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#ffffff', fontFamily: 'monospace', letterSpacing: '-0.02em' }}>
              {priceStr}
            </div>
            <div style={{
              fontSize: 22,
              fontWeight: 800,
              fontFamily: 'monospace',
              color: isPositive ? '#4ade80' : '#f87171',
              background: isPositive ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
              padding: '2px 12px',
              borderRadius: 6,
            }}>
              {changeStr}
            </div>
          </div>
        </div>

        {/* Sparkline chart area */}
        <div style={{ display: 'flex', flex: 1, padding: '12px 56px 0', alignItems: 'flex-end' }}>
          {displayPoints.length >= 2 ? (
            <svg
              width={chartW}
              height={chartH}
              viewBox={`0 0 ${chartW} ${chartH}`}
              style={{ overflow: 'visible' }}
            >
              {/* Gradient fill under line */}
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#fill)" />
              <path d={sparkPath} fill="none" stroke={lineColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {/* End dot */}
              {displayPoints.length > 0 && (() => {
                const values = displayPoints.map(p => p.value)
                const min = Math.min(...values)
                const max = Math.max(...values)
                const range = max - min || 1
                const last = displayPoints[displayPoints.length - 1]
                const cx = chartPad + ((displayPoints.length - 1) / (displayPoints.length - 1)) * (chartW - chartPad * 2)
                const cy = chartPad + (chartH - chartPad * 2) - ((last.value - min) / range) * (chartH - chartPad * 2)
                return <circle cx={cx} cy={cy} r="5" fill={lineColor} />
              })()}
            </svg>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: chartH, color: '#3f3f46', fontSize: 16 }}>
              No price history available
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 56px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
              VISION
            </div>
            <div style={{ width: 1, height: 16, background: '#3f3f46' }} />
            <div style={{ fontSize: 14, color: '#71717a', fontWeight: 500 }}>
              generalmarket.io
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {displayPoints.length >= 2 && (
              <div style={{ fontSize: 12, color: '#52525b', fontWeight: 600 }}>
                7-day history
              </div>
            )}
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: brandLight,
              background: `${brandColor}20`,
              padding: '6px 16px',
              borderRadius: 6,
            }}>
              Trade on Vision
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
