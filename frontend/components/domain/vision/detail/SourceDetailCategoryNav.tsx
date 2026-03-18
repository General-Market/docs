'use client'

import { useMemo } from 'react'
import { Link } from '@/i18n/routing'
import { SOURCE_CATEGORIES } from '@/lib/vision/source-categories'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'

interface SourceDetailCategoryNavProps {
  sourceCategory: string
}

export function SourceDetailCategoryNav({ sourceCategory }: SourceDetailCategoryNavProps) {
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
    { key: 'all', label: 'All', count: counts.all ?? 0 },
    ...categoryList.map(c => ({ key: c.key, label: c.label, count: counts[c.key] ?? 0 })),
  ], [categoryList, counts])

  return (
    <div className="border-b border-[var(--border)] bg-white">
      <div className="px-6 lg:px-12">
        <div
          className="max-w-site mx-auto flex items-center gap-1 h-11 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {pills.map(p => {
            const isActive = p.key === sourceCategory
            return (
              <Link
                key={p.key}
                href="/"
                className={`shrink-0 px-4 py-2 text-[13px] font-medium rounded transition-all whitespace-nowrap ${
                  isActive
                    ? 'text-black bg-surface font-semibold'
                    : 'text-text-secondary hover:text-black hover:bg-surface'
                }`}
              >
                {p.label} <span className="text-[11px] tabular-nums text-text-muted">{p.count}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
