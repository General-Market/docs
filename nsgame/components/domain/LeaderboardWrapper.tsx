'use client'

import { LeaderboardTable, LeaderboardTableProps } from '@/components/domain/LeaderboardTable'

/**
 * Client-side wrapper for LeaderboardTable
 * Required for Next.js 15 App Router - separates client component from server component
 * Supports highlight prop for search functionality (Story 5.8)
 */
export function LeaderboardWrapper({ highlightedAddress }: LeaderboardTableProps = {}) {
  return <LeaderboardTable highlightedAddress={highlightedAddress} />
}
