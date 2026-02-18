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
const WEIGHTING_OPTIONS = ['equal', 'mcap'] as const
const SWEEP_OPTIONS = ['none', 'top_n', 'weighting', 'rebalance', 'category'] as const

export interface SimFilterState {
  category_id: string
  top_n: number
  weighting: string
  rebalance_days: number
  base_fee_pct: number
  spread_multiplier: number
  sweep: string
  sweep_categories: string[]  // for category sweep
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

  const update = (patch: Partial<SimFilterState>) => {
    onChange({ ...filters, ...patch })
  }

  const toggleSweepCategory = (catId: string) => {
    const current = filters.sweep_categories
    if (current.includes(catId)) {
      update({ sweep_categories: current.filter(c => c !== catId) })
    } else {
      update({ sweep_categories: [...current, catId] })
    }
  }

  // Run is valid when: category sweep has >= 2 categories selected, OR single mode/other sweep has category_id
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
            /* Multi-select for category sweep */
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
              {/* Selected pills */}
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
            /* Single select for non-category sweep */
            <select
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs font-mono text-white appearance-none"
              value={filters.category_id}
              onChange={e => update({ category_id: e.target.value })}
              disabled={catsLoading}
            >
              <option value="">Select category...</option>
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

      {/* Row 2: Weighting + Rebalance */}
      <div className="flex flex-wrap gap-3 items-center">
        <div>
          <label className="text-[10px] text-white/40 font-mono uppercase block mb-1">Weighting</label>
          <div className="flex">
            {WEIGHTING_OPTIONS.map(w => (
              <button
                key={w}
                className={`px-3 py-1 text-xs font-mono border border-white/10 first:rounded-l last:rounded-r -ml-px first:ml-0 transition-colors capitalize ${
                  sweepDim === 'weighting'
                    ? 'bg-accent/20 text-accent border-accent/30'
                    : filters.weighting === w
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
                onClick={() => { if (sweepDim !== 'weighting') update({ weighting: w }) }}
                disabled={sweepDim === 'weighting'}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-white/40 font-mono uppercase block mb-1">Rebalance</label>
          <div className="flex">
            {REBALANCE_OPTIONS.map(r => (
              <button
                key={r.value}
                className={`px-2 py-1 text-xs font-mono border border-white/10 first:rounded-l last:rounded-r -ml-px first:ml-0 transition-colors ${
                  sweepDim === 'rebalance'
                    ? 'bg-accent/20 text-accent border-accent/30'
                    : filters.rebalance_days === r.value
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
                onClick={() => { if (sweepDim !== 'rebalance') update({ rebalance_days: r.value }) }}
                disabled={sweepDim === 'rebalance'}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Fees */}
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

      {/* Row 4: Sweep + Run */}
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
                {s === 'none' ? 'None' : s === 'top_n' ? 'Top N' : s === 'weighting' ? 'Weight' : s === 'rebalance' ? 'Rebal.' : 'Category'}
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
