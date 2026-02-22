import { ImageResponse } from 'next/og'
import { getItpDetail } from '@/lib/api/server-data'

export const runtime = 'edge'

export const alt = 'General Market ITP'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ itpId: string }> }) {
  const { itpId } = await params
  const itp = await getItpDetail(itpId)

  const name = itp?.name || 'ITP'
  const symbol = itp?.symbol || ''
  const nav = itp?.nav ? `$${itp.nav.toFixed(4)}` : ''
  const assetCount = itp?.assetCount || 0

  return new ImageResponse(
    (
      <div
        style={{
          background: '#09090B',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.05,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <p style={{ fontSize: '24px', color: 'rgba(250,250,250,0.4)', margin: 0 }}>
            General Market
          </p>
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color: '#FAFAFA',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {name}
          </h1>
          {symbol && (
            <p style={{ fontSize: '28px', color: 'rgba(250,250,250,0.5)', margin: 0 }}>
              ${symbol}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              gap: '60px',
              marginTop: '40px',
            }}
          >
            {nav && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', color: 'rgba(250,250,250,0.3)' }}>NAV</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#FAFAFA' }}>{nav}</span>
              </div>
            )}
            {assetCount > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', color: 'rgba(250,250,250,0.3)' }}>Assets</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#FAFAFA' }}>{assetCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
