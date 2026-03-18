'use client'

import { useState } from 'react'
import type { SimStats } from '@/hooks/useSimulation'

const SWEEP_COLORS = [
  '#4ade80', '#f87171', '#60a5fa', '#fbbf24', '#a78bfa',
  '#34d399', '#fb923c', '#818cf8',
]

interface VariantEntry {
  label: string
  runId: number
  stats: SimStats
}

interface SimVariantLegendProps {
  variants: VariantEntry[]
  onDeployIndex?: (runId: number, label: string) => void
}

export function SimVariantLegend({ variants, onDeployIndex }: SimVariantLegendProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!variants.length) return null

  return (
    <div className="border border-border-light rounded-xl bg-card p-3 space-y-0.5">
      <div className="text-xs font-medium uppercase tracking-widest text-text-muted mb-1">Variants</div>
      {variants.map((v, i) => {
        const color = SWEEP_COLORS[i % SWEEP_COLORS.length]
        const ret = v.stats.total_return_pct
        const isHovered = hoveredIdx === i

        return (
          <div
            key={v.label}
            className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted transition-colors group"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-text-primary truncate flex-1">
              {v.label}
            </span>
            <span className={`text-xs font-mono tabular-nums flex-shrink-0 ${ret >= 0 ? 'text-color-up' : 'text-color-down'}`}>
              {ret >= 0 ? '+' : ''}{ret.toFixed(1)}%
            </span>

            {isHovered && onDeployIndex && (
              <button
                className="text-[10px] font-medium px-2 py-0.5 bg-zinc-900 text-white rounded hover:bg-zinc-800 transition-colors flex-shrink-0 whitespace-nowrap"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeployIndex(v.runId, v.label)
                }}
              >
                Deploy Index
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
