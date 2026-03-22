'use client'

import { useState } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { useTranslations } from 'next-intl'
import { indexL3 } from '@/lib/wagmi'
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
  const { leaderboard, isLoading: lbLoading } = useVisionLeaderboard()
  const { data: allBatches } = useBatches()

  const totalBatches = allBatches?.length ?? 0
  const totalMarkets = allBatches?.reduce((s, b) => s + b.marketCount, 0) ?? 0

  const ROWS_PER_PAGE = 10

  const [leaderboardPage, setLeaderboardPage] = useState(1)
  const leaderboardTotalPages = Math.max(1, Math.ceil(leaderboard.length / ROWS_PER_PAGE))
  const paginatedLeaderboard = leaderboard.slice((leaderboardPage - 1) * ROWS_PER_PAGE, leaderboardPage * ROWS_PER_PAGE)

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      <div className="flex-1">
        {/* HERO */}
        <section className="bg-black text-white">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-16 md:py-20">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/40 mb-3">
                    {t('points.season')}
                  </div>
                  <h1 className="text-[52px] md:text-[64px] font-black tracking-[-0.03em] leading-[1] mb-3">
                    {t('points.title')}
                  </h1>
                  <p className="text-[15px] text-white/50 max-w-md">
                    {t('points.earn_description')}
                  </p>
                </div>

                {!isConnected ? (
                  <button
                    onClick={handleConnect}
                    className="px-8 py-3.5 bg-white text-black text-[14px] font-bold tracking-[-0.01em] hover:bg-white/90 transition-colors self-start md:self-end"
                  >
                    {t('points.connect_wallet')}
                  </button>
                ) : (
                  <div className="flex gap-8 md:gap-12 flex-wrap">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-1">
                        {t('points.batches')}
                      </div>
                      <div className="text-[28px] font-black font-mono tabular-nums">
                        {totalBatches}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-1">
                        Markets
                      </div>
                      <div className="text-[28px] font-black font-mono tabular-nums">
                        {totalMarkets.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-b border-border-light">
          <div className="px-6 lg:px-12">
            <div className="max-w-site mx-auto py-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-0">
                {[
                  {
                    step: '01',
                    title: t('points.how_step_01_title'),
                    desc: t('points.how_step_01_desc', { totalBatches, dailyEmission: '0' }),
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

        {/* LEADERBOARD */}
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
