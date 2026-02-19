'use client'

import { useQuery } from '@tanstack/react-query'
import { getBackendUrl } from '@/lib/contracts/addresses'
import type {
  BilateralBet,
  BilateralBetStatus,
  ArbitrationInfo,
  BilateralBetsListResponse,
} from '@/lib/types/bilateral-bet'

/**
 * Options for useBilateralBets hook
 */
export interface UseBilateralBetsOptions {
  /** Filter by status */
  status?: BilateralBetStatus
  /** Filter by creator address */
  creator?: string
  /** Filter by filler address */
  filler?: string
  /** Maximum number of results */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /** Whether to enable the query (default: true) */
  enabled?: boolean
}

/**
 * Fetches bilateral bets from backend API
 */
async function fetchBilateralBets(
  options: UseBilateralBetsOptions = {}
): Promise<BilateralBetsListResponse> {
  const backendUrl = getBackendUrl()
  const { status, creator, filler, limit = 50, offset = 0 } = options

  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (creator) params.set('creator', creator)
  if (filler) params.set('filler', filler)
  params.set('limit', limit.toString())
  params.set('offset', offset.toString())

  const response = await fetch(`${backendUrl}/api/bilateral-bets?${params}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch bilateral bets: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Hook for fetching bilateral bets list with filtering and pagination
 * Story 4-2: Bilateral bets from CollateralVault contract
 *
 * @param options - Filter and pagination options
 * @returns Bilateral bets, loading state, and pagination info
 */
export function useBilateralBets(options: UseBilateralBetsOptions = {}) {
  const { enabled = true, ...queryOptions } = options

  return useQuery({
    queryKey: ['bilateral-bets', queryOptions],
    queryFn: () => fetchBilateralBets(queryOptions),
    enabled,
    staleTime: 5000, // Consider data stale after 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds
  })
}

/**
 * Fetches a single bilateral bet by ID
 */
async function fetchBilateralBet(betId: number | string): Promise<BilateralBet> {
  const backendUrl = getBackendUrl()

  const response = await fetch(`${backendUrl}/api/bilateral-bets/${betId}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Bilateral bet not found')
    }
    throw new Error(`Failed to fetch bilateral bet: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Hook for fetching a single bilateral bet by ID
 * Story 4-2: Bilateral bet details from CollateralVault
 *
 * @param betId - The bet ID to fetch
 * @returns Bilateral bet details, loading state, and error
 */
export function useBilateralBet(betId: number | string | undefined) {
  return useQuery({
    queryKey: ['bilateral-bet', betId],
    queryFn: () => fetchBilateralBet(betId!),
    enabled: !!betId,
    staleTime: 5000,
  })
}

/**
 * Fetches bilateral bets for a specific user address
 */
async function fetchUserBilateralBets(
  address: string,
  options: Omit<UseBilateralBetsOptions, 'creator' | 'filler'> = {}
): Promise<BilateralBetsListResponse> {
  const backendUrl = getBackendUrl()
  const { status, limit = 50, offset = 0 } = options

  const params = new URLSearchParams()
  if (status) params.set('status', status)
  params.set('limit', limit.toString())
  params.set('offset', offset.toString())

  const response = await fetch(`${backendUrl}/api/bilateral-bets/user/${address}?${params}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch user bilateral bets: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Hook for fetching a user's bilateral bets (as creator or filler)
 * Story 4-2: User's bilateral bets from CollateralVault
 *
 * @param address - User's wallet address
 * @param options - Filter and pagination options
 * @returns User's bilateral bets, loading state, and pagination info
 */
export function useUserBilateralBets(
  address: string | undefined,
  options: Omit<UseBilateralBetsOptions, 'creator' | 'filler'> = {}
) {
  const { enabled = true, ...queryOptions } = options

  return useQuery({
    queryKey: ['user-bilateral-bets', address, queryOptions],
    queryFn: () => fetchUserBilateralBets(address!, queryOptions),
    enabled: enabled && !!address,
    staleTime: 5000,
    refetchInterval: 15000, // Refetch every 15 seconds
  })
}

/**
 * Fetches arbitration status for a bet
 */
async function fetchArbitrationStatus(betId: number | string): Promise<ArbitrationInfo> {
  const backendUrl = getBackendUrl()

  const response = await fetch(`${backendUrl}/api/bilateral-bets/${betId}/arbitration`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No arbitration request found for this bet')
    }
    throw new Error(`Failed to fetch arbitration status: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Hook for fetching arbitration status for a bilateral bet
 * Story 4-2: Arbitration info for disputed bets
 *
 * @param betId - The bet ID to check
 * @param enabled - Whether to enable the query (default: true)
 * @returns Arbitration status, loading state, and error
 */
export function useArbitrationStatus(betId: number | string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['arbitration-status', betId],
    queryFn: () => fetchArbitrationStatus(betId!),
    enabled: enabled && !!betId,
    staleTime: 5000,
    retry: (failureCount, error) => {
      // Don't retry on 404 (no arbitration exists)
      if (error instanceof Error && error.message.includes('not found')) {
        return false
      }
      return failureCount < 3
    },
  })
}
