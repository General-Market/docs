'use client'

import { useTranslations } from 'next-intl'
import type { SectionProps } from '../SectionRenderer'

function formatTvl(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function PctChange({ value }: { value?: number }) {
  if (value == null) return <span style={{ color: 'var(--apple-text-tertiary)' }}>—</span>
  const color = value >= 0 ? '#16a34a' : '#dc2626'
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', color, fontFamily: 'var(--apple-font-text)' }}>
      {value >= 0 ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}

export function DefiHealth({ enrichment }: SectionProps) {
  const t = useTranslations('markets.itp_page.defi')
  const defi = enrichment?.defi
  if (!defi) return null

  const cards = [
    { label: t('aggregate_tvl'), value: formatTvl(defi.total_tvl), color: 'var(--apple-text)' },
    {
      label: t('avg_tvl_change_7d'),
      value: `${defi.avg_tvl_change_7d >= 0 ? '+' : ''}${defi.avg_tvl_change_7d.toFixed(2)}%`,
      color: defi.avg_tvl_change_7d >= 0 ? '#16a34a' : '#dc2626',
    },
    {
      label: t('coverage'),
      value: t('coverage_value', { with_data: defi.protocols_with_data, total: defi.total_holdings }),
      color: 'var(--apple-text)',
    },
  ]

  const subHead = {
    fontFamily: 'var(--apple-font-text)',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 'var(--apple-track-loose)',
    color: 'var(--apple-text-tertiary)',
  }

  const headerCellStyle = {
    ...subHead,
    padding: '12px 16px',
    background: 'var(--apple-panel-2)',
    borderBottom: '1px solid var(--apple-line)',
  }

  const tdStyle = {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 'var(--apple-fs-14)',
    color: 'var(--apple-text)',
    letterSpacing: 'var(--apple-track-tight)',
    padding: '12px 16px',
  }

  return (
    <section className="py-8">
      <h2
        className="mb-6"
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 'clamp(24px, 2.4vw, 32px)',
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-tight)',
          color: 'var(--apple-text)',
          margin: 0,
        }}
      >
        {t('title')}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 mb-8">
        {cards.map(c => (
          <div
            key={c.label}
            style={{
              background: 'var(--apple-panel)',
              border: '1px solid var(--apple-line)',
              borderRadius: 'var(--apple-r-md)',
              padding: 20,
            }}
          >
            <div style={subHead}>{c.label}</div>
            <div
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 'var(--apple-fs-28)',
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-tight)',
                fontVariantNumeric: 'tabular-nums',
                color: c.color,
                marginTop: 8,
              }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {defi.top_by_tvl.length > 0 && (
        <div
          style={{
            border: '1px solid var(--apple-line)',
            borderRadius: 'var(--apple-r-md)',
            overflow: 'hidden',
            background: 'var(--apple-panel)',
          }}
        >
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...headerCellStyle, textAlign: 'left' }}>{t('protocol')}</th>
                <th style={{ ...headerCellStyle, textAlign: 'right' }}>{t('tvl')}</th>
                <th style={{ ...headerCellStyle, textAlign: 'right' }}>{t('change_1d')}</th>
                <th style={{ ...headerCellStyle, textAlign: 'right' }}>{t('change_7d')}</th>
              </tr>
            </thead>
            <tbody>
              {defi.top_by_tvl.map(p => (
                <tr key={p.symbol} style={{ borderTop: '1px solid var(--apple-line)' }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600 }}>{p.symbol}</span>
                    {p.name !== p.symbol && (
                      <span style={{ color: 'var(--apple-text-tertiary)', fontSize: 12, marginLeft: 6 }}>{p.name}</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatTvl(p.tvl)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}><PctChange value={p.change_1d} /></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}><PctChange value={p.change_7d} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
