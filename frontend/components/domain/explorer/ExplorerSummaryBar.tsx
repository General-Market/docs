'use client'

import { useTranslations } from 'next-intl'
import type { AggregatedSnapshot } from '@/hooks/useExplorerHealth'
import { useCountUp } from '@/hooks/useCountUp'

interface ExplorerSummaryBarProps {
  latest: AggregatedSnapshot | null
  loading: boolean
}

function CountValue({ value, formatter, className }: { value: number; formatter: (v: number) => string; className?: string }) {
  const display = useCountUp(value, 800)
  return <span className={className}>{formatter(display)}</span>
}

export function ExplorerSummaryBar({ latest, loading }: ExplorerSummaryBarProps) {
  const t = useTranslations('pages')
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 stagger">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="explorer-glass-card explorer-light-card rounded-apple-md p-3">
            <div className="h-3 bg-black/[0.06] rounded w-20 mb-2 animate-pulse" />
            <div className="h-5 bg-black/[0.06] rounded w-12 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (!latest) {
    return (
      <div className="explorer-light-card rounded-apple-md p-4 text-center">
        <p className="text-caption text-[#86868b]">{t('explorer.summary.na')}</p>
      </div>
    )
  }

  type Item =
    | { kind: 'string'; label: string; value: string; color: string }
    | { kind: 'number'; label: string; value: number; formatter: (n: number) => string; color: string }

  const oracleCount = Math.round((1 + Math.sqrt(1 + 4 * latest.total_peers)) / 2)

  const items: Item[] = [
    {
      kind: 'string',
      label: t('explorer.consensus_section.network_health'),
      value: latest.worst_status === 'healthy' ? t('explorer.consensus_section.healthy') : latest.worst_status === 'degraded' ? t('explorer.consensus_section.degraded') : t('explorer.consensus_section.unhealthy'),
      color: latest.worst_status === 'healthy' ? 'text-[#1F8F4D]' : latest.worst_status === 'degraded' ? 'text-[#B25600]' : 'text-[#D70015]',
    },
    {
      kind: 'string',
      label: t('explorer.consensus_section.quorum_status'),
      value: latest.quorum_met ? t('explorer.consensus_section.met') : t('explorer.consensus_section.not_met'),
      color: latest.quorum_met ? 'text-[#1F8F4D]' : 'text-[#D70015]',
    },
    {
      kind: 'number',
      label: t('explorer.summary.consensus'),
      value: latest.consensus_rounds_total,
      formatter: (n) => (n > 0 ? Math.round(n).toLocaleString() : '—'),
      color: 'text-[#1d1d1f]',
    },
    {
      kind: 'number',
      label: t('explorer.consensus_section.avg_duration'),
      value: latest.avg_consensus_time_ms,
      formatter: (n) => `${Math.round(n)}ms`,
      color: latest.avg_consensus_time_ms > 2000 ? 'text-[#D70015]' : 'text-[#1d1d1f]',
    },
    {
      kind: 'number',
      label: t('explorer.orders_section.pending'),
      value: latest.pending_order_count,
      formatter: (n) => Math.round(n).toString(),
      color: 'text-[#1d1d1f]',
    },
    {
      kind: 'number',
      label: t('explorer.summary.oracles'),
      value: oracleCount,
      formatter: (n) => Math.round(n).toString(),
      color: 'text-[#1d1d1f]',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 stagger">
      {items.map((item) => (
        <div
          key={item.label}
          className="explorer-glass-card explorer-light-card rounded-apple-md p-3"
        >
          <p className="text-micro font-semibold tracking-apple-loose uppercase text-[#86868b] mb-1">
            {item.label}
          </p>
          <p className={`text-heading font-display font-semibold tracking-apple-tighter explorer-count-up ${item.color}`}>
            {item.kind === 'number' ? (
              <CountValue value={item.value} formatter={item.formatter} />
            ) : (
              item.value
            )}
          </p>
        </div>
      ))}
    </div>
  )
}
