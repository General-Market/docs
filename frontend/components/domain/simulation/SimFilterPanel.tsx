'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

/** Hover tooltip that portals to document.body for guaranteed top z-index */
function Tip({ text, children }: { text: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!show || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ top: r.top - 8, left: r.left + r.width / 2 })
  }, [show])

  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)', zIndex: 99999 }}
          className="px-3 py-2.5 bg-zinc-900 text-white text-[11px] leading-relaxed rounded-xl shadow-2xl w-72 whitespace-pre-line pointer-events-none"
        >
          {text}
        </div>,
        document.body,
      )}
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
  { value: '', label: 'Off', title: 'No Fear & Greed overlay — use your base strategy as-is.' },
  { value: 'contrarian', label: 'Contrarian', title: 'Be greedy when others are fearful. When everyone panics, buy more risky coins. When everyone is euphoric, shift to safer ones.\n\nWhy: Classic "buy the dip" logic. Small weight nudges, so the effect is subtle — best with concentrated portfolios.\n\nBacktest: +91% (barely beats baseline). The nudges are too small to matter with 200 holdings.' },
  { value: 'risk_toggle', label: 'Risk Toggle', title: 'A simple on/off switch. When people are scared, ride the winners (momentum). When people are greedy, protect the downside (min variance).\n\nWhy: Instead of tweaking weights, it swaps the entire strategy. Binary but effective at extremes.\n\nBacktest: best at 40/60 → +220%, 0.66 Sharpe. Switches often enough to capture regime changes.' },
  { value: 'cash_shift', label: 'Cash Shift', title: 'When greed is high, move some money to cash. When greed fades, go back to fully invested. That\'s it.\n\nWhy: "Sell when everyone is buying" in its simplest form. Only the greed threshold matters — fear threshold is ignored.\n\nBacktest: best at greed ≥80 → +124%, 0.58 Sharpe. Cash drag hurts in bull markets — you\'re sitting out while prices rise.' },
  { value: 'graduated_cash', label: 'Grad. Cash', title: 'Smoothly ramp cash as sentiment gets greedier. At peak fear you\'re fully invested; at peak greed you\'re partially in cash.\n\nWhy: Smoother version of Cash Shift — no sudden all-or-nothing moves. But the cash drag is constant and adds up.\n\nBacktest: best at 15/80 → +76%, 0.48 Sharpe. Underperforms baseline in bull markets — you\'re always holding some cash.' },
  { value: 'quality_rotation', label: 'Quality Rot.', title: 'The big one. When scared: concentrate into top 5 blue-chips with defensive weighting. When greedy: spread across 50+ coins and ride momentum.\n\nWhy: Changes BOTH what you hold (top N) and how you weight it. Fear = flight to quality, greed = catch the altcoin wave.\n\nBacktest: best at 50/55 → +1140%, 0.92 Sharpe. Or 85/90 → +689% with only 62% fees (efficient). Dominant strategy.' },
  { value: 'trend_follow', label: 'Trend Follow', title: 'Ignores how scared or greedy people are — only cares about the direction. If sentiment is improving, ride momentum. If sentiment is worsening, get defensive.\n\nWhy: Catches trend reversals early, before FNG hits extreme levels. No tunable parameters.\n\nBacktest: +159%, 0.71 Sharpe. Solid mid-tier. Best risk-adjusted Sharpe among the simpler strategies.' },
] as const

const DOM_MODES = [
  { value: '', label: 'Off', title: 'No BTC Dominance overlay — use your base strategy as-is.' },
  { value: 'alts_when_low', label: 'Alts Low', title: 'When Bitcoin is losing market share (<50%), go wide into altcoins — it\'s alt season. When Bitcoin dominates (>60%), retreat to the top 5 blue chips.\n\nWhy: Alt seasons are where the biggest gains come from. This catches them automatically by watching Bitcoin\'s share of the total market.\n\nBacktest: +388%, 0.73 Sharpe. Top DOM strategy — simple signal, huge payoff.' },
  { value: 'alts_when_falling', label: 'Alts Falling', title: 'Watches the direction Bitcoin dominance is moving. If BTC share is dropping → spread into alts. If BTC share is rising → hide in Bitcoin.\n\nWhy: Reacts to the trend, not the level. Catches the early move into alt season before dominance hits a threshold.\n\nBacktest: best at 60d → +140%, 0.57 Sharpe. Decent but high fees (94%) from frequent switching.' },
  { value: 'btc_when_high', label: 'BTC High', title: 'When Bitcoin owns >55% of the market, play it safe — concentrate into the top 5 biggest coins. Also gets defensive when BTC dominance is rising.\n\nWhy: High BTC dominance usually means alts are bleeding. This dodges alt-season drawdowns by hiding in large caps.\n\nBacktest: best at 90d → +395%, 0.73 Sharpe. Surprisingly strong — nearly matches Alts Low.' },
  { value: 'combo', label: 'Combo', title: 'Combines Fear & Greed with BTC dominance into 4 scenarios:\n• Scared + BTC rising → hide in top 5 (safety)\n• Greedy + BTC falling → spread across 100 alts (max risk)\n• Scared + BTC falling → defensive alts (cautious)\n• Greedy + BTC rising → momentum top 10 (risk-on)\n\nWhy: Most sophisticated signal, but complexity doesn\'t always win.\n\nBacktest: best at 90d → +96%, 0.55 Sharpe. Barely beats baseline — too many conflicting signals.' },
  { value: 'momentum', label: 'Momentum', title: 'If BTC dominance is dropping fast → switch to momentum (ride the altcoin wave). If BTC dominance is rising → switch to MCap weighting (follow the big coins).\n\nWhy: Simple trend-following on the BTC/alt rotation. When money flows into alts, chase the winners.\n\nBacktest: best at 30d → +184%, 0.63 Sharpe. Solid middle ground — not the best, not the worst.' },
] as const

const DOM_LOOKBACK_OPTIONS = [
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
  { value: 90, label: '90d' },
]

// Optimized presets per FNG mode (benchmarked on ALL/200/equal/30d)
const FNG_PRESETS: Record<string, { label: string; fear: number; greed: number; title: string }[]> = {
  contrarian: [],
  risk_toggle: [
    { label: '40 / 60', fear: 40, greed: 60, title: 'Aggressive — switches more often at wider band.\nALL/200/equal/30d: +220%, 0.66 Sharpe' },
    { label: '20 / 60', fear: 20, greed: 60, title: 'Balanced — only activates at deep fear, fewer trades.\nALL/200/equal/30d: +186%, 0.63 Sharpe' },
  ],
  cash_shift: [
    { label: '_ / 80', fear: 25, greed: 80, title: 'Conservative greed trigger — only parks cash at extreme euphoria. Fear threshold is ignored by this mode.\nALL/200/equal/30d: +124%, 0.58 Sharpe' },
    { label: '_ / 75', fear: 25, greed: 75, title: 'Earlier cash move — starts parking cash sooner.\nALL/200/equal/30d: +109%, 0.56 Sharpe' },
  ],
  graduated_cash: [
    { label: '15 / 80', fear: 15, greed: 80, title: 'Widest range — minimal cash drag, ramps slowly.\nALL/200/equal/30d: +76%, 0.48 Sharpe' },
    { label: '15 / 55', fear: 15, greed: 55, title: 'Best drawdown protection — starts cashing out earlier.\nALL/200/equal/30d: +70%, 0.46 Sharpe, -82% DD' },
  ],
  quality_rotation: [
    { label: '50 / 55', fear: 50, greed: 55, title: 'Max return — narrow neutral band, almost always in fear or greed mode. High turnover.\nALL/200/equal/30d: +1140%, 0.92 Sharpe, 175% fees' },
    { label: '85 / 90', fear: 85, greed: 90, title: 'Capital efficient — only acts at extreme readings, very few switches. Same drawdown, fraction of the fees.\nALL/200/equal/30d: +689%, 0.88 Sharpe, 62% fees' },
  ],
  trend_follow: [],
}

// Optimized presets per DOM mode (benchmarked on ALL/200/equal/30d)
const DOM_PRESETS: Record<string, { label: string; lookback: number; title: string }[]> = {
  alts_when_low: [
    { label: '30d', lookback: 30, title: 'Lookback has no effect on this mode — it uses absolute dominance levels, not trend.\nALL/200/equal/30d: +388%, 0.73 Sharpe' },
  ],
  alts_when_falling: [
    { label: '60d', lookback: 60, title: 'Best return — medium-term trend catches bigger moves.\nALL/200/equal/30d: +140%, 0.57 Sharpe, 94% fees' },
    { label: '90d', lookback: 90, title: 'Lower fees — slower signal, less churn.\nALL/200/equal/30d: +74%, 0.49 Sharpe, 53% fees' },
  ],
  btc_when_high: [
    { label: '90d', lookback: 90, title: 'Best overall — slow trend filter avoids noise.\nALL/200/equal/30d: +395%, 0.73 Sharpe' },
    { label: '14d', lookback: 14, title: 'Faster reaction — catches short-term dominance spikes.\nALL/200/equal/30d: +226%, 0.64 Sharpe' },
  ],
  combo: [
    { label: '90d', lookback: 90, title: 'Smoothest signal — less whipsaw from the 4-quadrant matrix.\nALL/200/equal/30d: +96%, 0.55 Sharpe' },
    { label: '14d', lookback: 14, title: 'Fastest reaction — more switching between quadrants.\nALL/200/equal/30d: +87%, 0.55 Sharpe' },
  ],
  momentum: [
    { label: '30d', lookback: 30, title: 'Best overall — 30d trend hits the sweet spot.\nALL/200/equal/30d: +184%, 0.63 Sharpe' },
    { label: '14d', lookback: 14, title: 'Faster signal — reacts quicker to dominance shifts.\nALL/200/equal/30d: +111%, 0.57 Sharpe' },
  ],
}

const VC_MODES = [
  { value: '', label: 'Off', title: 'No VC overlay' },
  { value: 'funding', label: 'Funding', title: 'Multiply weight by total funding amount.\nCoins with more VC backing get higher weight.\nFilters to coins matching selected investors & rounds.' },
  { value: 'valuation', label: 'Valuation', title: 'Multiply weight by latest valuation.\nHigher-valued projects get more allocation.\nProxy for VC confidence in the project.' },
  { value: 'fresh_12', label: 'Fresh 12m', title: 'Only include coins with funding in last 12 months.\nRecently funded = active development.\nMultiplied by latest funding amount.' },
  { value: 'fresh_6', label: 'Fresh 6m', title: 'Only include coins with funding in last 6 months.\nMost recent VC activity signal.\nStricter filter than Fresh 12m.' },
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
  { id: 'equal', label: 'Equal', title: 'Equal weight: same $ amount in every coin.\nSimplest strategy — no bias toward size or momentum.\nGood baseline: outperforms MCap in alt seasons.\nRebalancing sells winners and buys losers (mean-reversion).', prefix: '', params: null, defaultParam: null, group: 'price' },
  { id: 'mcap', label: 'MCap', title: 'Market-cap weighted: bigger coins get more $.\nMimics how traditional index funds work (S&P 500 style).\nHeavily concentrated in BTC + ETH.\n0.5% floor prevents tiny weights on small coins.', prefix: '', params: null, defaultParam: null, group: 'price' },
  { id: 'mcap_cap', label: 'Capped', title: 'MCap-weighted with a maximum cap per holding.\nPrevents one coin from dominating the portfolio.\nCap 10% → no coin can exceed 10% of portfolio.\nBalances MCap efficiency with diversification.', prefix: 'mcap_cap', params: [
    { value: 5, label: '5%' }, { value: 10, label: '10%' }, { value: 15, label: '15%' }, { value: 25, label: '25%' }, { value: 50, label: '50%' },
  ], defaultParam: 10, group: 'price' },
  { id: 'sqrt_mcap', label: 'SqrtMCap', title: 'Square root of market cap weighting.\nDampens concentration vs pure MCap.\nBTC still gets more, but mid-caps get a fairer share.\nMidway between Equal and MCap.', prefix: '', params: null, defaultParam: null, group: 'price' },
  { id: 'momentum', label: 'Momentum', title: 'Weight by trailing return over lookback period.\nCoins that went up the most get the highest weight.\nClassic trend-following factor.\nWorks well in bull markets, hurts in reversals.', prefix: 'momentum_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' }, { value: 180, label: '180d' }, { value: 365, label: '1y' },
  ], defaultParam: 90, group: 'price' },
  { id: 'invvol', label: 'InvVol', title: 'Inverse volatility: less volatile = higher weight.\nStable coins get more allocation, volatile ones less.\nReduces portfolio volatility without going to cash.\nGood for risk-adjusted returns (Sharpe ratio).', prefix: 'invvol_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60, group: 'price' },
  { id: 'dual_mom', label: 'DualMom', title: 'Dual Momentum: trend-following with cash safety net.\nWhen average coin return > 0: invest normally.\nWhen average < 0: sell everything and go to cash.\nAvoids prolonged bear markets entirely.', prefix: 'dual_mom_', params: [
    { value: 90, label: '90d' }, { value: 180, label: '180d' }, { value: 365, label: '1y' },
  ], defaultParam: 180, group: 'price' },
  { id: 'risk_parity', label: 'RiskPar', title: 'Risk parity: each coin contributes equal risk.\nVolatile coins get less weight, stable ones more.\nUses covariance matrix for accurate risk budgeting.\nIterative optimization for equal marginal risk.', prefix: 'risk_parity_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60, group: 'price' },
  { id: 'min_var', label: 'MinVar', title: 'Minimum variance: minimize total portfolio volatility.\nLong-only optimization using covariance matrix.\nSmoothest equity curve at the cost of lower returns.\nBest when you want the least bumpy ride.', prefix: 'min_var_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60, group: 'price' },
  { id: 'multi_factor', label: 'MultiFac', title: 'Multi-factor composite: momentum + low vol + MCap.\nRanks coins on each factor, then averages ranks.\nDiversified signal — not reliant on one factor.\nBest all-rounder for different market regimes.', prefix: 'multi_factor_', params: [
    { value: 60, label: '60d' }, { value: 90, label: '90d' }, { value: 180, label: '180d' },
  ], defaultParam: 90, group: 'price' },
  { id: 'low_vol', label: 'LowVol', title: 'Low volatility: keep only the least volatile half.\nFilters out the most volatile coins entirely.\nRemaining coins are equal-weighted.\nDefensive play — lower drawdowns, lower returns.', prefix: 'low_vol_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60, group: 'price' },
  // DeFi strategies
  { id: 'tvl', label: 'TVL', title: 'Weight by Total Value Locked (TVL).\nMore TVL = more user trust = higher weight.\nFavors established DeFi protocols.\nUses current TVL snapshot (not historical).', prefix: '', params: null, defaultParam: null, group: 'defi' },
  { id: 'tvl_cap', label: 'TVL Cap', title: 'TVL-weighted with max % cap per holding.\nPrevents one protocol from dominating.\nBalances TVL signal with diversification.\nCap 10% → no protocol exceeds 10%.', prefix: 'tvl_cap', params: [
    { value: 5, label: '5%' }, { value: 10, label: '10%' }, { value: 15, label: '15%' }, { value: 25, label: '25%' }, { value: 50, label: '50%' },
  ], defaultParam: 10, group: 'defi' },
  { id: 'tvl_sqrt', label: 'TVL Sqrt', title: 'Square root of TVL: dampened concentration.\nMid-tier protocols get fairer share vs pure TVL.\nReduces dominance of mega-protocols like Lido/Aave.\nMiddle ground between Equal and TVL.', prefix: '', params: null, defaultParam: null, group: 'defi' },
  { id: 'fees_w', label: 'Fees', title: 'Weight by 24h protocol fees generated.\nRevenue-generating protocols get more weight.\nProxy for real usage and product-market fit.\nUses current fees (not historical).', prefix: '', params: null, defaultParam: null, group: 'defi' },
  { id: 'revenue_w', label: 'Revenue', title: 'Weight by 24h protocol revenue.\nRevenue = fees kept by the protocol (not LPs).\nFavors protocols with sustainable business models.\nStronger fundamental signal than raw fees.', prefix: '', params: null, defaultParam: null, group: 'defi' },
  { id: 'volume_w', label: 'Volume', title: 'Weight by 24h trading volume.\nMore volume = more activity = higher weight.\nFavors DEXes and actively traded protocols.\nVolatile signal — volume spikes during events.', prefix: '', params: null, defaultParam: null, group: 'defi' },
  { id: 'tvl_mom', label: 'TVL Mom', title: 'TVL Momentum: weight by TVL growth rate.\nProtocols gaining TVL fastest get highest weight.\nUses historical TVL (current / past ratio).\nCaptures growing protocols before MCap catches up.', prefix: 'tvl_mom_', params: [
    { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' },
  ], defaultParam: 60, group: 'defi' },
  { id: 'fee_eff', label: 'Fee Eff', title: 'Fee efficiency: fees_24h / TVL ratio.\nMeasures how much revenue per $ locked.\nFavors capital-efficient protocols.\nSmall protocols with high usage score well.', prefix: '', params: null, defaultParam: null, group: 'defi' },
  { id: 'yield_w', label: 'Yield', title: 'Weight by max yield APY offered.\nHigher yield = higher weight.\nFavors protocols offering attractive returns.\nCaution: high yields may signal risk.', prefix: '', params: null, defaultParam: null, group: 'defi' },
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
              { label: 'All', value: '2020-01-01' },
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
                filters.start_date && !['2020-01-01', fiveYearsAgo(), threeYearsAgo(), oneYearAgo()].includes(filters.start_date)
                  ? 'border-border-medium bg-white'
                  : 'border-border-light'
              }`}
              value={filters.start_date}
              onChange={e => update({ start_date: e.target.value })}
              min="2020-01-01"
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
            <label className="text-xs font-medium uppercase tracking-widest text-text-muted block mb-1.5">Fear & Greed<HelpTip text="Adjusts your strategy based on the Crypto Fear & Greed Index (0-100). Hover each mode for a plain-English explanation and backtest results." /></label>
            <div className="flex flex-wrap gap-1">
              {FNG_MODES.map(m => (
                <Tip key={m.value} text={m.title}>
                  <button
                    className={`px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
                      filters.fng_mode === m.value
                        ? m.value === '' ? 'bg-white text-text-secondary border-border-light' : 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-text-secondary border-border-light hover:bg-muted'
                    }`}
                    onClick={() => update({ fng_mode: m.value })}
                  >
                    {m.label}
                  </button>
                </Tip>
              ))}
            </div>
            {filters.fng_mode && (
              <div className="mt-2 pl-3 border-l-2 border-border-light space-y-2">
                {(FNG_PRESETS[filters.fng_mode]?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Optimized</span>
                    {FNG_PRESETS[filters.fng_mode]?.map((p, i) => (
                      <Tip key={i} text={p.title}>
                        <button
                          className={`px-2 py-0.5 text-[10px] font-mono border rounded-md transition-colors ${
                            filters.fng_fear === p.fear && filters.fng_greed === p.greed
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                          }`}
                          onClick={() => update({ fng_fear: p.fear, fng_greed: p.greed })}
                        >
                          {p.label}
                        </button>
                      </Tip>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-4">
                <div>
                  <span className="text-xs text-text-muted block mb-1">Fear &le; {filters.fng_fear}</span>
                  <input
                    type="range" min={5} max={90} step={1}
                    className="w-28 accent-zinc-900"
                    value={filters.fng_fear}
                    onChange={e => update({ fng_fear: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <span className="text-xs text-text-muted block mb-1">Greed &ge; {filters.fng_greed}</span>
                  <input
                    type="range" min={50} max={95} step={1}
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
              </div>
            )}
          </div>

          {/* BTC Dominance Regime */}
          <div>
            <label className="text-xs font-medium uppercase tracking-widest text-text-muted block mb-1.5">BTC Dominance<HelpTip text="Adjusts allocation based on Bitcoin's share of the total crypto market. Hover each mode for a plain-English explanation and backtest results." /></label>
            <div className="flex flex-wrap gap-1">
              {DOM_MODES.map(m => (
                <Tip key={m.value} text={m.title}>
                  <button
                    className={`px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
                      filters.dom_mode === m.value
                        ? m.value === '' ? 'bg-white text-text-secondary border-border-light' : 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-text-secondary border-border-light hover:bg-muted'
                    }`}
                    onClick={() => update({ dom_mode: m.value })}
                  >
                    {m.label}
                  </button>
                </Tip>
              ))}
            </div>
            {filters.dom_mode && (
              <div className="flex flex-wrap items-center gap-2 mt-2 pl-3 border-l-2 border-border-light">
                {(DOM_PRESETS[filters.dom_mode]?.length ?? 0) > 0 && (
                  <>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Optimized</span>
                    {DOM_PRESETS[filters.dom_mode]?.map((p, i) => (
                      <Tip key={i} text={p.title}>
                        <button
                          className={`px-2 py-0.5 text-[10px] font-mono border rounded-md transition-colors ${
                            filters.dom_lookback === p.lookback
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                          }`}
                          onClick={() => update({ dom_lookback: p.lookback })}
                        >
                          {p.label}
                        </button>
                      </Tip>
                    ))}
                    <span className="text-xs text-text-muted/50">|</span>
                  </>
                )}
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
                title={m.title}
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
