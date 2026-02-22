'use client'

import { useTranslations } from 'next-intl'
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
        <div key={i} className="flex items-center gap-4 p-4 border-b border-border-light">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
        </div>
      ))}
    </div>
  )
}

/**
 * Empty state when no bets exist
 */
function EmptyState() {
  const t = useTranslations('common')
  return (
    <div className="p-8 text-center">
      <p className="text-text-muted">{t('empty.no_bets')}</p>
      <p className="text-text-muted text-sm mt-1">
        {t('empty.no_bets_hint')}
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
  const t = useTranslations('p2pool')
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
          <TableHead>{t('bets_table.bet_id')}</TableHead>
          <TableHead>{t('bets_table.markets')}</TableHead>
          <TableHead>{t('bets_table.amount')}</TableHead>
          <TableHead>{t('bets_table.result')}</TableHead>
          <TableHead>{t('bets_table.status')}</TableHead>
          <TableHead>{t('bets_table.date')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bets.map((bet) => {
          const resultColor = bet.result >= 0 ? 'text-color-up' : 'text-text-muted'
          // Display outcome for settled bets, otherwise show status
          const displayStatus = bet.status === 'settled' && bet.outcome ? bet.outcome : bet.status

          return (
            <TableRow key={bet.betId}>
              <TableCell>
                {/* Bet detail page coming in future story */}
                <span
                  className="text-text-muted font-mono text-sm cursor-default"
                  title={bet.betId}
                >
                  {formatBetId(bet.betId)}
                </span>
              </TableCell>
              <TableCell className="font-mono text-text-secondary">
                {formatPortfolioSize(bet.tradeCount || bet.portfolioSize)}
              </TableCell>
              <TableCell className="font-mono text-text-secondary">
                {formatVolume(bet.amount)}
              </TableCell>
              <TableCell className={`font-mono font-bold ${resultColor}`}>
                {bet.status === 'settled' ? formatPnL(bet.result) : '-'}
              </TableCell>
              <TableCell>
                <StatusBadge status={displayStatus} />
              </TableCell>
              <TableCell className="font-mono text-text-muted text-sm">
                {formatBetDate(bet.createdAt)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
