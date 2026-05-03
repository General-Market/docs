'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from '@/i18n/routing'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'
import { SearchIcon } from './apple-icons'

type SearchResult = {
  sourceId: string
  name: string
  category: string
}

function fuzzyScore(haystack: string, needle: string): number {
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase().trim()
  if (!n) return 0
  if (h === n) return 1000
  if (h.startsWith(n)) return 500
  if (h.includes(n)) return 200
  let hi = 0
  let score = 0
  for (let ni = 0; ni < n.length; ni++) {
    const idx = h.indexOf(n[ni], hi)
    if (idx === -1) return 0
    score += 10 - Math.min(9, idx - hi)
    hi = idx + 1
  }
  return score
}

export function SourceSearch() {
  const router = useRouter()
  const { sources } = useSourceRegistry()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement | null>(null)

  const results: SearchResult[] = useMemo(() => {
    if (!q.trim()) return []
    return sources
      .map((s) => ({
        sourceId: s.sourceId,
        name: s.name,
        category: s.category,
        score: Math.max(fuzzyScore(s.name, q), fuzzyScore(s.category, q)),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ sourceId, name, category }) => ({ sourceId, name, category }))
  }, [q, sources])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function go(sourceId: string) {
    router.push(`/source/${sourceId}` as never)
    setOpen(false)
    setQ('')
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      go(results[active].sourceId)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative w-full">
      <div
        className="flex items-center gap-2 px-3 h-9 rounded-apple-sm border"
        style={{
          background: 'var(--apple-surface)',
          borderColor: 'var(--apple-border)',
        }}
      >
        <SearchIcon
          className="w-4 h-4 shrink-0"
          style={{ color: 'var(--apple-text-tertiary)' }}
        />
        <input
          type="search"
          value={q}
          placeholder="Search sources"
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className="flex-1 bg-transparent outline-none border-0"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-14)',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text)',
          }}
          aria-label="Search sources"
        />
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-apple-md border overflow-hidden z-50"
          style={{
            background: 'var(--apple-bg)',
            borderColor: 'var(--apple-border)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
          }}
        >
          {results.map((r, i) => (
            <button
              key={r.sourceId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(r.sourceId)}
              onMouseEnter={() => setActive(i)}
              className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors"
              style={{
                background: i === active ? 'var(--apple-surface)' : 'transparent',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 'var(--apple-fs-14)',
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text)',
                  fontWeight: 500,
                }}
              >
                {r.name}
              </span>
              <span
                style={{
                  fontSize: 'var(--apple-fs-12)',
                  color: 'var(--apple-text-tertiary)',
                  letterSpacing: 'var(--apple-track-loose)',
                  textTransform: 'uppercase',
                }}
              >
                {r.category}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
