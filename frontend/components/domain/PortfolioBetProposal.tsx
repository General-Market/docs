'use client'

//
// @deprecated SCHEDULED FOR REMOVAL
// TODO: Bet placement disabled - AI agents only
// See: architecture-change-asymmetric-odds.md
//
// This component was previously used for user bet placement.
// It is now disabled because all trading on AgiArena is performed
// by autonomous AI trading bots. The frontend is DISPLAY ONLY.
//
// Original functionality:
// - USDC approval flow
// - Bet placement transaction
// - Portfolio JSON upload to backend
//
// This stub is preserved for backwards compatibility in case any
// code still references it, but it will always show a disabled state.
//
// DEPRECATION NOTE: This file should be deleted in a future cleanup
// sprint if it's confirmed to be unused. (Added: 2026-01-24)
//

import { useState } from 'react'
import { PortfolioModal, PortfolioPosition } from './PortfolioModal'
import { formatUSD, formatNumber } from '@/lib/utils/formatters'

export interface PortfolioBetProposalData {
  portfolioJson: string
  positions: PortfolioPosition[]
  totalAmount: bigint // USDC amount (6 decimals)
  reasoning: string
}

interface PortfolioBetProposalProps {
  proposal: PortfolioBetProposalData
  onBetPlaced?: (txHash: string, betId: bigint) => void
}

/**
 * DEPRECATED: Bet placement component
 *
 * This component is disabled. All trading on AgiArena is performed
 * by autonomous AI agents, not via user-facing UI.
 *
 * See: architecture-change-asymmetric-odds.md
 */
export function PortfolioBetProposal({ proposal, onBetPlaced: _onBetPlaced }: PortfolioBetProposalProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Get top 10 positions for preview
  const positions = proposal.positions ?? []
  const top10Positions = positions.slice(0, 10)
  const portfolioSize = positions.length

  return (
    <div className="bg-black border border-white/20 p-6 font-mono">
      {/* Bot Trading Notice Banner */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-medium text-white">AI-Powered Trading Only</h3>
            <p className="text-sm text-gray-400">
              All bets on AgiArena are placed by autonomous AI trading agents.
              Manual bet placement is not available.
            </p>
          </div>
        </div>
      </div>

      {/* Portfolio Summary (Read-Only) */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white mb-4">Portfolio Preview</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-white/60 uppercase">Portfolio Size</p>
            <p className="text-xl font-bold text-white">
              {formatNumber(portfolioSize)} markets
            </p>
          </div>
          <div>
            <p className="text-xs text-white/60 uppercase">Total Amount</p>
            <p className="text-xl font-bold text-accent">
              {formatUSD(proposal.totalAmount)} USDC
            </p>
          </div>
        </div>
      </div>

      {/* Top 10 Preview */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm text-white/80">Top 10 Markets</h4>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-black border border-white text-white hover:bg-white hover:text-black transition-colors text-sm"
          >
            View Full Portfolio
          </button>
        </div>

        <div className="border border-white/10 divide-y divide-white/10">
          {top10Positions.map((position, index) => (
            <div
              key={`${position.marketId}-${index}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-white/5"
            >
              <div className="flex-1 min-w-0 mr-4">
                <a
                  href={`https://polymarket.com/event/${position.marketId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white hover:text-accent truncate block"
                  title={position.marketTitle}
                >
                  {position.marketTitle}
                </a>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`
                    px-2 py-1 text-xs font-bold
                    ${position.position === 'YES'
                      ? 'bg-white text-black'
                      : 'bg-accent text-white'
                    }
                  `}
                >
                  {position.position}
                </span>
                <span className="text-sm text-white/80 w-14 text-right">
                  {(position.currentPrice * 100).toFixed(1)}%
                </span>
                {position.confidence !== undefined && (
                  <span className="text-xs text-white/60 w-10 text-right">
                    {(position.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bet Reasoning */}
      <div className="mb-6">
        <h4 className="text-sm text-white/80 mb-2">Analysis Summary</h4>
        <p className="text-sm text-white/70 leading-relaxed">{proposal.reasoning}</p>
      </div>

      {/* Disabled Button with Explanation */}
      {/* TODO: Bet placement disabled - AI agents only (see architecture-change-asymmetric-odds.md) */}
      <button
        disabled
        className="w-full px-6 py-3 bg-gray-700 text-gray-400 font-mono cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Bet Placement Disabled
      </button>

      <p className="mt-3 text-xs text-white/40 text-center">
        This platform displays AI agent trading activity only.
        <a
          href="/docs"
          className="text-cyan-400 hover:text-cyan-300 ml-1"
        >
          Learn more about AI agents →
        </a>
      </p>

      {/* Portfolio Modal (Read-Only) */}
      <PortfolioModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        positions={proposal.positions}
        portfolioSize={portfolioSize}
      />
    </div>
  )
}
