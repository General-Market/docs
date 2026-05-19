// Editorial rule for /alpha-shrinking
//
// This page documents one thing: the measured decay of retail-accessible alphas
// over the past two decades. Every claim must be tied to a paper, a regulator
// disclosure, or an audited on-chain dataset. The thesis is that markets did
// not become unfair; they became unfair *more*, and the unfairness is published.
//
// If a row cannot cite a peer-reviewed paper, a regulator-mandated disclosure,
// or a named on-chain study with a public dashboard, it does not belong here.

export type AnomalyCategory =
  | 'classical'        // PEAD, momentum, value, size — Fama-French era
  | 'event'            // IPO drift, splits, spinoffs, mergers, index inclusion
  | 'information'      // insider mimicking, local-knowledge, alt-data
  | 'derivative'       // 0DTE, variance risk premium
  | 'on-chain'         // DeFi yields, memecoin launches

export interface DeadAnomaly {
  slug: string
  /** Display name. Short. */
  name: string
  category: AnomalyCategory
  /** First publication that documented the anomaly as a retail-accessible alpha. */
  born: { year: number; cite: string }
  /** Year the anomaly was measured to have decayed below trading-cost threshold. */
  died: { year: number; cite: string; mechanism: string }
  /** Peak return in % per year. */
  peakReturn: number
  /** Current measured return in % per year. */
  currentReturn: number
  /** Single-line description of what the anomaly was. */
  what: string
  /** The knife. What killed it and why. */
  knife: string
  /** Citation label. */
  sourceLabel: string
  sourceUrl: string
}

export interface DecadeBar {
  decade: string      // '1990s', '2000s', '2010s'
  value: number       // percentage points of excess return
  note?: string
}

export interface CohortRow {
  metric: string            // 'All US equity funds', 'Small-cap'
  before: { window: string; value: number; unit: string }
  after:  { window: string; value: number; unit: string }
  changeText: string        // '+91%' or 'nearly doubled'
  sourceLabel: string
  sourceUrl: string
}

export interface DecayRow {
  slug: string
  name: string
  /** Anomaly's peak documented return, % per year. */
  peakReturn: number
  /** Anomaly's most recent measured return, % per year. */
  currentReturn: number
  /** Defensible-range low. */
  lowReturn: number
  /** Defensible-range high. */
  highReturn: number
  diedYear: number
  killerCite: string
  killerUrl: string
  /** One-line cause. */
  killedBy: string
}

export interface RestorationRow {
  property: string
  restoredBy: string
}
