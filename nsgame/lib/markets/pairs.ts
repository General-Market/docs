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
  /** Window length in seconds. 14_400 stars, 120 cams. */
  windowSecs: number
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

const STARS_WINDOW = 14_400 // 4 hours
const CAMS_WINDOW = 120 // 2 minutes

// Stars — slug → display map. Reasonable approximations; the spec slugs
// carry digit suffixes and dashes that don't belong on screen.
const STARS: ReadonlyArray<readonly [string, string, bigint]> = [
  ['carlacute3', 'Carla Cute', 221_000_000n],
  ['siri-dahl', 'Siri Dahl', 360_000_000n],
  ['cleagaultier-official1', 'Cléa Gaultier', 425_000_000n],
  ['kendra-lust', 'Kendra Lust', 510_000_000n],
  ['skye-young2', 'Skye Young', 511_000_000n],
  ['liza-del-sierra', 'Liza Del Sierra', 544_000_000n],
  ['hot-pearl2', 'Hot Pearl', 593_000_000n],
  ['lia-lin', 'Lia Lin', 594_000_000n],
  ['nicole-aniston', 'Nicole Aniston', 600_000_000n],
  ['shinaryen27', 'Shinaryen', 618_000_000n],
  ['lexi-luna', 'Lexi Luna', 690_000_000n],
  ['dani-daniels', 'Dani Daniels', 710_000_000n],
  ['angela-white', 'Angela White', 720_000_000n],
  ['stacy-cruz', 'Stacy Cruz', 794_000_000n],
  ['natalie-cherie', 'Natalie Cherie', 819_000_000n],
  ['adriana-chechik', 'Adriana Chechik', 880_000_000n],
  ['luna-rival1', 'Luna Rival', 943_000_000n],
  ['brandi-love', 'Brandi Love', 950_000_000n],
  ['alexis-texas', 'Alexis Texas', 980_000_000n],
  ['mia-malkova', 'Mia Malkova', 1_100_000_000n],
  ['eva-elfie', 'Eva Elfie', 1_100_000_000n],
  ['sharon-lee', 'Sharon Lee', 1_160_000_000n],
  ['abella-danger', 'Abella Danger', 1_200_000_000n],
  ['sweetie-fox1', 'Sweetie Fox', 1_250_000_000n],
  ['lana-rhoades', 'Lana Rhoades', 1_450_000_000n],
  ['katty-west', 'Katty West', 1_530_000_000n],
  ['riley-reid', 'Riley Reid', 1_700_000_000n],
  ['anissa-kate1', 'Anissa Kate', 1_830_000_000n],
  ['gina-gerson2', 'Gina Gerson', 1_950_000_000n],
  ['vale_nappi3', 'Vale Nappi', 3_040_000_000n],
] as const

const STARS_TIGHTNESS = [
  0.61, 0.83, 0.94, 1.00, 0.97, 0.97, 0.91, 0.93, 0.99, 0.89,
  0.95, 0.96, 0.95, 0.93, 0.64,
] as const

// Cams — slug → display, audience tier, format split.
const CAMS: ReadonlyArray<readonly [string, string, bigint]> = [
  ['aria_blue', 'Aria Blue', 4200n],
  ['sasha_riot', 'Sasha Riot', 3800n],
  ['amelia_couple', 'Amelia Couple', 3100n],
  ['jade_xo', 'Jade XO', 2700n],
  ['ruby_couple', 'Ruby Couple', 2400n],
  ['carmen_latina', 'Carmen Latina', 2200n],
  ['yui_asian', 'Yui Asian', 1900n],
  ['zara_tease', 'Zara Tease', 1700n],
  ['diva_milf', 'Diva MILF', 1600n],
  ['lola_petite', 'Lola Petite', 1400n],
  ['mona_ebony', 'Mona Ebony', 1200n],
  ['viv_french', 'Viv French', 950n],
  ['rhea_german', 'Rhea German', 820n],
  ['elena_es', 'Elena ES', 740n],
  ['nova_german', 'Nova German', 700n],
  ['nadia_trans', 'Nadia Trans', 600n],
  ['kai_solo_male', 'Kai Solo Male', 510n],
  ['domme_velvet', 'Domme Velvet', 410n],
  ['mei_solo', 'Mei Solo', 380n],
  ['foot_mistress', 'Foot Mistress', 320n],
] as const

const CAMS_TIGHTNESS = [
  0.90, 0.87, 0.92, 0.89, 0.88, 0.79, 0.90, 0.86, 0.80, 0.84,
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
