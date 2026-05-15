'use client'

import { useTranslations } from 'next-intl'
import type { AggregatedSnapshot } from '@/hooks/useExplorerHealth'

interface ExplorerSummaryBarProps {
  latest: AggregatedSnapshot | null
  loading: boolean
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

  const items: { label: string; value: string; color: string }[] = [
    {
      label: t('explorer.consensus_section.network_health'),
      value: latest.worst_status === 'healthy' ? t('explorer.consensus_section.healthy') : latest.worst_status === 'degraded' ? t('explorer.consensus_section.degraded') : t('explorer.consensus_section.unhealthy'),
      color: latest.worst_status === 'healthy' ? 'text-[#1F8F4D]' : latest.worst_status === 'degraded' ? 'text-[#B25600]' : 'text-[#D70015]',
    },
    {
      label: t('explorer.consensus_section.quorum_status'),
      value: latest.quorum_met ? t('explorer.consensus_section.met') : t('explorer.consensus_section.not_met'),
      color: latest.quorum_met ? 'text-[#1F8F4D]' : 'text-[#D70015]',
    },
    {
      label: t('explorer.summary.consensus'),
      value: latest.consensus_rounds_total > 0 ? latest.consensus_rounds_total.toLocaleString() : '—',
      color: 'text-[#1d1d1f]',
    },
    {
      label: t('explorer.consensus_section.avg_duration'),
      value: `${latest.avg_consensus_time_ms}ms`,
      color: latest.avg_consensus_time_ms > 2000 ? 'text-[#D70015]' : 'text-[#1d1d1f]',
    },
    {
      label: t('explorer.orders_section.pending'),
      value: latest.pending_order_count.toString(),
      color: 'text-[#1d1d1f]',
    },
    {
      label: t('explorer.summary.oracles'),
      // total_peers = SUM(connected_peers) across K nodes in a full mesh.
      // Each node sees K-1 peers, so total = K*(K-1). Solve: K = (1+√(1+4·total))/2
      value: Math.round((1 + Math.sqrt(1 + 4 * latest.total_peers)) / 2).toString(),
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
          <p className={`text-heading font-display font-semibold tracking-apple-tighter ${item.color}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}
