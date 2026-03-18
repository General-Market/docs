'use client'

import { useMemo, useState } from 'react'

// ── Types ──

export interface HistoryBucket {
  hour: string
  recordCount: number
  uniqueAssets: number
  zeroCount: number
}

interface SourceHistoryChartProps {
  buckets: HistoryBucket[]
}

// ── Helpers ──

function formatHourLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCHours().toString().padStart(2, '0')}:00`
}

// ── Component ──

export function SourceHistoryChart({ buckets }: SourceHistoryChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const maxCount = useMemo(
    () => Math.max(1, ...buckets.map(b => b.recordCount)),
    [buckets]
  )

  if (buckets.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-text-muted text-sm">
        No history data available
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Chart area */}
      <div className="flex items-end gap-[2px] h-32">
        {buckets.map((bucket, i) => {
          const totalPct = (bucket.recordCount / maxCount) * 100
          const zeroPct =
            bucket.recordCount > 0
              ? (bucket.zeroCount / bucket.recordCount) * totalPct
              : 0
          const normalPct = totalPct - zeroPct

          return (
            <div
              key={bucket.hour}
              className="flex-1 flex flex-col justify-end h-full relative cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Tooltip */}
              {hoveredIndex === i && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 pointer-events-none">
                  <div className="bg-surface-dark text-white text-[10px] font-mono rounded px-2 py-1.5 whitespace-nowrap shadow-md">
                    <div className="font-bold">{formatHourLabel(bucket.hour)}</div>
                    <div>Records: {bucket.recordCount.toLocaleString()}</div>
                    <div>Assets: {bucket.uniqueAssets}</div>
                    {bucket.zeroCount > 0 && (
                      <div className="text-color-down">Zeros: {bucket.zeroCount}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Bar stack: normal (green) + zeros (red) */}
              <div className="w-full flex flex-col justify-end">
                {zeroPct > 0 && (
                  <div
                    className="w-full bg-color-down/70 rounded-t-sm"
                    style={{ height: `${(zeroPct / 100) * 128}px` }}
                  />
                )}
                <div
                  className={`w-full bg-color-up/60 ${zeroPct > 0 ? '' : 'rounded-t-sm'} transition-opacity ${hoveredIndex === i ? 'opacity-100' : 'opacity-80'}`}
                  style={{ height: `${(normalPct / 100) * 128}px`, minHeight: bucket.recordCount > 0 ? '2px' : '0px' }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex gap-[2px] mt-1">
        {buckets.map((bucket, i) => (
          <div
            key={bucket.hour}
            className="flex-1 text-center text-[8px] font-mono text-text-muted leading-none truncate"
          >
            {/* Show label every 3rd hour to avoid crowding */}
            {i % 3 === 0 ? formatHourLabel(bucket.hour) : ''}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-color-up/60 inline-block" />
          Records
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-color-down/70 inline-block" />
          Zero-value
        </span>
      </div>
    </div>
  )
}
