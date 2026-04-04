'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils/cn'

interface BatchVaultResultsProps {
  sourceId: string
}

interface SourceBatch {
  batchId: number
  status: string
  playerCount: number
  totalPool: number
  avgPnl: number
  topEarnerPnl?: number
  topEarnerAddress?: string | null
  timestamp: string
  settledAt?: string | null
  marketCount?: number | null
}

interface HistoryResponse {
  batches: SourceBatch[]
  page: number
  perPage: number
  totalSettled: number
  totalPages: number
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function truncAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || '--'
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`
}

function groupBatchesByDate(
  batches: SourceBatch[],
): { label: string; batches: SourceBatch[] }[] {
  const groups = new Map<string, SourceBatch[]>()

  for (const b of batches) {
    if (b.status !== 'settled') continue
    const d = new Date(b.settledAt ?? b.timestamp)
    const key = d.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    const existing = groups.get(key)
    if (existing) existing.push(b)
    else groups.set(key, [b])
  }

  return Array.from(groups.entries()).map(([label, batches]) => ({
    label,
    batches,
  }))
}

export function BatchVaultResults({ sourceId }: BatchVaultResultsProps) {
  const t = useTranslations('vision')
  const [page, setPage] = useState(1)

  // Batch history
  const { data: historyData, isLoading } = useQuery<HistoryResponse>({
    queryKey: ['source-history', sourceId, page],
    queryFn: async () => {
      const res = await fetch(
        `/api/vision/source/${encodeURIComponent(sourceId)}/history?page=${page}&per_page=20`,
      )
      if (!res.ok)
        return {
          batches: [],
          page: 1,
          perPage: 20,
          totalSettled: 0,
          totalPages: 0,
        }
      return res.json()
    },
    refetchInterval: 30_000,
  })

  const settled = historyData?.batches?.filter(b => b.status === 'settled') ?? []
  const groups = useMemo(() => groupBatchesByDate(settled), [settled])
  const totalPages = historyData?.totalPages ?? 0

  if (settled.length === 0 && !isLoading) return null

  return (
    <div>
      {/* ── Recent Batches — HLTV "Recent results" style ── */}
      {(settled.length > 0 || isLoading) && (
        <div>
          <div className="flex items-center justify-between px-5 py-3 bg-terminal-dark">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
                {t('batch_results.past_rounds_desc')}
              </div>
              <h3 className="text-[15px] font-bold text-white">
                {t('batch_results.recent_batches')}
                <span className="text-[11px] font-normal text-white/30 ml-2">
                  {historyData?.totalSettled ?? 0} {t('batch_results.total')}
                </span>
              </h3>
            </div>
          </div>

          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[80px_1fr_70px_90px_64px] items-center px-4 py-2 bg-[var(--surface)] border border-border-light text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
            <div>Date</div>
            <div className="text-center">Round</div>
            <div className="text-right">Players</div>
            <div className="text-right">Top Payout</div>
            <div />
          </div>

          <div className="bg-white border border-t-0 border-border-light">
            {isLoading && settled.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-text-muted animate-pulse">
                {t('batch_results.loading')}
              </div>
            )}

            {groups.map(group => (
              <div key={group.label}>
                {/* Group header — like HLTV tournament name */}
                <div className="px-4 py-2.5 bg-[var(--surface)] border-y border-border-light">
                  <span className="text-[13px] font-black text-black">
                    {group.label}
                  </span>
                </div>

                {group.batches.map(batch => {
                  const pnl = batch.topEarnerPnl ?? 0
                  const pnlPositive = pnl > 0
                  const addr = batch.topEarnerAddress

                  return (
                    <div
                      key={batch.batchId}
                      className="grid grid-cols-[80px_1fr_70px_90px_64px] items-center px-4 py-2.5 border-b border-border-light last:border-b-0 hover:bg-[var(--surface)] transition-colors"
                    >
                      {/* Date */}
                      <div className="text-[11px] text-text-muted font-mono">
                        {formatDate(batch.settledAt ?? batch.timestamp)}
                      </div>

                      {/* Batch info */}
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-[12px] font-bold text-black font-mono">
                          {t('batch_results.batch')} #{batch.batchId}
                        </span>
                        {addr && (
                          <>
                            <span className="text-[10px] text-text-muted">
                              &mdash;
                            </span>
                            <span
                              className="text-[10px] font-mono text-text-muted"
                              title={addr}
                            >
                              {truncAddr(addr)}
                            </span>
                          </>
                        )}
                        {batch.marketCount != null && (
                          <span className="text-[9px] text-text-muted ml-1">
                            {t('batch_card.markets_count', { count: batch.marketCount })}
                          </span>
                        )}
                      </div>

                      {/* Players */}
                      <div className="text-right text-[12px] font-mono tabular-nums text-text-secondary font-bold">
                        {batch.playerCount}
                      </div>

                      {/* Top Payout */}
                      <div
                        className={cn(
                          'text-right text-[12px] font-mono tabular-nums font-bold',
                          pnlPositive
                            ? 'text-color-up'
                            : pnl < 0
                              ? 'text-color-down'
                              : 'text-text-muted',
                        )}
                      >
                        {pnl !== 0
                          ? `${pnlPositive ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`
                          : '\u2014'}
                      </div>

                      {/* Detail button */}
                      <div className="text-right">
                        <span className="inline-block px-2.5 py-1 rounded bg-black/[0.06] text-[10px] font-bold text-text-secondary cursor-default">
                          {t('batch_results.batch')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-light bg-[var(--surface)]">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-[11px] font-mono font-bold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  &larr; {t('batch_results.prev')}
                </button>
                <span className="text-[10px] font-mono text-text-muted tabular-nums">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="text-[11px] font-mono font-bold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {t('batch_results.next')} &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
