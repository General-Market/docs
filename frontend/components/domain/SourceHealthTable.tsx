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
  | 'totalPriceRecords'
  | 'oldestRecord'
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
  dead: 0,
  stale: 1,
  healthy: 2,
}

function getStatusColor(status: SourceStatus): string {
  switch (status) {
    case 'healthy':
      return 'text-color-up'
    case 'stale':
      return 'text-color-warning'
    case 'dead':
      return 'text-color-down'
    default:
      return 'text-text-muted'
  }
}

function getStatusBg(status: SourceStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-surface-up'
    case 'stale':
      return 'bg-surface-warning'
    case 'dead':
      return 'bg-surface-down'
    default:
      return ''
  }
}

function getStatusDot(status: SourceStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-color-up'
    case 'stale':
      return 'bg-color-warning'
    case 'dead':
      return 'bg-color-down'
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

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function hasHighZeroRate(source: SourceHealth): boolean {
  if (source.activeAssets === 0) return false
  return (source.zeroValueAssets / source.activeAssets) > 0.2
}

// ── Skeleton ──

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }, (_, r) => (
        <TableRow key={r}>
          {Array.from({ length: 10 }, (_, c) => (
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

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      // Default direction: ascending for status (red first), descending for numeric values
      setSortDirection(field === 'status' || field === 'displayName' ? 'asc' : 'desc')
    }
  }, [sortField])

  const sortedSources = useMemo(() => {
    const sorted = [...sources].sort((a, b) => {
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
        case 'totalPriceRecords':
          cmp = a.totalPriceRecords - b.totalPriceRecords
          break
        case 'oldestRecord': {
          const aTime = a.oldestRecord ? new Date(a.oldestRecord).getTime() : 0
          const bTime = b.oldestRecord ? new Date(b.oldestRecord).getTime() : 0
          cmp = aTime - bTime
          break
        }
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
  }, [sources, sortField, sortDirection])

  const columns: { label: string; field: SortField; align?: string }[] = [
    { label: 'Source', field: 'displayName' },
    { label: 'Status', field: 'status' },
    { label: 'Assets', field: 'activeAssets', align: 'text-right' },
    { label: 'Records', field: 'totalPriceRecords', align: 'text-right' },
    { label: 'Oldest', field: 'oldestRecord' },
    { label: 'Freshness', field: 'lastSyncAgeSecs', align: 'text-right' },
    { label: 'Zeros', field: 'zeroValueAssets', align: 'text-right' },
    { label: 'Stale', field: 'staleAssets', align: 'text-right' },
    { label: 'Avg Change', field: 'avgChangePct', align: 'text-right' },
    { label: 'Max Gap', field: 'syncGapMaxSecs', align: 'text-right' },
  ]

  return (
    <div className="border border-border-light overflow-hidden">
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
                <TableCell colSpan={10} className="py-12 text-center">
                  <p className="text-text-muted">No sources found</p>
                  <p className="text-text-muted text-sm mt-1">
                    Check that the data-node is running and has ingested data.
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
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${getStatusColor(source.status)} ${getStatusBg(source.status)}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(source.status)}`} />
                        {source.status}
                      </span>
                    </TableCell>

                    {/* Assets */}
                    <TableCell className="text-right font-mono tabular-nums text-[12px]">
                      <span className="font-semibold text-black">{source.activeAssets}</span>
                      <span className="text-text-muted"> / {source.totalAssets}</span>
                    </TableCell>

                    {/* Records */}
                    <TableCell className="text-right font-mono tabular-nums text-[12px]">
                      {formatNumber(source.totalPriceRecords)}
                    </TableCell>

                    {/* Oldest */}
                    <TableCell className="text-[12px] font-mono tabular-nums whitespace-nowrap">
                      {formatDate(source.oldestRecord)}
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

                    {/* Stale */}
                    <TableCell className="text-right font-mono tabular-nums text-[12px]">
                      <span className={source.staleAssets > 0 ? 'text-color-warning font-semibold' : ''}>
                        {source.staleAssets}
                      </span>
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
