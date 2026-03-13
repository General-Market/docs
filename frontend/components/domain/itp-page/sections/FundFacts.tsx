'use client'

import { useState, useMemo } from 'react'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import type { SectionProps } from '../SectionRenderer'

function asOfToday() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function FundFacts({ itpId, symbol, nav, assetCount, createdAt, enrichment }: SectionProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const truncate = (s: string) => s.length > 16 ? `${s.slice(0, 8)}...${s.slice(-6)}` : s

  const inceptionDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'

  // Portfolio characteristics from enrichment
  const concentration = useMemo(() => {
    const holdings = enrichment?.holdings ?? []
    if (holdings.length === 0) return null
    const sorted = [...holdings].sort((a, b) => b.weight - a.weight)
    const top5 = sorted.slice(0, 5).reduce((s, h) => s + h.weight, 0) * 100
    const top10 = sorted.slice(0, 10).reduce((s, h) => s + h.weight, 0) * 100
    const hhi = sorted.reduce((s, h) => s + Math.pow(h.weight * 100, 2), 0)
    const hhiLabel = hhi < 1500 ? 'Low' : hhi < 2500 ? 'Moderate' : 'High'
    const avgMcap = holdings.reduce((s, h) => s + (h.market_cap ?? 0), 0) / holdings.length
    return { top5, top10, hhi, hhiLabel, avgMcap }
  }, [enrichment])

  const leftFacts = [
    { label: 'NAV / Share', value: nav > 0 ? `$${nav.toFixed(4)}` : '—', asOf: true },
    { label: 'Chain', value: 'Index L3 (Orbit)' },
    {
      label: 'Settlement Address',
      value: truncate(INDEX_PROTOCOL.settlementCustody),
      full: INDEX_PROTOCOL.settlementCustody,
      copyable: true,
    },
    { label: 'Rebalance Method', value: 'Equal Weight' },
  ]

  const rightFacts = [
    { label: 'Fund Inception', value: inceptionDate },
    { label: 'Asset Class', value: 'Crypto Index' },
    {
      label: 'ITP ID',
      value: truncate(itpId),
      full: itpId,
      copyable: true,
    },
    { label: 'Number of Holdings', value: assetCount > 0 ? `${assetCount}` : '—' },
  ]

  type Fact = { label: string; value: string; full?: string; copyable?: boolean; asOf?: boolean }

  const FactRow = ({ f }: { f: Fact }) => (
    <div className="flex justify-between py-3 border-b border-gray-100">
      <div>
        <span className="text-sm text-gray-600">{f.label}</span>
        {f.asOf && <div className="text-[10px] text-gray-400">as of {asOfToday()}</div>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900 text-right">{f.value}</span>
        {f.copyable && (
          <button
            onClick={() => copyToClipboard(f.full!, f.label)}
            className="text-xs text-gray-400 hover:text-gray-900 transition-colors"
          >
            {copied === f.label ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <section className="py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Fund Details</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16">
        <div>
          {leftFacts.map(f => <FactRow key={f.label} f={f} />)}
        </div>
        <div>
          {rightFacts.map(f => <FactRow key={f.label} f={f} />)}
        </div>
      </div>

      {/* Portfolio Characteristics */}
      {concentration && (
        <>
          <h3 className="text-xl font-bold text-gray-900 mt-10 mb-4">Portfolio Characteristics</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16">
            <div>
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">Top 5 Concentration</span>
                <span className="text-sm font-semibold text-gray-900">{concentration.top5.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">Top 10 Concentration</span>
                <span className="text-sm font-semibold text-gray-900">{concentration.top10.toFixed(1)}%</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">HHI Index</span>
                <span className="text-sm font-semibold text-gray-900">{Math.round(concentration.hhi)} ({concentration.hhiLabel})</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">Average Market Cap</span>
                <span className="text-sm font-semibold text-gray-900">{formatMcap(concentration.avgMcap)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Fees */}
      <h3 className="text-xl font-bold text-gray-900 mt-10 mb-4">Fees</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16">
        <div className="flex justify-between py-3 border-b border-gray-100">
          <span className="text-sm text-gray-600">Management Fee</span>
          <span className="text-sm font-semibold text-gray-900">0.00%</span>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2">Network gas costs apply to all transactions.</p>
    </section>
  )
}

function formatMcap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}
