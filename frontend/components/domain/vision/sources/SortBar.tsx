'use client'

const SORT_OPTIONS = [
  { key: 'trending', label: 'Trending' },
  { key: 'new', label: 'New' },
  { key: 'most-assets', label: 'Most Assets' },
  { key: 'volume', label: 'Volume' },
] as const

interface SortBarProps {
  activeSort: string
  onSortChange: (sort: string) => void
}

export function SortBar({ activeSort, onSortChange }: SortBarProps) {
  return (
    <div className="sort-row">
      {SORT_OPTIONS.map(opt => (
        <button
          key={opt.key}
          onClick={() => onSortChange(opt.key)}
          className={`sort-btn ${activeSort === opt.key ? 'active' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
