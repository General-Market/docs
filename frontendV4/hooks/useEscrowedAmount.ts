'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { getBackendUrl } from '@/lib/contracts/addresses'
import { formatUsdcAmount, toBaseUnits } from '@/lib/utils/formatters'
import type { BetRecord, BetStatus } from '@/hooks/useBetHistory'

interface UseEscrowedAmountReturn {
  /** Total escrowed amount in base units (6 decimals) */
  escrowed: bigint
  /** Formatted escrowed amount string (e.g., "1,234.56") */
  formatted: string
  /** Whether the escrowed amount is currently loading */
  isLoading: boolean
}

/**
 * Statuses considered as having escrowed funds
 * Story 14-1: Only pending bets have escrowed (unmatched) funds
 */
const ESCROWED_STATUSES: BetStatus[] = ['pending']

/**
 * Hook to calculate total escrowed amount from active bets
 * Auto-refreshes every 5 seconds
 * @returns Escrowed amount data and loading state
 */
export function useEscrowedAmount(): UseEscrowedAmountReturn {
  const { address, isConnected } = useAccount()

  const { data: bets, isLoading } = useQuery({
    queryKey: ['bets', 'user', address],
    queryFn: async (): Promise<BetRecord[]> => {
      if (!address) return []

      const backendUrl = getBackendUrl() // Throws if not configured

      const response = await fetch(`${backendUrl}/api/bets/user/${address}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch user bets: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      // Handle both raw array and wrapped responses (e.g., { bets: [...] } or { data: [...] })
      if (Array.isArray(data)) {
        return data
      }
      if (data && Array.isArray(data.bets)) {
        return data.bets
      }
      if (data && Array.isArray(data.data)) {
        return data.data
      }
      return []
    },
    enabled: isConnected && !!address,
    refetchInterval: 5000,
    staleTime: 3000
  })

  // Calculate escrowed: sum of remainingAmount for active bets
  const escrowed = calculateEscrowed(bets)

  // Format to display string using shared utility
  const formatted = formatUsdcAmount(escrowed)

  return {
    escrowed,
    formatted,
    isLoading
  }
}

/**
 * Calculates total escrowed amount from bet records
 * @param bets - Array of bet records
 * @returns Total escrowed amount in base units
 */
function calculateEscrowed(bets: BetRecord[] | undefined): bigint {
  if (!bets || !Array.isArray(bets) || bets.length === 0) {
    return BigInt(0)
  }

  return bets.reduce((sum: bigint, bet: BetRecord) => {
    if (ESCROWED_STATUSES.includes(bet.status)) {
      // Story 14-1: Single-filler model — pending bets have full amount escrowed
      return sum + toBaseUnits(bet.amount)
    }
    return sum
  }, BigInt(0))
}
