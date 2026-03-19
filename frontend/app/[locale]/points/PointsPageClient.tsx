'use client'

import { useState } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { useTranslations } from 'next-intl'
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

  const t = useTranslations('pages')
  const { batches, totalPointsPerTick, totalPointsPerHour, estimatedTotalPoints, activeBatches, roundPoints, roundsCompleted, isLoading } = useVisionPoints()
  const { leaderboard, isLoading: lbLoading } = useVisionLeaderboard()
  const { data: allBatches } = useBatches()

  const totalBatches = allBatches?.length ?? 0
  const coveragePercent = totalBatches > 0 ? Math.round((activeBatches / totalBatches) * 100) : 0
  const totalMarkets = allBatches?.reduce((s, b) => s + b.marketCount, 0) ?? 0
  const dailyEmission = allBatches?.reduce((s, b) => s + (b.tickDuration > 0 ? 100 * 86400 / b.tickDuration : 0), 0) ?? 0

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
                    {t('points.season')}
                  </div>
                  <h1 className="text-[52px] md:text-[64px] font-black tracking-[-0.03em] leading-[1] mb-3">
                    {!isConnected ? (
                      t('points.title')
                    ) : isLoading ? (
                      <span className="inline-block w-48 h-16 bg-white/10 rounded animate-pulse" />
                    ) : (
                      <span className="font-mono tabular-nums">{formatPoints(estimatedTotalPoints)}</span>
                    )}
                  </h1>
                  {isConnected && !isLoading && (
                    <p className="text-[15px] text-white/50 font-medium">
                      {t('points.total_earned')}
                    </p>
                  )}
                  {!isConnected && (
                    <p className="text-[15px] text-white/50 max-w-md">
                      {t('points.earn_description')}
                    </p>
                  )}
                </div>

                {/* Right: Live earning rate or Connect */}
                {!isConnected ? (
                  <button
                    onClick={handleConnect}
                    className="px-8 py-3.5 bg-white text-black text-[14px] font-bold tracking-[-0.01em] hover:bg-white/90 transition-colors self-start md:self-end"
                  >
                    {t('points.connect_wallet')}
                  </button>
                ) : !isLoading && (
                  <div className="flex gap-8 md:gap-12 flex-wrap">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-1">
                        {t('points.rate')}
                      </div>
                      <div className="text-[28px] font-black font-mono tabular-nums text-green-400">
                        +{formatPoints(totalPointsPerHour)}
                        <span className="text-[13px] font-semibold text-white/30 ml-1">{t('points.per_hour')}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-1">
                        {t('points.batches')}
                      </div>
                      <div className="text-[28px] font-black font-mono tabular-nums">
                        {activeBatches}
                        <span className="text-[13px] font-semibold text-white/30 ml-1">/ {totalBatches}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-1">
                        {t('points.coverage')}
                      </div>
                      <div className="text-[28px] font-black font-mono tabular-nums">
                        {coveragePercent}%
                      </div>
                    </div>
                    {roundsCompleted > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-1">
                          {t('points.rounds')}
                        </div>
                        <div className="text-[28px] font-black font-mono tabular-nums">
                          {roundsCompleted}
                          <span className="text-[13px] font-semibold text-white/30 ml-1">({formatPoints(roundPoints)} {t('points.pts')})</span>
                        </div>
                      </div>
                    )}
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
                    title: t('points.how_step_01_title'),
                    desc: t('points.how_step_01_desc', { totalBatches, dailyEmission: formatPoints(dailyEmission) }),
                  },
                  {
                    step: '02',
                    title: t('points.how_step_02_title'),
                    desc: t('points.how_step_02_desc'),
                  },
                  {
                    step: '03',
                    title: t('points.how_step_03_title'),
                    desc: t('points.how_step_03_desc'),
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
                {t('points.daily_title')}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 border border-border-light">
                <div className="p-4 border-r border-border-light">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{t('points.daily_per_tick')}</div>
                  <div className="text-[22px] font-black text-black font-mono">100</div>
                </div>
                <div className="p-4 border-r border-border-light">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{t('points.daily_sources')}</div>
                  <div className="text-[22px] font-black text-black font-mono">{totalBatches}</div>
                </div>
                <div className="p-4 border-r border-border-light">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{t('points.daily_markets')}</div>
                  <div className="text-[22px] font-black text-black font-mono">{totalMarkets.toLocaleString()}</div>
                </div>
                <div className="p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{t('points.daily_total')}</div>
                  <div className="text-[22px] font-black text-black font-mono">~{formatPoints(dailyEmission)}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border-light p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">{t('points.daily_vision_label')}</div>
                  <p className="text-[13px] text-text-secondary leading-relaxed">
                    {t('points.daily_vision_desc', { totalBatches, totalMarkets: totalMarkets.toLocaleString() })}
                  </p>
                </div>
                <div className="border border-border-light p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">{t('points.daily_index_label')}</div>
                  <p className="text-[13px] text-text-secondary leading-relaxed">
                    {t('points.daily_index_desc')}
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
                      {t('points.positions_title')}
                    </h2>
                    {batches.length > 0 && (
                      <p className="text-[12px] text-text-muted mt-0.5">
                        {t('points.positions_earning', { count: activeBatches, plural: activeBatches !== 1 ? 'es' : '', points: formatPoints(totalPointsPerTick) })}
                      </p>
                    )}
                  </div>
                  {batches.length > 0 && totalBatches > activeBatches && (
                    <Link
                      href="/"
                      className="text-[12px] font-bold text-black border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
                    >
                      {t('points.positions_join_more', { count: totalBatches - activeBatches })}
                    </Link>
                  )}
                </div>

                {/* Empty state */}
                {!isLoading && batches.length === 0 && (
                  <div className="border border-border-light bg-surface/50 px-6 py-10 text-center">
                    <p className="text-[15px] font-bold text-black mb-1">{t('points.positions_empty_title')}</p>
                    <p className="text-[13px] text-text-secondary mb-4">
                      {t('points.positions_empty_desc')}
                    </p>
                    <Link
                      href="/"
                      className="inline-block px-5 py-2.5 bg-black text-white text-[13px] font-bold hover:bg-zinc-800 transition-colors"
                    >
                      {t('points.positions_browse')}
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
                            <th className="text-left py-2.5 px-4">{t('points.table_batch')}</th>
                            <th className="text-right py-2.5 px-4">{t('points.table_your_stake')}</th>
                            <th className="text-right py-2.5 px-4">{t('points.table_pool_tvl')}</th>
                            <th className="text-right py-2.5 px-4">{t('points.table_your_share')}</th>
                            <th className="text-right py-2.5 px-4">{t('points.table_pts_tick')}</th>
                            <th className="text-right py-2.5 px-4">{t('points.table_pts_hour')}</th>
                            <th className="text-right py-2.5 px-4">{t('points.table_est_total')}</th>
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
                              {t('points.table_total')}
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
                          {t('points.previous')}
                        </button>
                        <span className="text-[11px] text-text-muted">
                          {t('points.page_of', { page: positionsPage, total: positionsTotalPages })}
                        </span>
                        <button
                          onClick={() => setPositionsPage(p => Math.min(positionsTotalPages, p + 1))}
                          disabled={positionsPage === positionsTotalPages}
                          className="text-[11px] font-semibold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          {t('points.next')}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════ ROUND POINTS ═══════════════════ */}
        {isConnected && roundsCompleted > 0 && (
          <section className="border-b border-border-light">
            <div className="px-6 lg:px-12">
              <div className="max-w-site mx-auto py-8">
                <h2 className="text-[20px] font-black tracking-[-0.01em] text-black mb-4">
                  {t('points.round_points_title')}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 border border-border-light">
                  <div className="p-4 border-r border-border-light">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{t('points.rounds_completed')}</div>
                    <div className="text-[22px] font-black text-black font-mono">{roundsCompleted}</div>
                  </div>
                  <div className="p-4 border-r border-border-light md:border-r">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{t('points.points_from_rounds')}</div>
                    <div className="text-[22px] font-black text-green-600 font-mono">{formatPoints(roundPoints)}</div>
                  </div>
                  <div className="p-4 col-span-2 md:col-span-1 border-t md:border-t-0 border-border-light">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{t('points.points_per_round')}</div>
                    <div className="text-[22px] font-black text-black font-mono">100</div>
                  </div>
                </div>
                <p className="text-[12px] text-text-muted mt-3">
                  {t('points.round_explain')}
                </p>
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
                    {t('points.leaderboard_title')}
                  </h2>
                  <p className="text-[12px] text-text-muted mt-0.5">
                    {lbLoading ? t('points.leaderboard_loading') : t('points.leaderboard_players', { count: leaderboard.length })}
                  </p>
                </div>
              </div>

              <div className="border border-border-light overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-medium bg-surface/50 text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">
                      <th className="text-left py-2.5 px-4 w-12">{t('points.rank')}</th>
                      <th className="text-left py-2.5 px-4">{t('points.player')}</th>
                      <th className="text-right py-2.5 px-4">{t('points.volume')}</th>
                      <th className="text-right py-2.5 px-4">{t('points.rounds')}</th>
                      <th className="text-right py-2.5 px-4">{t('points.win_pct')}</th>
                      <th className="text-right py-2.5 px-4">{t('points.correct_pct')}</th>
                      <th className="text-right py-2.5 px-4">{t('points.roi')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lbLoading && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-[13px] text-text-muted">
                          {t('points.leaderboard_loading_table')}
                        </td>
                      </tr>
                    )}

                    {!lbLoading && leaderboard.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-[13px] text-text-muted">
                          {t('points.leaderboard_empty')}
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
                                  {t('points.you')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-black">
                            {formatUsd(entry.totalVolume)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-text-secondary">
                            {entry.roundsPlayed}
                          </td>
                          <td className={`py-3 px-4 text-right font-mono tabular-nums ${entry.winRate > 50 ? 'text-green-600' : 'text-text-secondary'}`}>
                            {entry.winRate.toFixed(1)}%
                          </td>
                          <td className={`py-3 px-4 text-right font-mono tabular-nums ${entry.avgCorrectPct > 50 ? 'text-green-600' : 'text-text-secondary'}`}>
                            {entry.avgCorrectPct.toFixed(1)}%
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
                    {t('points.previous')}
                  </button>
                  <span className="text-[11px] text-text-muted">
                    {t('points.page_of', { page: leaderboardPage, total: leaderboardTotalPages })}
                  </span>
                  <button
                    onClick={() => setLeaderboardPage(p => Math.min(leaderboardTotalPages, p + 1))}
                    disabled={leaderboardPage === leaderboardTotalPages}
                    className="text-[11px] font-semibold text-text-muted hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('points.next')}
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
