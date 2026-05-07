'use client'

import { useTranslations } from 'next-intl'
import type { SectionProps } from '../SectionRenderer'

export function TradeCta({ itpId }: SectionProps) {
  const t = useTranslations('markets.itp_page.trade_cta')

  const primary = {
    padding: '12px 24px',
    borderRadius: 'var(--apple-r-pill)',
    background: 'var(--apple-accent, #0071e3)',
    color: '#ffffff',
    fontFamily: 'var(--apple-font-text)',
    fontSize: 'var(--apple-fs-14)',
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tight)',
    textAlign: 'center' as const,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 150ms var(--apple-ease-default)',
  }

  const secondary = {
    padding: '12px 24px',
    borderRadius: 'var(--apple-r-pill)',
    background: 'transparent',
    color: 'var(--apple-text)',
    fontFamily: 'var(--apple-font-text)',
    fontSize: 'var(--apple-fs-14)',
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tight)',
    textAlign: 'center' as const,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--apple-line)',
    transition: 'border-color 150ms var(--apple-ease-default), background 150ms var(--apple-ease-default)',
  }

  return (
    <section className="flex flex-col sm:flex-row gap-3 py-8">
      <a href={`/#markets`} style={primary}>
        {t('buy')}
      </a>
      <a href={`/#markets`} style={secondary}>
        {t('sell')}
      </a>
    </section>
  )
}
