import type { LineStyle } from '../transport-colors'
import { registerLineMap } from '../transport-colors'

// ── NYC MTA Subway (GTFS-RT line groups) ────────────────────────────
// Colors from the official MTA map: https://new.mta.info/map
// Keys match asset_id suffixes after stripping "transit_" prefix,
// e.g. transit_mta_line_123_trips → mta_line_123_trips → key "mta_line_123".

const GTFS_RT_LINES: Record<string, LineStyle> = {
  // MTA line groups
  mta_line_123:  { bg: '#EE352E', fg: '#fff', label: '123' },
  mta_line_4567: { bg: '#00933C', fg: '#fff', label: '456' },
  mta_line_ace:  { bg: '#0039A6', fg: '#fff', label: 'ACE' },
  mta_line_bdfm: { bg: '#FF6319', fg: '#fff', label: 'BDF' },
  mta_line_g:    { bg: '#6CBE45', fg: '#fff', label: 'G' },
  mta_line_jz:   { bg: '#996633', fg: '#fff', label: 'JZ' },
  mta_line_nqrw: { bg: '#FCCC0A', fg: '#000', label: 'NQR' },
  mta_line_l:    { bg: '#A7A9AC', fg: '#000', label: 'L' },
  mta_line_si:   { bg: '#1D2C6B', fg: '#fff', label: 'SI' },

  // MTA aggregate metrics (prefix-matched: mta_active_trips, mta_total_vehicles, mta_avg_speed)
  mta: { bg: '#0039A6', fg: '#fff', label: 'MTA' },

  // BART (San Francisco)
  bart: { bg: '#009BDA', fg: '#fff', label: 'BRT' },
}

// ── Flights (OpenSky regions + airports) ────────────────────────────
// Geographic palette: Americas → blue, Europe → navy/purple,
// Asia-Pacific → red/orange, Middle East → gold, Africa → green.

const FLIGHTS_LINES: Record<string, LineStyle> = {
  // ── Regions ───────────────────────────────────────────────────────
  us:              { bg: '#1565C0', fg: '#fff', label: 'US' },
  europe:          { bg: '#4A148C', fg: '#fff', label: 'EUR' },
  asia_pacific:    { bg: '#D84315', fg: '#fff', label: 'APJ' },
  middle_east:     { bg: '#F9A825', fg: '#000', label: 'MEA' },
  south_america:   { bg: '#0D47A1', fg: '#fff', label: 'SAM' },
  africa:          { bg: '#2E7D32', fg: '#fff', label: 'AFR' },
  north_atlantic:  { bg: '#1A237E', fg: '#fff', label: 'NAT' },
  global:          { bg: '#37474F', fg: '#fff', label: 'GLB' },

  // ── Americas airports ─────────────────────────────────────────────
  jfk: { bg: '#1976D2', fg: '#fff', label: 'JFK' },
  lax: { bg: '#1E88E5', fg: '#fff', label: 'LAX' },
  ord: { bg: '#2196F3', fg: '#fff', label: 'ORD' },
  atl: { bg: '#42A5F5', fg: '#fff', label: 'ATL' },
  gru: { bg: '#0D47A1', fg: '#fff', label: 'GRU' },

  // ── Europe airports ───────────────────────────────────────────────
  heathrow:  { bg: '#6A1B9A', fg: '#fff', label: 'LHR' },
  cdg:       { bg: '#7B1FA2', fg: '#fff', label: 'CDG' },
  frankfurt: { bg: '#8E24AA', fg: '#fff', label: 'FRA' },
  ams:       { bg: '#9C27B0', fg: '#fff', label: 'AMS' },
  ist:       { bg: '#AB47BC', fg: '#fff', label: 'IST' },

  // ── Asia-Pacific airports ─────────────────────────────────────────
  changi: { bg: '#E64A19', fg: '#fff', label: 'SIN' },
  haneda: { bg: '#F4511E', fg: '#fff', label: 'HND' },
  pek:    { bg: '#FF5722', fg: '#fff', label: 'PEK' },
  hkg:    { bg: '#FF6E40', fg: '#fff', label: 'HKG' },
  icn:    { bg: '#BF360C', fg: '#fff', label: 'ICN' },
  syd:    { bg: '#FF8A65', fg: '#000', label: 'SYD' },

  // ── Middle East airports ──────────────────────────────────────────
  dubai: { bg: '#F57F17', fg: '#000', label: 'DXB' },
}

// ── Self-register ────────────────────────────────────────────────────

registerLineMap('gtfs_rt', { prefix: 'transit_', matchMode: 'prefix', lines: GTFS_RT_LINES })
registerLineMap('flights', { prefix: 'flight_', lines: FLIGHTS_LINES })
