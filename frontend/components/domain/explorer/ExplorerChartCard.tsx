'use client'

import { ReactNode } from 'react'

interface ExplorerChartCardProps {
  title: string
  subtitle?: string
  loading?: boolean
  children: ReactNode
  className?: string
}

export function ExplorerChartCard({ title, subtitle, loading, children, className = '' }: ExplorerChartCardProps) {
  return (
    <div
      className={`
        explorer-glass-card
        relative rounded-xl p-5
        glass-surface-dark
        transition-[border-color,box-shadow] duration-300
        hover:border-white/[0.15]
        hover:shadow-[0_0_40px_-8px_rgba(255,255,255,0.05)]
        ${className}
      `}
    >
      {/* Inner gradient — ambient depth */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.02] via-transparent to-transparent pointer-events-none" />

      <div className="relative">
        <div className="mb-4">
          <h3 className="text-body font-bold text-white leading-tight">{title}</h3>
          {subtitle && (
            <p className="text-label text-white/40 mt-0.5">{subtitle}</p>
          )}
        </div>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="min-h-[200px]">{children}</div>
        )}
      </div>
    </div>
  )
}
