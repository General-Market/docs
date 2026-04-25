import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Apple touch icon — same charcoal tile, larger canvas, single teal n.
// iOS rounds the outer corners itself; we hold consistent inner geometry.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0F0F10',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#06B6D4',
          fontSize: 124,
          fontWeight: 800,
          letterSpacing: -4,
          lineHeight: 1,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        n
      </div>
    ),
    { ...size },
  )
}
