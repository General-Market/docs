'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount } from 'wagmi'
import { SimFilterPanel, SimFilterState } from './SimFilterPanel'
import { SimProgressBar } from './SimProgressBar'
import { SimStatsGrid } from './SimStatsGrid'
import { SimPerformanceChart } from './SimPerformanceChart'
import { SimHoldingsTable } from './SimHoldingsTable'
import { SimSweepStatsTable } from './SimSweepStatsTable'
import { useSimulation } from '@/hooks/useSimulation'
import { useSimSweep } from '@/hooks/useSimSweep'
import { useSimQuota } from '@/hooks/useSimQuota'
import { DATA_NODE_URL } from '@/lib/config'

interface DeployedItpRef {
  itpId: string
  name: string
  symbol: string
  creator?: string
}

interface BacktestSectionProps {
  expanded: boolean
  onToggle: () => void
  onDeployIndex?: (holdings: { symbol: string; weight: number }[]) => void
  deployedItps?: DeployedItpRef[]
  onRebalanceItp?: (itpId: string, holdings: { symbol: string; weight: number }[]) => void
}

export function BacktestSection({ expanded, onToggle, onDeployIndex, deployedItps, onRebalanceItp }: BacktestSectionProps) {
  const t = useTranslations('backtest')
  const { address } = useAccount()
  const [filters, setFilters] = useState<SimFilterState>({
    category_id: 'all',
    top_n: 5,
    weighting: 'multi_factor_90',
    rebalance_days: 30,
    base_fee_pct: 0.1,
    spread_multiplier: 1.0,
    sweep: 'none',
    sweep_categories: [],
    threshold_pct: null,
    start_date: '2020-06-01',
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
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const quota = useSimQuota()

  // Only show the connected wallet's own ITPs in the rebalance picker
  const ownedItps = useMemo(() => {
    if (!address || !deployedItps) return []
    const addr = address.toLowerCase()
    return deployedItps.filter(itp => itp.creator?.toLowerCase() === addr)
  }, [address, deployedItps])

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

  // Auto-run simulation on first mount — waits for data-node to be reachable
  const hasAutoRun = useRef(false)
  useEffect(() => {
    if (hasAutoRun.current || isSweep || !filters.category_id) return
    if (sim.status !== 'idle') return

    let cancelled = false
    const tryRun = async () => {
      // Ping data-node health before firing SSE stream
      for (let attempt = 0; attempt < 15; attempt++) {
        if (cancelled) return
        try {
          const res = await fetch(`${DATA_NODE_URL}/health`, { signal: AbortSignal.timeout(2000) })
          if (res.ok) break
        } catch {
          // not ready yet
        }
        await new Promise(r => setTimeout(r, 2000))
      }
      if (cancelled) return
      hasAutoRun.current = true
      sim.run()
    }
    tryRun()
    return () => { cancelled = true }
  }, [sim.status, sim.run, isSweep, filters.category_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = useCallback(() => {
    if (isLoading) {
      if (isSweep) sweep.cancel()
      else sim.cancel()
      return
    }

    if (!quota.canRun) return

    quota.consume()
    if (isSweep) sweep.run()
    else sim.run()
  }, [isSweep, isLoading, sim, sweep, quota])

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

  // Fetch holdings for a run_id and call onRebalanceItp with itpId + holdings
  const handleRebalanceItp = useCallback(async (itpId: string, runId: number) => {
    if (!onRebalanceItp) return
    try {
      const res = await fetch(`${DATA_NODE_URL}/sim/holdings?run_id=${runId}`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const holdings: { symbol: string; weight: number }[] = (data.holdings || []).map(
        (h: { symbol: string; weight: number }) => ({
          symbol: h.symbol.toUpperCase(),
          weight: Math.round(h.weight * 100 * 100) / 100,
        }),
      )
      if (holdings.length > 0) {
        onRebalanceItp(itpId, holdings)
      }
    } catch (e) {
      console.error('[BacktestSection] Failed to fetch holdings for rebalance:', e)
    }
  }, [onRebalanceItp])

  const hasResults = isSweep
    ? sweep.completedVariants.length > 0 || sweep.status === 'loading'
    : (sim.result != null || sim.status === 'loading')

  const resultsContent = (
    <>
      {/* Error */}
      {(sim.error || sweep.error) && (
        <div
          className="text-sm p-4 mb-6"
          style={{
            background: '#fdecec',
            border: '1px solid #f5b8b8',
            borderRadius: 12,
            color: '#a8071a',
            fontFamily: 'var(--apple-font-text)',
            letterSpacing: 'var(--apple-track-tight)',
          }}
        >
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
              deployedItps={ownedItps}
              onRebalanceItp={handleRebalanceItp}
              chartContainerRef={chartContainerRef}
            />
          )}
          {sim.result?.run_id && (
            <div className="mt-6">
              <h3
                className="mb-3"
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-loose)',
                  textTransform: 'uppercase',
                  color: 'var(--apple-text-tertiary)',
                }}
              >
                {t('holdings.title')}
              </h3>
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
              deployedItps={ownedItps}
              onRebalanceItp={handleRebalanceItp}
              chartContainerRef={chartContainerRef}
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
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-6"
          style={{ background: 'var(--apple-page-bg)' }}
        >
          <div className="flex justify-between items-center mb-6">
            <div>
              <p
                className="mb-1"
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-loose)',
                  textTransform: 'uppercase',
                  color: 'var(--apple-text-tertiary)',
                }}
              >
                {t('fullscreen.label')}
              </p>
              <h2
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 'var(--apple-fs-21)',
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tighter)',
                  color: 'var(--apple-text)',
                  margin: 0,
                }}
              >
                {t('fullscreen.title')}
              </h2>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="fluid-press"
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 14,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text)',
                background: 'var(--apple-panel)',
                border: '1px solid var(--apple-line)',
                borderRadius: 12,
                padding: '6px 14px',
                cursor: 'pointer',
                transition: 'background 200ms var(--apple-ease-default)',
              }}
              title={t('fullscreen.exit_title')}
            >
              {t('fullscreen.exit')}
            </button>
          </div>
          {resultsContent}
        </div>
      )}

      <div className="space-y-3 pb-10">
        {/* Section Header */}
        <div className="pt-10">
          <p
            className="mb-1.5"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-loose)',
              textTransform: 'uppercase',
              color: 'var(--apple-text-tertiary)',
            }}
          >
            {t('heading.label')}
          </p>
          <h2
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tighter)',
              lineHeight: 1.0714,
              color: 'var(--apple-text)',
              margin: 0,
            }}
          >
            {t('heading.title')}
          </h2>
          <p
            className="mt-1.5"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-21)',
              lineHeight: 1.1904,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text-secondary)',
              margin: 0,
            }}
          >
            {t('heading.description')}
          </p>
        </div>

        {/* Filter Panel */}
        <div
          style={{
            background: 'var(--apple-panel)',
            border: '1px solid var(--apple-line)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <SimFilterPanel
            filters={filters}
            onChange={setFilters}
            onRun={handleRun}
            isLoading={isLoading}
          />
        </div>
        {!quota.canRun && (
          <p
            className="mt-2 text-right"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              letterSpacing: 'var(--apple-track-loose)',
              color: 'var(--apple-text-tertiary)',
            }}
          >
            {t('quota.cooldown', { seconds: Math.ceil(quota.cooldownRemaining / 1000) })}
          </p>
        )}

        {/* Fullscreen toggle */}
        {hasResults && !isFullscreen && (
          <div className="flex justify-end">
            <button
              onClick={() => setIsFullscreen(true)}
              className="fluid-press"
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 12,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text-secondary)',
                background: 'var(--apple-panel)',
                border: '1px solid var(--apple-line)',
                borderRadius: 12,
                padding: '6px 14px',
                cursor: 'pointer',
                transition: 'background 200ms var(--apple-ease-default), color 200ms var(--apple-ease-default)',
              }}
            >
              {t('fullscreen.enter')}
            </button>
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <div
            style={{
              background: 'var(--apple-panel)',
              border: '1px solid var(--apple-line)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            {resultsContent}
          </div>
        )}
      </div>

    </>
  )
}
