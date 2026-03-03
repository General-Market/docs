'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { DATA_NODE_URL } from '@/lib/config'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/Table'
import { SourceHistoryChart, type HistoryBucket } from '@/components/domain/SourceHistoryChart'
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

// ── Types ──

interface SourceAsset {
  assetId: string
  symbol: string
  name: string
  isActive: boolean
  latestValue: number | null
  latestFetchedAt: string | null
  ageSecs: number
  totalRecords: number
  oldestRecord: string | null
  valueChangedIn24h: boolean
  changePct: number
  isZero: boolean
  isStale: boolean
}

interface SourceAssetsResponse {
  sourceId: string
  assets: Array<{
    assetId: string
    symbol: string
    name: string
    isActive: boolean
    latestValue: number | null
    latestFetchedAt: string | null
    ageSecs: number
    totalRecords: number
    oldestRecord: string | null
    valueChangedIn24h: boolean
    changePct: number
    isZero: boolean
    isStale: boolean
  }>
}

interface SourceHistoryResponse {
  sourceId: string
  hours: number
  buckets: Array<{
    hour: string
    recordCount: number
    uniqueAssets: number
    avgValue: number
    zeroCount: number
  }>
}

interface PriceHistoryPoint {
  fetchedAt: string
  value: number
}

interface SourceDetailModalProps {
  sourceId: string | null
  onClose: () => void
}

// ── Source metadata: value labels and units per source ──

interface SourceMeta {
  valueLabel: string
  unit: string
  /** Per-asset unit override based on name/symbol keywords */
  assetUnit?: (name: string, symbol: string) => string
}

const SOURCE_META: Record<string, SourceMeta> = {
  // ── Financial ──
  crypto: { valueLabel: 'Price', unit: 'USD' },
  pumpfun: { valueLabel: 'Price', unit: 'USD' },
  stocks: { valueLabel: 'Price', unit: 'USD' },
  defi: { valueLabel: 'TVL', unit: 'USD' },
  polymarket: { valueLabel: 'Probability', unit: '', assetUnit: () => '%' },
  backpacktf: { valueLabel: 'Price', unit: 'USD' },
  twse: { valueLabel: 'Price', unit: 'TWD' },

  // ── Rates & Bonds ──
  rates: { valueLabel: 'Rate', unit: '%' },
  bonds: { valueLabel: 'Yield', unit: '%' },
  ecb: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/rate|yield|growth|inflation|unemployment/i.test(name)) return '%'
      if (/supply|m[123]/i.test(name)) return 'EUR M'
      return ''
    },
  },

  // ── Economic indicators ──
  bls: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/unemployment|rate/i.test(name)) return '%'
      if (/cpi|ppi|index/i.test(name)) return 'index'
      if (/payroll/i.test(name)) return 'K jobs'
      if (/earnings|wage/i.test(name)) return '$/hr'
      if (/productivity/i.test(name)) return '%'
      return ''
    },
  },
  eia: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/inventor|storage|reserve|stock/i.test(name)) return 'K bbl'
      if (/production/i.test(name)) return 'K bbl/d'
      if (/utilization|rate/i.test(name)) return '%'
      if (/price/i.test(name)) return '$/gal'
      if (/natgas|natural gas/i.test(name)) return 'Bcf'
      return ''
    },
  },
  worldbank: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/gdp.*current/i.test(name)) return 'USD'
      if (/growth|inflation|unemploy/i.test(name)) return '% ann.'
      return ''
    },
  },
  usa_spending: {
    valueLabel: 'Amount', unit: '',
    assetUnit: (name) => {
      if (/contract.*award|count/i.test(name)) return 'count'
      if (/\$/i.test(name)) return 'USD'
      return 'USD'
    },
  },
  congress: { valueLabel: 'Count', unit: '' },

  // ── Nasdaq / Commodities ──
  cftc: { valueLabel: 'Contracts', unit: 'lots' },
  futures: { valueLabel: 'Price', unit: 'USD' },
  bchain: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/hash.rate/i.test(name)) return 'TH/s'
      if (/price|market.cap|revenue/i.test(name)) return 'USD'
      if (/transaction|block|output/i.test(name)) return 'count'
      if (/size/i.test(name)) return 'bytes'
      if (/difficulty/i.test(name)) return ''
      return ''
    },
  },
  opec: { valueLabel: 'Basket Price', unit: 'USD/bbl' },
  imf: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/gdp/i.test(name)) return 'USD B'
      if (/inflation|rate|growth|unemploy/i.test(name)) return '%'
      if (/trade|import|export/i.test(name)) return 'USD M'
      return ''
    },
  },

  // ── FINRA ──
  finra_short_vol: {
    valueLabel: 'Volume', unit: 'shares',
    assetUnit: (name) => {
      if (/ratio|%/i.test(name)) return '%'
      return 'shares'
    },
  },

  // ── Weather ──
  weather: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/temperature|temp/i.test(name)) return '°C'
      if (/rain|precip/i.test(name)) return 'mm'
      if (/humidity/i.test(name)) return '%'
      if (/wind/i.test(name)) return 'km/h'
      if (/pm2\.?5|pm10/i.test(name)) return 'µg/m³'
      if (/ozone|no2|so2|co\b/i.test(name)) return 'µg/m³'
      if (/uv/i.test(name)) return 'index'
      if (/pressure/i.test(name)) return 'hPa'
      if (/visibility/i.test(name)) return 'km'
      return ''
    },
  },
  weather_stations: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/temp/i.test(name)) return '°C'
      if (/humid/i.test(name)) return '%'
      if (/wind/i.test(name)) return 'km/h'
      return ''
    },
  },
  weather_alerts: { valueLabel: 'Count', unit: 'alerts' },

  // ── Geophysical ──
  earthquake: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/magnitude|max mag/i.test(name)) return 'M'
      if (/energy/i.test(name)) return 'J'
      if (/depth/i.test(name)) return 'km'
      return 'count'
    },
  },
  volcano: { valueLabel: 'Alert Level', unit: '0-3' },
  wildfire: { valueLabel: 'Hotspots', unit: 'fires' },
  spaceweather: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/kp/i.test(name)) return '0-9'
      if (/solar wind.*speed/i.test(name)) return 'km/s'
      if (/density/i.test(name)) return 'p/cm³'
      if (/sunspot/i.test(name)) return 'count'
      if (/flux/i.test(name)) return 'SFU'
      if (/storm|scale/i.test(name)) return '0-5'
      return ''
    },
  },

  // ── Transport ──
  flights: { valueLabel: 'Aircraft', unit: 'in airspace' },
  maritime: { valueLabel: 'Vessels', unit: 'in area' },
  mil_aircraft: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/altitude/i.test(name)) return 'm'
      if (/speed|velocity/i.test(name)) return 'm/s'
      return 'aircraft'
    },
  },
  gtfs_transit: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/speed/i.test(name)) return 'km/h'
      if (/delay/i.test(name)) return 'min'
      return 'trips'
    },
  },

  // ── Biology / Ecology ──
  epidemic: {
    valueLabel: 'Cases', unit: '',
    assetUnit: (name) => {
      if (/per.*million|\/m/i.test(name)) return '/1M pop'
      if (/rate|%/i.test(name)) return '%'
      return 'people'
    },
  },
  animals: { valueLabel: 'Observations', unit: '/24h' },
  shelter: { valueLabel: 'Count', unit: 'animals' },
  ebird: {
    valueLabel: 'Count', unit: '',
    assetUnit: (name) => {
      if (/species/i.test(name)) return 'species'
      if (/checklist/i.test(name)) return 'checklists'
      if (/rare/i.test(name)) return 'sightings'
      return 'obs'
    },
  },
  movebank: {
    valueLabel: 'Position', unit: '',
    assetUnit: (name) => {
      if (/lat/i.test(name)) return '°N'
      if (/lon/i.test(name)) return '°E'
      if (/speed/i.test(name)) return 'm/s'
      if (/altitude|height/i.test(name)) return 'm'
      return ''
    },
  },

  // ── Space ──
  iss: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/latitude/i.test(name)) return '°N'
      if (/longitude/i.test(name)) return '°E'
      if (/speed/i.test(name)) return 'km/h'
      if (/altitude/i.test(name)) return 'km'
      if (/people|crew/i.test(name)) return 'people'
      return ''
    },
  },

  // ── Entertainment ──
  steam: { valueLabel: 'Players', unit: 'online' },
  twitch: { valueLabel: 'Viewers', unit: 'live' },
  chaturbate: { valueLabel: 'Viewers', unit: 'live' },
  tmdb: { valueLabel: 'Popularity', unit: 'score' },
  lastfm: {
    valueLabel: 'Count', unit: '',
    assetUnit: (name) => {
      if (/listener/i.test(name)) return 'listeners'
      if (/scrobble|playcount/i.test(name)) return 'plays'
      return 'count'
    },
  },
  anilist: { valueLabel: 'Popularity', unit: 'score' },
  sports: { valueLabel: 'Score', unit: 'pts' },
  esports: { valueLabel: 'Score', unit: 'maps' },

  // ── Internet / Tech ──
  hackernews: {
    valueLabel: 'Activity', unit: '',
    assetUnit: (name) => {
      if (/score/i.test(name)) return 'pts'
      if (/comment/i.test(name)) return 'comments'
      return ''
    },
  },
  fourchan: {
    valueLabel: 'Activity', unit: '',
    assetUnit: (name) => {
      if (/greentext|%/i.test(name)) return '%'
      return 'count'
    },
  },
  npm: { valueLabel: 'Downloads', unit: '/day' },
  crates_io: { valueLabel: 'Downloads', unit: 'recent' },
  pypi: { valueLabel: 'Downloads', unit: '/day' },
  github: { valueLabel: 'Stars', unit: '' },
  reddit: {
    valueLabel: 'Count', unit: '',
    assetUnit: (name) => {
      if (/subscriber/i.test(name)) return 'subs'
      if (/active/i.test(name)) return 'online'
      return ''
    },
  },
  cloudflare: {
    valueLabel: 'Rank', unit: '',
    assetUnit: (name) => {
      if (/speed|latency/i.test(name)) return 'ms'
      if (/rank/i.test(name)) return '#'
      if (/score|quality/i.test(name)) return 'score'
      return ''
    },
  },

  // ── Environment & Transport ──
  usgs_water: { valueLabel: 'Discharge', unit: 'ft³/s' },
  noaa_tides: { valueLabel: 'Water Level', unit: 'ft' },
  nrc_nuclear: { valueLabel: 'Power Output', unit: '%' },
  citybikes: { valueLabel: 'Available Bikes', unit: 'bikes' },
  courtlistener: { valueLabel: 'Filings', unit: 'filings' },
  ndbc: { valueLabel: 'Wave Height', unit: 'm' },
  noaa_met: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/water.*temp/i.test(name)) return '°F'
      if (/wind/i.test(name)) return 'kn'
      return ''
    },
  },
  nwps: { valueLabel: 'Stage Height', unit: 'ft' },
  airnow: { valueLabel: 'AQI', unit: '0-500' },
  openalex: { valueLabel: 'Works', unit: 'papers' },
  crossref: { valueLabel: 'DOIs', unit: 'registrations' },
  pubmed: { valueLabel: 'Articles', unit: 'papers' },
  stackexchange: { valueLabel: 'Questions', unit: '/day' },

  // ── Autos & Vehicles ──
  parking: { valueLabel: 'Free Spaces', unit: 'spaces' },
  tomtom_traffic: { valueLabel: 'Congestion', unit: '0-1' },
  tomtom_evcharge: { valueLabel: 'Available', unit: 'connectors' },

  // ── Board Games & Shopping ──
  bgg: { valueLabel: 'Hotness Rank', unit: '#' },
  bestbuy: { valueLabel: 'Sale Price', unit: 'USD' },

  // ── Jobs / Labor ──
  adzuna: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/salary/i.test(name)) return 'local ccy'
      if (/vacanc/i.test(name)) return 'jobs'
      return ''
    },
  },

  // ── Tourism ──
  queue_times: { valueLabel: 'Avg Wait', unit: 'min' },
  cbp_border: { valueLabel: 'Wait Time', unit: 'min' },
  faa_delays: { valueLabel: 'Delay', unit: '0/1' },
  db_trains: { valueLabel: 'Avg Delay', unit: 'min' },

  // ── Drink Sources ──
  yahoo_drinks: {
    valueLabel: 'Price', unit: '',
    assetUnit: (name) => {
      if (/futures|=F/i.test(name)) return 'USD/lb'
      return 'USD'
    },
  },

  // ── SEC ──
  sec_efts: { valueLabel: 'Filings', unit: 'count' },
  sec_insider: {
    valueLabel: 'Value', unit: '',
    assetUnit: (name) => {
      if (/volume|value|\$/i.test(name)) return 'USD'
      if (/transaction|filing|trade/i.test(name)) return 'count'
      return ''
    },
  },
}

// ── Helpers ──

function formatAge(secs: number): string {
  if (secs < 60) return `${Math.round(secs)}s`
  if (secs < 3600) return `${Math.round(secs / 60)}m`
  if (secs < 86400) return `${(secs / 3600).toFixed(1)}h`
  return `${(secs / 86400).toFixed(1)}d`
}

function formatValue(v: number | null): string {
  if (v === null || v === undefined) return '--'
  if (v === 0) return '0'
  if (Math.abs(v) < 0.0001) return v.toExponential(2)
  if (Math.abs(v) < 1) return v.toFixed(6)
  if (Math.abs(v) < 1000) return v.toFixed(2)
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}K`
  return v.toFixed(2)
}

function getUnit(sourceId: string, name: string, symbol: string): string {
  const meta = SOURCE_META[sourceId]
  if (!meta) return ''
  if (meta.assetUnit) return meta.assetUnit(name, symbol)
  return meta.unit
}

function getValueLabel(sourceId: string): string {
  return SOURCE_META[sourceId]?.valueLabel || 'Value'
}

function getRowBg(asset: SourceAsset): string {
  if (asset.isZero) return 'bg-color-down/10'
  if (asset.isStale) return 'bg-color-warning/10'
  return ''
}

// ── Asset Sparkline ──

function AssetSparkline({ sourceId, assetId }: { sourceId: string; assetId: string }) {
  const [points, setPoints] = useState<PriceHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const now = new Date()
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    const url = `${DATA_NODE_URL}/market/prices/${sourceId}/${encodeURIComponent(assetId)}/history?from=${from.toISOString()}&to=${now.toISOString()}`

    fetch(url, { signal: AbortSignal.timeout(10_000) })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        const prices: PriceHistoryPoint[] = (data.prices || []).map((p: any) => ({
          fetchedAt: p.fetchedAt,
          value: typeof p.value === 'string' ? parseFloat(p.value) : p.value,
        }))
        setPoints(prices)
      })
      .catch(e => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [sourceId, assetId])

  const lineColor = useMemo(() => {
    if (points.length < 2) return '#94a3b8'
    return points[points.length - 1].value >= points[0].value ? '#4ade80' : '#C40000'
  }, [points])

  if (loading) {
    return (
      <div className="h-[80px] flex items-center justify-center">
        <div className="text-[11px] text-text-muted">Loading history...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[80px] flex items-center justify-center">
        <div className="text-[11px] text-color-down">Failed to load: {error}</div>
      </div>
    )
  }

  if (points.length < 2) {
    return (
      <div className="h-[80px] flex items-center justify-center">
        <div className="text-[11px] text-text-muted">Not enough data points ({points.length})</div>
      </div>
    )
  }

  // Downsample if too many points (keep max ~200 for performance)
  const displayPoints = points.length > 200
    ? points.filter((_, i) => i % Math.ceil(points.length / 200) === 0 || i === points.length - 1)
    : points

  return (
    <div className="px-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-text-muted">7-day history ({points.length} points)</span>
        <span className="text-[10px] font-mono text-text-muted">
          {formatValue(points[0].value)} &rarr; {formatValue(points[points.length - 1].value)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={displayPoints} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <XAxis
            dataKey="fetchedAt"
            tick={false}
            axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
            tickLine={false}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={false}
            axisLine={false}
            tickLine={false}
            width={0}
          />
          <Tooltip
            contentStyle={{
              background: '#1a1a2e',
              border: 'none',
              borderRadius: '6px',
              fontSize: '10px',
              fontFamily: 'monospace',
              color: '#fff',
              padding: '4px 8px',
            }}
            labelFormatter={(label: string) => {
              const d = new Date(label)
              return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
            }}
            formatter={(val: number) => [formatValue(val), 'Value']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Component ──

export function SourceDetailModal({ sourceId, onClose }: SourceDetailModalProps) {
  const [assets, setAssets] = useState<SourceAsset[]>([])
  const [buckets, setBuckets] = useState<HistoryBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null)

  const fetchData = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    setExpandedAssetId(null)

    try {
      const [assetsRes, historyRes] = await Promise.all([
        fetch(`${DATA_NODE_URL}/admin/sources/${id}/assets`, {
          signal: AbortSignal.timeout(15_000),
        }),
        fetch(`${DATA_NODE_URL}/admin/sources/${id}/history?hours=24`, {
          signal: AbortSignal.timeout(15_000),
        }),
      ])

      if (!assetsRes.ok) {
        throw new Error(`Assets: HTTP ${assetsRes.status}`)
      }
      if (!historyRes.ok) {
        throw new Error(`History: HTTP ${historyRes.status}`)
      }

      const assetsData: SourceAssetsResponse = await assetsRes.json()
      const historyData: SourceHistoryResponse = await historyRes.json()

      setAssets(
        assetsData.assets.map(a => ({
          assetId: a.assetId,
          symbol: a.symbol,
          name: a.name,
          isActive: a.isActive,
          latestValue: a.latestValue,
          latestFetchedAt: a.latestFetchedAt,
          ageSecs: a.ageSecs,
          totalRecords: a.totalRecords,
          oldestRecord: a.oldestRecord,
          valueChangedIn24h: a.valueChangedIn24h,
          changePct: a.changePct,
          isZero: a.isZero,
          isStale: a.isStale,
        }))
      )

      setBuckets(
        historyData.buckets.map(b => ({
          hour: b.hour,
          recordCount: b.recordCount,
          uniqueAssets: b.uniqueAssets,
          zeroCount: b.zeroCount,
        }))
      )
    } catch (e: any) {
      setError(e.message || 'Failed to fetch source details')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sourceId) {
      fetchData(sourceId)
    }
  }, [sourceId, fetchData])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!sourceId) return null

  // ── Summary stats ──
  const totalAssets = assets.length
  const activeAssets = assets.filter(a => a.isActive).length
  const zeroCount = assets.filter(a => a.isZero).length
  const staleCount = assets.filter(a => a.isStale).length
  const valueLabel = getValueLabel(sourceId)

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-[5vh] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border-light rounded-xl shadow-modal max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="text-lg font-bold text-black">Source Detail</h2>
              <p className="text-[13px] font-mono text-text-muted mt-0.5">{sourceId}</p>
            </div>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-black text-2xl leading-none transition-colors"
            >
              &times;
            </button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-text-muted text-sm">Loading source data...</div>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="border border-color-down/50 bg-surface-down rounded-lg px-4 py-3 mb-4">
              <p className="text-color-down text-[13px] font-semibold">Failed to load</p>
              <p className="text-text-secondary text-[12px] mt-0.5">{error}</p>
              <button
                onClick={() => fetchData(sourceId)}
                className="mt-2 text-[12px] font-bold text-color-info underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted border border-border-light rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-0.5">
                    Total Assets
                  </p>
                  <p className="text-[20px] font-extrabold font-mono tabular-nums text-black">
                    {totalAssets}
                  </p>
                </div>
                <div className="bg-muted border border-border-light rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-0.5">
                    Active
                  </p>
                  <p className="text-[20px] font-extrabold font-mono tabular-nums text-color-up">
                    {activeAssets}
                  </p>
                </div>
                <div className="bg-muted border border-border-light rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-0.5">
                    Zero Values
                  </p>
                  <p className={`text-[20px] font-extrabold font-mono tabular-nums ${zeroCount > 0 ? 'text-color-down' : 'text-black'}`}>
                    {zeroCount}
                  </p>
                </div>
                <div className="bg-muted border border-border-light rounded-lg p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-0.5">
                    Stale
                  </p>
                  <p className={`text-[20px] font-extrabold font-mono tabular-nums ${staleCount > 0 ? 'text-color-warning' : 'text-black'}`}>
                    {staleCount}
                  </p>
                </div>
              </div>

              {/* Regularity chart */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-3">
                  Data Regularity (Last 24h)
                </h3>
                <div className="bg-muted border border-border-light rounded-lg p-4">
                  <SourceHistoryChart buckets={buckets} />
                </div>
              </div>

              {/* Asset table */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-3">
                  Markets ({totalAssets}) <span className="font-normal text-text-muted">— click a row to see history</span>
                </h3>
                <div className="border border-border-light overflow-hidden rounded-lg">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table aria-label="Source Assets">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Market</TableHead>
                          <TableHead className="text-right">{valueLabel}</TableHead>
                          <TableHead className="text-right">Unit</TableHead>
                          <TableHead className="text-right">Age</TableHead>
                          <TableHead className="text-right">Change</TableHead>
                          <TableHead className="text-right">Records</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assets.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-8 text-center">
                              <p className="text-text-muted">No assets found for this source</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          assets.map(asset => {
                            const unit = getUnit(sourceId, asset.name, asset.symbol)
                            const isExpanded = expandedAssetId === asset.assetId
                            return (
                              <React.Fragment key={asset.assetId}>
                                <TableRow
                                  className={`cursor-pointer transition-colors ${isExpanded ? 'bg-surface-info' : getRowBg(asset)} hover:bg-surface`}
                                  onClick={() => setExpandedAssetId(isExpanded ? null : asset.assetId)}
                                >
                                  {/* Market name */}
                                  <TableCell className="max-w-[280px]">
                                    <div
                                      title={`${asset.symbol} — ${asset.name}\nClick to ${isExpanded ? 'hide' : 'show'} chart`}
                                    >
                                      <span className="font-semibold text-[12px] text-black">
                                        {asset.name || asset.symbol}
                                      </span>
                                      <span className="block font-mono text-[10px] text-text-muted truncate">
                                        {asset.symbol}
                                      </span>
                                    </div>
                                  </TableCell>

                                  {/* Value */}
                                  <TableCell className={`text-right font-mono tabular-nums text-[12px] ${asset.isZero ? 'text-color-down font-bold' : ''}`}>
                                    {formatValue(asset.latestValue)}
                                  </TableCell>

                                  {/* Unit */}
                                  <TableCell className="text-right text-[10px] text-text-muted whitespace-nowrap">
                                    {unit}
                                  </TableCell>

                                  {/* Age */}
                                  <TableCell className={`text-right font-mono tabular-nums text-[12px] ${asset.isStale ? 'text-color-warning font-semibold' : ''}`}>
                                    {formatAge(asset.ageSecs)}
                                  </TableCell>

                                  {/* Change% */}
                                  <TableCell className="text-right font-mono tabular-nums text-[12px]">
                                    {asset.changePct !== null && asset.changePct !== undefined
                                      ? <span className={asset.changePct > 0 ? 'text-color-up' : asset.changePct < 0 ? 'text-color-down' : ''}>
                                          {asset.changePct >= 0 ? '+' : ''}{asset.changePct.toFixed(2)}%
                                        </span>
                                      : <span className="text-text-muted">--</span>}
                                  </TableCell>

                                  {/* Records */}
                                  <TableCell className="text-right font-mono tabular-nums text-[12px]">
                                    {asset.totalRecords.toLocaleString()}
                                  </TableCell>

                                  {/* Status indicators */}
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      {asset.isZero && (
                                        <span
                                          className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-color-down/20 text-color-down"
                                          title="Zero value"
                                        >
                                          Zero
                                        </span>
                                      )}
                                      {asset.isStale && (
                                        <span
                                          className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-color-warning/20 text-color-warning"
                                          title="Stale data"
                                        >
                                          Stale
                                        </span>
                                      )}
                                      {!asset.isZero && !asset.isStale && asset.isActive && (
                                        <span
                                          className="w-2 h-2 rounded-full bg-color-up inline-block"
                                          title="Active with recent data"
                                        />
                                      )}
                                      {!asset.isActive && (
                                        <span
                                          className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-border-light text-text-muted"
                                          title="Inactive"
                                        >
                                          Off
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>

                                {/* Expanded sparkline row */}
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={7} className="bg-muted border-t border-border-light p-3">
                                      <AssetSparkline sourceId={sourceId} assetId={asset.assetId} />
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
