import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Apple touch icon — n monogram with red period anchor, larger canvas.
// iOS rounds the outer corners itself; we hold consistent inner geometry.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F0F10',
        }}
      >
        <svg width="180" height="180" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="12" width="32" height="8"  fill="#FAFAFA" />
          <rect x="10" y="20" width="8"  height="32" fill="#FAFAFA" />
          <rect x="34" y="20" width="8"  height="32" fill="#FAFAFA" />
          <rect x="46" y="44" width="8"  height="8"  fill="#DC2626" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
