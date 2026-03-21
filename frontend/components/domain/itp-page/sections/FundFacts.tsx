'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import type { SectionProps } from '../SectionRenderer'

function asOfToday() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function FundFacts({ itpId, symbol, nav, assetCount, createdAt, enrichment }: SectionProps) {
  const t = useTranslations('markets.itp_page')
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
    const hhiLabel = hhi < 1500 ? t('concentration.low') : hhi < 2500 ? t('concentration.moderate') : t('concentration.high')
    const avgMcap = holdings.reduce((s, h) => s + (h.market_cap ?? 0), 0) / holdings.length
    return { top5, top10, hhi, hhiLabel, avgMcap }
  }, [enrichment, t])

  const leftFacts = [
    { label: t('fund_facts.nav_per_share'), value: nav > 0 ? `$${nav.toFixed(4)}` : '—', asOf: true },
    { label: t('fund_facts.chain'), value: t('fund_facts.chain_value') },
    {
      label: t('fund_facts.settlement_address'),
      value: truncate(INDEX_PROTOCOL.settlementCustody),
      full: INDEX_PROTOCOL.settlementCustody,
      copyable: true,
    },
    { label: t('fund_facts.rebalance_method'), value: t('fund_facts.rebalance_value') },
  ]

  const rightFacts = [
    { label: t('fund_facts.fund_inception'), value: inceptionDate },
    { label: t('fund_facts.asset_class'), value: t('fund_facts.asset_class_value') },
    {
      label: t('fund_facts.itp_id'),
      value: truncate(itpId),
      full: itpId,
      copyable: true,
    },
    { label: t('fund_facts.number_of_holdings'), value: assetCount > 0 ? `${assetCount}` : '—' },
  ]

  type Fact = { label: string; value: string; full?: string; copyable?: boolean; asOf?: boolean }

  const FactRow = ({ f }: { f: Fact }) => (
    <div className="flex justify-between py-3 border-b border-border-light">
      <div>
        <span className="text-sm text-text-secondary">{f.label}</span>
        {f.asOf && <div className="text-micro text-text-muted">{t('fund_facts.as_of', { date: asOfToday() })}</div>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-text-primary text-right">{f.value}</span>
        {f.copyable && (
          <button
            onClick={() => copyToClipboard(f.full!, f.label)}
            className="text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            {copied === f.label ? t('fund_facts.copied') : t('fund_facts.copy')}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <section className="py-8">
      <h2 className="text-2xl font-bold text-text-primary mb-6">{t('fund_facts.title')}</h2>

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
          <h3 className="text-xl font-bold text-text-primary mt-10 mb-4">{t('fund_facts.portfolio_characteristics')}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16">
            <div>
              <div className="flex justify-between py-3 border-b border-border-light">
                <span className="text-sm text-text-secondary">{t('fund_facts.top_5_concentration')}</span>
                <span className="text-sm font-semibold text-text-primary">{concentration.top5.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-3 border-b border-border-light">
                <span className="text-sm text-text-secondary">{t('fund_facts.top_10_concentration')}</span>
                <span className="text-sm font-semibold text-text-primary">{concentration.top10.toFixed(1)}%</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between py-3 border-b border-border-light">
                <span className="text-sm text-text-secondary">{t('fund_facts.hhi_index')}</span>
                <span className="text-sm font-semibold text-text-primary">{Math.round(concentration.hhi)} ({concentration.hhiLabel})</span>
              </div>
              <div className="flex justify-between py-3 border-b border-border-light">
                <span className="text-sm text-text-secondary">{t('fund_facts.average_market_cap')}</span>
                <span className="text-sm font-semibold text-text-primary">{formatMcap(concentration.avgMcap)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Fees */}
      <h3 className="text-xl font-bold text-text-primary mt-10 mb-2">{t('fund_facts.fees')}</h3>
      <p className="text-xs text-text-muted mb-4">{t('fund_facts.fees_as_of')}</p>
      <div className="max-w-lg">
        <div className="flex justify-between py-3 border-b border-border-light">
          <span className="text-sm text-text-secondary">{t('fund_facts.management_fee')}</span>
          <span className="text-sm font-semibold text-text-primary">0.00%</span>
        </div>
        <div className="flex justify-between py-3 border-b border-border-light">
          <span className="text-sm text-text-secondary">{t('fund_facts.acquired_fund_fees')}</span>
          <span className="text-sm font-semibold text-text-primary">0.00%</span>
        </div>
        <div className="flex justify-between py-3 border-b border-border-light">
          <span className="text-sm text-text-secondary">{t('fund_facts.other_expenses')}</span>
          <span className="text-sm font-semibold text-text-primary">0.00%</span>
        </div>
        <div className="flex justify-between py-3 border-t-2 border-text-primary">
          <span className="text-sm font-bold text-text-primary">{t('fund_facts.expense_ratio')}</span>
          <span className="text-sm font-bold text-text-primary">0.00%</span>
        </div>
      </div>
      <p className="text-micro text-text-muted mt-3">
        {t('fund_facts.fee_disclaimer')}
      </p>
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
