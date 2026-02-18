'use client'

import { useState } from 'react'
import { useSimCategories } from '@/hooks/useSimCategories'

const TOP_N_OPTIONS = [5, 10, 20, 30, 50, 100, 200]
const REBALANCE_OPTIONS = [
  { value: 14, label: '2w' },
  { value: 30, label: '1m' },
  { value: 60, label: '2m' },
  { value: 90, label: '3m' },
  { value: 180, label: '6m' },
]
const THRESHOLD_OPTIONS = [
  { value: null as number | null, label: 'Periodic' },
  { value: 3 as number | null, label: '3%' },
  { value: 5 as number | null, label: '5%' },
  { value: 10 as number | null, label: '10%' },
  { value: 15 as number | null, label: '15%' },
]
const SWEEP_OPTIONS = ['none', 'top_n', 'weighting', 'rebalance', 'category'] as const

// Strategy families with their sub-parameters
interface StrategyFamily {
  id: string
  label: string
  title: string
  prefix: string               // used to build weighting string: prefix + param
  params: { value: number; label: string }[] | null  // null = no sub-params
  defaultParam: number | null
}

const STRATEGY_FAMILIES: StrategyFamily[] = [
  { id: 'equal', label: 'Equal', title: 'Equal weight across all holdings', prefix: '', params: null, defaultParam: null },
  { id: 'mcap', label: 'MCap', title: 'Weight by market capitalization', prefix: '', params: null, defaultParam: null },
  { id: 'mcap_cap', label: 'Capped', title: 'MCap-weighted with max % cap per holding', prefix: 'mcap_cap', params: [
    { value: 5, label: '5%' }, { value: 10, label: '10%' }, { value: 15, label: '15%' }, { value: 25, label: '25%' }, { value: 50, label: '50%' },
  ], defaultParam: 10 },
  { id: 'sqrt_mcap', label: 'SqrtMCap', title: 'Square root of MCap: dampened concentration', prefix: '', params: null, defaultParam: null },
  { id: 'momentum', label: 'Momentum', title: 'Weight by trailing return — winners get more', prefix: 'momentum_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' }, { value: 180, label: '180d' }, { value: 365, label: '1y' },
  ], defaultParam: 90 },
  { id: 'invvol', label: 'InvVol', title: 'Inverse Volatility: less volatile = higher weight', prefix: 'invvol_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60 },
  { id: 'dual_mom', label: 'DualMom', title: 'Dual Momentum: go to cash when market is down', prefix: 'dual_mom_', params: [
    { value: 90, label: '90d' }, { value: 180, label: '180d' }, { value: 365, label: '1y' },
  ], defaultParam: 180 },
  { id: 'risk_parity', label: 'RiskPar', title: 'Risk Parity: equal risk contribution per asset', prefix: 'risk_parity_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60 },
  { id: 'min_var', label: 'MinVar', title: 'Minimum Variance: minimize portfolio volatility', prefix: 'min_var_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60 },
  { id: 'multi_factor', label: 'MultiFac', title: 'Multi-Factor: momentum + low vol + MCap composite', prefix: 'multi_factor_', params: [
    { value: 60, label: '60d' }, { value: 90, label: '90d' }, { value: 180, label: '180d' },
  ], defaultParam: 90 },
  { id: 'low_vol', label: 'LowVol', title: 'Low Volatility: keep least volatile half, equal weight', prefix: 'low_vol_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60 },
]

// Parse a weighting string back into family + param
function parseWeighting(w: string): { familyId: string; param: number | null } {
  for (const f of STRATEGY_FAMILIES) {
    if (!f.params) {
      if (f.id === w) return { familyId: f.id, param: null }
    } else if (f.prefix && w.startsWith(f.prefix)) {
      const num = parseInt(w.slice(f.prefix.length), 10)
      if (!isNaN(num)) return { familyId: f.id, param: num }
    }
  }
  return { familyId: 'equal', param: null }
}

// Build weighting string from family + param
function buildWeighting(familyId: string, param: number | null): string {
  const f = STRATEGY_FAMILIES.find(s => s.id === familyId)
  if (!f || !f.params) return familyId
  return `${f.prefix}${param ?? f.defaultParam}`
}

export interface SimFilterState {
  category_id: string
  top_n: number
  weighting: string
  rebalance_days: number
  base_fee_pct: number
  spread_multiplier: number
  sweep: string
  sweep_categories: string[]
  threshold_pct: number | null
}

interface SimFilterPanelProps {
  filters: SimFilterState
  onChange: (filters: SimFilterState) => void
  onRun: () => void
  isLoading: boolean
}

export function SimFilterPanel({ filters, onChange, onRun, isLoading }: SimFilterPanelProps) {
  const { categories, isLoading: catsLoading } = useSimCategories()
  const [catSearchOpen, setCatSearchOpen] = useState(false)
  const [catSearch, setCatSearch] = useState('')

  const isSweeping = filters.sweep !== 'none'
  const sweepDim = filters.sweep
  const isCategorySweep = sweepDim === 'category'

  // Parse current weighting into family + param
  const { familyId: activeFamily, param: activeParam } = parseWeighting(filters.weighting)
  const activeFamilyDef = STRATEGY_FAMILIES.find(f => f.id === activeFamily)

  const update = (patch: Partial<SimFilterState>) => {
    onChange({ ...filters, ...patch })
  }

  const selectFamily = (fam: StrategyFamily) => {
    if (sweepDim === 'weighting') return
    update({ weighting: buildWeighting(fam.id, fam.defaultParam) })
  }

  const selectParam = (param: number) => {
    update({ weighting: buildWeighting(activeFamily, param) })
  }

  const toggleSweepCategory = (catId: string) => {
    const current = filters.sweep_categories
    if (current.includes(catId)) {
      update({ sweep_categories: current.filter(c => c !== catId) })
    } else {
      update({ sweep_categories: [...current, catId] })
    }
  }

  const canRun = isCategorySweep
    ? filters.sweep_categories.length >= 2
    : !!filters.category_id

  const filteredCategories = catSearch
    ? categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()) || c.id.includes(catSearch.toLowerCase()))
    : categories

  return (
    <div className="bg-black border border-white/10 rounded p-4 mb-4 space-y-3">
      {/* Row 1: Category + Top N */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] text-white/40 font-mono uppercase block mb-1">
            {isCategorySweep ? 'Categories (select 2+)' : 'Category'}
          </label>

          {isCategorySweep ? (
            <div className="relative">
              <button
                className="w-full bg-white/5 border border-accent/30 rounded px-2 py-1.5 text-xs font-mono text-accent text-left"
                onClick={() => setCatSearchOpen(!catSearchOpen)}
              >
                {filters.sweep_categories.length === 0
                  ? 'Select categories to compare...'
                  : `${filters.sweep_categories.length} categories selected`
                }
              </button>
              {catSearchOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-black border border-white/20 rounded max-h-60 overflow-y-auto">
                  <input
                    type="text"
                    className="w-full bg-white/5 border-b border-white/10 px-2 py-1.5 text-xs font-mono text-white outline-none"
                    placeholder="Search categories..."
                    value={catSearch}
                    onChange={e => setCatSearch(e.target.value)}
                    autoFocus
                  />
                  {filteredCategories.map(c => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="accent-[#C40000]"
                        checked={filters.sweep_categories.includes(c.id)}
                        onChange={() => toggleSweepCategory(c.id)}
                      />
                      <span className="text-xs font-mono text-white truncate">
                        {c.name}
                      </span>
                      <span className="text-[10px] font-mono text-white/30 ml-auto">
                        {c.coin_count}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {filters.sweep_categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {filters.sweep_categories.map(catId => {
                    const cat = categories.find(c => c.id === catId)
                    return (
                      <span
                        key={catId}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-accent/20 border border-accent/30 rounded text-[10px] font-mono text-accent"
                      >
                        {cat?.name || catId}
                        <button
                          className="hover:text-white"
                          onClick={() => toggleSweepCategory(catId)}
                        >
                          x
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <select
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs font-mono text-white cursor-pointer"
              value={filters.category_id}
              onChange={e => update({ category_id: e.target.value })}
              disabled={catsLoading}
            >
              <option value="">{catsLoading ? 'Loading categories...' : 'Select category...'}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.coin_count} coins)
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="text-[10px] text-white/40 font-mono uppercase block mb-1">Top N</label>
          <div className="flex">
            {TOP_N_OPTIONS.map(n => (
              <button
                key={n}
                className={`px-2 py-1 text-xs font-mono border border-white/10 first:rounded-l last:rounded-r -ml-px first:ml-0 transition-colors ${
                  sweepDim === 'top_n'
                    ? 'bg-accent/20 text-accent border-accent/30'
                    : filters.top_n === n
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
                onClick={() => { if (sweepDim !== 'top_n') update({ top_n: n }) }}
                disabled={sweepDim === 'top_n'}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Strategy family buttons */}
      <div>
        <label className="text-[10px] text-white/40 font-mono uppercase block mb-1">Weighting Strategy</label>
        <div className="flex flex-wrap gap-0.5">
          {STRATEGY_FAMILIES.map(fam => (
            <button
              key={fam.id}
              title={fam.title}
              className={`px-2 py-1 text-[10px] font-mono border border-white/10 rounded transition-colors ${
                sweepDim === 'weighting'
                  ? 'bg-accent/20 text-accent border-accent/30'
                  : activeFamily === fam.id
                    ? 'bg-white/20 text-white border-white/30'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
              onClick={() => selectFamily(fam)}
              disabled={sweepDim === 'weighting'}
            >
              {fam.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2b: Sub-parameter picker (only when active family has params, and not sweep=weighting) */}
      {activeFamilyDef?.params && sweepDim !== 'weighting' && (
        <div className="flex items-center gap-2 pl-2 border-l-2 border-white/10">
          <span className="text-[10px] text-white/30 font-mono">
            {activeFamily === 'mcap_cap' ? 'Max cap' : 'Lookback'}
          </span>
          <div className="flex">
            {activeFamilyDef.params.map((p, i) => (
              <button
                key={p.value}
                className={`px-2 py-0.5 text-[10px] font-mono border border-white/10 -ml-px transition-colors ${
                  i === 0 ? 'rounded-l ml-0' : ''
                } ${
                  i === (activeFamilyDef.params?.length ?? 0) - 1 ? 'rounded-r' : ''
                } ${
                  activeParam === p.value
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
                onClick={() => selectParam(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Row 3: Rebalance */}
      <div>
        <label className="text-[10px] text-white/40 font-mono uppercase block mb-1">Rebalance</label>
        <div className="flex items-center">
          {REBALANCE_OPTIONS.map(r => (
            <button
              key={r.value}
              title={`Rebalance every ${r.label}`}
              className={`px-2 py-1 text-xs font-mono border border-white/10 first:rounded-l -ml-px first:ml-0 transition-colors ${
                sweepDim === 'rebalance'
                  ? 'bg-accent/20 text-accent border-accent/30'
                  : filters.threshold_pct == null && filters.rebalance_days === r.value
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
              onClick={() => { if (sweepDim !== 'rebalance') update({ rebalance_days: r.value, threshold_pct: null }) }}
              disabled={sweepDim === 'rebalance'}
            >
              {r.label}
            </button>
          ))}
          <span className="px-1.5 text-white/20 text-[10px] font-mono select-none">|</span>
          {THRESHOLD_OPTIONS.filter(t => t.value != null).map((t, i) => (
            <button
              key={t.label}
              title={`Rebalance when any holding drifts ${t.label} from target`}
              className={`px-2 py-1 text-xs font-mono border border-white/10 -ml-px transition-colors ${
                i === THRESHOLD_OPTIONS.filter(x => x.value != null).length - 1 ? 'rounded-r' : ''
              } ${
                sweepDim === 'rebalance'
                  ? 'bg-accent/20 text-accent border-accent/30'
                  : filters.threshold_pct === t.value
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
              onClick={() => { if (sweepDim !== 'rebalance') update({ threshold_pct: t.value }) }}
              disabled={sweepDim === 'rebalance'}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 4: Fees */}
      <div className="flex flex-wrap gap-3 items-center">
        <div>
          <label className="text-[10px] text-white/40 font-mono uppercase block mb-1">Base Fee %</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="5"
            className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white"
            value={filters.base_fee_pct}
            onChange={e => update({ base_fee_pct: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 font-mono uppercase block mb-1">Spread Mult.</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white"
            value={filters.spread_multiplier}
            onChange={e => update({ spread_multiplier: parseFloat(e.target.value) || 0 })}
          />
          <span className="text-[10px] text-white/30 font-mono ml-1">x</span>
        </div>
      </div>

      {/* Row 5: Sweep + Run */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <label className="text-[10px] text-white/40 font-mono uppercase block mb-1">Sweep</label>
          <div className="flex">
            {SWEEP_OPTIONS.map(s => (
              <button
                key={s}
                className={`px-2 py-1 text-xs font-mono border border-white/10 first:rounded-l last:rounded-r -ml-px first:ml-0 transition-colors ${
                  filters.sweep === s
                    ? s === 'none' ? 'bg-white/20 text-white' : 'bg-accent/30 text-accent border-accent/30'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
                onClick={() => update({ sweep: s })}
              >
                {s === 'none' ? 'None' : s === 'top_n' ? 'Top N' : s === 'weighting' ? 'Weight' : s === 'rebalance' ? 'Rebalance' : 'Category'}
              </button>
            ))}
          </div>
        </div>
        <button
          className="px-4 py-2 bg-accent text-white text-xs font-mono font-bold rounded hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onRun}
          disabled={isLoading || !canRun}
        >
          {isLoading ? 'Running...' : isSweeping ? 'Run Sweep' : 'Run Simulation'}
        </button>
      </div>
    </div>
  )
}
