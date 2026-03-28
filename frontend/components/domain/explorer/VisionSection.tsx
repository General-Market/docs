'use client'

import { useMemo, useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import type { AggregatedSnapshot } from '@/hooks/useExplorerHealth'
import { ExplorerChartCard } from '@/components/domain/explorer'

interface SectionProps {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
}

interface BatchData {
  id: number
  source_id: string
  current_tick: number
  tick_duration: number
  player_count: number
  tvl: string
  market_count: number
  paused: boolean
}

function getSourceName(sourceId: string): string {
  return sourceId.replace(/_/g, ' ')
}

// Truncate long source labels for chart display
function truncateLabel(label: string, max = 18): string {
  return label.length > max ? label.slice(0, max - 1) + '\u2026' : label
}

function formatTvl(tvl: number): string {
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(1)}K`
  return `$${tvl.toFixed(2)}`
}

interface LeaderboardEntry {
  rank: number
  walletAddress: string
  pnl: number
  roi: number
  totalVolume: number
  portfolioBets: number
}

interface ActivityBucket {
  bucket: string
  rounds_settled: number
  rounds_created: number
  total_players: number
}

export function VisionSection({ snapshots, latest, loading }: SectionProps) {
  const t = useTranslations('pages')
  const [batches, setBatches] = useState<BatchData[]>([])
  const [batchLoading, setBatchLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [activity, setActivity] = useState<ActivityBucket[]>([])
  const [activityLoading, setActivityLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      const [batchRes, lbRes, actRes] = await Promise.allSettled([
        fetch('/api/vision/batches').then(r => r.ok ? r.json() : null),
        fetch('/api/dn/vision/leaderboard').then(r => r.ok ? r.json() : null),
        fetch('/api/vision/activity?range=24h&bucket_mins=15').then(r => r.ok ? r.json() : null),
      ])
      if (cancelled) return
      if (batchRes.status === 'fulfilled' && batchRes.value) {
        setBatches(batchRes.value.batches ?? [])
      }
      if (lbRes.status === 'fulfilled' && lbRes.value) {
        setLeaderboard(lbRes.value.leaderboard ?? [])
      }
      if (actRes.status === 'fulfilled' && actRes.value) {
        setActivity(actRes.value.buckets ?? [])
      }
      setBatchLoading(false)
      setActivityLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  // --- Card 1: Batch Volume stats ---
  const batchStats = useMemo(() => {
    const active = batches.filter((b) => !b.paused).length
    const paused = batches.filter((b) => b.paused).length
    const totalPlayers = batches.reduce((sum, b) => sum + b.player_count, 0)
    return { active, paused, totalPlayers, total: batches.length }
  }, [batches])

  // --- Card 2: Pool Stats ---
  const poolStats = useMemo(() => {
    const totalTvlWei = batches.reduce((sum, b) => sum + Number(BigInt(b.tvl || '0')), 0)
    const totalTvl = totalTvlWei / 1e18
    const avgPlayers = batches.length > 0 ? batches.reduce((s, b) => s + b.player_count, 0) / batches.length : 0

    // Top 5 sources by TVL
    const tvlBySource: Record<string, number> = {}
    for (const b of batches) {
      const sid = b.source_id
      tvlBySource[sid] = (tvlBySource[sid] ?? 0) + Number(BigInt(b.tvl || '0')) / 1e18
    }
    const top5 = Object.entries(tvlBySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, tvl]) => ({
        source: truncateLabel(getSourceName(source)),
        fullName: getSourceName(source),
        tvl,
      }))

    return { totalTvl, avgPlayers, top5 }
  }, [batches])

  // --- Card 3: Settlement Outcomes (batches per source) ---
  const sourceBreakdown = useMemo(() => {
    const countBySource: Record<string, number> = {}
    for (const b of batches) {
      countBySource[b.source_id] = (countBySource[b.source_id] ?? 0) + 1
    }
    return Object.entries(countBySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([source, count]) => ({
        source: truncateLabel(getSourceName(source), 16),
        fullName: getSourceName(source),
        count,
      }))
  }, [batches])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Card 1: Batch Volume — live stat card */}
      <ExplorerChartCard title={t('explorer.vision_section.batch_volume')} subtitle={t('explorer.vision_section.batch_volume_desc')} loading={batchLoading}>
        <div className="h-full flex flex-col justify-center gap-5 px-2">
          <div className="grid grid-cols-3 gap-3">
            <StatBlock label={t('explorer.vision_section.active_batches')} value={batchStats.active} />
            <StatBlock label={t('explorer.vision_section.paused')} value={batchStats.paused} />
            <StatBlock label={t('explorer.vision_section.total_players')} value={batchStats.totalPlayers} />
          </div>
          <div className="border-t border-border-light pt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-title font-black text-black tracking-tight">{batchStats.total}</span>
              <span className="text-caption text-text-muted">{t('explorer.vision_section.total_batches')}</span>
            </div>
            <div className="mt-1.5 flex gap-4">
              <MiniBar label={t('explorer.vision_section.active')} value={batchStats.active} total={batchStats.total} color="#000" />
              <MiniBar label={t('explorer.vision_section.paused')} value={batchStats.paused} total={batchStats.total} color="#d1d5db" />
            </div>
          </div>
        </div>
      </ExplorerChartCard>

      {/* Card 2: Pool Stats — TVL, avg players, top 5 sources */}
      <ExplorerChartCard title={t('explorer.vision_section.batch_pool_stats')} subtitle={t('explorer.vision_section.batch_pool_stats_desc')} loading={batchLoading}>
        <div className="h-full flex flex-col">
          <div className="flex items-baseline gap-3 mb-3">
            <div>
              <span className="text-label text-text-muted block">{t('explorer.vision_section.total_tvl')}</span>
              <span className="text-heading font-black text-black tracking-tight">{formatTvl(poolStats.totalTvl)}</span>
            </div>
            <div className="ml-auto text-right">
              <span className="text-label text-text-muted block">{t('explorer.vision_section.avg_players_batch')}</span>
              <span className="text-subhead font-bold text-black">{poolStats.avgPlayers.toFixed(1)}</span>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {poolStats.top5.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={poolStats.top5}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 4 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#999' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatTvl(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="source"
                    tick={{ fontSize: 10, fill: '#666' }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e5e5' }}
                    formatter={(v: number, _: string, entry: any) => [formatTvl(v), entry.payload.fullName]}
                    labelFormatter={() => ''}
                  />
                  <Bar dataKey="tvl" radius={[0, 3, 3, 0]} maxBarSize={16}>
                    {poolStats.top5.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#000' : '#888'} fillOpacity={1 - i * 0.15} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-caption text-text-muted">{t('explorer.vision_section.no_batch_data')}</p>
              </div>
            )}
          </div>
        </div>
      </ExplorerChartCard>

      {/* Card 3: Batches by Source — horizontal bar chart */}
      <ExplorerChartCard title={t('explorer.vision_section.batches_by_source')} subtitle={t('explorer.vision_section.batches_by_source_desc')} loading={batchLoading}>
        <div className="h-full">
          {sourceBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sourceBreakdown}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 4 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#999' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="source"
                  tick={{ fontSize: 9, fill: '#666' }}
                  tickLine={false}
                  axisLine={false}
                  width={95}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e5e5' }}
                  formatter={(v: number, _: string, entry: any) => [t('explorer.vision_section.batch_count', { count: v }), entry.payload.fullName]}
                  labelFormatter={() => ''}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={14}>
                  {sourceBreakdown.map((_, i) => (
                    <Cell key={i} fill="#000" fillOpacity={Math.max(0.3, 1 - i * 0.06)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-caption text-text-muted">{t('explorer.vision_section.no_batch_data')}</p>
            </div>
          )}
        </div>
      </ExplorerChartCard>

      {/* Vision Network Activity — rounds settled & created per time bucket */}
      <ExplorerChartCard
        title={t('explorer.vision_section.network_activity')}
        subtitle={t('explorer.vision_section.network_activity_desc')}
        loading={activityLoading}
      >
        {activity.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v) =>
                  new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
                tick={{ fontSize: 10 }}
                stroke="#ccc"
              />
              <YAxis tick={{ fontSize: 10 }} stroke="#ccc" allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Area
                type="monotone"
                dataKey="rounds_settled"
                name={t('explorer.vision_section.rounds_settled')}
                stroke="#000"
                fill="#000"
                fillOpacity={0.08}
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="total_players"
                name={t('explorer.vision_section.players_joined')}
                stroke="#888"
                fill="#888"
                fillOpacity={0.05}
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-caption text-text-muted">{t('explorer.vision_section.no_activity_data')}</p>
          </div>
        )}
      </ExplorerChartCard>

      {/* Top Players — from data-node leaderboard */}
      <ExplorerChartCard
        title={t('explorer.vision_section.top_players')}
        subtitle={t('explorer.vision_section.ranked_players', { count: leaderboard.length })}
        loading={batchLoading}
      >
        <div className="h-full overflow-y-auto">
          {leaderboard.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-light">
                  <th className="text-micro font-semibold text-text-muted pb-1.5 pr-2">{t('explorer.vision_section.player_rank')}</th>
                  <th className="text-micro font-semibold text-text-muted pb-1.5 pr-2">{t('explorer.vision_section.player')}</th>
                  <th className="text-micro font-semibold text-text-muted pb-1.5 text-right pr-2">{t('explorer.vision_section.volume')}</th>
                  <th className="text-micro font-semibold text-text-muted pb-1.5 text-right pr-2">{t('explorer.vision_section.roi')}</th>
                  <th className="text-micro font-semibold text-text-muted pb-1.5 text-right">{t('explorer.vision_section.pnl')}</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 10).map((p) => (
                  <tr key={p.walletAddress} className="border-b border-border-light last:border-0">
                    <td className="py-1 pr-2 text-label text-text-muted">{p.rank}</td>
                    <td className="py-1 pr-2 text-label font-mono text-black">
                      {p.walletAddress.slice(0, 6)}...{p.walletAddress.slice(-4)}
                    </td>
                    <td className="py-1 pr-2 text-label font-mono text-right text-text-muted">
                      {p.totalVolume >= 1000 ? `$${(p.totalVolume / 1000).toFixed(1)}K` : `$${p.totalVolume.toFixed(0)}`}
                    </td>
                    <td className={`py-1 pr-2 text-label font-mono text-right font-semibold ${p.roi >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                      {p.roi >= 0 ? '+' : ''}{p.roi.toFixed(1)}%
                    </td>
                    <td className={`py-1 text-label font-mono text-right font-semibold ${p.pnl >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                      {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-caption text-text-muted">{t('explorer.vision_section.no_player_data')}</p>
            </div>
          )}
        </div>
      </ExplorerChartCard>

    </div>
  )
}


// --- Helper components ---

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-black/[0.03] rounded-lg px-3 py-2.5 text-center">
      <div className="text-heading font-black text-black tracking-tight leading-none">{value}</div>
      <div className="text-micro text-text-muted mt-1 leading-tight">{label}</div>
    </div>
  )
}

function MiniBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-micro text-text-muted">{label}</span>
        <span className="text-micro font-medium text-black">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
