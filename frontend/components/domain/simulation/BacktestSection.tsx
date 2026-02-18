'use client'

import { useState, useCallback } from 'react'
import { SimFilterPanel, SimFilterState } from './SimFilterPanel'
import { SimProgressBar } from './SimProgressBar'
import { SimStatsGrid } from './SimStatsGrid'
import { SimPerformanceChart } from './SimPerformanceChart'
import { SimHoldingsTable } from './SimHoldingsTable'
import { SimSweepStatsTable } from './SimSweepStatsTable'
import { useSimulation } from '@/hooks/useSimulation'
import { useSimSweep } from '@/hooks/useSimSweep'

interface BacktestSectionProps {
  expanded: boolean
  onToggle: () => void
}

export function BacktestSection({ expanded, onToggle }: BacktestSectionProps) {
  const [filters, setFilters] = useState<SimFilterState>({
    category_id: '',
    top_n: 10,
    weighting: 'equal',
    rebalance_days: 30,
    base_fee_pct: 0.1,
    spread_multiplier: 1.0,
    sweep: 'none',
  })

  const isSweep = filters.sweep !== 'none'

  // Single simulation hook
  const sim = useSimulation(
    !isSweep && filters.category_id ? {
      category_id: filters.category_id,
      top_n: filters.top_n,
      weighting: filters.weighting,
      rebalance_days: filters.rebalance_days,
      base_fee_pct: filters.base_fee_pct,
      spread_multiplier: filters.spread_multiplier,
    } : null,
  )

  // Sweep hook
  const sweep = useSimSweep(
    isSweep && filters.category_id ? {
      category_id: filters.category_id,
      sweep: filters.sweep,
      weighting: filters.weighting,
      rebalance_days: filters.rebalance_days,
      top_n: filters.top_n,
      base_fee_pct: filters.base_fee_pct,
      spread_multiplier: filters.spread_multiplier,
    } : null,
  )

  const handleRun = useCallback(() => {
    if (isSweep) {
      sweep.run()
    } else {
      sim.run()
    }
  }, [isSweep, sim, sweep])

  const isLoading = isSweep ? sweep.status === 'loading' : sim.status === 'loading'

  return (
    <div className="bg-terminal-dark/50 border border-white/10 rounded-lg">
      {/* Header */}
      <div className="p-4 flex justify-between items-center">
        <button
          onClick={onToggle}
          className="flex-1 flex justify-between items-center text-left"
        >
          <div>
            <h2 className="text-lg font-bold text-white font-mono">Index Backtester</h2>
            <p className="text-xs text-white/50 font-mono">
              Simulate historical index performance across categories, sizes & strategies
            </p>
          </div>
          <span className="text-accent text-2xl font-mono ml-4">{expanded ? '−' : '+'}</span>
        </button>
      </div>

      {/* Content */}
      {expanded && (
        <div className="border-t border-white/10 p-4">
          {/* Filter Panel */}
          <SimFilterPanel
            filters={filters}
            onChange={setFilters}
            onRun={handleRun}
            isLoading={isLoading}
          />

          {/* Error */}
          {(sim.error || sweep.error) && (
            <div className="text-accent text-xs font-mono p-3 bg-accent/10 border border-accent/20 rounded mb-4">
              {sim.error || sweep.error}
            </div>
          )}

          {/* Single Simulation Results */}
          {!isSweep && (
            <>
              {/* Progress */}
              {sim.status === 'loading' && (
                <SimProgressBar mode="single" progress={sim.progress} />
              )}

              {/* Stats */}
              {sim.result?.stats && (
                <SimStatsGrid stats={sim.result.stats} />
              )}

              {/* Chart */}
              {sim.result?.nav_series && sim.result.nav_series.length > 0 && (
                <SimPerformanceChart
                  mode="single"
                  navSeries={sim.result.nav_series}
                />
              )}

              {/* Holdings */}
              {sim.result?.run_id && (
                <div className="mt-4">
                  <h3 className="text-xs text-white/40 font-mono uppercase mb-2">Holdings (Latest Rebalance)</h3>
                  <SimHoldingsTable runId={sim.result.run_id} />
                </div>
              )}
            </>
          )}

          {/* Sweep Results */}
          {isSweep && (
            <>
              {/* Progress */}
              {sweep.status === 'loading' && (
                <SimProgressBar
                  mode="sweep"
                  progress={sweep.progress}
                  completedCount={sweep.completedVariants.length}
                  totalVariants={sweep.progress?.total_variants || 0}
                />
              )}

              {/* Sweep Stats Table */}
              {sweep.completedVariants.length > 0 && (
                <SimSweepStatsTable
                  variants={sweep.completedVariants.map(v => ({
                    variant: v.variant,
                    stats: v.stats,
                  }))}
                />
              )}

              {/* Sweep Chart (progressively updated) */}
              {sweep.completedVariants.length > 0 && (
                <SimPerformanceChart
                  mode="sweep"
                  variants={sweep.completedVariants.map(v => ({
                    label: v.variant,
                    navSeries: v.nav_series,
                  }))}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
