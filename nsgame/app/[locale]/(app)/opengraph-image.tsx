import { ImageResponse } from 'next/og'
import { getAaDataNodeUrl } from '@/lib/config'

export const runtime = 'nodejs'
export const alt = 'General Market — Prediction Markets for Everything'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function getStats(): Promise<{ sources: number; markets: number; volume: string }> {
  try {
    const res = await fetch(`${getAaDataNodeUrl()}/vision/snapshot/meta`, {
      signal: AbortSignal.timeout(4_000),
    })
    if (!res.ok) return { sources: 60, markets: 300_000, volume: '$1.2M' }
    const d = await res.json()
    const vol = (d.totalVolume ?? 0) / 1e18
    return {
      sources: d.activeSources ?? 60,
      markets: d.totalAssets ?? 300_000,
      volume: vol >= 1e6 ? `$${(vol / 1e6).toFixed(1)}M` : vol >= 1e3 ? `$${(vol / 1e3).toFixed(0)}K` : `$${vol.toFixed(0)}`,
    }
  } catch {
    return { sources: 60, markets: 300_000, volume: '$1.2M' }
  }
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K+`
  return String(n)
}

export default async function Image() {
  const stats = await getStats()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px 60px',
          background: 'linear-gradient(145deg, #09090b 0%, #18181b 50%, #09090b 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top: Logo + brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '44px', height: '44px', background: 'white', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 900, color: '#09090b',
          }}>
            G
          </div>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em' }}>
            General Market
          </span>
        </div>

        {/* Center: Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            fontSize: '64px', fontWeight: 900, color: 'white',
            lineHeight: 1.05, letterSpacing: '-0.03em',
            maxWidth: '900px',
          }}>
            Prediction Markets for Everything
          </div>
          <div style={{
            fontSize: '24px', color: '#a1a1aa', fontWeight: 400,
            lineHeight: 1.4, maxWidth: '700px',
          }}>
            From crypto prices to train delays. Bet on real-world data, settled by oracles every 5 minutes.
          </div>
        </div>

        {/* Bottom: Stats bar */}
        <div style={{
          display: 'flex', gap: '48px', borderTop: '1px solid #27272a',
          paddingTop: '24px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>
              {fmtCount(stats.markets)}
            </span>
            <span style={{ fontSize: '14px', color: '#71717a', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Markets
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#fafafa', letterSpacing: '-0.02em' }}>
              {stats.sources}
            </span>
            <span style={{ fontSize: '14px', color: '#71717a', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Data Sources
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#fafafa', letterSpacing: '-0.02em' }}>
              5min
            </span>
            <span style={{ fontSize: '14px', color: '#71717a', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Settlement
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '14px', color: '#52525b', fontWeight: 500, marginTop: 'auto' }}>
              generalmarket.io
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
