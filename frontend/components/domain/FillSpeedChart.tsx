'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { DATA_NODE_URL } from '@/lib/config'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface OrderDataPoint {
  time: number // unix timestamp
  timeLabel: string
  buyAmount: number | null
  sellAmount: number | null
  orderId: number
  filled: boolean
  fillTime?: number // seconds
}

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

/**
 * Displays order flow chart using the /fill-speed data-node endpoint.
 *
 * Previously this scanned ALL OrderSubmitted + FillConfirmed events via getLogs
 * from block 0 every 5 seconds -- extremely heavy on-chain read.
 *
 * Now fetches from /fill-speed which returns global order flow data with
 * submit + fill timestamps, enabling fill latency computation.
 */
export function FillSpeedChart() {
  const t = useTranslations('system')
  const [data, setData] = useState<OrderDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [avgFillTime, setAvgFillTime] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${DATA_NODE_URL}/fill-speed`)
      if (!res.ok) throw new Error(`Fill-speed fetch failed: ${res.status}`)
      const entries: FillSpeedEntry[] = await res.json()

      const points: OrderDataPoint[] = entries.map((e) => {
        const unixTime = Math.floor(new Date(e.submit_time).getTime() / 1000)
        return {
          time: unixTime,
          timeLabel: formatTime(unixTime),
          buyAmount: e.side === 0 ? parseFloat(e.amount) / 1e6 : null,
          sellAmount: e.side === 1 ? parseFloat(e.amount) / 1e18 : null,
          orderId: e.order_id,
          filled: e.fill_time !== null,
          fillTime: e.fill_latency_secs ?? undefined,
        }
      })

      const filledPoints = points.filter((p) => p.fillTime !== undefined)
      const avg =
        filledPoints.length > 0
          ? filledPoints.reduce((sum, p) => sum + p.fillTime!, 0) / filledPoints.length
          : 0

      setData(points)
      setAvgFillTime(avg)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Poll every 30s instead of 5s since we're hitting REST, not chain
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const totalOrders = data.length
  const filledOrders = data.filter(d => d.filled).length
  const activeBuys = data.filter(d => d.buyAmount !== null && d.buyAmount > 0).length
  const activeSells = data.filter(d => d.sellAmount !== null && d.sellAmount > 0).length

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
        {avgFillTime > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-zinc-900 font-mono tabular-nums">{avgFillTime.toFixed(1)}s</p>
            <p className="text-xs text-text-secondary">{t('order_flow.avg_fill_time')}</p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-muted rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-text-primary font-mono tabular-nums">{totalOrders}</p>
          <p className="text-xs text-text-muted">{t('order_flow.total_orders')}</p>
        </div>
        <div className="bg-surface-up rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-color-up font-mono tabular-nums">{activeBuys}</p>
          <p className="text-xs text-text-muted">{t('order_flow.active_buys')}</p>
        </div>
        <div className="bg-surface-down rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-color-down font-mono tabular-nums">{activeSells}</p>
          <p className="text-xs text-text-muted">{t('order_flow.active_sells')}</p>
        </div>
        <div className="bg-muted rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-zinc-900 font-mono tabular-nums">{filledOrders}</p>
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
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="buyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sellGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis
                dataKey="timeLabel"
                stroke="#D4D4D8"
                tick={{ fill: '#A1A1AA', fontSize: 10 }}
              />
              <YAxis
                stroke="#D4D4D8"
                tick={{ fill: '#A1A1AA', fontSize: 11 }}
                label={{ value: 'Amount', angle: -90, position: 'insideLeft', fill: '#A1A1AA' }}
                domain={[0, 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                }}
                labelStyle={{ color: '#18181B' }}
                formatter={(value: number, name: string) => {
                  if (value === null) return [null, null]
                  const label = name === 'buyAmount' ? 'Buy' : 'Sell'
                  return [value === 0 ? 'Filled (0)' : value.toFixed(4), label]
                }}
                labelFormatter={(label: string, items: any[]) => {
                  const point = items?.[0]?.payload as OrderDataPoint | undefined
                  if (!point) return label
                  let str = `Order #${point.orderId} | ${label}`
                  if (point.filled && point.fillTime !== undefined) {
                    str += ` | Filled in ${point.fillTime}s`
                  }
                  return str
                }}
              />
              <ReferenceLine y={0} stroke="#E4E4E7" />
              <Area
                type="monotone"
                dataKey="buyAmount"
                stroke="#16A34A"
                strokeWidth={2}
                fill="url(#buyGradient)"
                connectNulls={false}
                dot={(props: any) => {
                  if (props.value === null) return <g key={props.index} />
                  return (
                    <circle
                      key={props.index}
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill="#16A34A"
                      stroke="#16A34A"
                      strokeWidth={props.value === 0 ? 1 : 2}
                      opacity={props.value === 0 ? 0.4 : 1}
                    />
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="sellAmount"
                stroke="#DC2626"
                strokeWidth={2}
                fill="url(#sellGradient)"
                connectNulls={false}
                dot={(props: any) => {
                  if (props.value === null) return <g key={props.index} />
                  return (
                    <circle
                      key={props.index}
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill="#DC2626"
                      stroke="#DC2626"
                      strokeWidth={props.value === 0 ? 1 : 2}
                      opacity={props.value === 0 ? 0.4 : 1}
                    />
                  )
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      {data.length > 0 && (
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border-light text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-color-up"></span>
            <span>{t('order_flow.legend_buy')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-color-down"></span>
            <span>{t('order_flow.legend_sell')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-border-medium"></span>
            <span>{t('order_flow.legend_filled')}</span>
          </div>
          <span className="ml-auto font-mono tabular-nums">{t('order_flow.orders_count', { count: totalOrders })}</span>
        </div>
      )}
    </div>
  )
}

function formatTime(unixTimestamp: number): string {
  const d = new Date(unixTimestamp * 1000)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
