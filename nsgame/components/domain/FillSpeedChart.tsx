'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { DATA_NODE_URL } from '@/lib/config'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'

interface FillSpeedEntry {
  order_id: number
  side: number
  amount: string
  submit_time: string
  fill_time: string | null
  fill_latency_secs: number | null
  fill_price: string | null
  fill_amount: string | null
}

interface ChartPoint {
  index: number
  orderId: number
  side: number // 0=buy, 1=sell
  amount: number // in tokens (divided by 1e18)
  barValue: number // positive for buy, negative for sell
  filled: boolean
  fillLatency: number | null // seconds
  submitTime: string
  dateLabel: string
}

/**
 * Order flow chart, bar chart of buy/sell amounts over time,
 * colored by fill status. Fill latency visible in tooltip.
 *
 * Previously used AreaChart with separate buy/sell series and
 * connectNulls={false}, which made most orders invisible due to
 * null gaps between alternating sides. Outlier amounts (1269 vs 10)
 * crushed the Y-axis, hiding 95% of data points.
 *
 * Now: single BarChart, buys as positive bars, sells as negative.
 * Filled = solid, unfilled = dimmed. All orders visible.
 */
export function FillSpeedChart() {
  const t = useTranslations('system')
  const [raw, setRaw] = useState<FillSpeedEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${DATA_NODE_URL}/fill-speed`)
      if (!res.ok) throw new Error(`Fill-speed fetch failed: ${res.status}`)
      const entries: FillSpeedEntry[] = await res.json()
      setRaw(entries)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const data: ChartPoint[] = useMemo(() => {
    // Reverse so oldest first (left-to-right chronological)
    const sorted = [...raw].reverse()
    return sorted.map((e, i) => {
      const amount = parseFloat(e.amount) / 1e18
      return {
        index: i,
        orderId: e.order_id,
        side: e.side,
        amount,
        barValue: e.side === 0 ? amount : -amount,
        filled: e.fill_time !== null,
        fillLatency: e.fill_latency_secs,
        submitTime: e.submit_time,
        dateLabel: formatDateTime(e.submit_time),
      }
    })
  }, [raw])

  const stats = useMemo(() => {
    const total = data.length
    const filled = data.filter(d => d.filled).length
    const buys = data.filter(d => d.side === 0).length
    const sells = data.filter(d => d.side === 1).length
    const latencies = data
      .filter(d => d.fillLatency !== null)
      .map(d => d.fillLatency!)
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0
    const medianLatency = latencies.length > 0
      ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)]
      : 0
    return { total, filled, buys, sells, avgLatency, medianLatency }
  }, [data])

  // Compute Y-axis domain using P95 to avoid outlier distortion
  const yDomain = useMemo(() => {
    if (data.length === 0) return [-10, 10]
    const absAmounts = data.map(d => d.amount).sort((a, b) => a - b)
    // Use P95 as the cap, outliers beyond this are clipped
    const p95Index = Math.floor(absAmounts.length * 0.95)
    const cap = absAmounts[p95Index] * 1.15 // 15% headroom
    return [-cap, cap]
  }, [data])

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-card p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">{t('order_flow.title')}</h2>
        <div className="text-color-down text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-card p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">{t('order_flow.title')}</h2>
          <p className="text-sm text-text-secondary">{t('order_flow.description')}</p>
        </div>
        {stats.medianLatency > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-zinc-900 font-mono tabular-nums">
              {formatLatency(stats.medianLatency)}
            </p>
            <p className="text-xs text-text-secondary">{t('order_flow.avg_fill_time')}</p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-muted rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-text-primary font-mono tabular-nums">{stats.total}</p>
          <p className="text-xs text-text-muted">{t('order_flow.total_orders')}</p>
        </div>
        <div className="bg-surface-up rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-color-up font-mono tabular-nums">{stats.buys}</p>
          <p className="text-xs text-text-muted">{t('order_flow.active_buys')}</p>
        </div>
        <div className="bg-surface-down rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-color-down font-mono tabular-nums">{stats.sells}</p>
          <p className="text-xs text-text-muted">{t('order_flow.active_sells')}</p>
        </div>
        <div className="bg-muted rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-zinc-900 font-mono tabular-nums">{stats.filled}</p>
          <p className="text-xs text-text-muted">{t('order_flow.filled')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-text-secondary">
          {t('order_flow.loading')}
        </div>
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-text-secondary">
          {t('order_flow.no_data')}
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis
                dataKey="dateLabel"
                stroke="#D4D4D8"
                tick={{ fill: '#A1A1AA', fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#D4D4D8"
                tick={{ fill: '#A1A1AA', fontSize: 11 }}
                domain={yDomain}
                tickFormatter={(v: number) => {
                  const abs = Math.abs(v)
                  if (abs >= 1000) return `${(abs / 1000).toFixed(0)}k`
                  if (abs >= 100) return abs.toFixed(0)
                  return abs.toFixed(0)
                }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as ChartPoint
                  return (
                    <div className="bg-white border border-border-light rounded-xl p-3 shadow-lg text-xs font-mono">
                      <div className="text-text-primary font-semibold mb-1">
                        Order #{p.orderId}
                      </div>
                      <div className="text-text-secondary">{p.dateLabel}</div>
                      <div className="mt-1.5 space-y-0.5">
                        <div>
                          <span className={p.side === 0 ? 'text-color-up' : 'text-color-down'}>
                            {p.side === 0 ? 'BUY' : 'SELL'}
                          </span>
                          {' '}{p.amount.toFixed(2)} GM
                        </div>
                        {p.filled ? (
                          <div className="text-text-secondary">
                            Filled in {formatLatency(p.fillLatency!)}
                          </div>
                        ) : (
                          <div className="text-amber-500">Pending</div>
                        )}
                      </div>
                    </div>
                  )
                }}
              />
              <ReferenceLine y={0} stroke="#D4D4D8" strokeWidth={1} />
              <Bar dataKey="barValue" radius={[2, 2, 0, 0]} maxBarSize={8}>
                {data.map((entry) => (
                  <Cell
                    key={entry.orderId}
                    fill={entry.side === 0 ? '#16A34A' : '#DC2626'}
                    fillOpacity={entry.filled ? 0.85 : 0.3}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      {data.length > 0 && (
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border-light text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-color-up opacity-85"></span>
            <span>{t('order_flow.legend_buy')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-color-down opacity-85"></span>
            <span>{t('order_flow.legend_sell')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-border-medium opacity-30"></span>
            <span>Pending</span>
          </div>
          <span className="ml-auto font-mono tabular-nums">{t('order_flow.orders_count', { count: stats.total })}</span>
        </div>
      )}
    </div>
  )
}

/** Format seconds into a human-readable latency string */
function formatLatency(secs: number): string {
  if (secs < 60) return `${secs.toFixed(0)}s`
  if (secs < 3600) return `${(secs / 60).toFixed(1)}m`
  const hours = secs / 3600
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

/** Format ISO timestamp to compact date+time */
function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const month = (d.getMonth() + 1).toString()
  const day = d.getDate().toString()
  const hours = d.getHours().toString().padStart(2, '0')
  const mins = d.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hours}:${mins}`
}
