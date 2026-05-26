'use client'

// Last-resort boundary: only renders if the root layout itself throws, which
// is outside every provider (no Tailwind, no fonts, no i18n guaranteed). So it
// is fully self-contained with inline styles — a clean page instead of a white
// screen, even when everything else is gone.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          color: '#1D1D1F',
          fontFamily:
            '"SF Pro Display", "SF Pro Text", Inter, "Helvetica Neue", Arial, sans-serif',
          letterSpacing: '-0.022em',
          padding: '24px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, margin: 0, color: '#000' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 17, color: '#6e6e73', marginTop: 12 }}>
            The page hit a snag. It has been logged. Try again, or head back.
          </p>
          <div
            style={{
              marginTop: 36,
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => reset()}
              style={{
                padding: '12px 24px',
                background: '#000',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: '12px 24px',
                background: '#fff',
                color: '#000',
                fontWeight: 700,
                fontSize: 14,
                border: '1px solid #e4e4e7',
                textDecoration: 'none',
              }}
            >
              Back to General Market
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
