'use client'

import { useTranslations } from 'next-intl'

interface HeroSectionProps {
  label?: string
  symbol: string
  name: string
  onBuy: () => void
}

export function HeroSection({ label, symbol, name, onBuy }: HeroSectionProps) {
  const t = useTranslations('markets.itp_page')

  return (
    <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 py-10 lg:py-12">
      <div className="min-w-0">
        {label && (
          <div
            className="mb-3"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 'var(--apple-track-loose)',
              color: 'var(--apple-text-tertiary)',
            }}
          >
            {label}
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="inline-flex items-center"
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--apple-r-pill)',
              border: '1px solid var(--apple-line)',
              fontFamily: 'var(--apple-font-text)',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-loose)',
              color: 'var(--apple-text)',
              background: 'transparent',
              lineHeight: 1,
            }}
          >
            {symbol}
          </span>
          <h1
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 600,
              lineHeight: 1.07,
              letterSpacing: 'var(--apple-track-tighter)',
              color: 'var(--apple-text)',
              margin: 0,
            }}
          >
            {name}
          </h1>
        </div>
      </div>
      <button
        onClick={onBuy}
        className="inline-flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          background: 'var(--apple-accent, #0071e3)',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: 'var(--apple-r-pill)',
          fontFamily: 'var(--apple-font-text)',
          fontSize: 'var(--apple-fs-14)',
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-tight)',
          border: 'none',
          cursor: 'pointer',
          minWidth: 140,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--apple-accent-hover, #0066cc)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--apple-accent, #0071e3)' }}
      >
        {t('buy_this_index')}
      </button>
    </header>
  )
}
