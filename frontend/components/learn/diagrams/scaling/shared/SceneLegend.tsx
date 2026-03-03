'use client'

/**
 * SceneLegend — shared legend component for 3D article scenes.
 *
 * Renders color swatches with labels at a readable size.
 * Replaces the per-scene Legend functions that used text-[10px] / w-3 h-2.
 *
 * Usage:
 *   <SceneLegend items={[
 *     { color: '#8b5cf6', label: 'Validation' },
 *     { color: '#22c55e', label: 'Execution' },
 *   ]} />
 */

export interface LegendItem {
  color: string
  label: string
}

export function SceneLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className="w-4 h-3 rounded-[3px] shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-[13px] text-text-secondary font-medium tracking-wide whitespace-nowrap">
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
