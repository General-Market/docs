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
    <div className={`bg-white border border-border-light rounded-card p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-[14px] font-bold text-black leading-tight">{title}</h3>
        {subtitle && (
          <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      {loading ? (
        <div className="h-[200px] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-border-light border-t-black rounded-full animate-spin" />
        </div>
      ) : (
        <div className="h-[200px]">{children}</div>
      )}
    </div>
  )
}
