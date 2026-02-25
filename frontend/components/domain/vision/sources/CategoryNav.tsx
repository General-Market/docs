'use client'

import { useMemo } from 'react'
import type { SourceCategory } from '@/lib/vision/sources'
import { SOURCE_CATEGORIES } from '@/lib/vision/source-categories'
import { getCategoryCounts } from '@/lib/vision/source-categories'

interface CategoryNavProps {
  activeCategory: SourceCategory | 'all'
  onCategoryChange: (cat: SourceCategory | 'all') => void
}

export function CategoryNav({ activeCategory, onCategoryChange }: CategoryNavProps) {
  const counts = useMemo(() => getCategoryCounts(), [])

  const pills: { key: SourceCategory | 'all'; label: string; count: number }[] = useMemo(() => {
    return [
      { key: 'all' as const, label: 'All', count: counts.all },
      ...SOURCE_CATEGORIES.map(c => ({
        key: c.key,
        label: c.label,
        count: counts[c.key] ?? 0,
      })),
    ]
  }, [counts])

  return (
    <div className="border-b border-[var(--border)] bg-white">
      <div className="px-6 lg:px-12">
        <div
          className="max-w-site mx-auto flex items-center gap-1 h-11 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {pills.map(p => {
            const isActive = activeCategory === p.key
            return (
              <button
                key={p.key}
                onClick={() => onCategoryChange(p.key)}
                className={`shrink-0 px-4 py-2 text-[13px] font-medium rounded transition-all whitespace-nowrap ${
                  isActive
                    ? 'text-black bg-surface font-semibold'
                    : 'text-text-secondary hover:text-black hover:bg-surface'
                }`}
              >
                {p.label} <span className="text-[11px] tabular-nums text-text-muted">{p.count}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
