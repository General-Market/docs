import type { LineStyle } from '../transport-colors'
import { registerLineMap } from '../transport-colors'

// ── FAA Delays — 30 US Airports ─────────────────────────────────────
// Colors by hub classification:
//   Major hubs   (ATL, ORD, DFW, DEN, LAX)       → red   #D32F2F
//   Large hubs   (JFK, SFO, SEA, MIA, etc.)       → blue  #1565C0
//   Medium hubs  (everything else)                 → gray  #546E7A

const MAJOR = { bg: '#D32F2F', fg: '#fff' } as const
const LARGE = { bg: '#1565C0', fg: '#fff' } as const
const MEDIUM = { bg: '#546E7A', fg: '#fff' } as const

const FAA_DELAYS_LINES: Record<string, LineStyle> = {
  // Major hubs
  atl: { ...MAJOR, label: 'ATL' },
  ord: { ...MAJOR, label: 'ORD' },
  dfw: { ...MAJOR, label: 'DFW' },
  den: { ...MAJOR, label: 'DEN' },
  lax: { ...MAJOR, label: 'LAX' },
  // Large hubs
  jfk: { ...LARGE, label: 'JFK' },
  sfo: { ...LARGE, label: 'SFO' },
  sea: { ...LARGE, label: 'SEA' },
  las: { ...LARGE, label: 'LAS' },
  mco: { ...LARGE, label: 'MCO' },
  ewr: { ...LARGE, label: 'EWR' },
  mia: { ...LARGE, label: 'MIA' },
  clt: { ...LARGE, label: 'CLT' },
  phx: { ...LARGE, label: 'PHX' },
  iah: { ...LARGE, label: 'IAH' },
  bos: { ...LARGE, label: 'BOS' },
  msp: { ...LARGE, label: 'MSP' },
  dtw: { ...LARGE, label: 'DTW' },
  fll: { ...LARGE, label: 'FLL' },
  phl: { ...LARGE, label: 'PHL' },
  // Medium hubs
  lga: { ...MEDIUM, label: 'LGA' },
  bwi: { ...MEDIUM, label: 'BWI' },
  slc: { ...MEDIUM, label: 'SLC' },
  dca: { ...MEDIUM, label: 'DCA' },
  iad: { ...MEDIUM, label: 'IAD' },
  san: { ...MEDIUM, label: 'SAN' },
  tpa: { ...MEDIUM, label: 'TPA' },
  pdx: { ...MEDIUM, label: 'PDX' },
  hnl: { ...MEDIUM, label: 'HNL' },
  stl: { ...MEDIUM, label: 'STL' },
}

// ── Ryanair — 40 European Airports ──────────────────────────────────
// Colors by country/region:
//   UK / Ireland          → blue   #003399
//   Spain / Portugal      → red    #C60B1E
//   Italy                 → green  #009246
//   Germany / Central EU  → amber  #FFCC00 (dark text)
//   Eastern EU            → teal   #00897B
//   Other                 → gray   #546E7A

const UK  = { bg: '#003399', fg: '#fff' } as const
const IBR = { bg: '#C60B1E', fg: '#fff' } as const
const ITA = { bg: '#009246', fg: '#fff' } as const
const CEU = { bg: '#FFCC00', fg: '#000' } as const
const EEU = { bg: '#00897B', fg: '#fff' } as const
const OTH = { bg: '#546E7A', fg: '#fff' } as const

const RYANAIR_LINES: Record<string, LineStyle> = {
  // Spain
  agp: { ...IBR, label: 'AGP' },   // Malaga
  alc: { ...IBR, label: 'ALC' },   // Alicante
  bcn: { ...IBR, label: 'BCN' },   // Barcelona
  mad: { ...IBR, label: 'MAD' },   // Madrid
  svq: { ...IBR, label: 'SVQ' },   // Seville
  vlc: { ...IBR, label: 'VLC' },   // Valencia
  // Portugal
  fao: { ...IBR, label: 'FAO' },   // Faro
  lis: { ...IBR, label: 'LIS' },   // Lisbon
  opo: { ...IBR, label: 'OPO' },   // Porto
  // UK
  bhx: { ...UK, label: 'BHX' },    // Birmingham
  brs: { ...UK, label: 'BRS' },    // Bristol
  edi: { ...UK, label: 'EDI' },    // Edinburgh
  ema: { ...UK, label: 'EMA' },    // East Midlands
  gla: { ...UK, label: 'GLA' },    // Glasgow
  lpl: { ...UK, label: 'LPL' },    // Liverpool
  ltn: { ...UK, label: 'LTN' },    // London Luton
  man: { ...UK, label: 'MAN' },    // Manchester
  ncl: { ...UK, label: 'NCL' },    // Newcastle
  stn: { ...UK, label: 'STN' },    // London Stansted
  // Ireland
  bfs: { ...UK, label: 'BFS' },    // Belfast
  dub: { ...UK, label: 'DUB' },    // Dublin
  snn: { ...UK, label: 'SNN' },    // Shannon
  // Italy
  bgy: { ...ITA, label: 'BGY' },   // Milan Bergamo
  blq: { ...ITA, label: 'BLQ' },   // Bologna
  bri: { ...ITA, label: 'BRI' },   // Bari
  cia: { ...ITA, label: 'CIA' },   // Rome Ciampino
  cta: { ...ITA, label: 'CTA' },   // Catania
  nap: { ...ITA, label: 'NAP' },   // Naples
  pmo: { ...ITA, label: 'PMO' },   // Palermo
  psa: { ...ITA, label: 'PSA' },   // Pisa
  tsf: { ...ITA, label: 'TSF' },   // Venice Treviso
  // Germany / Central EU
  ein: { ...CEU, label: 'EIN' },   // Eindhoven
  // Belgium
  bru: { ...CEU, label: 'BRU' },   // Brussels
  crl: { ...CEU, label: 'CRL' },   // Brussels Charleroi
  // Eastern EU
  bud: { ...EEU, label: 'BUD' },   // Budapest
  gdn: { ...EEU, label: 'GDN' },   // Gdansk
  krk: { ...EEU, label: 'KRK' },   // Krakow
  otp: { ...EEU, label: 'OTP' },   // Bucharest
  sof: { ...EEU, label: 'SOF' },   // Sofia
  wro: { ...EEU, label: 'WRO' },   // Wroclaw
}

// ── Registration ────────────────────────────────────────────────────

registerLineMap('faa_delays', { prefix: 'faa_delays_', lines: FAA_DELAYS_LINES })
registerLineMap('ryanair', { prefix: 'ryanair_', lines: RYANAIR_LINES })
