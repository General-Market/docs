'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import type { SectionProps } from '../SectionRenderer'

const PAGE_SIZE = 20

function asOfToday() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMcap(v?: number): string {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

type SortKey = 'rank' | 'symbol' | 'weight' | 'price' | 'change_24h' | 'market_cap'
type SortDir = 'asc' | 'desc'

export function HoldingsTable({ enrichment }: SectionProps) {
  const holdings = enrichment?.holdings ?? []
  const [sortKey, setSortKey] = useState<SortKey>('weight')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return holdings
    const q = search.toLowerCase()
    return holdings.filter(h =>
      h.symbol.toLowerCase().includes(q) ||
      (h.name && h.name.toLowerCase().includes(q))
    )
  }, [holdings, search])

  const sorted = useMemo(() => {
    const arr = filtered.map((h, i) => ({ ...h, rank: i + 1 }))
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'rank': cmp = a.rank - b.rank; break
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break
        case 'weight': cmp = a.weight - b.weight; break
        case 'price': cmp = a.price - b.price; break
        case 'change_24h': cmp = (a.change_24h ?? 0) - (b.change_24h ?? 0); break
        case 'market_cap': cmp = (a.market_cap ?? 0) - (b.market_cap ?? 0); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  const paged = sorted.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)
  const startIdx = (clampedPage - 1) * PAGE_SIZE + 1
  const endIdx = Math.min(clampedPage * PAGE_SIZE, sorted.length)

  if (holdings.length === 0) {
    return (
      <section className="py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Holdings</h2>
        <p className="text-sm text-gray-400">Holdings data loading...</p>
      </section>
    )
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'symbol' ? 'asc' : 'desc')
    }
    setPage(1)
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const SortHeader = ({ k, children, align }: { k: SortKey; children: React.ReactNode; align?: string }) => (
    <th
      className={`px-4 py-2.5 text-xs font-semibold uppercase text-gray-500 cursor-pointer hover:text-gray-900 transition-colors select-none ${align || 'text-left'}`}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  )

  return (
    <section className="py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Holdings</h2>
          <p className="text-xs text-gray-400 mt-0.5">as of {asOfToday()}</p>
        </div>
        <input
          type="text"
          placeholder="Filter list by keyword..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
      </div>

      <div className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader k="rank">#</SortHeader>
              <SortHeader k="symbol">Asset</SortHeader>
              <SortHeader k="weight" align="text-right">Weight</SortHeader>
              <SortHeader k="price" align="text-right">Price</SortHeader>
              <SortHeader k="change_24h" align="text-right">24h</SortHeader>
              <SortHeader k="market_cap" align="text-right hidden lg:table-cell">Market Cap</SortHeader>
            </tr>
          </thead>
          <tbody>
            {paged.map((h) => (
              <tr key={h.symbol} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{h.rank}</td>
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
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400">
                        {h.symbol[0]}
                      </div>
                    )}
                    <div>
                      <span className="font-semibold text-gray-900">{h.symbol}</span>
                      {h.name && h.name !== h.symbol && (
                        <span className="text-gray-400 text-xs ml-1.5">{h.name}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-900">
                  {(h.weight * 100).toFixed(2)}%
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-900">
                  ${h.price >= 1 ? h.price.toFixed(2) : h.price.toFixed(4)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {h.change_24h != null ? (
                    <span className={h.change_24h >= 0 ? 'text-color-up' : 'text-color-down'}>
                      {h.change_24h >= 0 ? '+' : ''}{h.change_24h.toFixed(2)}%
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-500 hidden lg:table-cell">
                  {formatMcap(h.market_cap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">
              {startIdx} to {endIdx} of {sorted.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={clampedPage === 1}
                className="px-3 py-1 text-xs font-semibold text-gray-500 hover:text-gray-900 disabled:opacity-30 transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = clampedPage <= 3 ? i + 1
                  : clampedPage >= totalPages - 2 ? totalPages - 4 + i
                  : clampedPage - 2 + i
                if (pageNum < 1 || pageNum > totalPages) return null
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-7 h-7 text-xs font-semibold rounded transition-colors ${
                      clampedPage === pageNum
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={clampedPage === totalPages}
                className="px-3 py-1 text-xs font-semibold text-gray-500 hover:text-gray-900 disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
