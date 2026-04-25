import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Apple touch icon — geometric n monogram, teal on charcoal, larger canvas.
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
          <rect x="16" y="14" width="32" height="12" fill="#06B6D4" />
          <rect x="16" y="14" width="12" height="36" fill="#06B6D4" />
          <rect x="36" y="18" width="12" height="32" fill="#06B6D4" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
