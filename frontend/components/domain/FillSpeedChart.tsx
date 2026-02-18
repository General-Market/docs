'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePublicClient } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { formatUnits } from 'viem'
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

export function FillSpeedChart() {
  const publicClient = usePublicClient()
  const [data, setData] = useState<OrderDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [avgFillTime, setAvgFillTime] = useState(0)
  const publicClientRef = useRef(publicClient)

  useEffect(() => { publicClientRef.current = publicClient }, [publicClient])

  const fetchData = useCallback(async () => {
    const client = publicClientRef.current
    if (!client) return

    try {
      // Get OrderSubmitted events
      const orderLogs = await client.getLogs({
        address: INDEX_PROTOCOL.index,
        event: {
          type: 'event',
          name: 'OrderSubmitted',
          inputs: [
            { indexed: true, name: 'orderId', type: 'uint256' },
            { indexed: true, name: 'user', type: 'address' },
            { indexed: true, name: 'itpId', type: 'bytes32' },
            { indexed: false, name: 'pairId', type: 'bytes32' },
            { indexed: false, name: 'side', type: 'uint8' },
            { indexed: false, name: 'amount', type: 'uint256' },
            { indexed: false, name: 'limitPrice', type: 'uint256' },
            { indexed: false, name: 'slippageTier', type: 'uint256' },
            { indexed: false, name: 'deadline', type: 'uint256' },
          ],
        },
        fromBlock: 0n,
        toBlock: 'latest',
      })

      // Get FillConfirmed events
      const fillLogs = await client.getLogs({
        address: INDEX_PROTOCOL.index,
        event: {
          type: 'event',
          name: 'FillConfirmed',
          inputs: [
            { indexed: true, name: 'orderId', type: 'uint256' },
            { indexed: true, name: 'cycleNumber', type: 'uint256' },
            { indexed: false, name: 'fillPrice', type: 'uint256' },
            { indexed: false, name: 'fillAmount', type: 'uint256' },
          ],
        },
        fromBlock: 0n,
        toBlock: 'latest',
      })

      // Build fill map: orderId -> fillBlockNumber
      const fillMap = new Map<string, bigint>()
      for (const log of fillLogs) {
        const orderId = (log.topics[1]) as string
        fillMap.set(orderId, log.blockNumber)
      }

      // Cache block timestamps
      const blockTimestampCache = new Map<string, bigint>()
      async function getBlockTimestamp(blockNumber: bigint): Promise<bigint> {
        const key = blockNumber.toString()
        const cached = blockTimestampCache.get(key)
        if (cached !== undefined) return cached
        const block = await client!.getBlock({ blockNumber })
        blockTimestampCache.set(key, block.timestamp)
        return block.timestamp
      }

      // Build data points from last 50 orders
      // For filled orders: 2 points (spike at submit time, drop to 0 at fill time)
      // For active orders: 1 point at submit time with amount
      const points: OrderDataPoint[] = []
      const fillTimes: number[] = []

      for (const log of orderLogs.slice(-50)) {
        const args = log.args as any
        const orderId = args.orderId ? Number(args.orderId) : 0
        const orderIdHex = log.topics[1] as string
        const side = Number(args.side ?? 0)
        const amount = Number(formatUnits(args.amount ?? 0n, 18))

        const submitTimestamp = await getBlockTimestamp(log.blockNumber)
        const time = Number(submitTimestamp)
        const isFilled = fillMap.has(orderIdHex)

        // Always show the original amount at submission time (the spike)
        points.push({
          time,
          timeLabel: formatTime(time),
          buyAmount: side === 0 ? amount : null,
          sellAmount: side === 1 ? amount : null,
          orderId,
          filled: isFilled,
        })

        // For filled orders, add a second point at fill time showing 0
        if (isFilled) {
          const fillBlock = fillMap.get(orderIdHex)!
          const fillTimestamp = await getBlockTimestamp(fillBlock)
          const ft = Number(fillTimestamp - submitTimestamp)
          fillTimes.push(ft)

          points.push({
            time: Number(fillTimestamp),
            timeLabel: formatTime(Number(fillTimestamp)),
            buyAmount: side === 0 ? 0 : null,
            sellAmount: side === 1 ? 0 : null,
            orderId,
            filled: true,
            fillTime: ft,
          })
        }
      }

      // Sort by time so the chart renders chronologically
      points.sort((a, b) => a.time - b.time)

      setData(points)
      setAvgFillTime(fillTimes.length > 0
        ? fillTimes.reduce((a, b) => a + b, 0) / fillTimes.length
        : 0
      )
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  const totalOrders = data.length
  const filledOrders = data.filter(d => d.filled).length
  const activeBuys = data.filter(d => d.buyAmount !== null && d.buyAmount > 0).length
  const activeSells = data.filter(d => d.sellAmount !== null && d.sellAmount > 0).length

  if (error) {
    return (
      <div className="bg-terminal-dark/50 border border-white/10 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Order Flow</h2>
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div className="bg-terminal-dark/50 border border-white/10 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Order Flow</h2>
          <p className="text-sm text-white/50">Outstanding buy/sell amounts over time</p>
        </div>
        {avgFillTime > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-accent">{avgFillTime.toFixed(1)}s</p>
            <p className="text-xs text-white/50">avg fill time</p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-black/30 rounded p-2 text-center">
          <p className="text-lg font-bold text-white">{totalOrders}</p>
          <p className="text-xs text-white/40">Total Orders</p>
        </div>
        <div className="bg-black/30 rounded p-2 text-center">
          <p className="text-lg font-bold text-green-400">{activeBuys}</p>
          <p className="text-xs text-white/40">Active Buys</p>
        </div>
        <div className="bg-black/30 rounded p-2 text-center">
          <p className="text-lg font-bold text-red-400">{activeSells}</p>
          <p className="text-xs text-white/40">Active Sells</p>
        </div>
        <div className="bg-black/30 rounded p-2 text-center">
          <p className="text-lg font-bold text-accent">{filledOrders}</p>
          <p className="text-xs text-white/40">Filled</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-white/50">
          Loading order data...
        </div>
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-white/50">
          No order data yet. Orders need to be submitted first.
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="buyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sellGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="timeLabel"
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                label={{ value: 'Amount', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.4)' }}
                domain={[0, 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#000',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
                labelStyle={{ color: '#fff' }}
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
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
              <Area
                type="monotone"
                dataKey="buyAmount"
                stroke="#22c55e"
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
                      fill={props.value === 0 ? '#22c55e' : '#22c55e'}
                      stroke="#22c55e"
                      strokeWidth={props.value === 0 ? 1 : 2}
                      opacity={props.value === 0 ? 0.4 : 1}
                    />
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="sellAmount"
                stroke="#ef4444"
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
                      fill="#ef4444"
                      stroke="#ef4444"
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
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10 text-xs text-white/50">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>BUY</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span>SELL</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-white/30"></span>
            <span>Filled (0)</span>
          </div>
          <span className="ml-auto">{totalOrders} orders</span>
        </div>
      )}
    </div>
  )
}

function formatTime(unixTimestamp: number): string {
  const d = new Date(unixTimestamp * 1000)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
