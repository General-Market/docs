'use client'

import { useTranslations } from 'next-intl'
import { useMorphoHistory, type MorphoTx } from '@/hooks/useMorphoHistory'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

interface LendingHistoryProps {
  market: MorphoMarketEntry
}

const TYPE_LABEL_KEYS: Record<MorphoTx['type'], string> = {
  deposit: 'lending_history.type_deposit',
  withdraw: 'lending_history.type_withdraw',
  borrow: 'lending_history.type_borrow',
  repay: 'lending_history.type_repay',
}

const TYPE_COLORS: Record<MorphoTx['type'], string> = {
  deposit: 'text-color-up',
  withdraw: 'text-orange-600',
  borrow: 'text-blue-600',
  repay: 'text-purple-600',
}

function formatTime(timestamp: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  // For dev chains with future block timestamps, or anything within ±2 min, show absolute time
  if (diffMs < 0 || Math.abs(diffMs) < 120_000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function LendingHistory({ market }: LendingHistoryProps) {
  const t = useTranslations('lending')
  const { txs, isLoading } = useMorphoHistory(market)

  if (isLoading && txs.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-card border border-border-light p-4">
        <h3 className="text-sm font-bold text-text-secondary mb-2">{t('lending_history.title')}</h3>
        <div className="text-center py-3 text-text-muted text-xs">{t('lending_history.loading')}</div>
      </div>
    )
  }

  if (txs.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-card border border-border-light p-4">
      <h3 className="text-sm font-bold text-text-secondary mb-3">{t('lending_history.title')}</h3>
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {txs.map((tx, i) => (
          <div key={`${tx.txHash}-${i}`} className="flex justify-between items-center text-xs py-1.5 border-b border-border-light last:border-0">
            <div className="flex items-center gap-2">
              <span className={`font-bold ${TYPE_COLORS[tx.type]}`}>
                {t(TYPE_LABEL_KEYS[tx.type])}
              </span>
              <span className="text-text-secondary font-mono tabular-nums">
                {parseFloat(tx.amount).toFixed(tx.token === 'USDC' ? 2 : 4)} {tx.token}
              </span>
            </div>
            <span className="text-text-muted">
              {formatTime(tx.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
