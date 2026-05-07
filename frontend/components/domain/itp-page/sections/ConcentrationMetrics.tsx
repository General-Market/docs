'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { SectionProps } from '../SectionRenderer'

export function ConcentrationMetrics({ enrichment }: SectionProps) {
  const t = useTranslations('markets.itp_page.concentration')
  const holdings = enrichment?.holdings ?? []

  const metrics = useMemo(() => {
    if (holdings.length === 0) return null
    const sorted = [...holdings].sort((a, b) => b.weight - a.weight)
    const top5 = sorted.slice(0, 5).reduce((s, h) => s + h.weight, 0) * 100
    const top10 = sorted.slice(0, 10).reduce((s, h) => s + h.weight, 0) * 100
    const hhi = sorted.reduce((s, h) => s + Math.pow(h.weight * 100, 2), 0)
    const hhiLabel = hhi < 1500 ? t('low') : hhi < 2500 ? t('moderate') : t('high')
    return { top5, top10, hhi, hhiLabel }
  }, [holdings, t])

  if (!metrics) return null

  const cards = [
    { label: t('top_5_weight'), value: `${metrics.top5.toFixed(1)}%` },
    { label: t('top_10_weight'), value: `${metrics.top10.toFixed(1)}%` },
    { label: t('hhi_concentration'), value: `${Math.round(metrics.hhi)}`, sub: metrics.hhiLabel },
  ]

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
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
            <div
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 'var(--apple-track-loose)',
                color: 'var(--apple-text-tertiary)',
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 'var(--apple-fs-28)',
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text)',
                fontVariantNumeric: 'tabular-nums',
                marginTop: 8,
              }}
            >
              {c.value}
            </div>
            {c.sub && (
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 12,
                  color: 'var(--apple-text-tertiary)',
                  marginTop: 4,
                  letterSpacing: 'var(--apple-track-tight)',
                }}
              >
                {c.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
