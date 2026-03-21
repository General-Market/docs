'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'
import { SOURCE_CATEGORIES } from '@/lib/vision/source-categories'

interface CategoryNavProps {
  activeCategory: string
  onCategoryChange: (cat: string) => void
}

export function CategoryNav({ activeCategory, onCategoryChange }: CategoryNavProps) {
  const t = useTranslations('vision')
  const { sources, categories: apiCategories } = useSourceRegistry()

  // Build category counts from registry sources
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: sources.length }
    for (const source of sources) {
      result[source.category] = (result[source.category] ?? 0) + 1
    }
    return result
  }, [sources])

  // Use API categories when available, fall back to static list
  const categoryList = apiCategories.length > 0
    ? apiCategories.sort((a, b) => a.order - b.order)
    : SOURCE_CATEGORIES.map(c => ({ key: c.key, label: c.label, order: 0 }))

  const pills = useMemo(() => [
    { key: 'all', label: t('category_nav.all'), count: counts.all ?? 0 },
    ...categoryList.map(c => ({ key: c.key, label: c.label, count: counts[c.key] ?? 0 })),
  ], [categoryList, counts, t])

  return (
    <div className="border-b border-border-light bg-white">
      <div className="px-6 lg:px-12">
        <div
          className="max-w-site mx-auto flex items-center gap-0.5 h-12 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {pills.map(p => {
            const isActive = activeCategory === p.key
            return (
              <button
                key={p.key}
                onClick={() => onCategoryChange(p.key)}
                className={`shrink-0 px-4 py-1.5 text-caption rounded transition-all whitespace-nowrap ${
                  isActive
                    ? 'text-black bg-black/[0.06] font-bold'
                    : 'text-text-muted font-medium hover:text-black hover:bg-black/[0.03]'
                }`}
              >
                {p.label}
                <span className="text-label font-mono tabular-nums text-text-muted/60 ml-1">{p.count}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
