'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import type { VisionSource, SourceCategory } from '@/lib/vision/sources'
import type { SourceCategoryInfo } from '@/lib/vision/source-categories'

interface DataExplorerClientProps {
  sources: VisionSource[]
  categories: SourceCategoryInfo[]
  categoryCounts: Record<SourceCategory | 'all', number>
}

export default function DataExplorerClient({
  sources,
  categories,
  categoryCounts,
}: DataExplorerClientProps) {
  const [activeCategory, setActiveCategory] = useState<SourceCategory | 'all'>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let result = sources
    if (activeCategory !== 'all') {
      result = result.filter(s => s.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q),
      )
    }
    return result
  }, [sources, activeCategory, search])

  return (
    <>
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sources..."
          className="w-full max-w-md px-4 py-2.5 border border-border-light rounded-lg bg-white text-[14px] text-black placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-black/10 transition-shadow"
        />
      </div>

      {/* Category filter buttons */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
            activeCategory === 'all'
              ? 'bg-black text-white'
              : 'bg-white border border-border-light text-text-secondary hover:border-black hover:text-black'
          }`}
        >
          All ({categoryCounts.all})
        </button>
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
              activeCategory === cat.key
                ? 'bg-black text-white'
                : 'bg-white border border-border-light text-text-secondary hover:border-black hover:text-black'
            }`}
          >
            {cat.label} ({categoryCounts[cat.key]})
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-[13px] text-text-muted font-semibold mb-4">
        {filtered.length} source{filtered.length !== 1 ? 's' : ''}
        {activeCategory !== 'all' && (
          <span> in {categories.find(c => c.key === activeCategory)?.label}</span>
        )}
        {search.trim() && (
          <span>
            {' '}matching &ldquo;{search.trim()}&rdquo;
          </span>
        )}
      </p>

      {/* Source grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(source => {
          const brandStyle: React.CSSProperties = source.brandBg.startsWith('linear-gradient')
            ? { background: source.brandBg }
            : { backgroundColor: source.brandBg }

          return (
            <Link
              key={source.id}
              href={`/source/${source.id}`}
              className="bg-white rounded-xl border border-border-light overflow-hidden hover:shadow-md hover:border-black/15 transition-all group"
            >
              {/* Logo area */}
              <div
                className="relative h-24 flex items-center justify-center"
                style={brandStyle}
              >
                <Image
                  src={source.logo}
                  alt={source.name}
                  width={160}
                  height={40}
                  loading="lazy"
                  className="max-h-[40px] max-w-[65%] object-contain"
                />
                <span className="absolute top-2 right-2 text-[9px] font-bold tracking-[0.06em] uppercase px-1.5 py-0.5 rounded bg-black/50 text-white/90 backdrop-blur-sm">
                  {categories.find(c => c.key === source.category)?.label ?? source.category}
                </span>
              </div>

              {/* Card body */}
              <div className="p-4">
                <h3 className="text-[15px] font-bold text-black group-hover:underline">
                  {source.name}
                </h3>
                <p className="text-[12px] text-text-secondary leading-relaxed mt-1 line-clamp-2">
                  {source.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[16px] font-bold text-black">No sources found</p>
          <p className="text-[14px] text-text-secondary mt-1">
            Try adjusting your search or category filter.
          </p>
        </div>
      )}
    </>
  )
}
