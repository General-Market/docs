'use client'

import { useMemo } from 'react'

interface HeatmapHeaderProps {
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

/** Map a market ID to a color based on synthetic change */
function marketColor(id: string): string {
  const h = hashStr(id)
  const change = ((h % 1600) - 800) / 100 // -8 to +8

  if (change >= 0) {
    // Green shades: higher change = more saturated
    const intensity = Math.min(change / 8, 1)
    const lightness = Math.round(95 - intensity * 50) // 95 (pale) to 45 (deep)
    return `hsl(142, 72%, ${lightness}%)`
  } else {
    // Red shades: larger drop = more saturated
    const intensity = Math.min(Math.abs(change) / 8, 1)
    const lightness = Math.round(95 - intensity * 50)
    return `hsl(0, 72%, ${lightness}%)`
  }
}

export function HeatmapHeader({ marketIds }: HeatmapHeaderProps) {
  const cells = useMemo(() => {
    return marketIds.map((id) => ({
      id,
      color: marketColor(id),
    }))
  }, [marketIds])

  // Calculate grid dimensions to fit within 64px height
  const count = cells.length
  // Aim for roughly square cells
  const cols = Math.ceil(Math.sqrt(count * 4)) // wider than tall
  const rows = Math.ceil(count / cols)
  const cellSize = Math.min(
    Math.floor(280 / cols),
    Math.floor(56 / Math.max(rows, 1))
  )
  const actualCellSize = Math.max(cellSize, 4)

  return (
    <div className="h-16 bg-surface rounded mb-3 flex items-center justify-center overflow-hidden">
      <div
        className="heatmap-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${actualCellSize}px)`,
          gap: '1px',
        }}
      >
        {cells.map((cell, i) => (
          <div
            key={cell.id}
            className="heatmap-cell rounded-[1px]"
            style={{
              width: actualCellSize,
              height: actualCellSize,
              backgroundColor: cell.color,
              animationDelay: `${i * 15}ms`,
            }}
            title={cell.id}
          />
        ))}
      </div>

      <style jsx>{`
        .heatmap-cell {
          opacity: 0;
          transform: scale(0);
          animation: heatmap-pop 0.3s ease-out forwards;
        }
        @keyframes heatmap-pop {
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )
}
