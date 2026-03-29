import type { LineStyle } from '../transport-colors'
import { registerLineMap } from '../transport-colors'

// Region colors — loosely inspired by DB's corporate palette
const NORTH = '#0080C8' // Hamburg, Bremen, Kiel, Hannover, ...
const BERLIN = '#EC0016' // Berlin, Potsdam
const NRW = '#00843D' // Köln, Düsseldorf, Dortmund, Essen, ...
const HESSEN = '#F39200' // Frankfurt, Darmstadt, Kassel, ...
const BAVARIA = '#003082' // München, Nürnberg, Augsburg, ...
const BADWUE = '#6E368C' // Stuttgart, Mannheim, Karlsruhe, ...
const EAST = '#009D81' // Leipzig, Dresden, Erfurt, ...
const OTHER = '#646973' // Rhineland-Palatinate, Saarland

const W = '#fff'

const DB_TRAINS_LINES: Record<string, LineStyle> = {
  // ── Berlin / Brandenburg ───────────────────────────────────────────
  berlin_hbf: { bg: BERLIN, fg: W, label: 'BER' },
  berlin_suedkreuz: { bg: BERLIN, fg: W, label: 'BLS' },
  berlin_ostkreuz: { bg: BERLIN, fg: W, label: 'BOK' },
  berlin_gesundbrunnen: { bg: BERLIN, fg: W, label: 'BGS' },
  berlin_spandau: { bg: BERLIN, fg: W, label: 'BSP' },
  potsdam_hbf: { bg: BERLIN, fg: W, label: 'POT' },

  // ── North ──────────────────────────────────────────────────────────
  hamburg_hbf: { bg: NORTH, fg: W, label: 'HAM' },
  hamburg_altona: { bg: NORTH, fg: W, label: 'HAA' },
  bremen_hbf: { bg: NORTH, fg: W, label: 'BRE' },
  hannover_hbf: { bg: NORTH, fg: W, label: 'HAJ' },
  kiel_hbf: { bg: NORTH, fg: W, label: 'KIE' },
  luebeck_hbf: { bg: NORTH, fg: W, label: 'LBC' },
  braunschweig_hbf: { bg: NORTH, fg: W, label: 'BWE' },
  osnabrueck_hbf: { bg: NORTH, fg: W, label: 'OSN' },
  wolfsburg_hbf: { bg: NORTH, fg: W, label: 'WOB' },
  hildesheim_hbf: { bg: NORTH, fg: W, label: 'HLI' },
  rostock_hbf: { bg: NORTH, fg: W, label: 'ROS' },

  // ── NRW ────────────────────────────────────────────────────────────
  koeln_hbf: { bg: NRW, fg: W, label: 'CGN' },
  koeln_messe: { bg: NRW, fg: W, label: 'KMD' },
  duesseldorf_hbf: { bg: NRW, fg: W, label: 'DUS' },
  essen_hbf: { bg: NRW, fg: W, label: 'ESS' },
  dortmund_hbf: { bg: NRW, fg: W, label: 'DTM' },
  duisburg_hbf: { bg: NRW, fg: W, label: 'DUI' },
  bielefeld_hbf: { bg: NRW, fg: W, label: 'BIE' },
  muenster_hbf: { bg: NRW, fg: W, label: 'MSR' },
  wuppertal_hbf: { bg: NRW, fg: W, label: 'WUP' },
  bochum_hbf: { bg: NRW, fg: W, label: 'BOC' },
  bonn_hbf: { bg: NRW, fg: W, label: 'BNJ' },
  aachen_hbf: { bg: NRW, fg: W, label: 'AAC' },
  hamm_hbf: { bg: NRW, fg: W, label: 'HMM' },
  hagen_hbf: { bg: NRW, fg: W, label: 'HAG' },

  // ── Hessen ─────────────────────────────────────────────────────────
  frankfurt_hbf: { bg: HESSEN, fg: W, label: 'FRA' },
  frankfurt_sued: { bg: HESSEN, fg: W, label: 'FRS' },
  darmstadt_hbf: { bg: HESSEN, fg: W, label: 'DAR' },
  hanau_hbf: { bg: HESSEN, fg: W, label: 'HAN' },
  kassel_wilhelmshoehe: { bg: HESSEN, fg: W, label: 'KSW' },

  // ── Bavaria ────────────────────────────────────────────────────────
  muenchen_hbf: { bg: BAVARIA, fg: W, label: 'MUC' },
  muenchen_ost: { bg: BAVARIA, fg: W, label: 'MUO' },
  nuernberg_hbf: { bg: BAVARIA, fg: W, label: 'NUE' },
  augsburg_hbf: { bg: BAVARIA, fg: W, label: 'AGB' },
  wuerzburg_hbf: { bg: BAVARIA, fg: W, label: 'WUE' },
  ingolstadt_hbf: { bg: BAVARIA, fg: W, label: 'ING' },
  regensburg_hbf: { bg: BAVARIA, fg: W, label: 'REG' },
  aschaffenburg_hbf: { bg: BAVARIA, fg: W, label: 'ASC' },

  // ── Baden-Württemberg ──────────────────────────────────────────────
  stuttgart_hbf: { bg: BADWUE, fg: W, label: 'STR' },
  mannheim_hbf: { bg: BADWUE, fg: W, label: 'MHG' },
  karlsruhe_hbf: { bg: BADWUE, fg: W, label: 'KAR' },
  freiburg_hbf: { bg: BADWUE, fg: W, label: 'FBG' },
  ulm_hbf: { bg: BADWUE, fg: W, label: 'ULM' },
  heidelberg_hbf: { bg: BADWUE, fg: W, label: 'HDB' },

  // ── Saxony / East ──────────────────────────────────────────────────
  leipzig_hbf: { bg: EAST, fg: W, label: 'LEJ' },
  dresden_hbf: { bg: EAST, fg: W, label: 'DRS' },
  erfurt_hbf: { bg: EAST, fg: W, label: 'ERF' },
  halle_hbf: { bg: EAST, fg: W, label: 'HAL' },
  magdeburg_hbf: { bg: EAST, fg: W, label: 'MAG' },

  // ── Other (Rhineland-Palatinate, Saarland) ─────────────────────────
  mainz_hbf: { bg: OTHER, fg: W, label: 'MNZ' },
  koblenz_hbf: { bg: OTHER, fg: W, label: 'KOB' },
  saarbruecken_hbf: { bg: OTHER, fg: W, label: 'SAR' },
}

registerLineMap('db_trains', { prefix: 'db_trains_', lines: DB_TRAINS_LINES })
