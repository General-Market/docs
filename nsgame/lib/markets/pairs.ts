/**
 * PvP pair registry. The on-chain Market PDA is keyed by
 * (source_id, threshold_bps, close_time, settlement_time). To smuggle a
 * pair index inside that constraint we repurpose `threshold_bps`:
 *
 *   - Stars cohort: threshold_bps 1..15  (source_id = 1, tubes_xv)
 *   - Cams  cohort: threshold_bps 16..25 (source_id = 4, tubes_cb)
 *
 * The program enforces |threshold_bps| <= 10_000 — 1..25 is safe.
 *
 * Each entry stores both the on-chain slug and a human-readable display
 * name. Audience values mirror the spec table at
 * `data-node/data/tube-rate-tests/MARKETS_PVP_25.md`.
 */

export type Board = 'stars' | 'cams'
export type PvpFormat = 'f1-gain-race' | 'f2-viewer-total'

export interface PvpPair {
  /** 1..25, doubles as on-chain threshold_bps. */
  pairIndex: number
  board: Board
  format: PvpFormat
  /** 1 = tubes_xv (stars), 4 = tubes_cb (cams). */
  sourceId: 1 | 4
  /** Cohort cycle length in seconds — when a fresh cohort opens.
   *  14_400 stars, 120 cams. */
  windowSecs: number
  /** How long a cohort accepts bets, measured from cohort start.
   *  Stars: 3_600 (1h open, 3h locked); cams: full window. */
  betWindowSecs: number
  slugA: string
  slugB: string
  displayA: string
  displayB: string
  /** Lifetime views (stars) or current viewers (cams). Raw integers. */
  audienceA: bigint
  audienceB: bigint
  /** 0..1, from the spec. min/max ratio of the two audiences. */
  tightness: number
}

// Stars: cohort cycles every 1 h, bet window is the full cycle, then
// a 3 h race phase where the oracle measures view-count gain. Result:
// at any moment one cohort is bettable plus three are racing — markets
// stay continuously tradable while the gain race remains 4 h
// end-to-end. Cams stay on a tight 2-min loop with no lock.
const STARS_WINDOW = 3_600 // 1 hour cycle (new cohort every hour)
const STARS_BET_WINDOW = 3_600 // full cycle accepts bets
const CAMS_WINDOW = 120 // 2 minutes
const CAMS_BET_WINDOW = 120 // full window — no lock phase

// Stars — slug → display map, regenerated from real xvideos data on
// 2026-04-26. Top 30 pornstars by total view count, sorted desc, paired
// adjacent-rank for competitive 4h gain races. Slugs match
// `tubes_xvideos_star_*` in the data-node's market_prices_latest.
//
// Audience values are total view counts (live numbers from xvideos,
// stored as bigint). The previous tier of fictional 200M-3B figures
// has been replaced with the actual numbers — Abella Danger is real
// and really sits at ~5.8B; the rest scale from there.
const STARS: ReadonlyArray<readonly [string, string, bigint]> = [
  ['abella-danger', 'Abella Danger', 5_814_981_298n],
  ['angela-white1', 'Angela White', 4_099_494_315n],
  ['adriana-chechik', 'Adriana Chechik', 3_772_695_268n],
  ['alexis-fawx', 'Alexis Fawx', 3_750_463_895n],
  ['ava-addams', 'Ava Addams', 3_698_788_641n],
  ['ariella-ferrera3', 'Ariella Ferrera', 3_381_566_702n],
  ['brandilovevip1', 'Brandi Love', 3_314_181_034n],
  ['alura-jenson-11', 'Alura Jenson', 3_120_629_989n],
  ['alison_tyler', 'Alison Tyler', 2_247_088_716n],
  ['bridgette-b', 'Bridgette B', 2_221_762_226n],
  ['chanel-preston', 'Chanel Preston', 2_183_134_750n],
  ['august-ames', 'August Ames', 2_125_548_986n],
  ['cathy-heaven', 'Cathy Heaven', 2_036_804_410n],
  ['alexis-texas', 'Alexis Texas', 1_989_793_063n],
  ['carmela_clutch_official1', 'Carmela Clutch', 1_968_129_263n],
  ['anny-kitty', 'Anny Kitty', 1_924_814_499n],
  ['beautiful-ann1', 'Beautiful Ann', 1_881_458_463n],
  ['blair-williams', 'Blair Williams', 1_848_614_795n],
  ['anissa-kate1', 'Anissa Kate', 1_833_521_333n],
  ['brooklyn-chase-model', 'Brooklyn Chase', 1_732_245_517n],
  ['alina-lopez-model', 'Alina Lopez', 1_714_105_378n],
  ['britney_amber', 'Britney Amber', 1_703_266_549n],
  ['asa_akira', 'Asa Akira', 1_626_082_056n],
  ['bianca_naldy_oficial_atriz_porno1', 'Bianca Naldy', 1_597_014_077n],
  ['casey-calvert', 'Casey Calvert', 1_553_740_935n],
  ['aj-applegate', 'AJ Applegate', 1_532_017_305n],
  ['alexis-crystal-1', 'Alexis Crystal', 1_510_973_020n],
  ['bruna_black4', 'Bruna Black', 1_501_766_675n],
  ['carolina-sweets', 'Carolina Sweets', 1_459_251_087n],
  ['abigail-mac5', 'Abigail Mac', 1_449_691_382n],
] as const

// Tightness = min/max audience ratio per pair. Higher = more even matchup.
const STARS_TIGHTNESS = [
  0.71, 0.99, 0.91, 0.94, 0.99, 0.96, 0.96, 0.96, 0.97, 0.94,
  0.99, 0.98, 0.99, 0.99, 0.99,
] as const

// Cams — slug → display, viewer count, format split. Top 20 chaturbate
// models by current peak viewer count, regenerated 2026-04-26. Slugs
// match `cb_model_*` in market_prices_latest. The display names mirror
// the room names; many include underscores and aren't proper names —
// we keep them lower-cased with normal capitalization where possible.
const CAMS: ReadonlyArray<readonly [string, string, bigint]> = [
  ['honeyyykate', 'Honey Kate', 22_360n],
  ['_happymeal', 'Happy Meal', 21_943n],
  ['emilybatee', 'Emily Bate', 20_197n],
  ['ms_dira', 'Ms Dira', 20_012n],
  ['blissdilley', 'Bliss Dilley', 19_973n],
  ['ronny_ponny', 'Ronny Ponny', 19_848n],
  ['dewdropdoll', 'Dewdrop Doll', 19_700n],
  ['_hidden_gem_', 'Hidden Gem', 19_587n],
  ['bella__donne', 'Bella Donne', 19_570n],
  ['monika_reed1', 'Monika Reed', 19_133n],
  ['estee_', 'Estee', 18_335n],
  ['milabunny_', 'Mila Bunny', 17_897n],
  ['germaine_jones', 'Germaine Jones', 17_858n],
  ['nica_rock', 'Nica Rock', 17_732n],
  ['honey_pinkgreen', 'Honey Pinkgreen', 17_695n],
  ['aviebby', 'Aviebby', 17_629n],
  ['naughtysammx', 'Naughty Sam', 17_579n],
  ['misss_viki', 'Miss Viki', 17_576n],
  ['eva_fashionista', 'Eva Fashionista', 17_397n],
  ['sweety_rinushka_', 'Sweet Rinushka', 17_237n],
] as const

const CAMS_TIGHTNESS = [
  0.98, 0.99, 0.99, 0.99, 0.98, 0.99, 0.99, 1.00, 0.99, 0.99,
] as const

// Spec: alternate gain race / viewer total starting with F1.
const CAMS_FORMATS: PvpFormat[] = [
  'f1-gain-race',
  'f2-viewer-total',
  'f1-gain-race',
  'f2-viewer-total',
  'f1-gain-race',
  'f2-viewer-total',
  'f1-gain-race',
  'f2-viewer-total',
  'f1-gain-race',
  'f2-viewer-total',
]

function buildRegistry(): readonly PvpPair[] {
  const out: PvpPair[] = []

  // Stars — 15 pairs, indices 1..15.
  for (let i = 0; i < 15; i++) {
    const [slugA, displayA, audA] = STARS[i * 2]!
    const [slugB, displayB, audB] = STARS[i * 2 + 1]!
    out.push({
      pairIndex: i + 1,
      board: 'stars',
      format: 'f1-gain-race',
      sourceId: 1,
      windowSecs: STARS_WINDOW,
      betWindowSecs: STARS_BET_WINDOW,
      slugA,
      slugB,
      displayA,
      displayB,
      audienceA: audA,
      audienceB: audB,
      tightness: STARS_TIGHTNESS[i]!,
    })
  }

  // Cams — 10 pairs, indices 16..25.
  for (let i = 0; i < 10; i++) {
    const [slugA, displayA, audA] = CAMS[i * 2]!
    const [slugB, displayB, audB] = CAMS[i * 2 + 1]!
    out.push({
      pairIndex: 16 + i,
      board: 'cams',
      format: CAMS_FORMATS[i]!,
      sourceId: 4,
      windowSecs: CAMS_WINDOW,
      betWindowSecs: CAMS_BET_WINDOW,
      slugA,
      slugB,
      displayA,
      displayB,
      audienceA: audA,
      audienceB: audB,
      tightness: CAMS_TIGHTNESS[i]!,
    })
  }

  return out
}

export const PAIR_REGISTRY: readonly PvpPair[] = buildRegistry()

export function pairById(pairIndex: number): PvpPair | undefined {
  return PAIR_REGISTRY.find(p => p.pairIndex === pairIndex)
}

export function pairsForBoard(board: Board | 'all'): PvpPair[] {
  if (board === 'all') return PAIR_REGISTRY.slice()
  return PAIR_REGISTRY.filter(p => p.board === board)
}

export function formatLabel(format: PvpFormat): string {
  return format === 'f1-gain-race' ? 'gain race' : 'viewer total'
}

export function windowLabel(windowSecs: number): string {
  if (windowSecs >= 3600) return `${Math.round(windowSecs / 3600)}h`
  if (windowSecs >= 60) return `${Math.round(windowSecs / 60)}m`
  return `${windowSecs}s`
}

export function formatPillLabel(pair: PvpPair): string {
  return `${windowLabel(pair.windowSecs)} ${formatLabel(pair.format)}`
}

/**
 * Short, single-line hook rendered on the market card. Tells the user
 * exactly what they're betting on without arithmetic. Read in the same
 * breath as the pair label — no more than ~36 chars.
 */
export function formatHook(pair: PvpPair): string {
  const win = windowLabel(pair.windowSecs)
  if (pair.format === 'f1-gain-race') {
    if (pair.board === 'cams') return `Most new live viewers in ${win} wins`
    return `Most new lifetime views in ${win} wins`
  }
  return `Most live viewers when the ${win} closes wins`
}

/**
 * Long-form description rendered under the title in the bet sheet. Says
 * the metric, the window, the resolution rule, and the refund condition.
 * Kept under 220 chars so the BetTicket renderer accepts it.
 */
export function formatDescription(pair: PvpPair): string {
  const win = windowLabel(pair.windowSecs)
  if (pair.format === 'f1-gain-race') {
    if (pair.board === 'cams') {
      return `Live viewer race over the next ${win}. Whoever picks up more new viewers during the window wins. Pick the side you think will spike. Tie or both flat refunds.`
    }
    return `Lifetime-views race over the next ${win}. Whoever gains more new views during the window wins. Pick the side you think will surge. Tie or both flat refunds.`
  }
  return `Live viewer count at the ${win} close. Whoever has more concurrent viewers when the window expires wins. Pick the side you think will be biggest. Tie or both flat refunds.`
}

/** Compact audience number for chips. 4_200 → "4.2k", 593_000_000 → "593M". */
export function compactAudience(n: bigint): string {
  const abs = n < 0n ? -n : n
  if (abs < 1_000n) return n.toString()
  const v = Number(n)
  if (abs < 1_000_000n) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`
  if (abs < 1_000_000_000n) return `${Math.round(v / 1_000_000)}M`
  return `${(v / 1_000_000_000).toFixed(2)}B`
}

/** Stars use lifetime views; cams use current viewers. */
export function audienceUnit(board: Board): string {
  return board === 'stars' ? 'lifetime' : 'avg viewers'
}
