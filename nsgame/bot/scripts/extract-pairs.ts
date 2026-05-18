/**
 * extract-pairs.ts — emit ../pairs.json from the canonical TS registry.
 *
 * Run from the mono root:
 *   npx tsx bot-nsgame/scripts/extract-pairs.ts
 *
 * The bot reads pairs.json at runtime; regenerating it pins the same
 * 25 cohorts the frontend renders. Audience values are bigints in the
 * source; we serialise them as decimal strings so JSON survives them.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { PAIR_REGISTRY } from '../../nsgame/lib/markets/pairs'

const STARS_SETTLE_DELAY_SECS = 60
const CAMS_SETTLE_DELAY_SECS = 30

const out = PAIR_REGISTRY.map(p => ({
  pair_index: p.pairIndex,
  board: p.board,
  format: p.format,
  source_id: p.sourceId,
  window_secs: p.windowSecs,
  settle_delay_secs: p.board === 'stars' ? STARS_SETTLE_DELAY_SECS : CAMS_SETTLE_DELAY_SECS,
  slug_a: p.slugA,
  slug_b: p.slugB,
  display_a: p.displayA,
  display_b: p.displayB,
  audience_a: p.audienceA.toString(),
  audience_b: p.audienceB.toString(),
  tightness: p.tightness,
}))

const target = path.resolve(__dirname, '..', 'pairs.json')
fs.writeFileSync(target, JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log(`wrote ${out.length} pairs to ${target}`)
