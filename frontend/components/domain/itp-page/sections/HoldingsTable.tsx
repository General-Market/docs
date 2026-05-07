'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import type { SectionProps } from '../SectionRenderer'

const PAGE_SIZE = 20

function asOfToday(locale?: string) {
  return new Date().toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
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

const sectionTitleStyle = {
  fontFamily: 'var(--apple-font-display)',
  fontSize: 'clamp(24px, 2.4vw, 32px)',
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-tight)',
  color: 'var(--apple-text)',
  margin: 0,
} as const

const subTextStyle = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: '12px',
  color: 'var(--apple-text-tertiary)',
  letterSpacing: 'var(--apple-track-tight)',
  marginTop: 4,
}

const headerCellStyle = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: 'var(--apple-track-loose)',
  color: 'var(--apple-text-tertiary)',
  padding: '12px 14px',
  cursor: 'pointer',
  userSelect: 'none' as const,
  background: 'var(--apple-panel-2)',
  borderBottom: '1px solid var(--apple-line)',
}

const cellStyle = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 'var(--apple-fs-14)',
  letterSpacing: 'var(--apple-track-tight)',
  color: 'var(--apple-text)',
  padding: '12px 14px',
}

export function HoldingsTable({ enrichment, nav, aum, assetCount }: SectionProps) {
  const t = useTranslations('markets.itp_page.holdings_table')
  const locale = useLocale()
  const holdings = enrichment?.holdings ?? []
  const [sortKey, setSortKey] = useState<SortKey>('weight')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tableRevealed, setTableRevealed] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = tableRef.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTableRevealed(true); obs.disconnect() }
    }, { threshold: 0.05 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

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
        <h2 style={sectionTitleStyle}>{t('title')}</h2>
        <p style={subTextStyle}>{t('loading')}</p>
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

  const SortHeader = ({ k, children, align, hideClass }: { k: SortKey; children: React.ReactNode; align?: 'left' | 'right'; hideClass?: string }) => (
    <th
      className={hideClass}
      style={{ ...headerCellStyle, textAlign: align ?? 'left' }}
      onClick={() => toggleSort(k)}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        {sortKey === k && <span style={{ fontSize: 9, color: 'var(--apple-text-secondary)' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  )

  return (
    <section className="py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h2 style={sectionTitleStyle}>{t('title')}</h2>
          <p style={subTextStyle}>{t('as_of', { date: asOfToday(locale) })}</p>
        </div>
        <input
          type="text"
          placeholder={t('filter_placeholder')}
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full sm:w-72"
          style={{
            background: 'var(--apple-panel)',
            border: '1px solid var(--apple-line)',
            borderRadius: 'var(--apple-r-sm)',
            padding: '8px 12px',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-14)',
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text)',
            outline: 'none',
          }}
        />
      </div>

      <div
        ref={tableRef}
        className="overflow-x-auto"
        style={{
          border: '1px solid var(--apple-line)',
          borderRadius: 'var(--apple-r-md)',
          background: 'var(--apple-panel)',
        }}
      >
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <SortHeader k="rank">{t('rank')}</SortHeader>
              <SortHeader k="name">{t('name')}</SortHeader>
              <th className="hidden sm:table-cell" style={{ ...headerCellStyle, textAlign: 'left' }}>{t('sector')}</th>
              <SortHeader k="weight" align="right">{t('weight')}</SortHeader>
              <SortHeader k="price" align="right">{t('price')}</SortHeader>
              <SortHeader k="change_24h" align="right">{t('change_24h')}</SortHeader>
              <SortHeader k="market_value" align="right" hideClass="hidden lg:table-cell">{t('market_value')}</SortHeader>
              <SortHeader k="notional" align="right" hideClass="hidden lg:table-cell">{t('notional_value')}</SortHeader>
              <SortHeader k="quantity" align="right" hideClass="hidden xl:table-cell">{t('shares')}</SortHeader>
              <SortHeader k="market_cap" align="right" hideClass="hidden lg:table-cell">{t('market_cap')}</SortHeader>
            </tr>
          </thead>
          <tbody>
            {paged.map((h, rowIdx) => (
              <tr
                key={h.symbol}
                className="animate-row-in"
                style={{
                  borderTop: '1px solid var(--apple-line)',
                  '--row-i': rowIdx,
                  animationPlayState: tableRevealed ? 'running' : 'paused',
                } as React.CSSProperties}
              >
                <td style={{ ...cellStyle, color: 'var(--apple-text-tertiary)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{h.rank}</td>
                <td style={cellStyle}>
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
                      <div
                        className="flex items-center justify-center"
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'var(--apple-panel-2)',
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--apple-text-secondary)',
                        }}
                      >
                        {h.symbol[0]}
                      </div>
                    )}
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--apple-text)' }}>{h.name && h.name !== h.symbol ? h.name : h.symbol}</span>
                      {h.name && h.name !== h.symbol && (
                        <span style={{ color: 'var(--apple-text-tertiary)', fontSize: 12, marginLeft: 6 }}>{h.symbol}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="hidden sm:table-cell" style={{ ...cellStyle, color: 'var(--apple-text-secondary)', fontSize: 12 }}>{t('cryptocurrency')}</td>
                <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {(h.weight * 100).toFixed(2)}%
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ${h.price >= 1 ? h.price.toFixed(2) : h.price.toFixed(4)}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {h.change_24h != null ? (
                    <span style={{ color: h.change_24h >= 0 ? '#16a34a' : '#dc2626' }}>
                      {h.change_24h >= 0 ? '+' : ''}{h.change_24h.toFixed(2)}%
                    </span>
                  ) : '—'}
                </td>
                <td className="hidden lg:table-cell" style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {h.marketValue > 0 ? formatUsd(h.marketValue) : '—'}
                </td>
                <td className="hidden lg:table-cell" style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--apple-text-secondary)' }}>
                  {h.notional > 0 ? formatUsd(h.notional) : '—'}
                </td>
                <td className="hidden xl:table-cell" style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--apple-text-secondary)' }}>
                  {h.quantity > 0 ? h.quantity.toFixed(6) : '—'}
                </td>
                <td className="hidden lg:table-cell" style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--apple-text-secondary)' }}>
                  {formatMcap(h.market_cap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div
          className="flex items-center justify-between"
          style={{
            padding: '14px 4px',
            marginTop: 4,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: 'var(--apple-text-secondary)',
              letterSpacing: 'var(--apple-track-tight)',
            }}
          >
            {t('range', { start: startIdx, end: endIdx, total: sorted.length })}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={clampedPage === 1}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: 'none',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-14)',
                fontWeight: 500,
                color: clampedPage === 1 ? 'var(--apple-text-tertiary)' : 'var(--apple-accent, #0071e3)',
                cursor: clampedPage === 1 ? 'default' : 'pointer',
                opacity: clampedPage === 1 ? 0.5 : 1,
              }}
            >
              {t('previous')}
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = clampedPage <= 3 ? i + 1
                : clampedPage >= totalPages - 2 ? totalPages - 4 + i
                : clampedPage - 2 + i
              if (pageNum < 1 || pageNum > totalPages) return null
              const active = clampedPage === pageNum
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--apple-r-sm)',
                    background: active ? 'var(--apple-accent, #0071e3)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--apple-text-secondary)',
                    border: 'none',
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 150ms var(--apple-ease-default)',
                  }}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={clampedPage === totalPages}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: 'none',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-14)',
                fontWeight: 500,
                color: clampedPage === totalPages ? 'var(--apple-text-tertiary)' : 'var(--apple-accent, #0071e3)',
                cursor: clampedPage === totalPages ? 'default' : 'pointer',
                opacity: clampedPage === totalPages ? 0.5 : 1,
              }}
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
