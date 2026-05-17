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
  /** Top earner's net P&L. Can be 0 or negative. */
  topEarnerPnl?: number
  /** Largest gross payout any player received. Always >= 0. The "Top Payout"
   *  column reads this, distinct from PnL. A round can have $0 PnL for the
   *  top earner but still a real payout if everyone got their stake back. */
  topPayout?: number
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

const CARD =
  'border border-[var(--apple-border,rgba(0,0,0,0.08))] bg-[var(--surface,#fff)] p-5 rounded-[var(--apple-r-md,12px)]'
const HEADER =
  'text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--apple-text-tertiary,#86868b)] mb-3'

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function truncAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || '--'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
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
  const [mobileExpanded, setMobileExpanded] = useState(false)

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
    staleTime: 60_000,
    gcTime: 300_000,
  })

  const settled = historyData?.batches?.filter(b => b.status === 'settled') ?? []
  const groups = useMemo(() => groupBatchesByDate(settled), [settled])
  const totalPages = historyData?.totalPages ?? 0
  const isEmpty = !isLoading && settled.length === 0
  const totalSettled = historyData?.totalSettled ?? 0

  return (
    <section className={CARD}>
      <header className="flex items-center justify-between mb-3">
        <h2 className={HEADER + ' mb-0'}>{t('batch_results.recent_batches')}</h2>
        <span
          className="text-[11px] font-mono tabular-nums"
          style={{ color: 'var(--apple-text-secondary)' }}
        >
          {totalSettled} {totalSettled === 1 ? 'round' : 'rounds'}
        </span>
      </header>

      {isLoading && settled.length === 0 ? (
        <div aria-hidden="true">
          <div
            className="hidden md:grid grid-cols-[64px_1fr_64px_104px] items-center px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: 'var(--apple-text-secondary)' }}
          >
            <div>Time</div>
            <div>Round</div>
            <div className="text-right">Players</div>
            <div className="text-right">Top Payout</div>
          </div>
          <div
            className="rounded-[10px] overflow-hidden"
            style={{ border: '1px solid var(--apple-border)' }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[48px_1fr_72px] md:grid-cols-[64px_1fr_64px_104px] items-center gap-2 px-3 py-2.5"
                style={{
                  borderBottom: i < 5 ? '1px solid var(--apple-divider,#e8e8ed)' : 'none',
                  animationDelay: `${i * 50}ms`,
                }}
              >
                <span className="skeleton h-[11px] w-12 rounded" />
                <div className="flex items-center gap-3 min-w-0">
                  <span className="skeleton h-[12px] w-20 rounded" />
                  <span className="hidden md:inline skeleton h-[10px] w-24 rounded" />
                </div>
                <span className="hidden md:block skeleton h-[12px] w-8 rounded justify-self-end" />
                <span className="skeleton h-[12px] w-16 rounded justify-self-end" />
              </div>
            ))}
          </div>
        </div>
      ) : isEmpty ? (
        <div
          className="rounded-[10px] px-5 py-8 text-center"
          style={{
            border: '1px solid var(--apple-border)',
            background: 'var(--apple-panel-2,#fbfbfd)',
          }}
        >
          <p className="text-[13px]" style={{ color: 'var(--apple-text-secondary)' }}>
            No settled rounds yet. The first result lands here once the current round settles.
          </p>
        </div>
      ) : (
        <div>
          {/* Column headers — desktop only */}
          <div
            className="hidden md:grid grid-cols-[64px_1fr_64px_104px] items-center px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: 'var(--apple-text-secondary)' }}
          >
            <div>Time</div>
            <div>Round</div>
            <div className="text-right">Players</div>
            <div className="text-right">Top Payout</div>
          </div>

          <div
            className="rounded-[10px] overflow-hidden"
            style={{ border: '1px solid var(--apple-border)' }}
          >
            <div
              className={cn(
                'overflow-y-auto sm:max-h-[500px]',
                mobileExpanded ? 'max-h-[500px]' : 'max-h-[280px]',
              )}
            >
              {groups.map((group, groupIdx) => (
                <div key={group.label}>
                  <div
                    className="px-3 py-2"
                    style={{
                      background: 'var(--apple-panel-2,#fbfbfd)',
                      borderTop: groupIdx === 0 ? 'none' : '1px solid var(--apple-divider,#e8e8ed)',
                      borderBottom: '1px solid var(--apple-divider,#e8e8ed)',
                    }}
                  >
                    <span
                      className="text-[11px] font-semibold tracking-tight"
                      style={{ color: 'var(--apple-text-secondary)' }}
                    >
                      {group.label}
                    </span>
                  </div>

                  {group.batches.map((batch, idx) => {
                    const rawPayout = batch.topPayout
                    const fallbackPayout =
                      batch.topEarnerPnl != null && batch.playerCount > 0
                        ? batch.topEarnerPnl + batch.totalPool / batch.playerCount
                        : undefined
                    const payout = rawPayout ?? fallbackPayout
                    const hasPlayers = batch.playerCount > 0
                    const showPayout = hasPlayers && payout != null && payout > 0
                    const addr = batch.topEarnerAddress

                    return (
                      <div
                        key={batch.batchId}
                        className="grid grid-cols-[48px_1fr_72px] md:grid-cols-[64px_1fr_64px_104px] items-center gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--apple-panel-2,#fbfbfd)]"
                        style={{
                          borderBottom:
                            idx < group.batches.length - 1
                              ? '1px solid var(--apple-divider,#e8e8ed)'
                              : 'none',
                        }}
                      >
                        <div
                          className="text-[11px] font-mono tabular-nums"
                          style={{ color: 'var(--apple-text-secondary)' }}
                        >
                          {formatTime(batch.settledAt ?? batch.timestamp)}
                        </div>

                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="text-[12px] font-mono font-bold shrink-0"
                            style={{ color: 'var(--apple-text)' }}
                          >
                            #{batch.batchId}
                          </span>
                          {addr && (
                            <span
                              className="hidden md:inline text-[10px] font-mono truncate"
                              title={addr}
                              style={{ color: 'var(--apple-text-tertiary)' }}
                            >
                              {truncAddr(addr)}
                            </span>
                          )}
                        </div>

                        <div
                          className="hidden md:block text-right text-[12px] font-mono tabular-nums font-semibold"
                          style={{ color: 'var(--apple-text-secondary)' }}
                        >
                          {batch.playerCount}
                        </div>

                        <div
                          className="text-right text-[12px] font-mono tabular-nums font-bold"
                          style={{
                            color: showPayout ? '#0E8F4A' : 'var(--apple-text-secondary)',
                          }}
                        >
                          {showPayout ? `$${payout!.toFixed(2)}` : '—'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {settled.length > 4 && (
              <button
                onClick={() => setMobileExpanded(v => !v)}
                className="sm:hidden w-full py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors"
                style={{
                  borderTop: '1px solid var(--apple-divider,#e8e8ed)',
                  color: 'var(--apple-text-tertiary)',
                  background: 'var(--apple-panel-2,#fbfbfd)',
                }}
              >
                {mobileExpanded ? t('batch_results.show_less') : t('batch_results.show_more')}
              </button>
            )}

            {totalPages > 1 && (
              <div
                className="flex items-center justify-between px-3 py-2.5"
                style={{
                  borderTop: '1px solid var(--apple-divider,#e8e8ed)',
                  background: 'var(--apple-panel-2,#fbfbfd)',
                }}
              >
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-[11px] font-mono font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  style={{ color: 'var(--apple-text-secondary)' }}
                >
                  &larr; {t('batch_results.prev')}
                </button>
                <span
                  className="text-[10px] font-mono tabular-nums"
                  style={{ color: 'var(--apple-text-secondary)' }}
                >
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="text-[11px] font-mono font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  style={{ color: 'var(--apple-text-secondary)' }}
                >
                  {t('batch_results.next')} &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
