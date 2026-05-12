'use client'

/**
 * Subliminal motion layer. A single faint horizontal line drifts
 * top to bottom every 6s. Two percent opacity, one pixel — out
 * of focus until the eye decides to find it.
 */
export function FloorBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-x-0 h-px"
        style={{
          background: '#0071e3',
          opacity: 0.04,
          animation: 'floorScan 6s linear infinite',
        }}
      />
    </div>
  )
}
