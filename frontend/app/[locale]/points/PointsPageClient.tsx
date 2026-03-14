'use client'

import { useState } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { indexL3 } from '@/lib/wagmi'
import { useVisionPoints } from '@/hooks/vision/useVisionPoints'
import { useVisionLeaderboard } from '@/hooks/vision/useVisionLeaderboard'
import { useBatches } from '@/hooks/vision/useBatches'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Link } from '@/i18n/routing'

function formatPoints(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 100_000) return `${(n / 1_000).toFixed(0)}K`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  if (n >= 1) return Math.floor(n).toLocaleString()
  return n.toFixed(2)
}

function formatUsd(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(2)}`
}

function truncAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || '--'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function PointsPageClient() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const injectedConnector = connectors.find(c => c.id === 'injected')

  const handleConnect = async () => {
    if (!injectedConnector) return
    if (typeof window !== 'undefined' && window.ethereum) {
      const chainIdHex = `0x${indexL3.id.toString(16)}`
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: indexL3.name,
            nativeCurrency: indexL3.nativeCurrency,
            rpcUrls: [indexL3.rpcUrls.default.http[0]],
          }],
        })
      } catch {}
    }
    connect({ connector: injectedConnector, chainId: indexL3.id })
  }

  const { batches, totalPointsPerTick, totalPointsPerHour, estimatedTotalPoints, activeBatches, isLoading } = useVisionPoints()
  const { leaderboard, isLoading: lbLoading } = useVisionLeaderboard()
  const { data: allBatches } = useBatches()

  const totalBatches = allBatches?.length ?? 0
  const coveragePercent = totalBatches > 0 ? Math.round((activeBatches / totalBatches) * 100) : 0

  const ROWS_PER_PAGE = 10

  const [positionsPage, setPositionsPage] = useState(1)
  const positionsTotalPages = Math.max(1, Math.ceil(batches.length / ROWS_PER_PAGE))
  const paginatedBatches = batches.slice((positionsPage - 1) * ROWS_PER_PAGE, positionsPage * ROWS_PER_PAGE)

  const [leaderboardPage, setLeaderboardPage] = useState(1)
  const leaderboardTotalPages = Math.max(1, Math.ceil(leaderboard.length / ROWS_PER_PAGE))
  const paginatedLeaderboard = leaderboard.slice((leaderboardPage - 1) * ROWS_PER_PAGE, leaderboardPage * ROWS_PER_PAGE)

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      <div className="flex-1">
        {/* ═══════════════════ HERO ═══════════════════ */}
        <section className="bg-black text-white">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-16 md:py-20">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
                {/* Left: Season + Points */}
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/40 mb-3">
                    Season 1
                  </div>
                  <h1 className="text-[52px] md:text-[64px] font-black tracking-[-0.03em] leading-[1] mb-3">
                    {!isConnected ? (
                      'Points'
                    ) : isLoading ? (
                      <span className="inline-block w-48 h-16 bg-white/10 rounded animate-pulse" />
                    ) : (
                      <span className="font-mono tabular-nums">{formatPoints(estimatedTotalPoints)}</span>
                    )}
                  </h1>
                  {isConnected && !isLoading && (
                    <p className="text-[15px] text-white/50 font-medium">
                      Total points earned
                    </p>
                  )}
                  {!isConnected && (
                    <p className="text-[15px] text-white/50 max-w-md">
                      Earn points by providing liquidity across Vision prediction batches. Points will convert to tokens at the end of the season.
                    </p>
                  )}
                </div>

                {/* Right: Live earning rate or Connect */}
                {!isConnected ? (
                  <button
                    onClick={handleConnect}
                    className="px-8 py-3.5 bg-white text-black text-[14px] font-bold tracking-[-0.01em] hover:bg-white/90 transition-colors self-start md:self-end"
                  >
                    Connect Wallet
                  </button>
                ) : !isLoading && (
                  <div className="flex gap-8 md:gap-12">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-1">
                        Rate
                      </div>
                      <div className="text-[28px] font-black font-mono tabular-nums text-green-400">
                        +{formatPoints(totalPointsPerHour)}
                        <span className="text-[13px] font-semibold text-white/30 ml-1">/hr</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-1">
                        Batches
                      </div>
                      <div className="text-[28px] font-black font-mono tabular-nums">
                        {activeBatches}
                        <span className="text-[13px] font-semibold text-white/30 ml-1">/ {totalBatches}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-1">
                        Coverage
                      </div>
                      <div className="text-[28px] font-black font-mono tabular-nums">
                        {coveragePercent}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
        <section className="border-b border-border-light">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-0">
                {[
                  {
                    step: '01',
                    title: 'Join batches',
                    desc: 'Each of the 100 prediction batches emits 100 points every tick (~10 min). That\'s 1.44M points distributed daily across all batches.',
                  },
                  {
                    step: '02',
                    title: 'Earn by share',
                    desc: 'Points are split proportionally by your USDC share of each batch. More capital = more points. Empty batches = 100% to you.',
                  },
                  {
                    step: '03',
                    title: 'Collect airdrop',
                    desc: 'At the end of Season 1, points convert to tokens. Spread across more batches and deposit early to maximize earnings.',
                  },
                ].map((item, i) => (
                  <div
                    key={item.step}
                    className={`py-5 md:py-0 ${i !== 0 ? 'border-t md:border-t-0 md:border-l border-border-light' : ''} ${i !== 0 ? 'md:pl-8' : ''} ${i !== 2 ? 'md:pr-8' : ''}`}
                  >
                    <div className="text-[11px] font-bold text-text-muted tracking-[0.06em] mb-2">
                      {item.step}
                    </div>
                    <div className="text-[16px] font-extrabold text-black tracking-[-0.01em] mb-1">
                      {item.title}
                    </div>
                    <p className="text-[13px] text-text-secondary leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ DAILY BREAKDOWN ═══════════════════ */}
        <section className="border-b border-border-light">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-8">
              <h2 className="text-[20px] font-black tracking-[-0.01em] text-black mb-4">
                Daily Points Distribution
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 border border-border-light">
                <div className="p-4 border-r border-border-light">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">Per Tick / Batch</div>
                  <div className="text-[22px] font-black text-black font-mono">100</div>
                </div>
                <div className="p-4 border-r border-border-light">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">Ticks / Day</div>
                  <div className="text-[22px] font-black text-black font-mono">144</div>
                </div>
                <div className="p-4 border-r border-border-light">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">Batches</div>
                  <div className="text-[22px] font-black text-black font-mono">{totalBatches}</div>
                </div>
                <div className="p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">Total / Day</div>
                  <div className="text-[22px] font-black text-black font-mono">1.44M</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border-light p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">Vision (Prediction Markets)</div>
                  <p className="text-[13px] text-text-secondary leading-relaxed">
                    100 batches across 25,000+ markets. Each batch emits 100 pts every 10 minutes. Earn by depositing USDC into any batch — your share of the pool determines your points.
                  </p>
                </div>
                <div className="border border-border-light p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">Index (ITPs)</div>
                  <p className="text-[13px] text-text-secondary leading-relaxed">
                    Index product points coming in Season 2. Hold ITP shares to earn points from the index protocol. Stay tuned for details on ITP-based point emissions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ YOUR POSITIONS ═══════════════════ */}
        {isConnected && (
          <section className="border-b border-border-light">
            <div className="px-6 lg:px-12">
              <div className="max-w-site mx-auto py-8">
                {/* Section header */}
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <h2 className="text-[20px] font-black tracking-[-0.01em] text-black">
                      Your Positions
                    </h2>
                    {batches.length > 0 && (
                      <p className="text-[12px] text-text-muted mt-0.5">
                        Earning across {activeBatches} batch{activeBatches !== 1 ? 'es' : ''} — {formatPoints(totalPointsPerTick)} pts/tick
                      </p>
                    )}
                  </div>
                  {batches.length > 0 && totalBatches > activeBatches && (
                    <Link
                      href="/"
                      className="text-[12px] font-bold text-black border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
                    >
                      Join {totalBatches - activeBatches} more
                    </Link>
                  )}
                </div>

                {/* Empty state */}
                {!isLoading && batches.length === 0 && (
                  <div className="border border-border-light bg-surface/50 px-6 py-10 text-center">
                    <p className="text-[15px] font-bold text-black mb-1">No active positions</p>
                    <p className="text-[13px] text-text-secondary mb-4">
                      Join a Vision batch to start earning points. Empty batches give you 100% of the points.
                    </p>
                    <Link
                      href="/"
                      className="inline-block px-5 py-2.5 bg-black text-white text-[13px] font-bold hover:bg-zinc-800 transition-colors"
                    >
                      Browse Batches
                    </Link>
                  </div>
                )}

                {/* Loading state */}
                {isLoading && (
                  <div className="space-y-1">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-12 bg-surface animate-pulse" />
                    ))}
                  </div>
                )}

                {/* Positions table */}
                {batches.length > 0 && (
                  <>
                    <div className="border border-border-light overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border-light text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
                            <th className="text-left py-2.5 px-4">Batch</th>
                            <th className="text-right py-2.5 px-4">Your Stake</th>
                            <th className="text-right py-2.5 px-4">Pool TVL</th>
                            <th className="text-right py-2.5 px-4">Your Share</th>
                            <th className="text-right py-2.5 px-4">Pts / Tick</th>
                            <th className="text-right py-2.5 px-4">Pts / Hour</th>
                            <th className="text-right py-2.5 px-4">Est. Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBatches.map((b, i) => (
                            <tr
                              key={b.batchId}
                              className={`border-b border-border-light text-[13px] hover:bg-surface/60 transition-colors ${
                                i % 2 === 1 ? 'bg-surface/30' : ''
                              }`}
                            >
                              <td className="py-3 px-4 font-mono text-[12px] text-text-muted">
                                #{b.batchId}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-black">
                                {formatUsd(b.myBalanceUsd)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-text-secondary">
                                {formatUsd(b.batchTvlUsd)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                                <span className={b.myShare >= 0.5 ? 'text-green-600' : b.myShare >= 0.1 ? 'text-black' : 'text-text-secondary'}>
                                  {(b.myShare * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-black">
                                {b.pointsPerTick.toFixed(1)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-green-600">
                                +{formatPoints(b.pointsPerHour)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-text-secondary">
                                {formatPoints(b.estimatedTotalPoints)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {/* Totals row */}
                        <tfoot>
                          <tr className="bg-black text-white text-[13px] font-bold">
                            <td className="py-3 px-4 text-[11px] uppercase tracking-[0.06em] font-extrabold">
                              Total
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {formatUsd(batches.reduce((s, b) => s + b.myBalanceUsd, 0))}
                            </td>
                            <td className="py-3 px-4" />
                            <td className="py-3 px-4" />
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {totalPointsPerTick.toFixed(1)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-green-400">
                              +{formatPoints(totalPointsPerHour)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {formatPoints(estimatedTotalPoints)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {positionsTotalPages > 1 && (
                      <div className="flex items-center justify-between mt-3">
                        <button
                          onClick={() => setPositionsPage(p => Math.max(1, p - 1))}
                          disabled={positionsPage === 1}
                          className="text-[11px] font-semibold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          &larr; Previous
                        </button>
                        <span className="text-[11px] text-text-muted">
                          Page {positionsPage} of {positionsTotalPages}
                        </span>
                        <button
                          onClick={() => setPositionsPage(p => Math.min(positionsTotalPages, p + 1))}
                          disabled={positionsPage === positionsTotalPages}
                          className="text-[11px] font-semibold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Next &rarr;
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════ LEADERBOARD ═══════════════════ */}
        <section>
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-8 pb-16">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2 className="text-[20px] font-black tracking-[-0.01em] text-black">
                    Leaderboard
                  </h2>
                  <p className="text-[12px] text-text-muted mt-0.5">
                    {lbLoading ? 'Loading...' : `${leaderboard.length} players ranked by volume`}
                  </p>
                </div>
              </div>

              <div className="border border-border-light overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-medium bg-surface/50 text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
                      <th className="text-left py-2.5 px-4 w-12">Rank</th>
                      <th className="text-left py-2.5 px-4">Player</th>
                      <th className="text-right py-2.5 px-4">Volume</th>
                      <th className="text-right py-2.5 px-4">Batches</th>
                      <th className="text-right py-2.5 px-4">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lbLoading && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-[13px] text-text-muted">
                          Loading leaderboard...
                        </td>
                      </tr>
                    )}

                    {!lbLoading && leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-[13px] text-text-muted">
                          No players yet — join a batch to compete
                        </td>
                      </tr>
                    )}

                    {paginatedLeaderboard.map((entry, i) => {
                      const isYou = address && entry.walletAddress.toLowerCase() === address.toLowerCase()
                      const rank = entry.rank || ((leaderboardPage - 1) * ROWS_PER_PAGE + i + 1)

                      return (
                        <tr
                          key={entry.walletAddress}
                          className={`border-b border-border-light text-[13px] transition-colors ${
                            isYou
                              ? 'bg-green-50 hover:bg-green-100/60'
                              : i % 2 === 1
                                ? 'bg-surface/30 hover:bg-surface/60'
                                : 'hover:bg-surface/40'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <span className={`font-mono font-bold ${rank <= 3 ? 'text-black text-[14px]' : 'text-text-muted text-[12px]'}`}>
                              {rank <= 3 ? ['', '1st', '2nd', '3rd'][rank] : rank}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-[12px] ${isYou ? 'text-green-700 font-bold' : 'text-black font-medium'}`}>
                                {truncAddr(entry.walletAddress)}
                              </span>
                              {isYou && (
                                <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-green-600 bg-green-100 px-1.5 py-0.5">
                                  You
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-black">
                            {formatUsd(entry.totalVolume)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-text-secondary">
                            {entry.portfolioBets}
                          </td>
                          <td className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${entry.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {entry.roi >= 0 ? '+' : ''}{entry.roi.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {leaderboardTotalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => setLeaderboardPage(p => Math.max(1, p - 1))}
                    disabled={leaderboardPage === 1}
                    className="text-[11px] font-semibold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    &larr; Previous
                  </button>
                  <span className="text-[11px] text-text-muted">
                    Page {leaderboardPage} of {leaderboardTotalPages}
                  </span>
                  <button
                    onClick={() => setLeaderboardPage(p => Math.min(leaderboardTotalPages, p + 1))}
                    disabled={leaderboardPage === leaderboardTotalPages}
                    className="text-[11px] font-semibold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  )
}
