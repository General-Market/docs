import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Favicon — n monogram with red period anchor. Mirrors /public/brand/nsgame-icon.svg.
export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <svg width="32" height="32" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="12" ry="12" fill="#0F0F10" />
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
