'use client'

import { useTranslations } from 'next-intl'
import { getItpPageConfig } from '@/lib/itp-page-config'
import type { SectionProps } from '../SectionRenderer'

export function InvestmentObjective({ itpId }: SectionProps) {
  const t = useTranslations('markets.itp_page.investment_objective')
  const config = getItpPageConfig(itpId)
  const obj = config.investmentObjective
  if (!obj) return null

  const headingStyle = {
    fontFamily: 'var(--apple-font-display)',
    fontSize: 'var(--apple-fs-24)',
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tight)',
    color: 'var(--apple-text)',
    margin: 0,
    marginBottom: 16,
  } as const

  const bodyStyle = {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 'var(--apple-fs-17)',
    lineHeight: 1.47,
    letterSpacing: 'var(--apple-track-tight)',
    color: 'var(--apple-text-secondary)',
  } as const

  return (
    <section className="py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <h2 style={headingStyle}>{t('why_title')}</h2>
          <ol style={{ ...bodyStyle, listStyle: 'decimal', paddingLeft: 20 }} className="space-y-4">
            {obj.whyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ol>
        </div>
        <div>
          <h2 style={headingStyle}>{t('objective_title')}</h2>
          <p style={bodyStyle}>{obj.objective}</p>
        </div>
      </div>
    </section>
  )
}
