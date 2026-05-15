'use client'

import { ReactNode } from 'react'

interface ExplorerChartCardProps {
  title: string
  subtitle?: string
  loading?: boolean
  children: ReactNode
  className?: string
  /**
   * Tailwind classes applied to the body wrapper around `children`.
   * Default `h-[200px]` gives Recharts ResponsiveContainer (`height="100%"`)
   * a definite parent height. Pass `min-h-[200px]` (or similar) for cards
   * that contain natural-flow content like scrollable lists or grids.
   */
  bodyClassName?: string
}

export function ExplorerChartCard({ title, subtitle, loading, children, className = '', bodyClassName = 'h-[200px]' }: ExplorerChartCardProps) {
  return (
    <div
      className={`
        explorer-glass-card explorer-light-card
        relative rounded-apple-md p-5
        ${className}
      `}
    >
      <div className="relative">
        <div className="mb-4">
          <h3 className="text-body font-semibold tracking-apple-tight text-[#1d1d1f] leading-tight">{title}</h3>
          {subtitle && (
            <p className="text-label tracking-apple-tight text-[#86868b] mt-1">{subtitle}</p>
          )}
        </div>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-black/[0.08] border-t-[#1d1d1f] rounded-full animate-spin" />
          </div>
        ) : (
          <div className={`explorer-chart-reveal ${bodyClassName}`}>{children}</div>
        )}
      </div>
    </div>
  )
}
