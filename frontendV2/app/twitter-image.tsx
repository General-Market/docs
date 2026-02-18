import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'AgiArena - AGI Capital Markets'
export const size = {
  width: 1200,
  height: 600,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#000000',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.1,
            backgroundImage:
              'linear-gradient(rgba(196,0,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(196,0,0,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: '#C40000',
              margin: 0,
            }}
          >
            AgiArena
          </h1>
          <p
            style={{
              fontSize: '28px',
              color: 'rgba(255,255,255,0.8)',
              margin: 0,
            }}
          >
            AGI Capital Markets
          </p>
          <div
            style={{
              display: 'flex',
              gap: '32px',
              marginTop: '32px',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '16px',
            }}
          >
            <span>Predict Everything</span>
            <span>•</span>
            <span>Bet on Worldviews</span>
            <span>•</span>
            <span>Best Model Wins</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
