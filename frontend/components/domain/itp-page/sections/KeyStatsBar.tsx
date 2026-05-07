'use client'

import { useTranslations, useLocale } from 'next-intl'
import { useItpNavSeries } from '@/hooks/useItpNavSeries'
import type { SectionProps } from '../SectionRenderer'

function asOfToday(locale?: string) {
  return new Date().toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}

const labelStyle = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: 'var(--apple-track-loose)',
  color: 'var(--apple-text-tertiary)',
}

const subStyle = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: '11px',
  letterSpacing: 'var(--apple-track-tight)',
  color: 'var(--apple-text-tertiary)',
  marginTop: 2,
}

const valueStyle = {
  fontFamily: 'var(--apple-font-display)',
  fontSize: 'clamp(24px, 2.4vw, 32px)',
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-tight)',
  color: 'var(--apple-text)',
  fontVariantNumeric: 'tabular-nums' as const,
  lineHeight: 1.1,
  marginTop: 8,
}

const tileStyle = {
  background: 'var(--apple-panel)',
  border: '1px solid var(--apple-line)',
  borderRadius: 'var(--apple-r-md)',
  padding: 20,
}

function Skeleton() {
  return (
    <div
      className="animate-pulse"
      style={{
        height: 30,
        width: 120,
        background: 'var(--apple-panel-2)',
        borderRadius: 6,
        marginTop: 8,
      }}
    />
  )
}

export function KeyStatsBar({ itpId, nav, aum, assetCount }: SectionProps) {
  const t = useTranslations('markets.itp_page.key_stats')
  const locale = useLocale()
  const { data: dayData } = useItpNavSeries(itpId, '5m')

  let change1d: number | null = null
  let change1dAbs: number | null = null
  if (dayData.length > 0 && nav > 0) {
    const openNav = dayData[0].open
    if (openNav > 0) {
      change1d = ((nav - openNav) / openNav) * 100
      change1dAbs = nav - openNav
    }
  }

  const asOf = asOfToday(locale)
  const changeColor = change1d == null
    ? 'var(--apple-text-tertiary)'
    : change1d >= 0 ? '#16a34a' : '#dc2626'

  return (
    <div className="py-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <div style={tileStyle}>
          <div style={labelStyle}>{t('nav_per_share')}</div>
          <div style={subStyle}>{t('as_of', { date: asOf })}</div>
          {nav > 0 ? (
            <div style={valueStyle}>${nav.toFixed(4)}</div>
          ) : (
            <Skeleton />
          )}
        </div>

        <div style={tileStyle}>
          <div style={labelStyle}>{t('one_day_nav_change')}</div>
          <div style={subStyle}>{t('as_of', { date: asOf })}</div>
          {change1d != null && change1dAbs != null ? (
            <div style={{ ...valueStyle, color: changeColor }}>
              {change1dAbs >= 0 ? '+' : ''}{change1dAbs.toFixed(4)}
              <span style={{ fontSize: '0.6em', marginLeft: 8, color: changeColor, fontWeight: 500 }}>
                ({change1d >= 0 ? '+' : ''}{change1d.toFixed(2)}%)
              </span>
            </div>
          ) : (
            <div style={{ ...valueStyle, color: 'var(--apple-text-tertiary)' }}>—</div>
          )}
        </div>

        <div style={tileStyle}>
          <div style={labelStyle}>{t('total_value_locked')}</div>
          <div style={subStyle}>{t('as_of', { date: asOf })}</div>
          <div style={valueStyle}>{aum > 0 ? formatUsd(aum) : '—'}</div>
        </div>

        <div style={tileStyle}>
          <div style={labelStyle}>{t('holdings')}</div>
          <div style={subStyle}>{t('as_of', { date: asOf })}</div>
          <div style={valueStyle}>{assetCount > 0 ? assetCount : '—'}</div>
        </div>
      </div>
    </div>
  )
}

function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(2)}`
}
