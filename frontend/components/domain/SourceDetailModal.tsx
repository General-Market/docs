'use client'

import { useState, useEffect, useCallback } from 'react'
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

interface SourceDetailModalProps {
  sourceId: string | null
  onClose: () => void
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
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}K`
  return v.toFixed(2)
}

function getRowBg(asset: SourceAsset): string {
  if (asset.isZero) return 'bg-color-down/10'
  if (asset.isStale) return 'bg-color-warning/10'
  return ''
}

// ── Component ──

export function SourceDetailModal({ sourceId, onClose }: SourceDetailModalProps) {
  const [assets, setAssets] = useState<SourceAsset[]>([])
  const [buckets, setBuckets] = useState<HistoryBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)

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

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-[5vh] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border-light rounded-xl shadow-modal max-w-4xl w-full max-h-[90vh] overflow-y-auto"
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
                  Assets ({totalAssets})
                </h3>
                <div className="border border-border-light overflow-hidden rounded-lg">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table aria-label="Source Assets">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead className="text-right">Age</TableHead>
                          <TableHead className="text-right">Change%</TableHead>
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
                          assets.map(asset => (
                            <TableRow
                              key={asset.assetId}
                              className={getRowBg(asset)}
                            >
                              {/* Symbol */}
                              <TableCell className="font-mono text-[12px] font-semibold text-black whitespace-nowrap">
                                {asset.symbol}
                              </TableCell>

                              {/* Name */}
                              <TableCell className="text-[12px] text-text-secondary max-w-[200px] truncate">
                                {asset.name}
                              </TableCell>

                              {/* Value */}
                              <TableCell className={`text-right font-mono tabular-nums text-[12px] ${asset.isZero ? 'text-color-down font-bold' : ''}`}>
                                {formatValue(asset.latestValue)}
                              </TableCell>

                              {/* Age */}
                              <TableCell className={`text-right font-mono tabular-nums text-[12px] ${asset.isStale ? 'text-color-warning font-semibold' : ''}`}>
                                {formatAge(asset.ageSecs)}
                              </TableCell>

                              {/* Change% */}
                              <TableCell className="text-right font-mono tabular-nums text-[12px]">
                                {asset.changePct !== null && asset.changePct !== undefined
                                  ? `${asset.changePct >= 0 ? '+' : ''}${asset.changePct.toFixed(2)}%`
                                  : '--'}
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
                          ))
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
