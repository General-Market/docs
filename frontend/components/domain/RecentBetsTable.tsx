'use client'

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { AgentBet } from '@/hooks/useAgentBets'
import { formatPortfolioSize, formatVolume, formatPnL } from '@/lib/utils/formatters'
import { formatRelativeTime } from '@/lib/utils/time'

interface RecentBetsTableProps {
  /** Array of agent bets to display */
  bets: AgentBet[]
  /** Loading state */
  isLoading?: boolean
}

/**
 * Loading skeleton for bets table
 */
function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b border-white/10">
          <div className="h-4 w-24 bg-white/10 rounded" />
          <div className="h-4 w-16 bg-white/10 rounded" />
          <div className="h-4 w-20 bg-white/10 rounded" />
          <div className="h-4 w-16 bg-white/10 rounded" />
          <div className="h-4 w-16 bg-white/10 rounded" />
          <div className="h-4 w-20 bg-white/10 rounded" />
        </div>
      ))}
    </div>
  )
}

/**
 * Empty state when no bets exist
 */
function EmptyState() {
  return (
    <div className="p-8 text-center">
      <p className="text-white/60 font-mono">No bets yet</p>
      <p className="text-white/40 text-sm font-mono mt-1">
        This agent has not placed any portfolio bets
      </p>
    </div>
  )
}

/**
 * Truncates bet ID for display (0x1234...5678)
 */
function formatBetId(betId: string): string {
  if (!betId || betId.length < 14) return betId
  return `${betId.slice(0, 6)}...${betId.slice(-4)}`
}

/**
 * Formats date for table display
 */
function formatBetDate(isoString: string): string {
  return formatRelativeTime(isoString)
}

/**
 * RecentBetsTable component (AC5)
 * Displays last 10 portfolio bets with columns:
 * - Bet ID (clickable)
 * - Markets (portfolio size)
 * - Amount
 * - Result (+/- P&L)
 * - Status (Matched/Pending/Settled)
 * - Date
 */
export function RecentBetsTable({ bets, isLoading = false }: RecentBetsTableProps) {
  if (isLoading) {
    return <TableSkeleton />
  }

  if (!bets || bets.length === 0) {
    return <EmptyState />
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bet ID</TableHead>
          <TableHead>Markets</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bets.map((bet) => {
          const resultColor = bet.result >= 0 ? 'text-green-400' : 'text-white/60'
          // Display outcome for settled bets, otherwise show status
          const displayStatus = bet.status === 'settled' && bet.outcome ? bet.outcome : bet.status

          return (
            <TableRow key={bet.betId}>
              <TableCell>
                {/* Bet detail page coming in future story */}
                <span
                  className="text-white/60 font-mono text-sm cursor-default"
                  title={bet.betId}
                >
                  {formatBetId(bet.betId)}
                </span>
              </TableCell>
              <TableCell className="font-mono text-white/80">
                {formatPortfolioSize(bet.tradeCount || bet.portfolioSize)}
              </TableCell>
              <TableCell className="font-mono text-white/80">
                {formatVolume(bet.amount)}
              </TableCell>
              <TableCell className={`font-mono font-bold ${resultColor}`}>
                {bet.status === 'settled' ? formatPnL(bet.result) : '-'}
              </TableCell>
              <TableCell>
                <StatusBadge status={displayStatus} />
              </TableCell>
              <TableCell className="font-mono text-white/60 text-sm">
                {formatBetDate(bet.createdAt)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
