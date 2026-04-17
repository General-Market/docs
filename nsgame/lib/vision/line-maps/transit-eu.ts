import type { LineStyle, SourceLineConfig } from '../transport-colors'
import { registerLineMap } from '../transport-colors'

// ── RATP Paris Métro ─────────────────────────────────────────────────
// Official colors: https://data.ratp.fr/

const PARIS_METRO_LINES: Record<string, LineStyle> = {
  '1':    { bg: '#FFBE00', fg: '#000', label: '1' },
  '2':    { bg: '#0064B0', fg: '#fff', label: '2' },
  '3':    { bg: '#9F971A', fg: '#fff', label: '3' },
  '3bis': { bg: '#89D3DE', fg: '#000', label: '3b' },
  '4':    { bg: '#C04191', fg: '#fff', label: '4' },
  '5':    { bg: '#F28E42', fg: '#000', label: '5' },
  '6':    { bg: '#83C491', fg: '#000', label: '6' },
  '7':    { bg: '#F3A4BA', fg: '#000', label: '7' },
  '7bis': { bg: '#83C491', fg: '#000', label: '7b' },
  '8':    { bg: '#C9A0DC', fg: '#000', label: '8' },
  '9':    { bg: '#D5C900', fg: '#000', label: '9' },
  '10':   { bg: '#E3B32A', fg: '#000', label: '10' },
  '11':   { bg: '#8D5E2A', fg: '#fff', label: '11' },
  '12':   { bg: '#00814F', fg: '#fff', label: '12' },
  '13':   { bg: '#89D3DE', fg: '#000', label: '13' },
  '14':   { bg: '#662483', fg: '#fff', label: '14' },
}

// ── TfL London Underground ───────────────────────────────────────────
// Official colors: https://tfl.gov.uk/info-for/media/press-releases
//
// Keys use underscores to match asset_id suffixes (e.g. tfl_tube_hammersmith_city).
// The config's api_ref uses hyphens, but the prefix-stripping operates on asset_id.

const TFL_TUBE_LINES: Record<string, LineStyle> = {
  'bakerloo':         { bg: '#B36305', fg: '#fff', label: 'Bkl' },
  'central':          { bg: '#E32017', fg: '#fff', label: 'Cen' },
  'circle':           { bg: '#FFD300', fg: '#000', label: 'Cir' },
  'district':         { bg: '#00782A', fg: '#fff', label: 'Dis' },
  'hammersmith_city':  { bg: '#F3A9BB', fg: '#000', label: 'H&C' },
  'jubilee':          { bg: '#A0A5A9', fg: '#000', label: 'Jub' },
  'metropolitan':     { bg: '#9B0056', fg: '#fff', label: 'Met' },
  'northern':         { bg: '#000000', fg: '#fff', label: 'Nth' },
  'piccadilly':       { bg: '#003688', fg: '#fff', label: 'Pic' },
  'victoria':         { bg: '#0098D4', fg: '#fff', label: 'Vic' },
  'waterloo_city':    { bg: '#95CDBA', fg: '#000', label: 'W&C' },
}

// ── Self-register ────────────────────────────────────────────────────

registerLineMap('paris_metro', { prefix: 'paris_metro_', lines: PARIS_METRO_LINES })
registerLineMap('tfl_tube', { prefix: 'tfl_tube_', lines: TFL_TUBE_LINES })
