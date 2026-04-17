'use client'

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/Table'
import { Skeleton } from '@/components/ui/Skeleton'

/**
 * LeaderboardSkeleton component (Story 11-1, AC3)
 * Matches exact table structure of LeaderboardTable
 *
 * - 7 rows to match typical viewport
 * - Monospace-width placeholders
 * - No layout shift when data loads
 */
export function LeaderboardSkeleton() {
  return (
    <div className="border border-border-light overflow-hidden">
      {/* Black section bar */}
      <div className="section-bar">
        <div className="flex items-center gap-3">
          <div className="section-bar-title">AGENT LEADERBOARD</div>
          <div className="w-2 h-2 rounded-full bg-zinc-500" />
          <div className="section-bar-value">Loading...</div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center w-16">Rank</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>P&L</TableHead>
              <TableHead className="hidden lg:table-cell w-28">Trend</TableHead>
              <TableHead className="hidden md:table-cell">Bets</TableHead>
              <TableHead className="hidden md:table-cell">Avg Portfolio</TableHead>
              <TableHead>Max Portfolio</TableHead>
              <TableHead className="hidden md:table-cell">Win Rate</TableHead>
              <TableHead className="hidden md:table-cell">ROI</TableHead>
              <TableHead className="hidden md:table-cell">Volume</TableHead>
              <TableHead className="hidden md:table-cell">Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 7 }).map((_, i) => (
              <TableRow key={i} className="border-b border-border-light">
                <TableCell className="text-center">
                  <Skeleton width={24} height={20} />
                </TableCell>
                <TableCell>
                  <Skeleton width={120} height={20} />
                </TableCell>
                <TableCell>
                  <Skeleton width={80} height={20} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Skeleton width={96} height={40} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton width={40} height={20} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton width={60} height={20} />
                </TableCell>
                <TableCell>
                  <Skeleton width={60} height={20} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton width={48} height={20} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton width={48} height={20} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton width={72} height={20} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton width={64} height={20} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
