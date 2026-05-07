'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useTranslations } from 'next-intl'
import type { SectionProps } from '../SectionRenderer'

export function FundingOverview({ enrichment }: SectionProps) {
  const t = useTranslations('markets.itp_page.funding')
  const funding = enrichment?.funding
  if (!funding) return null

  const cards = [
    { label: t('total_raised'), value: `$${funding.total_raised_m.toFixed(0)}M` },
    { label: t('avg_valuation'), value: funding.avg_valuation_m > 0 ? `$${funding.avg_valuation_m.toFixed(0)}M` : '—' },
    { label: t('funding_rounds'), value: `${funding.total_rounds}` },
  ]

  const sectionTitle = {
    fontFamily: 'var(--apple-font-display)',
    fontSize: 'clamp(24px, 2.4vw, 32px)',
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tight)',
    color: 'var(--apple-text)',
    margin: 0,
  } as const

  const subHead = {
    fontFamily: 'var(--apple-font-text)',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 'var(--apple-track-loose)',
    color: 'var(--apple-text-tertiary)',
  }

  const tile = {
    background: 'var(--apple-panel)',
    border: '1px solid var(--apple-line)',
    borderRadius: 'var(--apple-r-md)',
    padding: 20,
  }

  const tileValue = {
    fontFamily: 'var(--apple-font-display)',
    fontSize: 'var(--apple-fs-28)',
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tight)',
    color: 'var(--apple-text)',
    fontVariantNumeric: 'tabular-nums' as const,
    marginTop: 8,
  }

  const headerCellStyle = {
    fontFamily: 'var(--apple-font-text)',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 'var(--apple-track-loose)',
    color: 'var(--apple-text-tertiary)',
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
      <h2 className="mb-6" style={sectionTitle}>
        {t('title')}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} style={tile}>
            <div style={subHead}>{c.label}</div>
            <div style={tileValue}>{c.value}</div>
          </div>
        ))}
      </div>

      {funding.top_investors.length > 0 && (
        <div
          className="mb-8"
          style={{
            background: 'var(--apple-panel)',
            border: '1px solid var(--apple-line)',
            borderRadius: 'var(--apple-r-md)',
            padding: 20,
          }}
        >
          <h3 className="mb-4" style={subHead}>
            {t('top_investors')}
          </h3>
          <ResponsiveContainer width="100%" height={funding.top_investors.length * 32 + 16}>
            <BarChart data={funding.top_investors} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fontSize: 11, fill: '#6e6e73' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [value, t('investments')]}
                contentStyle={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 12,
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                }}
              />
              <Bar dataKey="count" fill="#0071e3" radius={[0, 3, 3, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {funding.recent_raises.length > 0 && (
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
                <th style={{ ...headerCellStyle, textAlign: 'left' }}>{t('project')}</th>
                <th style={{ ...headerCellStyle, textAlign: 'left' }}>{t('round')}</th>
                <th style={{ ...headerCellStyle, textAlign: 'right' }}>{t('amount')}</th>
                <th style={{ ...headerCellStyle, textAlign: 'left' }}>{t('lead')}</th>
                <th style={{ ...headerCellStyle, textAlign: 'right' }}>{t('date')}</th>
              </tr>
            </thead>
            <tbody>
              {funding.recent_raises.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--apple-line)' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{r.project}</td>
                  <td style={{ ...tdStyle, color: 'var(--apple-text-secondary)' }}>{r.round}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${r.amount_m.toFixed(1)}M</td>
                  <td style={{ ...tdStyle, color: 'var(--apple-text-secondary)' }}>{r.lead}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--apple-text-tertiary)' }}>{r.date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
