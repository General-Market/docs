'use client'

import { FillSpeedChart } from '@/components/domain/FillSpeedChart'
import { InventoryBumpChart } from '@/components/domain/InventoryBumpChart'

interface PerformanceSectionProps {
  expanded: boolean
  onToggle: () => void
}

export function PerformanceSection({ expanded, onToggle }: PerformanceSectionProps) {
  return (
    <div id="performance" className="bg-terminal-dark/50 border border-white/10 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full p-4 flex justify-between items-center text-left"
      >
        <div>
          <h2 className="text-xl font-bold text-white">Performance Dashboard</h2>
          <p className="text-sm text-white/50">Order fill speed and system metrics</p>
        </div>
        <span className="text-accent text-2xl">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 border-t border-white/10 space-y-4">
          <FillSpeedChart />
          <InventoryBumpChart />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-terminal border border-white/10 rounded-lg p-4 text-center">
              <p className="text-xs text-white/50 mb-1">Consensus Threshold</p>
              <p className="text-2xl font-bold text-white">2/3</p>
              <p className="text-xs text-white/40">BLS signatures required</p>
            </div>
            <div className="bg-terminal border border-white/10 rounded-lg p-4 text-center">
              <p className="text-xs text-white/50 mb-1">Active Issuers</p>
              <p className="text-2xl font-bold text-white">3</p>
              <p className="text-xs text-white/40">Processing orders</p>
            </div>
            <div className="bg-terminal border border-white/10 rounded-lg p-4 text-center">
              <p className="text-xs text-white/50 mb-1">Network</p>
              <p className="text-2xl font-bold text-white">Index L3</p>
              <p className="text-xs text-white/40">Orbit chain</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
