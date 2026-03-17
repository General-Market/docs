'use client'

import { useTranslations } from 'next-intl'
import { useSimHoldings } from '@/hooks/useSimHoldings'

interface SimHoldingsTableProps {
  runId: number | null
  date?: string | null
}

export function SimHoldingsTable({ runId, date }: SimHoldingsTableProps) {
  const t = useTranslations('backtest')
  const { holdings, isLoading, error } = useSimHoldings(runId, date)

  if (!runId) return null

  if (isLoading) {
    return (
      <div className="text-text-muted text-xs py-4 text-center">
        {t('holdings.loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-color-down text-xs py-4 text-center">
        {t('holdings.error', { message: error })}
      </div>
    )
  }

  if (!holdings.length) {
    return (
      <div className="text-text-muted text-xs py-4 text-center">
        {t('holdings.no_data')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-xs font-medium uppercase tracking-wider text-text-muted border-b border-border-light bg-muted">
            <th className="text-left pb-2 pt-2 pr-2 px-3">{t('holdings.header.rank')}</th>
            <th className="text-left pb-2 pt-2 pr-2 px-3">{t('holdings.header.coin')}</th>
            <th className="text-left pb-2 pt-2 pr-2 px-3">{t('holdings.header.symbol')}</th>
            <th className="text-right pb-2 pt-2 pr-2 px-3">{t('holdings.header.weight')}</th>
            <th className="text-right pb-2 pt-2 pr-2 px-3">{t('holdings.header.price')}</th>
            <th className="text-right pb-2 pt-2 px-3">{t('holdings.header.value')}</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => (
            <tr key={h.coin_id} className="border-b border-border-light hover:bg-card-hover">
              <td className="py-1.5 pr-2 px-3 text-text-muted text-xs font-mono tabular-nums">{i + 1}</td>
              <td className="py-1.5 pr-2 px-3 text-text-primary text-xs">{h.coin_id}</td>
              <td className="py-1.5 pr-2 px-3 text-text-secondary text-xs font-mono">{h.symbol}</td>
              <td className="py-1.5 pr-2 px-3 text-right text-text-secondary text-xs font-mono tabular-nums">
                {(h.weight * 100).toFixed(2)}%
              </td>
              <td className="py-1.5 pr-2 px-3 text-right text-text-secondary text-xs font-mono tabular-nums">
                ${h.price_usd.toFixed(4)}
              </td>
              <td className="py-1.5 px-3 text-right text-text-primary text-xs font-mono tabular-nums">
                ${(h.quantity * h.price_usd).toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
