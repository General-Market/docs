'use client'

import { useMemo } from 'react'

interface BarGridHeaderProps {
  marketIds: string[]
}

/** Hash string to number */
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Generate a synthetic percentage change for a market */
function syntheticChange(id: string): number {
  const h = hashStr(id)
  // Produces a value between -8 and +8
  return ((h % 1600) - 800) / 100
}

export function BarGridHeader({ marketIds }: BarGridHeaderProps) {
  const bars = useMemo(() => {
    return marketIds.map((id) => {
      const change = syntheticChange(id)
      const absChange = Math.abs(change)
      // Normalize bar height: max height = 48px, min = 4px
      const maxChange = 8
      const height = Math.max(4, (absChange / maxChange) * 48)
      const isUp = change >= 0
      return { id, change, height, isUp }
    })
  }, [marketIds])

  const barWidth = Math.max(6, Math.min(16, Math.floor(280 / marketIds.length)))
  const gap = Math.max(1, Math.min(3, Math.floor(8 / Math.max(marketIds.length / 6, 1))))

  return (
    <div className="h-16 bg-surface rounded mb-3 flex items-end justify-center px-2 overflow-hidden pb-1">
      {bars.map((bar, i) => (
        <div
          key={bar.id}
          className="bar-animate flex flex-col items-center"
          style={{
            marginLeft: i === 0 ? 0 : gap,
          }}
        >
          <div
            className="rounded-t-sm transition-all"
            style={{
              width: barWidth,
              height: bar.height,
              backgroundColor: bar.isUp ? '#16A34A' : '#DC2626',
              opacity: 0.7 + Math.min(bar.height / 48, 1) * 0.3,
              animationDelay: `${i * 40}ms`,
            }}
          />
        </div>
      ))}

      <style jsx>{`
        .bar-animate > div {
          transform: scaleY(0);
          transform-origin: bottom;
          animation: bar-grow 0.4s ease-out forwards;
        }
        @keyframes bar-grow {
          to {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  )
}
