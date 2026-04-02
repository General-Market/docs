'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { useReadContracts } from 'wagmi'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { indexL3 } from '@/lib/wagmi'
import fundData from '@/data/fund-branding.json'
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

const STRATEGY_LABELS: Record<string, string> = {
  momentum: 'Momentum',
  contrarian: 'Contrarian',
  bullish: 'Bullish',
  bearish: 'Bearish',
  momentum_threshold: 'Selective',
  home_field: 'Home Field',
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

  // Managed funds for this source
  const funds = useMemo(
    () =>
      (fundData as any).funds.filter(
        (f: any) => f.source === sourceId && f.vault,
      ),
    [sourceId],
  )

  const vaultAddresses = funds
    .map((f: any) => f.vault as `0x${string}`)
    .filter(Boolean)

  const calls = vaultAddresses.flatMap((addr: `0x${string}`) => [
    {
      address: addr,
      abi: VISION_VAULT_ABI,
      functionName: 'totalAssets' as const,
      chainId: indexL3.id,
    },
    {
      address: addr,
      abi: VISION_VAULT_ABI,
      functionName: 'totalSupply' as const,
      chainId: indexL3.id,
    },
  ])

  const { data: vaultResults } = useReadContracts({
    contracts: calls as any,
    allowFailure: true,
    query: { enabled: vaultAddresses.length > 0 },
  })

  const settled = historyData?.batches?.filter(b => b.status === 'settled') ?? []
  const groups = useMemo(() => groupBatchesByDate(settled), [settled])
  const totalPages = historyData?.totalPages ?? 0

  if (funds.length === 0 && settled.length === 0 && !isLoading) return null

  return (
    <div className="mt-6">
      {/* ── Top Vaults — fund cards styled like HLTV team header ── */}
      {funds.length > 0 && (
        <>
          <div className="flex items-center justify-between px-4 py-3 bg-white border border-border-light">
            <h3 className="text-[14px] font-black text-black">Top Vaults</h3>
            <span className="text-[11px] font-mono text-text-muted">
              {funds.length} funds
            </span>
          </div>
          <div className="bg-white border border-t-0 border-border-light divide-y divide-border-light">
            {funds.map((fund: any, i: number) => {
              const base = i * 2
              const totalAssets =
                vaultResults?.[base]?.status === 'success'
                  ? (vaultResults[base].result as bigint)
                  : 0n
              const totalSupply =
                vaultResults?.[base + 1]?.status === 'success'
                  ? (vaultResults[base + 1].result as bigint)
                  : 0n
              const nav =
                totalSupply > 0n
                  ? Number(totalAssets) / Number(totalSupply)
                  : 1.0
              const perf = nav - 1.0
              const tvl = parseFloat(formatUnits(totalAssets, 18))

              return (
                <div
                  key={fund.symbol}
                  className="flex items-center px-4 py-3 hover:bg-surface/30 transition-colors"
                >
                  {/* Color accent bar */}
                  <div
                    className="w-1.5 h-10 rounded-sm mr-3 shrink-0"
                    style={{ backgroundColor: fund.color }}
                  />

                  {/* Fund info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-black">
                        {fund.name}
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">
                        {fund.symbol}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      {STRATEGY_LABELS[fund.strategy] || fund.strategy} &middot;{' '}
                      {fund.fee / 100}% fee
                    </div>
                  </div>

                  {/* TVL */}
                  <div className="text-right mr-6">
                    <div className="text-[12px] font-mono font-bold text-black tabular-nums">
                      $
                      {tvl > 0
                        ? tvl.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })
                        : '0'}
                    </div>
                    <div className="text-[9px] text-text-muted">TVL</div>
                  </div>

                  {/* Performance */}
                  <div className="text-right">
                    <div
                      className={cn(
                        'text-[13px] font-mono font-black tabular-nums',
                        perf >= 0 ? 'text-green-600' : 'text-red-600',
                      )}
                    >
                      {perf >= 0 ? '+' : ''}
                      {(perf * 100).toFixed(2)}%
                    </div>
                    <div className="text-[9px] text-text-muted">Perf</div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Recent Batches — HLTV "Recent results" style ── */}
      {(settled.length > 0 || isLoading) && (
        <div className={funds.length > 0 ? 'mt-6' : ''}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border border-border-light">
            <div>
              <h3 className="text-[14px] font-black text-black">
                Recent Batches
              </h3>
              <div className="text-[11px] text-text-muted">
                Settled rounds for this source
              </div>
            </div>
            <div className="text-[11px] font-mono text-text-muted">
              {historyData?.totalSettled ?? 0} total
            </div>
          </div>

          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[80px_1fr_70px_80px_90px_64px] items-center px-4 py-2 bg-white border-x border-border-light text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
            <div>Date</div>
            <div className="text-center">Matches</div>
            <div className="text-right">Players</div>
            <div className="text-right">Pool</div>
            <div className="text-right">Top P&L</div>
            <div />
          </div>

          <div className="bg-white border border-t-0 border-border-light">
            {isLoading && settled.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-text-muted animate-pulse">
                Loading history...
              </div>
            )}

            {groups.map(group => (
              <div key={group.label}>
                {/* Group header — like HLTV tournament name */}
                <div className="px-4 py-2.5 bg-surface/40 border-y border-border-light">
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
                      className="grid grid-cols-[80px_1fr_70px_80px_90px_64px] items-center px-4 py-2.5 border-b border-border-light last:border-b-0 hover:bg-surface/30 transition-colors"
                    >
                      {/* Date */}
                      <div className="text-[11px] text-text-muted font-mono">
                        {formatDate(batch.settledAt ?? batch.timestamp)}
                      </div>

                      {/* Batch info — center, like match result */}
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-[12px] font-bold text-black font-mono">
                          Batch #{batch.batchId}
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
                            {batch.marketCount} mkts
                          </span>
                        )}
                      </div>

                      {/* Players */}
                      <div className="text-right text-[12px] font-mono tabular-nums text-text-secondary font-bold">
                        {batch.playerCount}
                      </div>

                      {/* Pool */}
                      <div className="text-right text-[12px] font-mono tabular-nums text-text-secondary">
                        ${batch.totalPool.toFixed(2)}
                      </div>

                      {/* Top P&L */}
                      <div
                        className={cn(
                          'text-right text-[12px] font-mono tabular-nums font-bold',
                          pnlPositive
                            ? 'text-green-600'
                            : pnl < 0
                              ? 'text-red-600'
                              : 'text-text-muted',
                        )}
                      >
                        {pnl !== 0
                          ? `${pnlPositive ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`
                          : '\u2014'}
                      </div>

                      {/* "Match" button — HLTV style */}
                      <div className="text-right">
                        <span className="inline-block px-2.5 py-1 rounded bg-[#4a89dc]/10 text-[10px] font-bold text-[#4a89dc] cursor-default">
                          Batch
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-light bg-surface/20">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-[11px] font-mono font-bold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  &larr; Prev
                </button>
                <span className="text-[10px] font-mono text-text-muted tabular-nums">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="text-[11px] font-mono font-bold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
