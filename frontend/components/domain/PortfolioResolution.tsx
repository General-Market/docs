'use client'

import { useAccount } from 'wagmi'
import type { BetRecord } from '@/hooks/useBetHistory'
import { useResolution, formatWinRate, getWinRateColorClass, formatResolutionOutcome } from '@/hooks/useResolution'
import { useBetTrades, formatTradePosition, formatTradePrice } from '@/hooks/useBetTrades'
import { useCategoryById, formatCategoryDisplay } from '@/hooks/useCategories'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { truncateAddress } from '@/lib/utils/address'
import { getAddressUrl, getTxUrl } from '@/lib/utils/basescan'
import { formatUsdcString } from '@/lib/utils/formatters'

interface PortfolioResolutionProps {
  betId: string
  bet: BetRecord
}

/**
 * Settlement details subcomponent
 */
interface SettlementDetailsProps {
  totalPot: string
  platformFee: string
  winnerPayout: string
  settlementTxHash: string | null
  winnerAddress: string | null
  loserAddress: string | null
  creatorWins: boolean | null
}

function SettlementDetails({
  totalPot,
  platformFee,
  winnerPayout,
  settlementTxHash,
  winnerAddress,
  loserAddress,
  creatorWins
}: SettlementDetailsProps) {
  const loserLoss = parseFloat(totalPot) - parseFloat(winnerPayout)

  return (
    <div className="border border-border-medium rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-bold text-text-primary">Settlement Details</h4>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Total Pot</span>
          <span className="font-mono text-text-primary">{formatUsdcString(totalPot)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Platform Fee (0.1%)</span>
          <span className="font-mono text-text-secondary">{formatUsdcString(platformFee)}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-border-light pt-2">
          <span className="text-text-primary font-bold">Winner Payout</span>
          <span className="font-mono text-text-primary font-bold">{formatUsdcString(winnerPayout)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Loser Loss</span>
          <span className="font-mono text-color-down">{formatUsdcString(loserLoss.toFixed(6))}</span>
        </div>
      </div>

      {/* Winner/Loser addresses */}
      {winnerAddress && (
        <div className="pt-2 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted">Winner:</span>
            <a
              href={getAddressUrl(winnerAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-text-primary hover:text-zinc-900 transition-colors"
            >
              {truncateAddress(winnerAddress)}
            </a>
            <span className="text-text-muted font-mono">
              ({creatorWins ? 'Creator' : 'Matcher'})
            </span>
          </div>
          {loserAddress && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted">Loser:</span>
              <a
                href={getAddressUrl(loserAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-text-secondary hover:text-zinc-900 transition-colors"
              >
                {truncateAddress(loserAddress)}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Settlement transaction link */}
      {settlementTxHash && (
        <div className="pt-2">
          <a
            href={getTxUrl(settlementTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-text-muted hover:text-text-primary transition-colors"
          >
            View Settlement Transaction ↗
          </a>
        </div>
      )}
    </div>
  )
}

/**
 * Trade outcomes breakdown component
 */
interface TradesBreakdownProps {
  betId: string
}

function TradesBreakdown({ betId }: TradesBreakdownProps) {
  const { trades, isLoading } = useBetTrades({ betId: parseInt(betId) })

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <span className="text-xs text-text-muted">Loading trades...</span>
      </div>
    )
  }

  if (trades.length === 0) {
    return null
  }

  return (
    <div className="border border-border-light rounded-xl p-3 space-y-2">
      <h4 className="text-sm font-bold text-text-primary">Trade Outcomes</h4>
      <div className="max-h-60 overflow-y-auto space-y-1">
        {trades.map((trade, idx) => (
          <div
            key={`${trade.tradeId}-${idx}`}
            className="flex items-center justify-between text-xs py-1 border-b border-border-light last:border-b-0"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-text-secondary font-mono truncate max-w-[120px]" title={trade.ticker}>
                {trade.ticker}
              </span>
              <span className="text-text-muted font-mono text-[10px] uppercase">
                {trade.source}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-text-muted">
                {formatTradePosition(trade.position, trade.source)}
              </span>
              <span className="font-mono text-text-muted">
                {formatTradePrice(trade.entryPrice, trade.source)}
                {trade.exitPrice && (
                  <>
                    <span className="text-text-muted mx-1">→</span>
                    {formatTradePrice(trade.exitPrice, trade.source)}
                  </>
                )}
              </span>
              <span className={`font-mono font-bold ${
                trade.cancelled ? 'text-gray-500' :
                trade.won === true ? 'text-color-up' :
                trade.won === false ? 'text-color-down' :
                trade.exitPrice ? 'text-color-warning' : 'text-text-muted'
              }`}>
                {trade.cancelled ? '—' : trade.won === true ? '✓' : trade.won === false ? '✗' : trade.exitPrice ? '=' : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Loading skeleton for resolution component
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-16 bg-muted rounded" />
      <div className="h-8 bg-muted rounded w-1/2" />
      <div className="h-24 bg-muted rounded" />
    </div>
  )
}

/**
 * Main PortfolioResolution component
 * Epic 8: Majority-wins resolution (trades won > 50%)
 * Displays win count/rate, trade outcomes, and settlement details
 */
export function PortfolioResolution({ betId, bet }: PortfolioResolutionProps) {
  const { address } = useAccount()
  const { resolution, isLoading } = useResolution({ betId })
  const category = useCategoryById(bet.categoryId)

  if (isLoading) {
    return <LoadingSkeleton />
  }

  // No resolution data yet
  if (!resolution) {
    return (
      <div className="border border-border-light rounded-xl p-4 text-center">
        <p className="text-sm text-text-muted">No resolution data available yet</p>
        <p className="text-xs text-text-muted mt-1">
          Bet has not been resolved
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 border border-border-medium rounded-xl p-4">
      {/* Main Win Count Display */}
      <div className="text-center space-y-2">
        <div>
          <span className="text-xs text-text-muted block mb-1">
            Trades Won
          </span>
          <span className={`text-4xl font-mono font-bold ${getWinRateColorClass(resolution.winsCount, resolution.validTrades)}`}>
            {resolution.winsCount}/{resolution.validTrades}
          </span>
          <span className="text-2xl text-text-muted font-mono ml-2">
            ({resolution.winRate.toFixed(0)}%)
          </span>
        </div>

        {/* Outcome Badge */}
        <div className="pt-2">
          <span className={`px-3 py-1 text-sm font-mono font-bold rounded ${
            resolution.isTie ? 'bg-surface-warning text-color-warning' :
            resolution.isCancelled ? 'bg-muted text-text-muted' :
            resolution.creatorWins ? 'bg-surface-up text-color-up' :
            'bg-surface-down text-color-down'
          }`}>
            {formatResolutionOutcome(resolution)}
          </span>
        </div>
      </div>

      {/* Category Badge */}
      {category && (
        <div className="flex justify-center">
          <span className="px-2 py-1 bg-muted rounded text-sm font-mono">
            {formatCategoryDisplay(category)}
            {bet.listSize && (
              <span className="ml-2 text-text-muted">({bet.listSize})</span>
            )}
          </span>
        </div>
      )}

      {/* Bet Summary */}
      <div className="flex justify-center gap-6 py-3 border-t border-b border-border-light">
        <div className="text-center">
          <span className="text-xs text-text-muted block">List Size</span>
          <span className="text-sm font-mono text-text-primary font-bold">
            {bet.tradeCount || bet.portfolioSize || bet.listSize || '--'} trades
          </span>
        </div>
        <div className="text-center">
          <span className="text-xs text-text-muted block">Bet Amount</span>
          <span className="text-sm font-mono text-text-primary font-bold">
            {formatUsdcString(bet.amount)}
          </span>
        </div>
        {resolution.status === 'resolved' && resolution.winnerAddress && (
          <div className="text-center">
            <span className="text-xs text-text-muted block">Outcome</span>
            {address && resolution.winnerAddress.toLowerCase() === address.toLowerCase() ? (
              <span className="text-sm font-mono text-color-up font-bold">
                Won {formatUsdcString(resolution.winnerPayout)}
              </span>
            ) : (
              <span className="text-sm font-mono text-color-down font-bold">
                Lost {formatUsdcString(bet.amount)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Resolution Status Badge */}
      <div className="flex items-center justify-between">
        <StatusBadge status={resolution.status} />
        {resolution.resolvedAt && (
          <span className="text-xs text-text-muted font-mono">
            Resolved {new Date(resolution.resolvedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Trade Outcomes Breakdown */}
      <TradesBreakdown betId={betId} />

      {/* Settlement Details - shown when resolved */}
      {resolution.status === 'resolved' && (
        <SettlementDetails
          totalPot={resolution.totalPot}
          platformFee={resolution.platformFee}
          winnerPayout={resolution.winnerPayout}
          settlementTxHash={resolution.settlementTxHash}
          winnerAddress={resolution.winnerAddress}
          loserAddress={resolution.loserAddress}
          creatorWins={resolution.creatorWins}
        />
      )}

      {/* Tie/Cancelled Status */}
      {resolution.isTie && (
        <div className="border border-color-warning/30 rounded-xl p-3 text-center">
          <span className="text-sm font-mono text-color-warning">
            Tie - Both parties refunded
          </span>
        </div>
      )}

      {resolution.isCancelled && (
        <div className="border border-border-light rounded-xl p-3 text-center">
          <span className="text-sm font-mono text-text-muted">
            Cancelled: {resolution.cancelReason || 'No reason provided'}
          </span>
        </div>
      )}

      {/* Resolver info */}
      {resolution.resolvedBy && (
        <div className="text-center">
          <span className="text-xs text-text-muted font-mono">
            Resolved by{' '}
            <a
              href={getAddressUrl(resolution.resolvedBy)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              {truncateAddress(resolution.resolvedBy)}
            </a>
          </span>
        </div>
      )}
    </div>
  )
}
