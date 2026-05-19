// Greenwood & Sammon (Journal of Finance 2025) — "The Disappearing Index Effect."
//
// The S&P 500 inclusion premium across decades, plus the deletion effect.
// Published: HBS WP 23-025; SSRN 4294297; NBER w30748; JoF 80(2), 2025.

import type { DecadeBar } from './types'

export const INCLUSION_BARS: DecadeBar[] = [
  { decade: '1990s', value: 7.4, note: 'The trade everyone could see' },
  { decade: '2000s', value: 4.0, note: 'Passive flows begin to absorb the kink' },
  { decade: '2010s', value: 0.9, note: 'Crossed into rounding-error territory' },
  { decade: '2020–2022', value: 0.6, note: 'The marginal buyer is now a future' },
]

export const DELETION_BARS: DecadeBar[] = [
  { decade: '1990s', value: -10.0, note: 'Forced selling crushed the deletion' },
  { decade: '2000s', value: -5.4, note: 'Still measurably negative' },
  { decade: '2010s', value: -0.1, note: 'A statistical zero' },
  { decade: '2020–2022', value: -0.4, note: 'Noise' },
]

export const INCLUSION_SOURCE = {
  label: 'Greenwood & Sammon · JoF 2025',
  url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4294297',
}
