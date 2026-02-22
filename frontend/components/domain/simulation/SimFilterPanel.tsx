'use client'

import { useState } from 'react'
import { useSimCategories } from '@/hooks/useSimCategories'

/** Tiny "?" circle that shows a tooltip on hover */
function HelpTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1">
      <span className="w-3.5 h-3.5 rounded-full bg-border-light text-text-muted text-[9px] font-bold inline-flex items-center justify-center cursor-help leading-none">?</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-zinc-900 text-white text-[11px] leading-snug rounded-lg whitespace-normal w-52 text-center opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-lg">
        {text}
      </span>
    </span>
  )
}

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
const SWEEP_OPTIONS = ['none', 'top_n', 'weighting', 'rebalance', 'category', 'defi_weight', 'fng_regime', 'dom_regime'] as const

const SWEEP_LABELS: Record<string, string> = {
  none: 'None', top_n: 'Top N', weighting: 'Weight', rebalance: 'Rebalance',
  category: 'Category', defi_weight: 'DeFi Wt', fng_regime: 'FNG', dom_regime: 'DOM',
}

const FNG_MODES = [
  { value: '', label: 'Off' },
  { value: 'contrarian', label: 'Contrarian' },
  { value: 'risk_toggle', label: 'Risk Toggle' },
  { value: 'cash_shift', label: 'Cash Shift' },
] as const

const DOM_MODES = [
  { value: '', label: 'Off' },
  { value: 'alts_when_low', label: 'Alts Low' },
  { value: 'alts_when_falling', label: 'Alts Falling' },
  { value: 'btc_when_high', label: 'BTC High' },
] as const

const DOM_LOOKBACK_OPTIONS = [
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
  { value: 90, label: '90d' },
]

const VC_MODES = [
  { value: '', label: 'Off' },
  { value: 'funding', label: 'Funding' },
  { value: 'valuation', label: 'Valuation' },
  { value: 'fresh_12', label: 'Fresh 12m' },
  { value: 'fresh_6', label: 'Fresh 6m' },
] as const

const VC_INVESTOR_PRESETS = [
  'a16z', 'paradigm', 'sequoia', 'binance labs', 'coinbase ventures',
  'polychain', 'multicoin', 'dragonfly', 'framework', 'pantera',
] as const

const VC_ROUND_PRESETS = [
  'seed', 'series_a', 'series_b', 'series_c', 'strategic', 'private',
] as const

// Strategy families with their sub-parameters
interface StrategyFamily {
  id: string
  label: string
  title: string
  prefix: string               // used to build weighting string: prefix + param
  params: { value: number; label: string }[] | null  // null = no sub-params
  defaultParam: number | null
  group?: 'price' | 'defi'
}

const STRATEGY_FAMILIES: StrategyFamily[] = [
  // Price-based strategies
  { id: 'equal', label: 'Equal', title: 'Equal weight across all holdings', prefix: '', params: null, defaultParam: null, group: 'price' },
  { id: 'mcap', label: 'MCap', title: 'Weight by market capitalization', prefix: '', params: null, defaultParam: null, group: 'price' },
  { id: 'mcap_cap', label: 'Capped', title: 'MCap-weighted with max % cap per holding', prefix: 'mcap_cap', params: [
    { value: 5, label: '5%' }, { value: 10, label: '10%' }, { value: 15, label: '15%' }, { value: 25, label: '25%' }, { value: 50, label: '50%' },
  ], defaultParam: 10, group: 'price' },
  { id: 'sqrt_mcap', label: 'SqrtMCap', title: 'Square root of MCap: dampened concentration', prefix: '', params: null, defaultParam: null, group: 'price' },
  { id: 'momentum', label: 'Momentum', title: 'Weight by trailing return — winners get more', prefix: 'momentum_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' }, { value: 180, label: '180d' }, { value: 365, label: '1y' },
  ], defaultParam: 90, group: 'price' },
  { id: 'invvol', label: 'InvVol', title: 'Inverse Volatility: less volatile = higher weight', prefix: 'invvol_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60, group: 'price' },
  { id: 'dual_mom', label: 'DualMom', title: 'Dual Momentum: go to cash when market is down', prefix: 'dual_mom_', params: [
    { value: 90, label: '90d' }, { value: 180, label: '180d' }, { value: 365, label: '1y' },
  ], defaultParam: 180, group: 'price' },
  { id: 'risk_parity', label: 'RiskPar', title: 'Risk Parity: equal risk contribution per asset', prefix: 'risk_parity_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60, group: 'price' },
  { id: 'min_var', label: 'MinVar', title: 'Minimum Variance: minimize portfolio volatility', prefix: 'min_var_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60, group: 'price' },
  { id: 'multi_factor', label: 'MultiFac', title: 'Multi-Factor: momentum + low vol + MCap composite', prefix: 'multi_factor_', params: [
    { value: 60, label: '60d' }, { value: 90, label: '90d' }, { value: 180, label: '180d' },
  ], defaultParam: 90, group: 'price' },
  { id: 'low_vol', label: 'LowVol', title: 'Low Volatility: keep least volatile half, equal weight', prefix: 'low_vol_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60, group: 'price' },
  // DeFi strategies
  { id: 'tvl', label: 'TVL', title: 'Weight by Total Value Locked', prefix: '', params: null, defaultParam: null, group: 'defi' },
  { id: 'tvl_cap', label: 'TVL Cap', title: 'TVL-weighted with max % cap per holding', prefix: 'tvl_cap', params: [
    { value: 5, label: '5%' }, { value: 10, label: '10%' }, { value: 15, label: '15%' }, { value: 25, label: '25%' }, { value: 50, label: '50%' },
  ], defaultParam: 10, group: 'defi' },
  { id: 'tvl_sqrt', label: 'TVL Sqrt', title: 'Square root of TVL: dampened concentration', prefix: '', params: null, defaultParam: null, group: 'defi' },
  { id: 'fees_w', label: 'Fees', title: 'Weight by protocol fees generated', prefix: '', params: null, defaultParam: null, group: 'defi' },
  { id: 'revenue_w', label: 'Revenue', title: 'Weight by protocol revenue', prefix: '', params: null, defaultParam: null, group: 'defi' },
  { id: 'volume_w', label: 'Volume', title: 'Weight by trading volume', prefix: '', params: null, defaultParam: null, group: 'defi' },
  { id: 'tvl_mom', label: 'TVL Mom', title: 'TVL Momentum: weight by TVL growth rate', prefix: 'tvl_mom_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60, group: 'defi' },
  { id: 'fee_eff', label: 'Fee Eff', title: 'Fee Efficiency: fees relative to TVL', prefix: '', params: null, defaultParam: null, group: 'defi' },
  { id: 'yield_w', label: 'Yield', title: 'Weight by protocol yield', prefix: '', params: null, defaultParam: null, group: 'defi' },
]

// Date helpers for start date presets
function fiveYearsAgo(): string {
  const d = new Date(); d.setFullYear(d.getFullYear() - 5)
  return d.toISOString().slice(0, 10)
}
function threeYearsAgo(): string {
  const d = new Date(); d.setFullYear(d.getFullYear() - 3)
  return d.toISOString().slice(0, 10)
}
function oneYearAgo(): string {
  const d = new Date(); d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

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
  start_date: string  // YYYY-MM-DD or '' for auto
  // FNG regime overlay
  fng_mode: string       // '' | 'contrarian' | 'risk_toggle' | 'cash_shift'
  fng_fear: number       // 25
  fng_greed: number      // 75
  fng_cash_pct: number   // 0.5
  // BTC Dominance regime overlay
  dom_mode: string       // '' | 'alts_when_low' | 'alts_when_falling' | 'btc_when_high'
  dom_lookback: number   // 30
  // VC overlay
  vc_mode: string           // '' | 'funding' | 'valuation' | 'fresh_12' | 'fresh_6'
  vc_investors: string      // ''
  vc_min_amount_m: number   // 0
  vc_round_types: string    // ''
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
    <div className="space-y-2.5 p-4">
      {/* Row 1: Category + Top N */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium uppercase tracking-widest text-text-muted block mb-1.5">
            {isCategorySweep ? 'Categories (select 2+)' : 'Category'}
            <HelpTip text="The asset universe to pick from. Each category groups coins by theme (e.g. DeFi, Layer 1, Memes)." />
          </label>

          {isCategorySweep ? (
            <div className="relative">
              <button
                className="w-full bg-muted border border-border-light rounded-lg px-3 py-2 text-sm text-text-primary text-left hover:border-border-medium transition-colors"
                onClick={() => setCatSearchOpen(!catSearchOpen)}
              >
                {filters.sweep_categories.length === 0
                  ? 'Select categories to compare...'
                  : `${filters.sweep_categories.length} categories selected`
                }
              </button>
              {catSearchOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border-medium rounded-lg shadow-card-hover max-h-60 overflow-y-auto">
                  <input
                    type="text"
                    className="w-full border-b border-border-light px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
                    placeholder="Search categories..."
                    value={catSearch}
                    onChange={e => setCatSearch(e.target.value)}
                    autoFocus
                  />
                  {filteredCategories.map(c => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="accent-zinc-900"
                        checked={filters.sweep_categories.includes(c.id)}
                        onChange={() => toggleSweepCategory(c.id)}
                      />
                      <span className="text-sm text-text-primary truncate">
                        {c.name}
                      </span>
                      <span className="text-xs text-text-muted ml-auto">
                        {c.coin_count}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {filters.sweep_categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {filters.sweep_categories.map(catId => {
                    const cat = categories.find(c => c.id === catId)
                    return (
                      <span
                        key={catId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted border border-border-light rounded-md text-xs text-text-secondary"
                      >
                        {cat?.name || catId}
                        <button
                          className="hover:text-text-primary transition-colors"
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
              className="w-full bg-muted border border-border-light rounded-lg px-3 py-2 text-sm text-text-primary cursor-pointer hover:border-border-medium transition-colors"
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
          <label className="text-xs font-medium uppercase tracking-widest text-text-muted block mb-1.5">Top N<HelpTip text="How many coins to hold. 'Top 10' means the 10 largest by market cap from your chosen category." /></label>
          <div className="flex">
            {TOP_N_OPTIONS.map(n => (
              <button
                key={n}
                className={`px-2.5 py-1.5 text-xs border border-border-light first:rounded-l-lg last:rounded-r-lg -ml-px first:ml-0 transition-colors ${
                  sweepDim === 'top_n'
                    ? 'bg-muted text-text-muted border-border-light'
                    : filters.top_n === n
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-text-secondary hover:bg-muted'
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
        <label className="text-xs font-medium uppercase tracking-widest text-text-muted block mb-1.5">Weighting Strategy<HelpTip text="How to distribute money across your holdings. 'Equal' = same amount in each coin. 'MCap' = more money in bigger coins. Others use momentum, volatility, or DeFi metrics." /></label>
        <div className="flex flex-wrap gap-1 items-center">
          {STRATEGY_FAMILIES.filter(f => f.group === 'price').map(fam => (
            <button
              key={fam.id}
              title={fam.title}
              className={`px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
                sweepDim === 'weighting' || sweepDim === 'defi_weight'
                  ? 'bg-muted text-text-muted border-border-light'
                  : activeFamily === fam.id
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-text-secondary border-border-light hover:bg-muted'
              }`}
              onClick={() => selectFamily(fam)}
              disabled={sweepDim === 'weighting' || sweepDim === 'defi_weight'}
            >
              {fam.label}
            </button>
          ))}
          <span className="text-xs text-text-muted px-1">|</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">DeFi</span>
          {STRATEGY_FAMILIES.filter(f => f.group === 'defi').map(fam => (
            <button
              key={fam.id}
              title={fam.title}
              className={`px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
                sweepDim === 'weighting' || sweepDim === 'defi_weight'
                  ? 'bg-muted text-text-muted border-border-light'
                  : activeFamily === fam.id
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-text-secondary border-border-light hover:bg-muted'
              }`}
              onClick={() => selectFamily(fam)}
              disabled={sweepDim === 'weighting' || sweepDim === 'defi_weight'}
            >
              {fam.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2b: Sub-parameter picker (only when active family has params, and not sweep=weighting) */}
      {activeFamilyDef?.params && sweepDim !== 'weighting' && (
        <div className="flex items-center gap-2 pl-3 border-l-2 border-border-light">
          <span className="text-xs text-text-muted">
            {activeFamily === 'mcap_cap' ? 'Max cap' : 'Lookback'}
          </span>
          <div className="flex">
            {activeFamilyDef.params.map((p, i) => (
              <button
                key={p.value}
                className={`px-2.5 py-1 text-xs border border-border-light -ml-px transition-colors ${
                  i === 0 ? 'rounded-l-lg ml-0' : ''
                } ${
                  i === (activeFamilyDef.params?.length ?? 0) - 1 ? 'rounded-r-lg' : ''
                } ${
                  activeParam === p.value
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-text-muted hover:bg-muted'
                }`}
                onClick={() => selectParam(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Row 3: Rebalance family */}
      <div>
        <label className="text-xs font-medium uppercase tracking-widest text-text-muted block mb-1.5">Rebalance<HelpTip text="How often to re-adjust your portfolio back to target weights. 'Periodic' = fixed schedule. 'Drift Band' = only when a holding drifts too far from its target." /></label>
        <div className="flex gap-1">
          <button
            title="Rebalance at fixed time intervals"
            className={`px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
              sweepDim === 'rebalance'
                ? 'bg-muted text-text-muted border-border-light'
                : filters.threshold_pct == null
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-text-secondary border-border-light hover:bg-muted'
            }`}
            onClick={() => { if (sweepDim !== 'rebalance') update({ threshold_pct: null, rebalance_days: filters.rebalance_days }) }}
            disabled={sweepDim === 'rebalance'}
          >
            Periodic
          </button>
          <button
            title="Rebalance when any holding drifts past a threshold"
            className={`px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
              sweepDim === 'rebalance'
                ? 'bg-muted text-text-muted border-border-light'
                : filters.threshold_pct != null
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-text-secondary border-border-light hover:bg-muted'
            }`}
            onClick={() => { if (sweepDim !== 'rebalance') update({ threshold_pct: filters.threshold_pct ?? 5 }) }}
            disabled={sweepDim === 'rebalance'}
          >
            Drift Band
          </button>
        </div>
      </div>

      {/* Row 3b: Rebalance sub-parameter */}
      {sweepDim !== 'rebalance' && (
        <div className="flex items-center gap-2 pl-3 border-l-2 border-border-light">
          <span className="text-xs text-text-muted">
            {filters.threshold_pct == null ? 'Interval' : 'Threshold'}
          </span>
          <div className="flex">
            {filters.threshold_pct == null ? (
              REBALANCE_OPTIONS.map((r, i) => (
                <button
                  key={r.value}
                  title={`Rebalance every ${r.label}`}
                  className={`px-2.5 py-1 text-xs border border-border-light -ml-px transition-colors ${
                    i === 0 ? 'rounded-l-lg ml-0' : ''
                  } ${
                    i === REBALANCE_OPTIONS.length - 1 ? 'rounded-r-lg' : ''
                  } ${
                    filters.rebalance_days === r.value
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-text-muted hover:bg-muted'
                  }`}
                  onClick={() => update({ rebalance_days: r.value })}
                >
                  {r.label}
                </button>
              ))
            ) : (
              THRESHOLD_OPTIONS.filter(t => t.value != null).map((t, i, arr) => (
                <button
                  key={t.label}
                  title={`Rebalance when any holding drifts ${t.label} from target`}
                  className={`px-2.5 py-1 text-xs border border-border-light -ml-px transition-colors ${
                    i === 0 ? 'rounded-l-lg ml-0' : ''
                  } ${
                    i === arr.length - 1 ? 'rounded-r-lg' : ''
                  } ${
                    filters.threshold_pct === t.value
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-text-muted hover:bg-muted'
                  }`}
                  onClick={() => update({ threshold_pct: t.value })}
                >
                  {t.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Row 4: Fees + Start Date */}
      <div className="flex flex-wrap gap-4 items-center">
        <div>
          <label className="text-xs font-medium uppercase tracking-widest text-text-muted block mb-1.5">Base Fee %<HelpTip text="Annual management fee charged on the index (like an ETF expense ratio). 0.1% is typical for crypto index products." /></label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="5"
            className="w-20 bg-muted border border-border-light rounded-lg px-3 py-1.5 text-sm text-text-primary tabular-nums font-mono"
            value={filters.base_fee_pct}
            onChange={e => update({ base_fee_pct: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-widest text-text-muted block mb-1.5">Spread Mult.<HelpTip text="Simulates trading slippage. 1x = realistic spread costs. Higher values model worse execution (e.g. illiquid markets)." /></label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            className="w-20 bg-muted border border-border-light rounded-lg px-3 py-1.5 text-sm text-text-primary tabular-nums font-mono"
            value={filters.spread_multiplier}
            onChange={e => update({ spread_multiplier: parseFloat(e.target.value) || 0 })}
          />
          <span className="text-xs text-text-muted ml-1">x</span>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-widest text-text-muted block mb-1.5">Start From<HelpTip text="When to start the backtest. 'All' uses the maximum available history. Shorter periods show more recent performance." /></label>
          <div className="flex items-center gap-1">
            {[
              { label: 'All', value: '' },
              { label: '5y', value: fiveYearsAgo() },
              { label: '3y', value: threeYearsAgo() },
              { label: '1y', value: oneYearAgo() },
            ].map(opt => (
              <button
                key={opt.label}
                className={`px-2.5 py-1 text-xs border border-border-light rounded-lg transition-colors ${
                  filters.start_date === opt.value
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-text-muted hover:bg-muted'
                }`}
                onClick={() => update({ start_date: opt.value })}
              >
                {opt.label}
              </button>
            ))}
            <input
              type="date"
              className={`bg-muted border rounded-lg px-3 py-1.5 text-sm text-text-primary w-[130px] ${
                filters.start_date && !['', fiveYearsAgo(), threeYearsAgo(), oneYearAgo()].includes(filters.start_date)
                  ? 'border-border-medium bg-white'
                  : 'border-border-light'
              }`}
              value={filters.start_date}
              onChange={e => update({ start_date: e.target.value })}
              min="2017-01-01"
            />
          </div>
        </div>
      </div>

      {/* Row 5: Regime Overlays */}
      <div className="border border-border-light rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-2.5 bg-muted hover:bg-border-light transition-colors"
          onClick={() => update({} as Partial<SimFilterState>)} // no-op, toggle via local state
          type="button"
        >
          <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Regime Overlays<HelpTip text="Optional rules that adjust your strategy based on market sentiment (Fear & Greed Index) or Bitcoin dominance trends." /></span>
          <span className="text-xs text-text-muted">
            {filters.fng_mode || filters.dom_mode ? 'Active' : 'Off'}
          </span>
        </button>
        <div className="p-4 space-y-4">
          {/* FNG Regime */}
          <div>
            <label className="text-xs font-medium uppercase tracking-widest text-text-muted block mb-1.5">Fear & Greed<HelpTip text="Adjusts strategy based on the Crypto Fear & Greed Index (0-100). 'Contrarian' buys when fearful, sells when greedy. 'Cash Shift' moves to cash during greed." /></label>
            <div className="flex flex-wrap gap-1">
              {FNG_MODES.map(m => (
                <button
                  key={m.value}
                  className={`px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
                    filters.fng_mode === m.value
                      ? m.value === '' ? 'bg-white text-text-secondary border-border-light' : 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-text-secondary border-border-light hover:bg-muted'
                  }`}
                  onClick={() => update({ fng_mode: m.value })}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {filters.fng_mode && (
              <div className="flex flex-wrap gap-4 mt-2 pl-3 border-l-2 border-border-light">
                <div>
                  <span className="text-xs text-text-muted block mb-1">Fear &le; {filters.fng_fear}</span>
                  <input
                    type="range" min={10} max={40} step={1}
                    className="w-28 accent-zinc-900"
                    value={filters.fng_fear}
                    onChange={e => update({ fng_fear: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <span className="text-xs text-text-muted block mb-1">Greed &ge; {filters.fng_greed}</span>
                  <input
                    type="range" min={60} max={90} step={1}
                    className="w-28 accent-zinc-900"
                    value={filters.fng_greed}
                    onChange={e => update({ fng_greed: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <span className="text-xs text-text-muted block mb-1">Cash %</span>
                  <input
                    type="number" step="0.05" min="0" max="1"
                    className="w-16 bg-muted border border-border-light rounded-lg px-2 py-1 text-xs text-text-primary tabular-nums font-mono"
                    value={filters.fng_cash_pct}
                    onChange={e => update({ fng_cash_pct: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* BTC Dominance Regime */}
          <div>
            <label className="text-xs font-medium uppercase tracking-widest text-text-muted block mb-1.5">BTC Dominance<HelpTip text="Adjusts allocation based on Bitcoin's market dominance trend. When BTC dominance falls, altcoins tend to outperform ('alt season')." /></label>
            <div className="flex flex-wrap gap-1">
              {DOM_MODES.map(m => (
                <button
                  key={m.value}
                  className={`px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
                    filters.dom_mode === m.value
                      ? m.value === '' ? 'bg-white text-text-secondary border-border-light' : 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-text-secondary border-border-light hover:bg-muted'
                  }`}
                  onClick={() => update({ dom_mode: m.value })}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {filters.dom_mode && (
              <div className="flex items-center gap-2 mt-2 pl-3 border-l-2 border-border-light">
                <span className="text-xs text-text-muted">Lookback</span>
                <div className="flex">
                  {DOM_LOOKBACK_OPTIONS.map((opt, i) => (
                    <button
                      key={opt.value}
                      className={`px-2.5 py-1 text-xs border border-border-light -ml-px transition-colors ${
                        i === 0 ? 'rounded-l-lg ml-0' : ''
                      } ${
                        i === DOM_LOOKBACK_OPTIONS.length - 1 ? 'rounded-r-lg' : ''
                      } ${
                        filters.dom_lookback === opt.value
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-white text-text-muted hover:bg-muted'
                      }`}
                      onClick={() => update({ dom_lookback: opt.value })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 6: VC Overlay */}
      <div className="border border-border-light rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-2.5 bg-muted hover:bg-border-light transition-colors"
          type="button"
        >
          <span className="text-xs font-medium uppercase tracking-widest text-text-muted">VC Overlay<HelpTip text="Boost or filter coins based on venture capital funding data. Coins backed by top VCs with large recent rounds get higher weight." /></span>
          <span className="text-xs text-text-muted">
            {filters.vc_mode ? 'Active' : 'Off'}
          </span>
        </button>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1">
            {VC_MODES.map(m => (
              <button
                key={m.value}
                className={`px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
                  filters.vc_mode === m.value
                    ? m.value === '' ? 'bg-white text-text-secondary border-border-light' : 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-text-secondary border-border-light hover:bg-muted'
                }`}
                onClick={() => update({ vc_mode: m.value })}
              >
                {m.label}
              </button>
            ))}
          </div>
          {filters.vc_mode && (
            <div className="flex flex-wrap gap-4 pl-3 border-l-2 border-border-light">
              <div>
                <span className="text-xs text-text-muted block mb-1">Min Funding ($M)</span>
                <input
                  type="number" step="1" min="0"
                  className="w-20 bg-muted border border-border-light rounded-lg px-2 py-1 text-xs text-text-primary tabular-nums font-mono"
                  value={filters.vc_min_amount_m}
                  onChange={e => update({ vc_min_amount_m: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <span className="text-xs text-text-muted block mb-1.5">Investors</span>
                <div className="flex flex-wrap gap-1">
                  {VC_INVESTOR_PRESETS.map(inv => {
                    const selected = filters.vc_investors.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
                    const isOn = selected.includes(inv.toLowerCase())
                    return (
                      <button
                        key={inv}
                        className={`px-2 py-1 text-[11px] border rounded-md transition-colors ${
                          isOn
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white text-text-secondary border-border-light hover:bg-muted'
                        }`}
                        onClick={() => {
                          const next = isOn
                            ? selected.filter(s => s !== inv.toLowerCase())
                            : [...selected, inv]
                          update({ vc_investors: next.join(', ') })
                        }}
                      >
                        {inv}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <span className="text-xs text-text-muted block mb-1.5">Round Types</span>
                <div className="flex flex-wrap gap-1">
                  {VC_ROUND_PRESETS.map(rt => {
                    const selected = filters.vc_round_types.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
                    const isOn = selected.includes(rt.toLowerCase())
                    return (
                      <button
                        key={rt}
                        className={`px-2 py-1 text-[11px] border rounded-md transition-colors ${
                          isOn
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white text-text-secondary border-border-light hover:bg-muted'
                        }`}
                        onClick={() => {
                          const next = isOn
                            ? selected.filter(s => s !== rt.toLowerCase())
                            : [...selected, rt]
                          update({ vc_round_types: next.join(', ') })
                        }}
                      >
                        {rt.replace('_', ' ')}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 7: Sweep + Run */}
      <div className="flex flex-wrap gap-4 items-center justify-between pt-2 border-t border-border-light">
        <div>
          <label className="text-xs font-medium uppercase tracking-widest text-text-muted block mb-1.5">Sweep<HelpTip text="Run multiple simulations at once, varying one parameter. Compare how different top N sizes, strategies, or rebalance frequencies perform." /></label>
          <div className="flex flex-wrap gap-y-1">
            {SWEEP_OPTIONS.map(s => (
              <button
                key={s}
                className={`px-2.5 py-1.5 text-xs border border-border-light first:rounded-l-lg last:rounded-r-lg -ml-px first:ml-0 transition-colors ${
                  filters.sweep === s
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-text-secondary hover:bg-muted'
                }`}
                onClick={() => update({ sweep: s })}
              >
                {SWEEP_LABELS[s] || s}
              </button>
            ))}
          </div>
        </div>
        <button
          className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isLoading
              ? 'bg-muted text-text-secondary hover:bg-border-light'
              : 'bg-zinc-900 text-white hover:bg-zinc-800'
          }`}
          onClick={onRun}
          disabled={!isLoading && !canRun}
        >
          {isLoading ? 'Cancel' : isSweeping ? 'Run Sweep' : 'Run Simulation'}
        </button>
      </div>
    </div>
  )
}
