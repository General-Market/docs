'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import type { SectionProps } from '../SectionRenderer'
import type { EnrichedHolding } from '@/lib/itp-enrichment-types'

const PAGE_SIZE = 20

type SortKey = 'rank' | 'symbol' | 'weight' | 'price'
type SortDir = 'asc' | 'desc'

export function HoldingsTable({ enrichment }: SectionProps) {
  const holdings = enrichment?.holdings ?? []
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    const arr = holdings.map((h, i) => ({ ...h, rank: i + 1 }))
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'rank': cmp = a.rank - b.rank; break
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break
        case 'weight': cmp = a.weight - b.weight; break
        case 'price': cmp = a.price - b.price; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [holdings, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  const paged = sorted.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)

  if (holdings.length === 0) return null

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'symbol' ? 'asc' : 'desc')
    }
    setPage(1)
  }

  const SortHeader = ({ k, children, align }: { k: SortKey; children: React.ReactNode; align?: string }) => (
    <th
      className={`px-4 py-2.5 font-semibold text-text-secondary cursor-pointer hover:text-text-primary transition-colors select-none ${align || 'text-left'}`}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  )

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-4">
        Holdings
      </h2>
      <div className="bg-white border border-border-light rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border-light">
            <tr>
              <SortHeader k="rank">#</SortHeader>
              <SortHeader k="symbol">Asset</SortHeader>
              <SortHeader k="weight" align="text-right">Weight</SortHeader>
              <SortHeader k="price" align="text-right">Price</SortHeader>
            </tr>
          </thead>
          <tbody>
            {paged.map((h) => (
              <tr key={h.symbol} className="border-t border-border-light hover:bg-surface/50 transition-colors">
                <td className="px-4 py-2.5 text-text-muted font-mono text-xs">{h.rank}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    {h.image ? (
                      <Image
                        src={h.image}
                        alt={h.symbol}
                        width={24}
                        height={24}
                        className="rounded-full"
                        unoptimized
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-surface flex items-center justify-center text-[10px] font-bold text-text-muted">
                        {h.symbol[0]}
                      </div>
                    )}
                    <div>
                      <span className="font-semibold">{h.symbol}</span>
                      {h.name && h.name !== h.symbol && (
                        <span className="text-text-muted text-xs ml-1.5">{h.name}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {(h.weight * 100).toFixed(2)}%
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  ${h.price >= 1 ? h.price.toFixed(2) : h.price.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border-light bg-surface">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={clampedPage === 1}
              className="text-xs font-semibold text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-text-muted">
              Page {clampedPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={clampedPage === totalPages}
              className="text-xs font-semibold text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
