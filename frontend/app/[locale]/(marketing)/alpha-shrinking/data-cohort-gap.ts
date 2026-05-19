// Adjacent-cohort retail timing-gap data.
//
// Derek Horstmeyer (George Mason, Costello College of Business) ran the
// dollar-weighted vs time-weighted timing gap on the universe of US-dollar
// mutual funds across two adjacent five-year windows: pre-Covid and post-Covid.
// Same fund universe. Different retail behavior. The gap nearly doubled.
//
// Source: Zacks Investment Management commentary citing the Horstmeyer split:
// https://zacksim.com/blog/the-growing-risk-to-long-term-investor-returns/
//
// DALBAR's 2025 QAIB provides the cross-cycle headline number used in this section.

import type { CohortRow } from './types'

export const COHORT_ROWS: CohortRow[] = [
  {
    metric: 'All US equity funds',
    before: { window: '2015 – 2019', value: 0.53, unit: '%/yr drag' },
    after:  { window: '2020 – Oct 2024', value: 1.01, unit: '%/yr drag' },
    changeText: '+91% wider',
    sourceLabel: 'Horstmeyer (George Mason) via Zacks IM',
    sourceUrl: 'https://zacksim.com/blog/the-growing-risk-to-long-term-investor-returns/',
  },
  {
    metric: 'Small-cap equity funds',
    before: { window: '2015 – 2019', value: 0.62, unit: '%/yr drag' },
    after:  { window: '2020 – Oct 2024', value: 1.38, unit: '%/yr drag' },
    changeText: '+123% wider',
    sourceLabel: 'Horstmeyer (George Mason) via Zacks IM',
    sourceUrl: 'https://zacksim.com/blog/the-growing-risk-to-long-term-investor-returns/',
  },
  {
    metric: 'Average equity investor vs S&P 500',
    before: { window: '2009 — the last year retail beat the index', value: 0, unit: 'bps gap' },
    after:  { window: '2024 — 15 years later', value: 848, unit: 'bps gap' },
    changeText: '15 straight years lagging',
    sourceLabel: 'DALBAR 2025 QAIB',
    sourceUrl: 'https://www.dalbar.com/press-release/investors-missed-the-best-of-2024s-market-gains-latest-dalbar-investor-behavior-report-finds/',
  },
  {
    metric: 'Morningstar dollar-vs-fund gap (10-yr rolling)',
    before: { window: 'pre-2020 rolling decades', value: 1.0, unit: '%/yr drag' },
    after:  { window: '2020 – 2024 rolling decade', value: 1.2, unit: '%/yr drag' },
    changeText: '~15% of fund returns forfeited',
    sourceLabel: 'Morningstar · Mind the Gap 2025',
    sourceUrl: 'https://www.morningstar.com/business/insights/research/mind-the-gap',
  },
]
