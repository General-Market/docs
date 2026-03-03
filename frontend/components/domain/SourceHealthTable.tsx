'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/Table'
import type { SourceHealth, SourceStatus } from '@/hooks/useSourceHealth'

// ── Types ──

type SortField =
  | 'displayName'
  | 'status'
  | 'activeAssets'
  | 'syncIntervalSecs'
  | 'totalPriceRecords'
  | 'lastSyncAgeSecs'
  | 'zeroValueAssets'
  | 'staleAssets'
  | 'avgChangePct'
  | 'syncGapMaxSecs'

type SortDirection = 'asc' | 'desc'

interface SourceHealthTableProps {
  sources: SourceHealth[]
  loading: boolean
  selectedSourceId: string | null
  onSelectSource: (sourceId: string) => void
}

// ── Status helpers ──

const STATUS_ORDER: Record<SourceStatus, number> = {
  healthy: 0,
  initializing: 1,
  stale: 2,
  dead: 3,
  not_started: 4,
}

function getStatusColor(status: SourceStatus): string {
  switch (status) {
    case 'healthy':
      return 'text-color-up'
    case 'initializing':
      return 'text-color-info'
    case 'stale':
      return 'text-color-warning'
    case 'dead':
      return 'text-color-down'
    case 'not_started':
      return 'text-text-muted'
    default:
      return 'text-text-muted'
  }
}

function getStatusBg(status: SourceStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-surface-up'
    case 'initializing':
      return 'bg-surface-info'
    case 'stale':
      return 'bg-surface-warning'
    case 'dead':
      return 'bg-surface-down'
    case 'not_started':
      return 'bg-surface'
    default:
      return ''
  }
}

function getStatusDot(status: SourceStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-color-up'
    case 'initializing':
      return 'bg-color-info animate-pulse'
    case 'stale':
      return 'bg-color-warning'
    case 'dead':
      return 'bg-color-down'
    case 'not_started':
      return 'bg-text-muted'
    default:
      return 'bg-text-muted'
  }
}

// ── Formatting helpers ──

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatAge(secs: number): string {
  if (secs < 60) return `${Math.round(secs)}s`
  if (secs < 3600) return `${Math.round(secs / 60)}m`
  if (secs < 86400) return `${(secs / 3600).toFixed(1)}h`
  return `${(secs / 86400).toFixed(1)}d`
}

function hasHighZeroRate(source: SourceHealth): boolean {
  if (source.activeAssets === 0) return false
  return (source.zeroValueAssets / source.activeAssets) > 0.2
}

function getFrequencyLabel(secs: number): { label: string; color: string } {
  if (secs <= 120) return { label: 'RT', color: 'bg-color-up/15 text-color-up' }        // real-time (<=2min)
  if (secs <= 900) return { label: '10m', color: 'bg-color-info/15 text-color-info' }    // <=15min
  if (secs <= 7200) return { label: '1h', color: 'bg-color-warning/15 text-color-warning' }  // <=2h
  if (secs <= 172800) return { label: '1d', color: 'bg-text-muted/15 text-text-muted' }  // <=48h
  return { label: '1w+', color: 'bg-text-muted/10 text-text-muted' }                     // weekly+
}

// ── API key signup links ──

const API_KEY_LINKS: Record<string, { url: string; label: string }> = {
  eia: { url: 'https://www.eia.gov/opendata/register.php', label: 'EIA' },
  ecb: { url: 'https://data.ecb.europa.eu/', label: 'ECB (no key needed, enable flag)' },
  weather: { url: 'https://open-meteo.com/', label: 'Open-Meteo (free, enable flag)' },
  finra: { url: 'https://developer.finra.org/', label: 'FINRA Developer' },
  bonds: { url: 'https://fiscaldata.treasury.gov/api-documentation/', label: 'Treasury' },
  cloudflare: { url: 'https://developers.cloudflare.com/radar/', label: 'Cloudflare Radar' },
  github: { url: 'https://github.com/settings/tokens', label: 'GitHub Token' },
  wildfire: { url: 'https://firms.modaps.eosdis.nasa.gov/api/area/', label: 'NASA FIRMS' },
  maritime: { url: 'https://aisstream.io/', label: 'AISstream' },
  aisstream: { url: 'https://aisstream.io/', label: 'AISstream' },
  crypto: { url: 'https://www.coingecko.com/en/api', label: 'CoinGecko' },
  stocks: { url: 'https://finnhub.io/register', label: 'Finnhub' },
  rates: { url: 'https://fred.stlouisfed.org/docs/api/api_key.html', label: 'FRED' },
  bls: { url: 'https://data.bls.gov/registrationEngine/', label: 'BLS' },
  cftc: { url: 'https://data.nasdaq.com/sign-up', label: 'Nasdaq Data Link' },
  futures: { url: 'https://data.nasdaq.com/sign-up', label: 'Nasdaq Data Link' },
  bchain: { url: 'https://data.nasdaq.com/sign-up', label: 'Nasdaq Data Link' },
  opec: { url: 'https://data.nasdaq.com/sign-up', label: 'Nasdaq Data Link' },
  imf: { url: 'https://data.nasdaq.com/sign-up', label: 'Nasdaq Data Link' },
  twitch: { url: 'https://dev.twitch.tv/console/apps', label: 'Twitch Developer' },
  esports: { url: 'https://www.pandascore.co/pricing', label: 'PandaScore' },
  reddit: { url: 'https://www.reddit.com/prefs/apps', label: 'Reddit Apps' },
  tmdb: { url: 'https://www.themoviedb.org/settings/api', label: 'TMDb' },
  lastfm: { url: 'https://www.last.fm/api', label: 'Last.fm API' },
  backpacktf: { url: 'https://backpack.tf/developer/apikey/view', label: 'backpack.tf' },
  movebank: { url: 'https://www.movebank.org/cms/movebank-main', label: 'Movebank' },
  ebird: { url: 'https://ebird.org/api/keygen', label: 'eBird' },
  ndbc: { url: 'https://www.ndbc.noaa.gov/', label: 'NDBC' },
  noaa_met: { url: 'https://tidesandcurrents.noaa.gov/api/', label: 'CO-OPS API' },
  nwps: { url: 'https://api.water.noaa.gov/nwps/v1/', label: 'NWPS API' },
  airnow: { url: 'https://docs.airnowapi.org/', label: 'AirNow API' },
  shelter: { url: 'https://data.austintexas.gov/Health-and-Community-Services/Austin-Animal-Center-Stray-Map/kz4x-q9k5', label: 'Austin Animal Center (Socrata)' },
  parking: { url: 'https://api.parkendd.de/', label: 'ParkAPI' },
  tomtom_traffic: { url: 'https://developer.tomtom.com/traffic-api/documentation', label: 'TomTom Traffic' },
  tomtom_evcharge: { url: 'https://developer.tomtom.com/ev-charging-stations-availability-api', label: 'TomTom EV' },
  bgg: { url: 'https://boardgamegeek.com/using_the_xml_api', label: 'BGG API (free token)' },
  bestbuy: { url: 'https://developer.bestbuy.com/', label: 'Best Buy Developer' },
  adzuna: { url: 'https://developer.adzuna.com/', label: 'Adzuna API' },
  queue_times: { url: 'https://queue-times.com/en-US/pages/api', label: 'Queue-Times API' },
  cbp_border: { url: 'https://bwt.cbp.gov/', label: 'CBP Border Wait Times' },
  faa_delays: { url: 'https://soa.smext.faa.gov/asws/api/airport/status/', label: 'FAA ASWS' },
  db_trains: { url: 'https://v6.db.transport.rest/', label: 'DB Transport REST' },
  mcbroken: { url: 'https://mcbroken.com/', label: 'McBroken' },
  nyc311: { url: 'https://data.cityofnewyork.us/', label: 'NYC Open Data' },
}

// ── Skeleton ──

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }, (_, r) => (
        <TableRow key={r}>
          {Array.from({ length: 11 }, (_, c) => (
            <TableCell key={c}>
              <div className={`h-4 bg-border-light rounded animate-pulse ${c === 0 ? 'w-28' : 'w-14'}`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ── Sort icon ──

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) {
    return (
      <span className="ml-1 text-text-muted opacity-40 text-[9px]">{'\u2195'}</span>
    )
  }
  return (
    <span className="ml-1 text-black text-[9px]">
      {direction === 'asc' ? '\u2191' : '\u2193'}
    </span>
  )
}

// ── Component ──

export function SourceHealthTable({
  sources,
  loading,
  selectedSourceId,
  onSelectSource,
}: SourceHealthTableProps) {
  const [sortField, setSortField] = useState<SortField>('status')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [search, setSearch] = useState('')

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection(field === 'status' || field === 'displayName' ? 'asc' : 'desc')
    }
  }, [sortField])

  const filteredSources = useMemo(() => {
    if (!search.trim()) return sources
    const q = search.toLowerCase().trim()
    return sources.filter(s =>
      s.displayName.toLowerCase().includes(q) ||
      s.sourceId.toLowerCase().includes(q)
    )
  }, [sources, search])

  const sortedSources = useMemo(() => {
    const sorted = [...filteredSources].sort((a, b) => {
      let cmp = 0

      switch (sortField) {
        case 'displayName':
          cmp = a.displayName.localeCompare(b.displayName)
          break
        case 'status':
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
          break
        case 'activeAssets':
          cmp = a.activeAssets - b.activeAssets
          break
        case 'syncIntervalSecs':
          cmp = a.syncIntervalSecs - b.syncIntervalSecs
          break
        case 'totalPriceRecords':
          cmp = a.totalPriceRecords - b.totalPriceRecords
          break
        case 'lastSyncAgeSecs':
          cmp = a.lastSyncAgeSecs - b.lastSyncAgeSecs
          break
        case 'zeroValueAssets':
          cmp = a.zeroValueAssets - b.zeroValueAssets
          break
        case 'staleAssets':
          cmp = a.staleAssets - b.staleAssets
          break
        case 'avgChangePct':
          cmp = a.avgChangePct - b.avgChangePct
          break
        case 'syncGapMaxSecs':
          cmp = a.syncGapMaxSecs - b.syncGapMaxSecs
          break
      }

      return sortDirection === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [filteredSources, sortField, sortDirection])

  const columns: { label: string; field: SortField; align?: string }[] = [
    { label: 'Source', field: 'displayName' },
    { label: 'Status', field: 'status' },
    { label: 'Live / Total', field: 'activeAssets', align: 'text-right' },
    { label: 'Cycle', field: 'syncIntervalSecs', align: 'text-right' },
    { label: 'Records', field: 'totalPriceRecords', align: 'text-right' },
    { label: 'Freshness', field: 'lastSyncAgeSecs', align: 'text-right' },
    { label: 'Zeros', field: 'zeroValueAssets', align: 'text-right' },
    { label: 'Stale', field: 'staleAssets', align: 'text-right' },
    { label: 'Avg Change', field: 'avgChangePct', align: 'text-right' },
    { label: 'Max Gap', field: 'syncGapMaxSecs', align: 'text-right' },
  ]

  return (
    <div className="border border-border-light overflow-hidden">
      {/* Search bar */}
      <div className="px-3 py-2 border-b border-border-light bg-muted">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sources..."
            className="w-full max-w-xs bg-card border border-border-light rounded px-3 py-1.5 text-[12px] text-black placeholder:text-text-muted focus:outline-none focus:border-color-info transition-colors"
          />
          {search && (
            <span className="text-[11px] text-text-muted whitespace-nowrap">
              {filteredSources.length} of {sources.length}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table aria-label="Source Health Monitoring">
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead
                  key={col.field}
                  className={`cursor-pointer select-none hover:text-black transition-colors ${col.align || ''}`}
                  onClick={() => handleSort(col.field)}
                >
                  {col.label}
                  <SortIcon active={sortField === col.field} direction={sortDirection} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : sortedSources.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-12 text-center">
                  <p className="text-text-muted">
                    {search ? 'No sources match your search' : 'No sources found'}
                  </p>
                  <p className="text-text-muted text-sm mt-1">
                    {search
                      ? 'Try a different query or clear the search.'
                      : 'Check that the data-node is running and has ingested data.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedSources.map(source => {
                const isSelected = selectedSourceId === source.sourceId
                const highZeros = hasHighZeroRate(source)

                return (
                  <TableRow
                    key={source.sourceId}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-surface-info'
                        : highZeros
                        ? 'hover:bg-surface-info/50'
                        : 'hover:bg-surface'
                    }`}
                    onClick={() => onSelectSource(source.sourceId)}
                    data-state={isSelected ? 'selected' : undefined}
                  >
                    {/* Source Name */}
                    <TableCell className="font-bold text-black text-[13px]">
                      <div className="flex flex-col">
                        <span>{source.displayName}</span>
                        <span className="text-[10px] font-mono text-text-muted font-normal">
                          {source.sourceId}
                        </span>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${getStatusColor(source.status)} ${getStatusBg(source.status)}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(source.status)}`} />
                          {source.status === 'not_started' ? 'OFF' : source.status}
                        </span>
                        {source.notStartedReason && (
                          <span className="text-[9px] text-text-muted leading-tight max-w-[160px] truncate" title={source.notStartedReason}>
                            {source.notStartedReason}
                          </span>
                        )}
                        {source.status === 'not_started' && API_KEY_LINKS[source.sourceId] && (
                          <a
                            href={API_KEY_LINKS[source.sourceId].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] text-color-info hover:underline leading-tight"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Get key: {API_KEY_LINKS[source.sourceId].label} &rarr;
                          </a>
                        )}
                        {source.lastError && source.status === 'dead' && (
                          <span className="text-[9px] text-color-down leading-tight max-w-[140px] truncate" title={source.lastError}>
                            {source.errorCategory}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Live / Total */}
                    <TableCell className="text-right font-mono tabular-nums text-[12px]">
                      {(() => {
                        const live = Math.max(0, source.activeAssets - source.staleAssets - source.zeroValueAssets)
                        const liveRatio = source.totalAssets > 0 ? live / source.totalAssets : 0
                        return (
                          <div className="flex flex-col items-end">
                            <div>
                              <span className={`font-bold ${liveRatio > 0.7 ? 'text-color-up' : liveRatio > 0.3 ? 'text-color-warning' : 'text-color-down'}`}>
                                {live}
                              </span>
                              <span className="text-text-muted"> / {source.totalAssets}</span>
                            </div>
                            <span className="text-[9px] text-text-muted">
                              {source.totalAssets > 0 ? `${Math.round(liveRatio * 100)}%` : '--'}
                            </span>
                          </div>
                        )
                      })()}
                    </TableCell>

                    {/* Cycle (sync interval) */}
                    <TableCell className="text-right font-mono tabular-nums text-[12px]">
                      {(() => {
                        const freq = getFrequencyLabel(source.syncIntervalSecs)
                        return (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`inline-block px-1.5 py-0 rounded text-[10px] font-bold uppercase tracking-wider ${freq.color}`}>
                              {freq.label}
                            </span>
                            <span className="text-[9px] text-text-muted">{formatAge(source.syncIntervalSecs)}</span>
                          </div>
                        )
                      })()}
                    </TableCell>

                    {/* Records */}
                    <TableCell className="text-right font-mono tabular-nums text-[12px]">
                      {formatNumber(source.totalPriceRecords)}
                    </TableCell>

                    {/* Freshness (last sync age) */}
                    <TableCell className="text-right font-mono tabular-nums text-[12px]">
                      <span
                        className={
                          source.lastSyncAgeSecs > source.syncIntervalSecs * 10
                            ? 'text-color-down font-bold'
                            : source.lastSyncAgeSecs > source.syncIntervalSecs * 3
                            ? 'text-color-warning font-semibold'
                            : 'text-color-up'
                        }
                      >
                        {formatAge(source.lastSyncAgeSecs)}
                      </span>
                    </TableCell>

                    {/* Zero Values */}
                    <TableCell className="text-right font-mono tabular-nums text-[12px]">
                      <span className={highZeros ? 'text-color-info font-bold' : ''}>
                        {source.zeroValueAssets}
                      </span>
                    </TableCell>

                    {/* Stale (with dormant/active breakdown + reason) */}
                    <TableCell className="text-right font-mono tabular-nums text-[12px]">
                      {source.staleAssets > 0 ? (
                        <div className="flex flex-col items-end leading-tight" title={source.staleReason}>
                          <span className={source.staleActive > 0 ? 'text-color-warning font-semibold' : 'text-muted-foreground'}>
                            {source.staleAssets}
                          </span>
                          <span className="text-[10px] text-muted-foreground max-w-[140px] truncate">
                            {source.staleDormant > 0
                              ? `${source.staleDormant} dormant`
                              : source.staleReason}
                          </span>
                        </div>
                      ) : (
                        <span>0</span>
                      )}
                    </TableCell>

                    {/* Avg Change */}
                    <TableCell className="text-right font-mono tabular-nums text-[12px]">
                      {source.avgChangePct.toFixed(2)}%
                    </TableCell>

                    {/* Max Gap */}
                    <TableCell className="text-right font-mono tabular-nums text-[12px]">
                      <span
                        className={
                          source.syncGapMaxSecs > source.syncIntervalSecs * 10
                            ? 'text-color-down font-bold'
                            : source.syncGapMaxSecs > source.syncIntervalSecs * 3
                            ? 'text-color-warning font-semibold'
                            : ''
                        }
                      >
                        {formatAge(source.syncGapMaxSecs)}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
