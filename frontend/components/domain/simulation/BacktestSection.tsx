'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { SimFilterPanel, SimFilterState } from './SimFilterPanel'
import { SimProgressBar } from './SimProgressBar'
import { SimStatsGrid } from './SimStatsGrid'
import { SimPerformanceChart } from './SimPerformanceChart'
import { SimHoldingsTable } from './SimHoldingsTable'
import { SimSweepStatsTable } from './SimSweepStatsTable'
import { useSimulation } from '@/hooks/useSimulation'
import { useSimSweep } from '@/hooks/useSimSweep'
import { DATA_NODE_URL } from '@/lib/config'

interface DeployedItpRef {
  itpId: string
  name: string
  symbol: string
}

interface BacktestSectionProps {
  expanded: boolean
  onToggle: () => void
  onDeployIndex?: (holdings: { symbol: string; weight: number }[]) => void
  deployedItps?: DeployedItpRef[]
  onRebalanceItp?: (itpId: string) => void
}

export function BacktestSection({ expanded, onToggle, onDeployIndex, deployedItps, onRebalanceItp }: BacktestSectionProps) {
  const [filters, setFilters] = useState<SimFilterState>({
    category_id: 'made-in-china',
    top_n: 5,
    weighting: 'multi_factor_90',
    rebalance_days: 30,
    base_fee_pct: 0.1,
    spread_multiplier: 1.0,
    sweep: 'none',
    sweep_categories: [],
    threshold_pct: null,
    start_date: '',
    fng_mode: '',
    fng_fear: 25,
    fng_greed: 75,
    fng_cash_pct: 0.5,
    dom_mode: '',
    dom_lookback: 30,
    vc_mode: '',
    vc_investors: 'a16z, paradigm, sequoia, binance labs, coinbase ventures',
    vc_min_amount_m: 0,
    vc_round_types: 'series_a, seed, series_b',
  })
  const [isFullscreen, setIsFullscreen] = useState(false)

  const isSweep = filters.sweep !== 'none'
  const isCategorySweep = filters.sweep === 'category'

  // Single simulation hook
  const sim = useSimulation(
    !isSweep && filters.category_id ? {
      category_id: filters.category_id,
      top_n: filters.top_n,
      weighting: filters.weighting,
      rebalance_days: filters.rebalance_days,
      base_fee_pct: filters.base_fee_pct,
      spread_multiplier: filters.spread_multiplier,
      threshold_pct: filters.threshold_pct,
      start_date: filters.start_date || undefined,
      fng_mode: filters.fng_mode || undefined,
      fng_fear: filters.fng_fear,
      fng_greed: filters.fng_greed,
      fng_cash_pct: filters.fng_cash_pct,
      dom_mode: filters.dom_mode || undefined,
      dom_lookback: filters.dom_lookback,
      vc_mode: filters.vc_mode || undefined,
      vc_investors: filters.vc_investors || undefined,
      vc_min_amount_m: filters.vc_min_amount_m || undefined,
      vc_round_types: filters.vc_round_types || undefined,
    } : null,
  )

  // Sweep hook — for category sweep, use first selected category as category_id (backend uses 'categories' param)
  const sweep = useSimSweep(
    isSweep ? {
      category_id: isCategorySweep
        ? (filters.sweep_categories[0] || '')
        : filters.category_id,
      sweep: filters.sweep,
      weighting: filters.weighting,
      rebalance_days: filters.rebalance_days,
      top_n: filters.top_n,
      base_fee_pct: filters.base_fee_pct,
      spread_multiplier: filters.spread_multiplier,
      categories: isCategorySweep ? filters.sweep_categories : undefined,
      threshold_pct: filters.threshold_pct,
      start_date: filters.start_date || undefined,
      fng_mode: filters.fng_mode || undefined,
      fng_fear: filters.fng_fear,
      fng_greed: filters.fng_greed,
      fng_cash_pct: filters.fng_cash_pct,
      dom_mode: filters.dom_mode || undefined,
      dom_lookback: filters.dom_lookback,
      vc_mode: filters.vc_mode || undefined,
      vc_investors: filters.vc_investors || undefined,
      vc_min_amount_m: filters.vc_min_amount_m || undefined,
      vc_round_types: filters.vc_round_types || undefined,
    } : null,
  )

  const isLoading = isSweep ? sweep.status === 'loading' : sim.status === 'loading'

  // Auto-run simulation on first mount with default params
  const hasAutoRun = useRef(false)
  useEffect(() => {
    if (!hasAutoRun.current && sim.status === 'idle' && !isSweep && filters.category_id) {
      hasAutoRun.current = true
      sim.run()
    }
  }, [sim.status, sim.run, isSweep, filters.category_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = useCallback(() => {
    if (isLoading) {
      // Cancel
      if (isSweep) sweep.cancel()
      else sim.cancel()
    } else {
      // Run
      if (isSweep) sweep.run()
      else sim.run()
    }
  }, [isSweep, isLoading, sim, sweep])

  // Fetch holdings for a run_id and call onDeployIndex with symbol+weight
  const handleDeployIndex = useCallback(async (runId: number, _label: string) => {
    if (!onDeployIndex) return
    try {
      const res = await fetch(`${DATA_NODE_URL}/sim/holdings?run_id=${runId}`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const holdings: { symbol: string; weight: number }[] = (data.holdings || []).map(
        (h: { symbol: string; weight: number }) => ({
          symbol: h.symbol.toUpperCase(),
          weight: Math.round(h.weight * 100 * 100) / 100, // convert 0.1 → 10, keep 2 decimals
        }),
      )
      if (holdings.length > 0) {
        onDeployIndex(holdings)
      }
    } catch (e) {
      console.error('[BacktestSection] Failed to fetch holdings for deploy:', e)
    }
  }, [onDeployIndex])

  const hasResults = isSweep
    ? sweep.completedVariants.length > 0 || sweep.status === 'loading'
    : (sim.result != null || sim.status === 'loading')

  const resultsContent = (
    <>
      {/* Error */}
      {(sim.error || sweep.error) && (
        <div className="text-color-down text-sm p-4 bg-surface-down border border-border-light rounded-xl mb-6">
          {sim.error || sweep.error}
        </div>
      )}

      {/* Single Simulation Results */}
      {!isSweep && (
        <>
          {sim.status === 'loading' && (
            <SimProgressBar mode="single" progress={sim.progress} />
          )}
          {sim.result?.stats && (
            <SimStatsGrid stats={sim.result.stats} />
          )}
          {sim.result?.nav_series && sim.result.nav_series.length > 0 && (
            <SimPerformanceChart
              mode="single"
              navSeries={sim.result.nav_series}
              runId={sim.result.run_id}
              onDeployIndex={handleDeployIndex}
              deployedItps={deployedItps}
              onRebalanceItp={onRebalanceItp}
            />
          )}
          {sim.result?.run_id && (
            <div className="mt-6">
              <h3 className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">Holdings (Latest Rebalance)</h3>
              <SimHoldingsTable runId={sim.result.run_id} />
            </div>
          )}
        </>
      )}

      {/* Sweep Results */}
      {isSweep && (
        <>
          {sweep.status === 'loading' && (
            <SimProgressBar
              mode="sweep"
              progress={sweep.progress}
              completedCount={sweep.completedVariants.length}
              totalVariants={sweep.progress?.total_variants || 0}
            />
          )}
          {sweep.completedVariants.length > 0 && (
            <SimSweepStatsTable
              variants={sweep.completedVariants.map(v => ({
                variant: v.variant,
                stats: v.stats,
              }))}
            />
          )}
          {sweep.completedVariants.length > 0 && (
            <SimPerformanceChart
              mode="sweep"
              variants={sweep.completedVariants.map(v => ({
                label: v.variant,
                navSeries: v.nav_series,
                runId: v.run_id,
                stats: v.stats,
              }))}
              onDeployIndex={handleDeployIndex}
              deployedItps={deployedItps}
              onRebalanceItp={onRebalanceItp}
            />
          )}
        </>
      )}
    </>
  )

  return (
    <>
      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-page overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-1">Index Backtester</p>
              <h2 className="text-lg font-bold text-text-primary">Simulation Results</h2>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="text-text-muted hover:text-text-primary text-sm px-3 py-1 border border-border-light rounded-lg transition-colors"
              title="Exit fullscreen"
            >
              ESC
            </button>
          </div>
          {resultsContent}
        </div>
      )}

      <div className="space-y-3 pb-10">
        {/* Section Header */}
        <div className="pt-10">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">Strategy Simulation</p>
          <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">Backtest</h2>
          <p className="text-[14px] text-text-secondary mt-1.5">Test index strategies against historical data before deploying capital.</p>
        </div>

        {/* Filter Panel */}
        <div className="border border-border-light">
          <SimFilterPanel
            filters={filters}
            onChange={setFilters}
            onRun={handleRun}
            isLoading={isLoading}
          />
        </div>

        {/* Fullscreen toggle */}
        {hasResults && !isFullscreen && (
          <div className="flex justify-end">
            <button
              onClick={() => setIsFullscreen(true)}
              className="text-xs text-text-muted hover:text-text-primary px-3 py-1.5 border border-border-light rounded-lg hover:border-border-medium transition-colors"
            >
              Fullscreen
            </button>
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <div className="border border-border-light p-4">
            {resultsContent}
          </div>
        )}
      </div>
    </>
  )
}
