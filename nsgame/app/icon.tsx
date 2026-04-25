import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Favicon — charcoal tile, uniform 8px corners, single teal lowercase n.
// Mirrors /public/brand/nsgame-icon.svg.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0F0F10',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#06B6D4',
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: -1,
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
