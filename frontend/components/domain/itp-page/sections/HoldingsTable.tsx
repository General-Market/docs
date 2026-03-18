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

function formatUsd(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`
  if (v >= 1) return `$${v.toFixed(2)}`
  if (v > 0) return `$${v.toFixed(4)}`
  return '$0.00'
}

type SortKey = 'rank' | 'name' | 'weight' | 'price' | 'change_24h' | 'market_cap' | 'market_value' | 'notional' | 'quantity'
type SortDir = 'asc' | 'desc'

export function HoldingsTable({ enrichment, nav, aum }: SectionProps) {
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
    const arr = filtered.map((h, i) => {
      const marketValue = aum > 0 ? h.weight * aum : 0
      const quantity = h.price > 0 ? (h.weight * (aum > 0 ? aum : 1)) / h.price : 0
      return { ...h, rank: i + 1, marketValue, notional: marketValue, quantity }
    })
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'rank': cmp = a.rank - b.rank; break
        case 'name': cmp = (a.name || a.symbol).localeCompare(b.name || b.symbol); break
        case 'weight': cmp = a.weight - b.weight; break
        case 'price': cmp = a.price - b.price; break
        case 'change_24h': cmp = (a.change_24h ?? 0) - (b.change_24h ?? 0); break
        case 'market_cap': cmp = (a.market_cap ?? 0) - (b.market_cap ?? 0); break
        case 'market_value': cmp = a.marketValue - b.marketValue; break
        case 'notional': cmp = a.notional - b.notional; break
        case 'quantity': cmp = a.quantity - b.quantity; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, sortDir, aum])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  const paged = sorted.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)
  const startIdx = (clampedPage - 1) * PAGE_SIZE + 1
  const endIdx = Math.min(clampedPage * PAGE_SIZE, sorted.length)

  if (holdings.length === 0) {
    return (
      <section className="py-8">
        <h2 className="text-2xl font-bold text-text-primary mb-2">Holdings</h2>
        <p className="text-sm text-text-muted">Holdings data loading...</p>
      </section>
    )
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
    setPage(1)
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const SortHeader = ({ k, children, align, className: cx }: { k: SortKey; children: React.ReactNode; align?: string; className?: string }) => (
    <th
      className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary cursor-pointer hover:text-text-primary transition-colors select-none ${align || 'text-left'} ${cx || ''}`}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k && <span className="text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  )

  return (
    <section className="py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Holdings</h2>
          <p className="text-xs text-text-muted mt-0.5">as of {asOfToday()}</p>
        </div>
        <input
          type="text"
          placeholder="Filter by name or ticker..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="border border-border-light rounded px-3 py-1.5 text-sm w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-text-muted"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-surface border-b border-border-light">
            <tr>
              <SortHeader k="rank">#</SortHeader>
              <SortHeader k="name">Name</SortHeader>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary text-left">Sector</th>
              <SortHeader k="weight" align="text-right">Weight</SortHeader>
              <SortHeader k="price" align="text-right">Price</SortHeader>
              <SortHeader k="change_24h" align="text-right">24h</SortHeader>
              <SortHeader k="market_value" align="text-right" className="hidden lg:table-cell">Market Value</SortHeader>
              <SortHeader k="notional" align="text-right" className="hidden lg:table-cell">Notional Value</SortHeader>
              <SortHeader k="quantity" align="text-right" className="hidden xl:table-cell">Shares</SortHeader>
              <SortHeader k="market_cap" align="text-right" className="hidden lg:table-cell">Market Cap</SortHeader>
            </tr>
          </thead>
          <tbody>
            {paged.map((h) => (
              <tr key={h.symbol} className="border-b border-border-light hover:bg-surface transition-colors">
                <td className="px-3 py-2.5 text-text-muted font-mono text-xs">{h.rank}</td>
                <td className="px-3 py-2.5">
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
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-text-muted">
                        {h.symbol[0]}
                      </div>
                    )}
                    <div>
                      <span className="font-semibold text-text-primary">{h.name && h.name !== h.symbol ? h.name : h.symbol}</span>
                      {h.name && h.name !== h.symbol && (
                        <span className="text-text-muted text-xs ml-1.5">{h.symbol}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-text-secondary text-xs">Cryptocurrency</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-primary">
                  {(h.weight * 100).toFixed(2)}%
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-primary">
                  ${h.price >= 1 ? h.price.toFixed(2) : h.price.toFixed(4)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {h.change_24h != null ? (
                    <span className={h.change_24h >= 0 ? 'text-color-up' : 'text-color-down'}>
                      {h.change_24h >= 0 ? '+' : ''}{h.change_24h.toFixed(2)}%
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-primary hidden lg:table-cell">
                  {h.marketValue > 0 ? formatUsd(h.marketValue) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-secondary hidden lg:table-cell">
                  {h.notional > 0 ? formatUsd(h.notional) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-secondary hidden xl:table-cell">
                  {h.quantity > 0 ? h.quantity.toFixed(6) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-text-secondary hidden lg:table-cell">
                  {formatMcap(h.market_cap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-3 border-t border-border-light">
          <span className="text-xs text-text-secondary">
            {startIdx} to {endIdx} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={clampedPage === 1}
              className="px-3 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
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
                      ? 'bg-text-primary text-text-inverse'
                      : 'text-text-secondary hover:bg-muted'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={clampedPage === totalPages}
              className="px-3 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
