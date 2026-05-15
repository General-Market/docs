'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { AggregatedSnapshot } from '@/hooks/useExplorerHealth'
import { computeDeltas } from '@/hooks/useExplorerHealth'
import { ExplorerChartCard } from '@/components/domain/explorer'

interface SectionProps {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
}

const STATUS_MAP: Record<string, number> = {
  healthy: 1,
  degraded: 2,
  unhealthy: 3,
}

export function SystemHealthSection({ snapshots, latest, loading }: SectionProps) {
  const t = useTranslations('pages')

  const STATUS_LABELS: Record<number, string> = {
    1: t('explorer.system_health_section.healthy'),
    2: t('explorer.system_health_section.degraded'),
    3: t('explorer.system_health_section.unhealthy'),
  }

  const statusData = useMemo(
    () =>
      snapshots.map((s) => ({
        poll_batch_ts: s.poll_batch_ts,
        status: STATUS_MAP[s.worst_status] ?? 3,
      })),
    [snapshots]
  )

  const quorumData = useMemo(
    () =>
      snapshots.map((s) => ({
        poll_batch_ts: s.poll_batch_ts,
        quorum: s.quorum_met ? 1 : 0,
      })),
    [snapshots]
  )

  // Per-interval success rate (delta success / delta rounds)
  const successRateData = useMemo(() => {
    const result: { poll_batch_ts: string; rate: number }[] = []
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1]
      const curr = snapshots[i]
      const dRounds = curr.consensus_rounds_total - prev.consensus_rounds_total
      const dSuccess = curr.consensus_success_total - prev.consensus_success_total
      if (dRounds <= 0) {
        result.push({ poll_batch_ts: curr.poll_batch_ts, rate: 100 })
      } else {
        result.push({
          poll_batch_ts: curr.poll_batch_ts,
          rate: Math.round((Math.max(0, dSuccess) / dRounds) * 100),
        })
      }
    }
    return result
  }, [snapshots])

  const errorRateData = useMemo(
    () => computeDeltas(snapshots, 'consensus_failed_total'),
    [snapshots]
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* #82: Network Status */}
      <ExplorerChartCard
        title={t('explorer.system_health_section.network_status')}
        subtitle={t('explorer.system_health_section.network_status_desc')}
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={statusData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
            <XAxis
              dataKey="poll_batch_ts"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              tick={{ fontSize: 10 }}
              stroke="#D2D2D7"
            />
            <YAxis
              domain={[0.5, 3.5]}
              ticks={[1, 2, 3]}
              tickFormatter={(v) => STATUS_LABELS[v] ?? ''}
              tick={{ fontSize: 10 }}
              stroke="#D2D2D7"
            />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(value: number) => [STATUS_LABELS[value] ?? value, t('explorer.system_health_section.status')]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <defs>
              <linearGradient id="statusGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D70015" stopOpacity={0.15} />
                <stop offset="50%" stopColor="#B25600" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#1F8F4D" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <Area
              type="stepAfter"
              dataKey="status"
              name={t('explorer.system_health_section.status')}
              stroke="#86868b"
              fill="url(#statusGrad)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ExplorerChartCard>

      {/* #83: Quorum History */}
      <ExplorerChartCard
        title={t('explorer.system_health_section.quorum_history')}
        subtitle={t('explorer.system_health_section.quorum_history_desc')}
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={quorumData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
            <XAxis
              dataKey="poll_batch_ts"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              tick={{ fontSize: 10 }}
              stroke="#D2D2D7"
            />
            <YAxis
              domain={[-0.1, 1.1]}
              ticks={[0, 1]}
              tickFormatter={(v) => (v === 1 ? t('explorer.system_health_section.met') : t('explorer.system_health_section.lost'))}
              tick={{ fontSize: 10 }}
              stroke="#D2D2D7"
            />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(value: number) => [value === 1 ? t('explorer.system_health_section.quorum_met') : t('explorer.system_health_section.quorum_lost'), t('explorer.system_health_section.quorum')]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <defs>
              <linearGradient id="quorumGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1F8F4D" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#1F8F4D" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              type="stepAfter"
              dataKey="quorum"
              name={t('explorer.system_health_section.quorum')}
              stroke="#1F8F4D"
              fill="url(#quorumGrad)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ExplorerChartCard>

      {/* #84: Consensus Success Rate */}
      <ExplorerChartCard
        title={t('explorer.system_health_section.consensus_success_rate')}
        subtitle={t('explorer.system_health_section.consensus_success_rate_desc')}
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={successRateData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
            <XAxis
              dataKey="poll_batch_ts"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              tick={{ fontSize: 10 }}
              stroke="#D2D2D7"
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10 }}
              stroke="#D2D2D7"
            />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(value: number) => [`${value}%`, t('explorer.system_health_section.success_rate')]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="rate"
              name={t('explorer.system_health_section.success_rate')}
              stroke="#1F8F4D"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ExplorerChartCard>

      {/* #85: Error Rate */}
      <ExplorerChartCard
        title={t('explorer.system_health_section.error_rate')}
        subtitle={t('explorer.system_health_section.error_rate_desc')}
        loading={loading}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={errorRateData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8ED" />
            <XAxis
              dataKey="time"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              tick={{ fontSize: 10 }}
              stroke="#D2D2D7"
            />
            <YAxis tick={{ fontSize: 10 }} stroke="#D2D2D7" allowDecimals={false} />
            <Tooltip
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(value: number) => [value, t('explorer.system_health_section.failures')]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="delta"
              name={t('explorer.system_health_section.failures')}
              stroke="#D70015"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ExplorerChartCard>
    </div>
  )
}
