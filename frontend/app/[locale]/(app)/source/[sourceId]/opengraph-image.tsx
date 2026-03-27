import { ImageResponse } from 'next/og'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import { getAaDataNodeUrl } from '@/lib/config'
import { getCategoryLabel } from '@/lib/vision/source-categories'
import { allInternalIds } from '@/lib/vision/source-ids'

export const runtime = 'nodejs'
export const alt = 'Vision Market Data'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Mover {
  name: string
  changePct: number
}

function solidColor(bg: string): string {
  if (bg.startsWith('#')) return bg
  const m = bg.match(/#[0-9a-fA-F]{3,8}/)
  return m ? m[0] : '#6366f1'
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
          return !isNaN(pct) && !isNaN(val) && val > 0 && Math.abs(pct) < 99.9
        })
        .map(s => ({
          name: cleanAssetName(String(s.name || s.symbol || s.assetId), prefixes),
          changePct: parseFloat(String(s.changePct)),
        }))
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
        .slice(0, 4)

      return { movers: parsed, total: snaps.length }
    }
  } catch { /* graceful fallback */ }
  return { movers: [], total: 0 }
}

export default async function OGImage({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params
  const source = await getSourceDisplayServer(sourceId)

  if (!source) {
    return new ImageResponse(
      <div style={{ display: 'flex', width: 1200, height: 630, background: '#09090b', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
        Source not found
      </div>,
      size,
    )
  }

  const { movers, total } = await getMovers(sourceId)
  const brand = solidColor(source.brandBg)
  const cat = getCategoryLabel(source.category)
  const logoPath = source.logo.replace(/\.webp$/, '.svg')
  const logo = logoPath.startsWith('http') ? logoPath : `https://www.generalmarket.io${logoPath}`
  const count = total > 0 ? total : source.prefixes.length

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 1200,
        height: 630,
        background: '#09090b',
        fontFamily: 'sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow — simple large circle, Satori-safe */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: -200,
          right: -200,
          width: 600,
          height: 600,
          borderRadius: 999,
          background: `${brand}08`,
        }}
      />

      {/* Top section — logo, name, meta */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          padding: '52px 64px 0',
          gap: 24,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: 16,
            background: '#18181b',
            border: `1px solid #27272a`,
            flexShrink: 0,
          }}
        >
          <img src={logo} width={48} height={48} style={{ borderRadius: 8 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Source name — big and bold */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: '#fafafa',
              letterSpacing: -1.5,
              lineHeight: 1.1,
            }}
          >
            {source.name.length > 24 ? source.name.slice(0, 23) + '\u2026' : source.name}
          </div>

          {/* Category + count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: 1.5,
                color: brand,
              }}
            >
              {cat}
            </div>
            <div
              style={{
                display: 'flex',
                width: 4,
                height: 4,
                borderRadius: 2,
                background: '#3f3f46',
              }}
            />
            <div style={{ fontSize: 14, color: '#71717a', fontWeight: 600 }}>
              {count} markets
            </div>
          </div>
        </div>
      </div>

      {/* Movers — hero pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          padding: '40px 64px 0',
          gap: 16,
          flex: 1,
        }}
      >
        {movers.map((m, i) => {
          const up = m.changePct >= 0
          const pctColor = up ? '#4ade80' : '#f87171'
          const pctBg = up ? '#4ade8012' : '#f8717112'
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: 260,
                height: 120,
                background: '#141416',
                border: '1px solid #27272a',
                borderRadius: 16,
                padding: '20px 24px',
              }}
            >
              {/* Market name */}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#a1a1aa',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                }}
              >
                {m.name.length > 22 ? m.name.slice(0, 21) + '\u2026' : m.name}
              </div>

              {/* Change % — the hero number */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: pctColor,
                    letterSpacing: -0.5,
                    lineHeight: 1,
                  }}
                >
                  {up ? '+' : ''}{m.changePct.toFixed(1)}%
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 11,
                    fontWeight: 700,
                    color: pctColor,
                    background: pctBg,
                    padding: '3px 8px',
                    borderRadius: 6,
                    textTransform: 'uppercase' as const,
                    letterSpacing: 0.5,
                  }}
                >
                  24h
                </div>
              </div>
            </div>
          )
        })}

        {/* If no movers, show market count */}
        {movers.length === 0 && (
          <div
            style={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              color: '#3f3f46',
            }}
          >
            {count} live markets
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 64px 36px',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: '#fafafa',
              letterSpacing: 2,
            }}
          >
            VISION
          </div>
          <div
            style={{
              display: 'flex',
              width: 1,
              height: 18,
              background: '#3f3f46',
            }}
          />
          <div style={{ fontSize: 15, color: '#52525b', fontWeight: 500 }}>
            generalmarket.io
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 14,
            fontWeight: 700,
            color: '#fafafa',
            background: brand,
            padding: '10px 24px',
            borderRadius: 10,
          }}
        >
          Trade predictions on anything
        </div>
      </div>
    </div>,
    size,
  )
}
