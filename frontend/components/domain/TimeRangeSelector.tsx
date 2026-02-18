'use client'

/**
 * Time range options for performance graph
 */
export type TimeRange = '7d' | '30d' | '90d' | 'all'

/**
 * Props for TimeRangeSelector component
 */
export interface TimeRangeSelectorProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
}

/**
 * Time range button labels
 */
const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All' }
]

/**
 * TimeRangeSelector component (AC: 5)
 * Toggle buttons for selecting time range: 7d/30d/90d/All
 * Styled with Dev Arena theme (black bg, white/accent text)
 */
export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="inline-flex bg-terminal border border-white/20 rounded overflow-hidden">
      {RANGE_OPTIONS.map((option) => {
        const isSelected = value === option.value
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              px-3 py-1.5 font-mono text-sm transition-colors
              ${isSelected
                ? 'bg-white/10 text-white font-bold'
                : 'text-white/60 hover:text-white hover:bg-white/5'
              }
              ${option.value !== '7d' ? 'border-l border-white/20' : ''}
            `}
            aria-pressed={isSelected}
            aria-label={`Show ${option.label === 'All' ? 'all time' : `last ${option.label.toLowerCase()}`} data`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
