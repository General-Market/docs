'use client'

import { use } from 'react'
import { useTranslations } from 'next-intl'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { HeroBand } from '@/components/ui/HeroBand'
import { SectionBar } from '@/components/ui/SectionBar'
import { PerformanceGraphMini } from '@/components/domain/PerformanceGraphMini'
import { useAgentDetail } from '@/hooks/useAgentDetail'
import { useAgentBets } from '@/hooks/useAgentBets'
import { truncateAddress } from '@/lib/utils/address'
import { formatROI, formatVolume } from '@/lib/utils/formatters'
import { formatRelativeTime } from '@/lib/utils/time'

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="py-3 px-4">
      <div className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">{label}</div>
      <div className={`text-heading font-bold font-mono tabular-nums ${color || 'text-black'}`}>{value}</div>
    </div>
  )
}

export default function AgentPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params)
  const t = useTranslations('pages.agent')
  const { agent, isLoading, isError } = useAgentDetail(address)
  const { bets, isLoading: betsLoading } = useAgentBets(address, 20)

  const displayName = agent?.displayName || truncateAddress(address)
  const roiColor = (agent?.roi ?? 0) >= 0 ? 'text-color-up' : 'text-color-down'
  const pnlColor = (agent?.pnl ?? 0) >= 0 ? 'text-color-up' : 'text-color-down'

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      <HeroBand
        eyebrow={t('rank', { rank: String(agent?.rank ?? '\u2014') })}
        title={displayName}
        subtitle={address}
      />

      <div className="px-6 lg:px-12">
      <div className="max-w-site mx-auto w-full pb-16">
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="text-sm text-text-muted animate-pulse">{t('loading')}</div>
          </div>
        ) : isError || !agent ? (
          <div className="py-12 text-center">
            <div className="text-sm text-text-muted">{t('no_data')}</div>
          </div>
        ) : (
          <>
            {/* Performance Overview */}
            <SectionBar title={t('performance')} />
            <div className="grid grid-cols-2 md:grid-cols-4 border border-border-light">
              <StatCard label={t('roi')} value={formatROI(agent.roi)} color={roiColor} />
              <div className="border-l border-border-light">
                <StatCard label={t('pnl')} value={`${agent.pnl >= 0 ? '+' : ''}$${Math.abs(agent.pnl).toFixed(2)}`} color={pnlColor} />
              </div>
              <div className="border-l border-border-light">
                <StatCard label={t('volume')} value={formatVolume(agent.volume)} />
              </div>
              <div className="border-l border-border-light">
                <StatCard label={t('win_rate')} value={`${agent.winRate.toFixed(1)}%`} />
              </div>
            </div>

            {/* Trend Chart */}
            <div className="mt-6 border border-border-light p-6">
              <div className="text-label font-semibold uppercase tracking-[0.08em] text-text-muted mb-3">{t('performance_trend')}</div>
              <div className="h-32">
                <PerformanceGraphMini walletAddress={address} height={128} />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="mt-8">
              <SectionBar title={t('stats')} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 border border-border-light">
              <StatCard label={t('total_bets')} value={agent.totalBets.toLocaleString()} />
              <div className="border-l border-border-light">
                <StatCard label={t('avg_portfolio')} value={`${agent.avgPortfolioSize.toLocaleString()} ${t('mkts')}`} />
              </div>
              <div className="border-l border-border-light">
                <StatCard label={t('max_portfolio')} value={`${agent.maxPortfolioSize.toLocaleString()} ${t('mkts')}`} />
              </div>
              <div className="border-l border-border-light">
                <StatCard label={t('avg_bet_size')} value={`$${agent.avgBetSize.toFixed(2)}`} />
              </div>
            </div>

            <div className="grid grid-cols-2 border border-t-0 border-border-light">
              <StatCard label={t('best_bet')} value={`+$${agent.bestBet.result.toFixed(2)}`} color="text-color-up" />
              <div className="border-l border-border-light">
                <StatCard label={t('worst_bet')} value={`$${agent.worstBet.result.toFixed(2)}`} color="text-color-down" />
              </div>
            </div>

            {/* Recent Bets */}
            <div className="mt-8">
              <SectionBar title={t('recent_bets')} value={`${bets.length}`} />
            </div>
            <div className="border border-border-light overflow-x-auto">
              {betsLoading ? (
                <div className="py-8 text-center text-sm text-text-muted animate-pulse">{t('loading_bets')}</div>
              ) : bets.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-muted">{t('no_bets')}</div>
              ) : (
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-surface border-b border-border-light">
                    <tr>
                      <th className="px-3 py-2.5 text-micro font-semibold uppercase tracking-[0.08em] text-text-secondary text-left">{t('col_bet')}</th>
                      <th className="px-3 py-2.5 text-micro font-semibold uppercase tracking-[0.08em] text-text-secondary text-right">{t('col_markets')}</th>
                      <th className="px-3 py-2.5 text-micro font-semibold uppercase tracking-[0.08em] text-text-secondary text-right">{t('col_amount')}</th>
                      <th className="px-3 py-2.5 text-micro font-semibold uppercase tracking-[0.08em] text-text-secondary text-right">{t('col_result')}</th>
                      <th className="px-3 py-2.5 text-micro font-semibold uppercase tracking-[0.08em] text-text-secondary text-left">{t('col_status')}</th>
                      <th className="px-3 py-2.5 text-micro font-semibold uppercase tracking-[0.08em] text-text-secondary text-right">{t('col_date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bets.map((bet) => (
                      <tr key={bet.betId} className="border-b border-border-light hover:bg-surface transition-colors">
                        <td className="px-3 py-2.5 font-mono text-xs text-text-muted">#{bet.betId}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">{bet.portfolioSize}</td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums">${bet.amount.toFixed(2)}</td>
                        <td className={`px-3 py-2.5 text-right font-mono tabular-nums font-bold ${bet.result >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                          {bet.result >= 0 ? '+' : ''}${bet.result.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            bet.status === 'settled' ? (bet.outcome === 'won' ? 'bg-surface-up text-color-up' : 'bg-surface-down text-color-down')
                            : bet.status === 'matched' ? 'bg-surface-info text-color-info'
                            : 'bg-surface text-text-muted'
                          }`}>
                            {bet.outcome || bet.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-text-muted text-xs">
                          {formatRelativeTime(bet.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Last Active */}
            {agent.lastActiveAt && (
              <div className="mt-4 text-xs text-text-muted">
                {t('last_active', { time: formatRelativeTime(agent.lastActiveAt) })}
              </div>
            )}
          </>
        )}
      </div>
      </div>

      <div className="flex-1" />
      <Footer />
    </main>
  )
}
