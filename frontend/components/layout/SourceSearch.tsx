'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from '@/i18n/routing'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'
import { useSourceStats } from '@/hooks/useSourceStats'
import Image from 'next/image'
import { SearchIcon } from './apple-icons'

type SearchResult = {
  sourceId: string
  name: string
  category: string
  settlements: number
}

const MAX_RESULTS_TYPING = 8

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

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

/** Round logo. Apple's circle treatment: registry image, neutral fallback. */
function ResultLogo({ sourceId, name }: { sourceId: string; name: string }) {
  const [broken, setBroken] = useState(false)
  if (!broken) {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-7 shrink-0 overflow-hidden rounded-full"
        style={{ background: '#f5f5f7' }}
      >
        <Image
          src={`/source-imgs/icons/${sourceId}.png`}
          alt=""
          width={28}
          height={28}
          className="object-cover"
          unoptimized
          onError={() => setBroken(true)}
        />
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-full font-semibold"
      style={{
        background: '#f5f5f7',
        color: 'var(--apple-text)',
        fontSize: 12,
      }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export function SourceSearch() {
  const router = useRouter()
  const { sources } = useSourceRegistry()
  const { byId: statsById } = useSourceStats()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement | null>(null)

  // Settlement count per display source = SUM(market_count) across the
  // source's internalIds, matching the topbar's global definition. While
  // the oracle still serves the old API without `settledMarkets`, fall
  // back to `settledBatches` so the ranking stays sensible.
  const settlementsBySource = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sources) {
      const ids = s.internalIds?.length ? s.internalIds : [s.sourceId]
      let total = 0
      for (const id of ids) {
        const row = statsById.get(id.toLowerCase())
        total += row?.settledMarkets || row?.settledBatches || 0
      }
      m.set(s.sourceId, total)
    }
    return m
  }, [sources, statsById])

  const results: SearchResult[] = useMemo(() => {
    const trimmed = q.trim()
    const decorate = (s: typeof sources[number]): SearchResult => ({
      sourceId: s.sourceId,
      name: s.name,
      category: s.category,
      settlements: settlementsBySource.get(s.sourceId) ?? 0,
    })
    if (!trimmed) {
      // Browse mode: every source, ranked by lifetime settlement count desc.
      // Ties fall back to alphabetical so the list is stable when stats lag.
      return [...sources]
        .map(decorate)
        .sort((a, b) => {
          if (b.settlements !== a.settlements) return b.settlements - a.settlements
          return a.name.localeCompare(b.name)
        })
    }
    return sources
      .map((s) => ({
        ...decorate(s),
        score: Math.max(fuzzyScore(s.name, trimmed), fuzzyScore(s.category, trimmed)),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return b.settlements - a.settlements
      })
      .slice(0, MAX_RESULTS_TYPING)
      .map(({ sourceId, name, category, settlements }) => ({
        sourceId,
        name,
        category,
        settlements,
      }))
  }, [q, sources, settlementsBySource])

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

  const showHeader = open && !q.trim() && results.length > 0

  return (
    <div ref={ref} className="relative w-full">
      <div
        className="flex items-center gap-2 px-3 h-9 rounded-apple-pill"
        style={{ background: 'rgba(0,0,0,0.04)' }}
      >
        <SearchIcon
          className="w-4 h-4 shrink-0"
          style={{ color: 'var(--apple-text-tertiary)' }}
        />
        <input
          type="search"
          value={q}
          placeholder="Search asset name or source"
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className="flex-1 bg-transparent outline-none border-0"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 15,
            letterSpacing: 'var(--apple-track-tighter)',
            color: 'var(--apple-text)',
          }}
          aria-label="Search sources"
        />
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-apple-md border overflow-hidden z-50 max-h-[480px] overflow-y-auto"
          style={{
            background: 'var(--apple-panel)',
            borderColor: 'var(--apple-line)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
          }}
        >
          {showHeader && (
            <div
              className="px-3 pt-2 pb-1 sticky top-0"
              style={{
                background: 'var(--apple-panel)',
                fontSize: 11,
                letterSpacing: '0.04em',
                color: 'var(--apple-text-tertiary)',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              All markets
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={r.sourceId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(r.sourceId)}
              onMouseEnter={() => setActive(i)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
              style={{
                background: i === active ? 'rgba(0,0,0,0.04)' : 'transparent',
              }}
            >
              <ResultLogo sourceId={r.sourceId} name={r.name} />
              <span
                className="flex-1 truncate"
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 14,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text)',
                  fontWeight: 500,
                }}
              >
                {r.name}
              </span>
              <span
                className="flex items-center gap-2 shrink-0"
                style={{
                  fontSize: 11,
                  color: 'var(--apple-text-tertiary)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                <span>{r.category}</span>
                {r.settlements > 0 && (
                  <span
                    title={`${r.settlements.toLocaleString()} settlements`}
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--apple-text-secondary)',
                      fontWeight: 500,
                    }}
                  >
                    {compactNumber.format(r.settlements)}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
