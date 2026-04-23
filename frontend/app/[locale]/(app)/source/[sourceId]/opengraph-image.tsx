import { ImageResponse } from 'next/og'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getAaDataNodeUrl } from '@/lib/config'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { allInternalIds } from '@/lib/vision/source-ids'
import { logoAsDataUrl } from '@/lib/og/logo'

export const runtime = 'nodejs'
export const alt = 'Vision Market Data'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Mover { name: string; changePct: number; value: number }

function solidColor(bg: string): string {
  if (bg.startsWith('#')) return bg
  const m = bg.match(/#[0-9a-fA-F]{3,8}/)
  return m ? m[0] : '#6366f1'
}

function fmtVal(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  if (n >= 1) return n.toFixed(1)
  return n.toFixed(4)
}

function cleanAssetName(name: string, prefixes: string[]): string {
  const lower = name.toLowerCase()
  for (const p of prefixes) {
    if (lower.startsWith(p)) return name.slice(p.length).replace(/_/g, ' ')
  }
  return name.replace(/_/g, ' ')
}

async function getMovers(sourceId: string): Promise<{ movers: Mover[]; total: number }> {
  try {
    for (const iid of allInternalIds(sourceId)) {
      const res = await fetch(
        `${getAaDataNodeUrl()}/vision/snapshot?source=${encodeURIComponent(iid)}&limit=200`,
        { signal: AbortSignal.timeout(6_000) },
      )
      if (!res.ok) continue
      const data = await res.json()
      const snaps: Array<Record<string, unknown>> = data.snapshots ?? []
      const source = await getSourceDisplayServer(sourceId)
      const prefixes = source?.prefixes ?? []
      const parsed = snaps
        .filter(s => {
          const pct = parseFloat(String(s.changePct))
          const val = parseFloat(String(s.value))
          return !isNaN(pct) && !isNaN(val) && val > 0 && Math.abs(pct) < 99.9 && String(s.name || '').length > 0
        })
        .map(s => ({
          name: cleanAssetName(String(s.name || s.symbol || s.assetId), prefixes),
          changePct: parseFloat(String(s.changePct)),
          value: parseFloat(String(s.value)),
        }))
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
        .slice(0, 5)
      // total = all non-zero markets, not the capped snapshot count
      const activeCount = snaps.filter(s => parseFloat(String(s.value)) > 0).length
      return { movers: parsed, total: activeCount }
    }
  } catch { /* graceful */ }
  return { movers: [], total: 0 }
}

export default async function OGImage({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params
  const source = await getSourceDisplayServer(sourceId)
  if (!source) {
    return new ImageResponse(
      <div style={{ display: 'flex', width: 1200, height: 630, background: '#09090b', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>Source not found</div>,
      size,
    )
  }

  const { movers, total: count } = await getMovers(sourceId)
  const brand = solidColor(source.brandBg)
  const cat = getCategoryLabel(source.category)
  const [logo, gmLogo] = await Promise.all([
    logoAsDataUrl(source.logo, 720),
    logoAsDataUrl('/logo.svg', 96),
  ])
  // What we measure — the hero label
  const measure = source.valueLabel.toUpperCase()
  const unit = source.valueUnit ? `(${source.valueUnit.toUpperCase()})` : ''

  return new ImageResponse(
    <div style={{ display: 'flex', width: 1200, height: 630 }}>
      {/* LEFT 600px: brand + logo */}
      <div style={{ display: 'flex', width: 600, height: 630, background: brand, alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        {logo && <img src={logo} width={540} height={540} style={{ objectFit: 'contain' }} />}
      </div>

      {/* RIGHT 600px: white panel */}
      <div style={{ display: 'flex', flexDirection: 'column', width: 600, height: 630, background: '#ffffff', padding: '32px 36px' }}>
        {/* Top bar: active markets + GM logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: '#a1a1aa' }}>
            Prediction Market
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {gmLogo && <img src={gmLogo} width={24} height={24} />}
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: '#18181b' }}>General Market</div>
          </div>
        </div>

        {/* Source name */}
        <div style={{ display: 'flex', fontSize: 46, fontWeight: 800, color: '#09090b', marginTop: 12 }}>
          {source.name}
        </div>

        {/* Measurement — the hero label */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: brand, letterSpacing: 1 }}>
            {measure}
          </div>
          {unit && (
            <div style={{ display: 'flex', fontSize: 14, fontWeight: 600, color: '#a1a1aa' }}>{unit}</div>
          )}
        </div>

        {/* Markets — trading feel: show direction + value */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20, flex: 1 }}>
          {movers.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0 8px', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: '#e4e4e7' }}>
              <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, color: '#a1a1aa', letterSpacing: 1 }}>PREDICT</div>
              <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, color: '#a1a1aa', letterSpacing: 1 }}>DIRECTION</div>
            </div>
          )}
          {movers.map((m, i) => {
            const up = m.changePct >= 0
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: '#f4f4f5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', fontSize: 18, fontWeight: 600, color: '#18181b' }}>
                    {m.name.length > 20 ? m.name.slice(0, 19) + '\u2026' : m.name}
                  </div>
                  <div style={{ display: 'flex', fontSize: 13, fontWeight: 600, color: '#a1a1aa' }}>
                    {fmtVal(m.value)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: up ? '#16a34a' : '#dc2626', width: 70, justifyContent: 'flex-end' }}>
                    {up ? '+' : ''}{m.changePct.toFixed(1)}%
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: up ? '#16a34a' : '#dc2626' }}>
                    {up ? (
                      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1L12 6H9V13H5V6H2L7 1Z" fill="white" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 13L2 8H5V1H9V8H12L7 13Z" fill="white" /></svg>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    size,
  )
}
