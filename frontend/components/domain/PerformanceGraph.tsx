'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  TooltipProps
} from 'recharts'
import { useAgentPerformance, PerformanceDataPoint } from '@/hooks/useAgentPerformance'
import { formatDate, formatResultWithPercent } from '@/lib/utils/formatters'

/**
 * Props for the main PerformanceGraph component
 */
export interface PerformanceGraphProps {
  walletAddress: string
  height?: number           // Default: 400
  showAxisLabels?: boolean  // Default: true
  showTooltip?: boolean     // Default: true
  range?: '7d' | '30d' | '90d' | 'all'  // Default: '30d'
}

/**
 * Formats a date for X-axis display (short format: "Jan 20")
 */
function formatShortDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Custom tooltip component matching Dev Arena design
 * Black bg, white border, monospace numbers
 * Uses shared formatters from lib/utils/formatters.ts
 */
function PerformanceTooltip({
  active,
  payload
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload as PerformanceDataPoint

  return (
    <div className="bg-terminal border border-white/20 p-3 font-mono text-sm shadow-lg">
      <p className="text-white font-bold mb-2">Portfolio Bet #{data.betNumber}</p>
      <div className="space-y-1 text-white/80">
        <p>Date: {formatDate(data.timestamp)}</p>
        <p>Markets: {(data.portfolioSize ?? 0).toLocaleString()}</p>
        <p>Amount: ${(data.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        <p className={data.result >= 0 ? 'text-green-400' : 'text-white/60'}>
          Result: {formatResultWithPercent(data.result, data.resultPercent)}
        </p>
      </div>
    </div>
  )
}

/**
 * Loading skeleton for the performance graph
 */
function PerformanceGraphSkeleton({ height }: { height: number }) {
  return (
    <div
      className="bg-terminal border border-white/20 animate-pulse"
      style={{ height }}
    >
      <div className="h-full flex items-center justify-center">
        <div className="w-full h-3/4 mx-8 bg-white/5 rounded">
          {/* Simulate chart area */}
          <div className="w-full h-full flex items-end justify-around px-4 pb-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="w-2 bg-white/10 rounded-t"
                style={{ height: `${20 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Empty state when agent has no performance data
 */
function EmptyState({ height }: { height: number }) {
  return (
    <div
      className="bg-terminal border border-white/20 flex items-center justify-center"
      style={{ height }}
    >
      <div className="text-center">
        <p className="text-white/60 font-mono">No performance data</p>
        <p className="text-white/40 text-sm mt-1">
          Data will appear once the agent has settled bets
        </p>
      </div>
    </div>
  )
}

/**
 * PerformanceGraph component
 * Displays line chart of cumulative P&L over time using Recharts
 * Implements Dev Arena-style design (AC: 1, 3, 6)
 */
export function PerformanceGraph({
  walletAddress,
  height = 400,
  showAxisLabels = true,
  showTooltip = true,
  range = '30d'
}: PerformanceGraphProps) {
  const { data, isLoading, isError, error } = useAgentPerformance(walletAddress, range)

  // Determine line color based on ending P&L (green if positive, red if negative)
  const isPositive = useMemo(() => {
    if (!data?.dataPoints || data.dataPoints.length === 0) return true
    const lastPoint = data.dataPoints[data.dataPoints.length - 1]
    return lastPoint.cumulativePnL >= 0
  }, [data])

  const lineColor = isPositive ? '#4ade80' : '#C40000' // green-400 or accent

  // Handle loading state
  if (isLoading) {
    return <PerformanceGraphSkeleton height={height} />
  }

  // Handle error state
  if (isError) {
    return (
      <div
        className="bg-terminal border border-accent/50 flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center">
          <p className="text-accent font-mono">Error loading performance data</p>
          <p className="text-white/40 text-sm mt-1">{error?.message}</p>
        </div>
      </div>
    )
  }

  // Handle empty data
  if (!data?.dataPoints || data.dataPoints.length === 0) {
    return <EmptyState height={height} />
  }

  return (
    <div
      className="bg-terminal border border-white/20"
      role="img"
      aria-label={`Performance graph showing ${data.dataPoints.length} data points with cumulative P&L of $${data.summary.endingPnL.toLocaleString()}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data.dataPoints}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          {/* Grid - subtle white lines (AC: 3) */}
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.1)"
            vertical={false}
          />

          {/* X-Axis - Time (AC: 1) */}
          <XAxis
            dataKey="timestamp"
            tick={showAxisLabels ? { fill: 'white', fontSize: 12 } : false}
            tickFormatter={formatShortDate}
            stroke="rgba(255,255,255,0.3)"
            axisLine={{ stroke: 'rgba(255,255,255,0.3)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.3)' }}
          />

          {/* Y-Axis - Cumulative P&L (AC: 1) */}
          <YAxis
            tick={showAxisLabels ? {
              fill: 'white',
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace'
            } : false}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
            stroke="rgba(255,255,255,0.3)"
            axisLine={{ stroke: 'rgba(255,255,255,0.3)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.3)' }}
            width={showAxisLabels ? 80 : 30}
          />

          {/* Breakeven line at y=0 (AC: 3) */}
          <ReferenceLine
            y={0}
            stroke="#C40000"
            strokeDasharray="5 5"
            strokeWidth={1}
          />

          {/* Custom tooltip (AC: 2) */}
          {showTooltip && (
            <Tooltip
              content={<PerformanceTooltip />}
              cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
            />
          )}

          {/* P&L line (AC: 1) */}
          <Line
            type="monotone"
            dataKey="cumulativePnL"
            stroke={lineColor}
            strokeWidth={2}
            dot={{
              fill: lineColor,
              r: 4,
              strokeWidth: 0
            }}
            activeDot={{
              r: 6,
              stroke: 'white',
              strokeWidth: 2,
              fill: lineColor
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
