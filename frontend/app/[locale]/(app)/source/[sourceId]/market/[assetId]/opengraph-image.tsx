import { ImageResponse } from 'next/og'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getAaDataNodeUrl } from '@/lib/config'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { allInternalIds } from '@/lib/vision/source-ids'
import { logoAsDataUrl } from '@/lib/og/logo'

export const runtime = 'nodejs'
export const alt = 'Vision Market'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface PricePoint { value: number }
interface Candle { open: number; close: number; high: number; low: number }

function fmtPrice(v: string | number, currency: boolean): string {
  const n = typeof v === 'number' ? v : parseFloat(v)
  if (isNaN(n)) return '--'
  const p = currency ? '$' : ''
  if (n >= 1e9) return `${p}${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${p}${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${p}${(n / 1e3).toFixed(2)}K`
  if (n >= 1) return `${p}${n.toFixed(2)}`
  return `${p}${n.toFixed(4)}`
}

function solidColor(bg: string): string {
  if (bg.startsWith('#')) return bg
  const m = bg.match(/#[0-9a-fA-F]{3,8}/)
  return m ? m[0] : '#6366f1'
}

function cleanName(name: string, prefixes: string[]): string {
  const lower = name.toLowerCase()
  for (const p of prefixes) {
    if (lower.startsWith(p)) return name.slice(p.length).replace(/_/g, ' ')
  }
  return name.replace(/_/g, ' ')
}

async function fetchHistory(sourceId: string, assetId: string): Promise<PricePoint[]> {
  try {
    const now = new Date()
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    for (const iid of allInternalIds(sourceId)) {
      const url = `${getAaDataNodeUrl()}/market/prices/${encodeURIComponent(iid)}/${encodeURIComponent(assetId)}/history?from=${from.toISOString()}&to=${now.toISOString()}`
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
      if (!res.ok) continue
      const data = await res.json()
      const raw: PricePoint[] = (data.prices ?? []).map((p: Record<string, unknown>) => ({
        value: typeof p.value === 'string' ? parseFloat(p.value as string) : (p.value as number),
      }))
      // Downsample immediately if huge — we only need ~200 points max for candles
      if (raw.length > 500) {
        const step = Math.ceil(raw.length / 500)
        const sampled = raw.filter((_, i) => i % step === 0 || i === raw.length - 1)
        if (sampled.length > 0) return sampled
      }
      if (raw.length > 0) return raw
    }
  } catch { /* graceful */ }
  return []
}

async function fetchCurrent(sourceId: string, assetId: string): Promise<{ value: string; changePct: string | null; name: string } | null> {
  try {
    for (const iid of allInternalIds(sourceId)) {
      const res = await fetch(
        `${getAaDataNodeUrl()}/vision/snapshot?source=${encodeURIComponent(iid)}&limit=500`,
        { signal: AbortSignal.timeout(6_000) },
      )
      if (!res.ok) continue
      const raw = await res.json()
      const found = (raw.snapshots ?? []).find((s: Record<string, unknown>) => s.assetId === assetId)
      if (found) return { value: String(found.value ?? '0'), changePct: found.changePct != null ? String(found.changePct) : null, name: String(found.name ?? '') }
    }
  } catch { /* graceful */ }
  return null
}

function toCandles(points: PricePoint[], n: number): Candle[] {
  if (points.length < 2) return []
  const bucketSize = Math.max(1, Math.floor(points.length / n))
  const candles: Candle[] = []
  for (let i = 0; i < points.length; i += bucketSize) {
    const slice = points.slice(i, i + bucketSize)
    if (slice.length === 0) continue
    const vals = slice.map(p => p.value)
    candles.push({ open: vals[0], close: vals[vals.length - 1], high: Math.max(...vals), low: Math.min(...vals) })
  }
  return candles.slice(0, n)
}

function candlePaths(candles: Candle[], w: number, h: number, pad: number): { greenBodies: string; redBodies: string; greenWicks: string; redWicks: string; globalMin: number; globalMax: number; minY: number; maxY: number } {
  const empty = { greenBodies: '', redBodies: '', greenWicks: '', redWicks: '', globalMin: 0, globalMax: 0, minY: 0, maxY: 0 }
  if (candles.length === 0) return empty
  const allVals = candles.flatMap(c => [c.high, c.low])
  const min = Math.min(...allVals)
  const max = Math.max(...allVals)
  const range = max - min || 1
  const innerW = w - pad * 2
  const innerH = h - pad * 2
  const barW = Math.max(4, (innerW / candles.length) * 0.55)
  const gap = innerW / candles.length

  let greenBodies = '', redBodies = '', greenWicks = '', redWicks = ''
  let minY = pad, maxY = pad + innerH

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const cx = pad + gap * i + gap / 2
    const yHigh = pad + innerH - ((c.high - min) / range) * innerH
    const yLow = pad + innerH - ((c.low - min) / range) * innerH
    const yOpen = pad + innerH - ((c.open - min) / range) * innerH
    const yClose = pad + innerH - ((c.close - min) / range) * innerH
    const up = c.close >= c.open
    const bodyTop = Math.min(yOpen, yClose)
    const bodyH = Math.max(2, Math.abs(yOpen - yClose))

    const wick = `M${cx.toFixed(1)},${yHigh.toFixed(1)} L${cx.toFixed(1)},${yLow.toFixed(1)} `
    const x = cx - barW / 2
    const body = `M${x.toFixed(1)},${bodyTop.toFixed(1)} h${barW.toFixed(1)} v${bodyH.toFixed(1)} h${(-barW).toFixed(1)} Z `

    if (up) { greenWicks += wick; greenBodies += body }
    else { redWicks += wick; redBodies += body }
  }

  // Y positions for min/max labels
  maxY = pad // max is at top
  minY = pad + innerH // min is at bottom

  return { greenBodies, redBodies, greenWicks, redWicks, globalMin: min, globalMax: max, minY, maxY }
}

export default async function OGImage({ params }: { params: Promise<{ sourceId: string; assetId: string }> }) {
  const { sourceId, assetId } = await params
  const decoded = decodeURIComponent(assetId)
  const source = await getSourceDisplayServer(sourceId)
  if (!source) {
    return new ImageResponse(
      <div style={{ display: 'flex', width: 1200, height: 630, background: '#fff', color: '#000', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>Market not found</div>,
      size,
    )
  }

  const [history, current, logo, gmLogo] = await Promise.all([
    fetchHistory(sourceId, decoded),
    fetchCurrent(sourceId, decoded),
    logoAsDataUrl(source.logo, 720),
    logoAsDataUrl('/logo.svg', 96),
  ])
  const brand = solidColor(source.brandBg)
  const cat = getCategoryLabel(source.category)

  const marketName = cleanName(current?.name || decoded, source.prefixes)
  const priceStr = current ? fmtPrice(current.value, source.isPrice) : '--'
  const changePct = current?.changePct ? parseFloat(current.changePct) : null
  const changeStr = changePct != null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '--'
  const isUp = changePct == null || changePct >= 0

  const candles = toCandles(history, 28)
  const chartW = 520
  const chartH = 300
  const paths = candlePaths(candles, chartW, chartH, 16)
  const minLabel = fmtPrice(paths.globalMin, source.isPrice)
  const maxLabel = fmtPrice(paths.globalMax, source.isPrice)

  return new ImageResponse(
    <div style={{ display: 'flex', width: 1200, height: 630 }}>
      {/* LEFT 600px: source brand + large logo */}
      <div style={{ display: 'flex', width: 600, height: 630, background: brand, alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        {logo && <img src={logo} width={540} height={540} style={{ objectFit: 'contain' }} />}
      </div>

      {/* RIGHT 600px: white panel — market data + chart */}
      <div style={{ display: 'flex', flexDirection: 'column', width: 600, height: 630, background: '#ffffff', padding: '28px 32px' }}>
        {/* Top bar: category + GM logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: '#a1a1aa', letterSpacing: 1.5 }}>
            PREDICTION MARKET
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {gmLogo && <img src={gmLogo} width={24} height={24} />}
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: '#18181b' }}>General Market</div>
          </div>
        </div>

        {/* Market name — huge */}
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: '#09090b', marginTop: 12 }}>
          {marketName.length > 20 ? marketName.slice(0, 19) + '\u2026' : marketName}
        </div>

        {/* Chart with min/max labels */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
          {candles.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {/* Y-axis labels */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: chartH, width: 70, paddingRight: 8 }}>
                <div style={{ display: 'flex', fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{maxLabel}</div>
                <div style={{ display: 'flex', fontSize: 15, fontWeight: 800, color: '#dc2626' }}>{minLabel}</div>
              </div>
              {/* Chart */}
              <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
                <line x1="16" y1={chartH * 0.25} x2={chartW - 16} y2={chartH * 0.25} stroke="#f4f4f5" strokeWidth="1" />
                <line x1="16" y1={chartH * 0.5} x2={chartW - 16} y2={chartH * 0.5} stroke="#f4f4f5" strokeWidth="1" />
                <line x1="16" y1={chartH * 0.75} x2={chartW - 16} y2={chartH * 0.75} stroke="#f4f4f5" strokeWidth="1" />
                <path d={paths.greenWicks} fill="none" stroke="#16a34a" strokeWidth="1.5" />
                <path d={paths.redWicks} fill="none" stroke="#dc2626" strokeWidth="1.5" />
                <path d={paths.greenBodies} fill="#16a34a" />
                <path d={paths.redBodies} fill="#dc2626" />
              </svg>
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: 16, color: '#a1a1aa' }}>No history available</div>
          )}
        </div>

        {/* Bottom data bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: '#e4e4e7', paddingTop: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, color: '#a1a1aa', letterSpacing: 1 }}>CURRENT</div>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#09090b' }}>{priceStr}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, color: '#a1a1aa', letterSpacing: 1 }}>24H</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 4, background: isUp ? '#16a34a' : '#dc2626' }} />
              <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: isUp ? '#16a34a' : '#dc2626' }}>{changeStr}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, color: '#a1a1aa', letterSpacing: 1 }}>7D</div>
            <div style={{ display: 'flex', fontSize: 15, fontWeight: 600, color: '#71717a' }}>{history.length} points</div>
          </div>
        </div>
      </div>
    </div>,
    size,
  )
}
