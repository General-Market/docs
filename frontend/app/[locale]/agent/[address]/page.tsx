'use client'

import { use } from 'react'
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">{label}</div>
      <div className={`text-[18px] font-bold font-mono tabular-nums ${color || 'text-black'}`}>{value}</div>
    </div>
  )
}

export default function AgentPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params)
  const { agent, isLoading, isError } = useAgentDetail(address)
  const { bets, isLoading: betsLoading } = useAgentBets(address, 20)

  const displayName = agent?.displayName || truncateAddress(address)
  const roiColor = (agent?.roi ?? 0) >= 0 ? 'text-color-up' : 'text-color-down'
  const pnlColor = (agent?.pnl ?? 0) >= 0 ? 'text-color-up' : 'text-color-down'

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      <HeroBand
        eyebrow={`Rank #${agent?.rank ?? '—'}`}
        title={displayName}
        subtitle={address}
      />

      <div className="max-w-site mx-auto w-full px-6 lg:px-12 pb-16">
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="text-sm text-text-muted animate-pulse">Loading agent data...</div>
          </div>
        ) : isError || !agent ? (
          <div className="py-12 text-center">
            <div className="text-sm text-text-muted">No data found for this agent. They may not have placed any bets yet.</div>
          </div>
        ) : (
          <>
            {/* Performance Overview */}
            <SectionBar title="Performance" />
            <div className="grid grid-cols-2 md:grid-cols-4 border border-border-light">
              <StatCard label="ROI" value={formatROI(agent.roi)} color={roiColor} />
              <div className="border-l border-border-light">
                <StatCard label="P&L" value={`${agent.pnl >= 0 ? '+' : ''}$${Math.abs(agent.pnl).toFixed(2)}`} color={pnlColor} />
              </div>
              <div className="border-l border-border-light">
                <StatCard label="Volume" value={formatVolume(agent.volume)} />
              </div>
              <div className="border-l border-border-light">
                <StatCard label="Win Rate" value={`${agent.winRate.toFixed(1)}%`} />
              </div>
            </div>

            {/* Trend Chart */}
            <div className="mt-6 border border-border-light p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-3">Performance Trend</div>
              <div className="h-32">
                <PerformanceGraphMini walletAddress={address} height={128} />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="mt-8">
              <SectionBar title="Stats" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 border border-border-light">
              <StatCard label="Total Bets" value={agent.totalBets.toLocaleString()} />
              <div className="border-l border-border-light">
                <StatCard label="Avg Portfolio" value={`${agent.avgPortfolioSize.toLocaleString()} mkts`} />
              </div>
              <div className="border-l border-border-light">
                <StatCard label="Max Portfolio" value={`${agent.maxPortfolioSize.toLocaleString()} mkts`} />
              </div>
              <div className="border-l border-border-light">
                <StatCard label="Avg Bet Size" value={`$${agent.avgBetSize.toFixed(2)}`} />
              </div>
            </div>

            <div className="grid grid-cols-2 border border-t-0 border-border-light">
              <StatCard label="Best Bet" value={`+$${agent.bestBet.result.toFixed(2)}`} color="text-color-up" />
              <div className="border-l border-border-light">
                <StatCard label="Worst Bet" value={`$${agent.worstBet.result.toFixed(2)}`} color="text-color-down" />
              </div>
            </div>

            {/* Recent Bets */}
            <div className="mt-8">
              <SectionBar title="Recent Bets" value={`${bets.length}`} />
            </div>
            <div className="border border-border-light overflow-x-auto">
              {betsLoading ? (
                <div className="py-8 text-center text-sm text-text-muted animate-pulse">Loading bets...</div>
              ) : bets.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-muted">No bets found</div>
              ) : (
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-surface border-b border-border-light">
                    <tr>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary text-left">Bet</th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary text-right">Markets</th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary text-right">Amount</th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary text-right">Result</th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary text-left">Status</th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary text-right">Date</th>
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
                Last active {formatRelativeTime(agent.lastActiveAt)}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex-1" />
      <Footer />
    </main>
  )
}
