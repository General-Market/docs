import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'General Market — On-chain Index Products'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
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
        {/* Subtle grid background */}
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

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: '#FAFAFA',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            General Market
          </h1>
          <p
            style={{
              fontSize: '28px',
              color: 'rgba(250,250,250,0.7)',
              margin: 0,
            }}
          >
            The institutional-grade protocol for on-chain index products
          </p>
          <div
            style={{
              display: 'flex',
              gap: '40px',
              marginTop: '40px',
              color: 'rgba(250,250,250,0.4)',
              fontSize: '18px',
            }}
          >
            <span>Create Indices</span>
            <span style={{ color: 'rgba(250,250,250,0.2)' }}>|</span>
            <span>Trade ITPs</span>
            <span style={{ color: 'rgba(250,250,250,0.2)' }}>|</span>
            <span>Earn Yield</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
