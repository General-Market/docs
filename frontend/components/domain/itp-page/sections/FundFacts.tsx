'use client'

import { useState, useMemo, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { encodeFunctionData, decodeFunctionResult } from 'viem'
import { INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { L3_RPC_URL } from '@/lib/config'
import type { SectionProps } from '../SectionRenderer'

function asOfToday(locale?: string) {
  return new Date().toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function FundFacts({ itpId, symbol, nav, assetCount, createdAt, enrichment }: SectionProps) {
  const t = useTranslations('markets.itp_page')
  const locale = useLocale()
  const [copied, setCopied] = useState<string | null>(null)
  const [creatorAddress, setCreatorAddress] = useState<string | null>(null)

  // Fetch creator address from L3 on mount
  useEffect(() => {
    let cancelled = false
    async function fetchCreator() {
      try {
        const calldata = encodeFunctionData({
          abi: INDEX_ABI,
          functionName: 'getITPState',
          args: [itpId as `0x${string}`],
        })
        const res = await fetch(L3_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'eth_call', params: [{ to: INDEX_PROTOCOL.index, data: calldata }, 'latest'] }),
          signal: AbortSignal.timeout(10_000),
        })
        const json = await res.json()
        if (json.result && !cancelled) {
          const decoded = decodeFunctionResult({
            abi: INDEX_ABI,
            functionName: 'getITPState',
            data: json.result,
          }) as [string, bigint, bigint, string[], bigint[], bigint[]]
          setCreatorAddress(decoded[0])
        }
      } catch { /* creator display is non-critical */ }
    }
    fetchCreator()
    return () => { cancelled = true }
  }, [itpId])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const truncate = (s: string) => s.length > 16 ? `${s.slice(0, 8)}...${s.slice(-6)}` : s

  const inceptionDate = createdAt
    ? new Date(createdAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
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
    ...(creatorAddress ? [{
      label: 'Creator',
      value: truncate(creatorAddress),
      full: creatorAddress,
      copyable: true,
      testId: 'creator-address',
    }] : []),
  ]

  type Fact = { label: string; value: string; full?: string; copyable?: boolean; asOf?: boolean; testId?: string }

  const sectionTitle = {
    fontFamily: 'var(--apple-font-display)',
    fontSize: 'clamp(24px, 2.4vw, 32px)',
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tight)',
    color: 'var(--apple-text)',
    margin: 0,
  } as const

  const subTitle = {
    fontFamily: 'var(--apple-font-display)',
    fontSize: 'var(--apple-fs-21)',
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tight)',
    color: 'var(--apple-text)',
    margin: 0,
  } as const

  const factLabelStyle = {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 'var(--apple-fs-14)',
    color: 'var(--apple-text-secondary)',
    letterSpacing: 'var(--apple-track-tight)',
  }

  const factValueStyle = {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 'var(--apple-fs-14)',
    color: 'var(--apple-text)',
    fontWeight: 500,
    letterSpacing: 'var(--apple-track-tight)',
    textAlign: 'right' as const,
  }

  const FactRow = ({ f }: { f: Fact }) => (
    <div
      className="flex justify-between"
      style={{ padding: '12px 0', borderBottom: '1px solid var(--apple-line)' }}
      {...(f.testId ? { 'data-testid': f.testId } : {})}
    >
      <div>
        <span style={factLabelStyle}>{f.label}</span>
        {f.asOf && (
          <div style={{ fontFamily: 'var(--apple-font-text)', fontSize: 11, color: 'var(--apple-text-tertiary)', marginTop: 2 }}>
            {t('fund_facts.as_of', { date: asOfToday(locale) })}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span style={factValueStyle}>{f.value}</span>
        {f.copyable && (
          <button
            onClick={() => copyToClipboard(f.full!, f.label)}
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: 'var(--apple-accent, #0071e3)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {copied === f.label ? t('fund_facts.copied') : t('fund_facts.copy')}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <section className="py-8">
      <h2 className="mb-6" style={sectionTitle}>{t('fund_facts.title')}</h2>

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
          <h3 className="mt-12 mb-4" style={subTitle}>{t('fund_facts.portfolio_characteristics')}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16">
            <div>
              <div className="flex justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--apple-line)' }}>
                <span style={factLabelStyle}>{t('fund_facts.top_5_concentration')}</span>
                <span style={factValueStyle}>{concentration.top5.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--apple-line)' }}>
                <span style={factLabelStyle}>{t('fund_facts.top_10_concentration')}</span>
                <span style={factValueStyle}>{concentration.top10.toFixed(1)}%</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--apple-line)' }}>
                <span style={factLabelStyle}>{t('fund_facts.hhi_index')}</span>
                <span style={factValueStyle}>{Math.round(concentration.hhi)} ({concentration.hhiLabel})</span>
              </div>
              <div className="flex justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--apple-line)' }}>
                <span style={factLabelStyle}>{t('fund_facts.average_market_cap')}</span>
                <span style={factValueStyle}>{formatMcap(concentration.avgMcap)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Fees */}
      <h3 className="mt-12 mb-2" style={subTitle}>{t('fund_facts.fees')}</h3>
      <p style={{ fontFamily: 'var(--apple-font-text)', fontSize: 12, color: 'var(--apple-text-tertiary)', marginBottom: 16 }}>
        {t('fund_facts.fees_as_of')}
      </p>
      <div className="max-w-lg">
        <div className="flex justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--apple-line)' }}>
          <span style={factLabelStyle}>{t('fund_facts.management_fee')}</span>
          <span style={factValueStyle}>0.00%</span>
        </div>
        <div className="flex justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--apple-line)' }}>
          <span style={factLabelStyle}>{t('fund_facts.acquired_fund_fees')}</span>
          <span style={factValueStyle}>0.00%</span>
        </div>
        <div className="flex justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--apple-line)' }}>
          <span style={factLabelStyle}>{t('fund_facts.other_expenses')}</span>
          <span style={factValueStyle}>0.00%</span>
        </div>
        <div className="flex justify-between" style={{ padding: '12px 0', borderTop: '2px solid var(--apple-text)' }}>
          <span style={{ ...factLabelStyle, color: 'var(--apple-text)', fontWeight: 600 }}>{t('fund_facts.expense_ratio')}</span>
          <span style={{ ...factValueStyle, fontWeight: 600 }}>0.00%</span>
        </div>
      </div>
      <p style={{ fontFamily: 'var(--apple-font-text)', fontSize: 11, color: 'var(--apple-text-tertiary)', marginTop: 12 }}>
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
