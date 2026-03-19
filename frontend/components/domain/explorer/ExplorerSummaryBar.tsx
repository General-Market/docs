'use client'

import type { AggregatedSnapshot } from '@/hooks/useExplorerHealth'

interface ExplorerSummaryBarProps {
  latest: AggregatedSnapshot | null
  loading: boolean
}

export function ExplorerSummaryBar({ latest, loading }: ExplorerSummaryBarProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 stagger">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="explorer-glass-card glass-surface-dark rounded-xl p-3">
            <div className="h-3 bg-white/[0.06] rounded w-20 mb-2 animate-pulse" />
            <div className="h-5 bg-white/[0.06] rounded w-12 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (!latest) {
    return (
      <div className="glass-surface-dark rounded-xl p-4 text-center">
        <p className="text-caption text-white/40">No data available yet</p>
      </div>
    )
  }

  const items: { label: string; value: string; color: string; glow?: string }[] = [
    {
      label: 'Network',
      value: latest.worst_status === 'healthy' ? 'Healthy' : latest.worst_status === 'degraded' ? 'Degraded' : 'Unhealthy',
      color: latest.worst_status === 'healthy' ? 'text-emerald-400' : latest.worst_status === 'degraded' ? 'text-amber-400' : 'text-red-400',
      glow: latest.worst_status === 'healthy'
        ? '0 0 14px rgba(52,211,153,0.35)'
        : latest.worst_status === 'degraded'
          ? '0 0 14px rgba(251,191,36,0.35)'
          : '0 0 14px rgba(248,113,113,0.35)',
    },
    {
      label: 'Quorum',
      value: latest.quorum_met ? 'Met' : 'Lost',
      color: latest.quorum_met ? 'text-emerald-400' : 'text-red-400',
      glow: latest.quorum_met ? '0 0 14px rgba(52,211,153,0.35)' : '0 0 14px rgba(248,113,113,0.35)',
    },
    {
      label: 'Consensus Rounds',
      value: latest.consensus_rounds_total > 0 ? latest.consensus_rounds_total.toLocaleString() : '\u2014',
      color: 'text-white',
    },
    {
      label: 'Avg Consensus',
      value: `${latest.avg_consensus_time_ms}ms`,
      color: latest.avg_consensus_time_ms > 2000 ? 'text-red-400' : 'text-white',
      glow: latest.avg_consensus_time_ms > 2000 ? '0 0 14px rgba(248,113,113,0.35)' : undefined,
    },
    {
      label: 'Pending Orders',
      value: latest.pending_order_count.toString(),
      color: 'text-white',
    },
    {
      label: 'Connected Peers',
      value: latest.total_peers.toString(),
      color: 'text-white',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 stagger">
      {items.map((item) => (
        <div
          key={item.label}
          className="explorer-glass-card glass-surface-dark rounded-xl p-3 hover:border-white/[0.15] transition-[border-color] duration-300"
        >
          <p className="text-micro font-semibold tracking-[0.08em] uppercase text-white/40 mb-1">
            {item.label}
          </p>
          <p
            className={`text-heading font-black tracking-tight ${item.color}`}
            style={item.glow ? { textShadow: item.glow } : undefined}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}
