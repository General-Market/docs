import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const alt = 'nsgame — 1-click trading on Solana'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '44px', height: '44px', background: 'white', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 900, color: '#09090b',
          }}>
            n
          </div>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em' }}>
            nsgame
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            fontSize: '64px', fontWeight: 900, color: 'white',
            lineHeight: 1.05, letterSpacing: '-0.03em',
            maxWidth: '900px',
          }}>
            1-click trading on Solana
          </div>
          <div style={{
            fontSize: '24px', color: '#a1a1aa', fontWeight: 400,
            lineHeight: 1.4, maxWidth: '700px',
          }}>
            Session-wallet prediction market. Real on-chain transactions, parimutuel payouts.
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #27272a',
          paddingTop: '24px',
        }}>
          <span style={{ fontSize: '14px', color: '#52525b', fontWeight: 500 }}>
            nsgame.io
          </span>
        </div>
      </div>
    ),
    { ...size },
  )
}
