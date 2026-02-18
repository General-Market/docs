'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts'
import { useAgentPerformance } from '@/hooks/useAgentPerformance'

/**
 * Props for the mini/sparkline performance graph
 */
export interface PerformanceGraphMiniProps {
  walletAddress: string
  height?: number  // Default: 40
}

/**
 * Loading skeleton for the mini graph
 */
function MiniSkeleton({ height }: { height: number }) {
  return (
    <div
      className="bg-white/5 animate-pulse rounded"
      style={{ height, width: '100%' }}
    />
  )
}

/**
 * PerformanceGraphMini component
 * Compact sparkline variant for homepage/leaderboard rows (AC: 4)
 * Fixed height, no axis labels, simple line with trend color
 */
export function PerformanceGraphMini({
  walletAddress,
  height = 40
}: PerformanceGraphMiniProps) {
  const { data, isLoading, isError } = useAgentPerformance(walletAddress, '30d')

  // Determine line color based on trend (last vs first point)
  const lineColor = useMemo(() => {
    if (!data?.dataPoints || data.dataPoints.length < 2) {
      return 'rgba(255,255,255,0.4)' // Neutral gray if not enough data
    }
    const firstPoint = data.dataPoints[0]
    const lastPoint = data.dataPoints[data.dataPoints.length - 1]
    return lastPoint.cumulativePnL >= firstPoint.cumulativePnL
      ? '#4ade80'  // green-400 (uptrend)
      : '#C40000'  // accent (downtrend)
  }, [data])

  // Handle loading state
  if (isLoading) {
    return <MiniSkeleton height={height} />
  }

  // Handle error or empty data - show flat line
  if (isError || !data?.dataPoints || data.dataPoints.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height }}
      >
        <div className="w-full h-px bg-white/20" />
      </div>
    )
  }

  // Handle single data point - show dot
  if (data.dataPoints.length === 1) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: lineColor }}
        />
      </div>
    )
  }

  // Determine trend direction for aria-label
  const trendDirection = data.dataPoints[data.dataPoints.length - 1].cumulativePnL >=
    data.dataPoints[0].cumulativePnL ? 'upward' : 'downward'

  return (
    <div
      role="img"
      aria-label={`Performance sparkline showing ${trendDirection} trend over ${data.dataPoints.length} data points`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data.dataPoints}
          margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
        >
          <Line
            type="monotone"
            dataKey="cumulativePnL"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
