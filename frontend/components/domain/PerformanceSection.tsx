'use client'

import { FillSpeedChart } from '@/components/domain/FillSpeedChart'
import { InventoryBumpChart } from '@/components/domain/InventoryBumpChart'

interface PerformanceSectionProps {
  expanded: boolean
  onToggle: () => void
}

export function PerformanceSection({ expanded, onToggle }: PerformanceSectionProps) {
  return (
    <div id="performance">
      {!expanded && (
        <button
          onClick={onToggle}
          className="w-full bg-card rounded-xl shadow-card border border-border-light p-4 flex justify-between items-center text-left hover:shadow-card-hover transition-shadow"
        >
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Performance Dashboard</h2>
            <p className="text-sm text-text-secondary">Order fill speed and system metrics</p>
          </div>
          <span className="text-text-muted text-2xl">+</span>
        </button>
      )}

      {expanded && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-1">Performance</p>
              <h2 className="text-lg font-semibold text-text-primary">Performance Dashboard</h2>
            </div>
            <button onClick={onToggle} className="text-text-muted text-2xl hover:text-text-primary">−</button>
          </div>

          <FillSpeedChart />
          <InventoryBumpChart />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl shadow-card border border-border-light p-6 text-center">
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Consensus Threshold</p>
              <p className="text-3xl font-bold text-text-primary font-mono tabular-nums">2/3</p>
              <p className="text-xs text-text-muted mt-1">BLS signatures required</p>
            </div>
            <div className="bg-card rounded-xl shadow-card border border-border-light p-6 text-center">
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Active Issuers</p>
              <p className="text-3xl font-bold text-text-primary font-mono tabular-nums">3</p>
              <p className="text-xs text-text-muted mt-1">Processing orders</p>
            </div>
            <div className="bg-card rounded-xl shadow-card border border-border-light p-6 text-center">
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Network</p>
              <p className="text-3xl font-bold text-text-primary">Index L3</p>
              <p className="text-xs text-text-muted mt-1">Orbit chain</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
