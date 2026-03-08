'use client'

export interface AggregatedSnapshot {
  worst_status: 'healthy' | 'degraded' | 'unhealthy'
  quorum_met: boolean
  consensus_rounds_total: number
  consensus_success_total: number
  avg_consensus_time_ms: number
  pending_order_count: number
  total_peers: number
}

interface ExplorerSummaryBarProps {
  latest: AggregatedSnapshot | null
  loading: boolean
}

export function ExplorerSummaryBar({ latest, loading }: ExplorerSummaryBarProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-border-light rounded-card p-3 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-20 mb-2" />
            <div className="h-5 bg-gray-100 rounded w-12" />
          </div>
        ))}
      </div>
    )
  }

  if (!latest) {
    return (
      <div className="bg-white border border-border-light rounded-card p-4 text-center">
        <p className="text-[13px] text-text-muted">No data available yet</p>
      </div>
    )
  }

  const items = [
    {
      label: 'Network',
      value: latest.worst_status === 'healthy' ? 'Healthy' : latest.worst_status === 'degraded' ? 'Degraded' : 'Unhealthy',
      color: latest.worst_status === 'healthy' ? 'text-color-up' : latest.worst_status === 'degraded' ? 'text-yellow-600' : 'text-color-down',
    },
    {
      label: 'Quorum',
      value: latest.quorum_met ? 'Met' : 'Lost',
      color: latest.quorum_met ? 'text-color-up' : 'text-color-down',
    },
    {
      label: 'Consensus Success',
      value: latest.consensus_rounds_total > 0
        ? `${((latest.consensus_success_total / latest.consensus_rounds_total) * 100).toFixed(1)}%`
        : '\u2014',
      color: 'text-black',
    },
    {
      label: 'Avg Consensus',
      value: `${latest.avg_consensus_time_ms}ms`,
      color: latest.avg_consensus_time_ms > 2000 ? 'text-color-down' : 'text-black',
    },
    {
      label: 'Pending Orders',
      value: latest.pending_order_count.toString(),
      color: 'text-black',
    },
    {
      label: 'Connected Peers',
      value: latest.total_peers.toString(),
      color: 'text-black',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item) => (
        <div key={item.label} className="bg-white border border-border-light rounded-card p-3">
          <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-muted mb-1">
            {item.label}
          </p>
          <p className={`text-[18px] font-black tracking-[-0.02em] ${item.color}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}
