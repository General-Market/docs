'use client'
import { useTranslations } from 'next-intl'

const SORT_KEYS = ['trending', 'new', 'most-assets', 'volume'] as const

interface SortBarProps {
  activeSort: string
  onSortChange: (sort: string) => void
}

export function SortBar({ activeSort, onSortChange }: SortBarProps) {
  const t = useTranslations('vision')
  const SORT_LABELS: Record<string, string> = {
    'trending': t('sort_bar.trending'),
    'new': t('sort_bar.new'),
    'most-assets': t('sort_bar.most_assets'),
    'volume': t('sort_bar.volume'),
  }
  return (
    <div className="sort-row fluid-btn-group">
      {SORT_KEYS.map(key => (
        <button
          key={key}
          onClick={() => onSortChange(key)}
          className={`sort-btn fluid-press ${activeSort === key ? 'active' : ''}`}
        >
          {SORT_LABELS[key]}
        </button>
      ))}
    </div>
  )
}
