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
 * Styled with institutional theme
 */
export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="inline-flex bg-card border border-border-medium rounded-lg overflow-hidden">
      {RANGE_OPTIONS.map((option) => {
        const isSelected = value === option.value
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              px-3 py-1.5 text-sm transition-colors
              ${isSelected
                ? 'bg-muted text-text-primary font-bold'
                : 'text-text-muted hover:text-text-primary hover:bg-card-hover'
              }
              ${option.value !== '7d' ? 'border-l border-border-medium' : ''}
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
