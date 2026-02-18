'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useCallback } from 'react'
import { getBackendUrl } from '@/lib/contracts/addresses'
import type {
  SignatureStatus,
  SignatureStatusResponse,
  SignatureCollectedEvent,
  ResolutionSubmittedEvent,
} from '@/lib/types/resolution'

/**
 * Return type for useResolutionSignatures hook
 */
export interface UseResolutionSignaturesReturn {
  /** Signature collection status data */
  data: SignatureStatus | null
  /** Whether the query is loading */
  isLoading: boolean
  /** Error if any */
  error: Error | null
  /** Whether polling is active */
  isPolling: boolean
  /** Refetch the data */
  refetch: () => void
}

/** Polling interval when actively collecting (5 seconds) */
const COLLECTING_POLL_INTERVAL = 5000

/** Polling interval when not collecting (30 seconds) */
const IDLE_POLL_INTERVAL = 30000

/**
 * Fetch signature status from backend
 */
async function fetchSignatureStatus(betId: number): Promise<SignatureStatus | null> {
  const backendUrl = getBackendUrl()
  const response = await fetch(`${backendUrl}/api/resolution-signatures/${betId}`)

  if (!response.ok) {
    if (response.status === 404) {
      // No signature collection in progress for this bet
      return null
    }
    throw new Error(`Failed to fetch signature status: ${response.statusText}`)
  }

  const data: SignatureStatusResponse = await response.json()

  if (!data.success || !data.data) {
    return null
  }

  return data.data
}

/**
 * Hook for fetching and polling resolution signature status
 *
 * Story 14.3, Task 8: API integration for signature status
 *
 * Features:
 * - Polls every 5s when actively collecting signatures
 * - Polls every 30s when idle
 * - Stops polling when status is 'submitted' or 'expired'
 * - Integrates with TanStack Query for caching
 *
 * @param betId - The bet ID to fetch signature status for
 * @param enabled - Whether to enable the query (default: true)
 * @returns Signature status and query state
 */
export function useResolutionSignatures(
  betId: number,
  enabled: boolean = true
): UseResolutionSignaturesReturn {
  const queryClient = useQueryClient()

  // Determine refetch interval based on current status
  const getRefetchInterval = useCallback((query: { state: { data?: SignatureStatus | null } }): number | false => {
    const data = query.state.data
    if (!data) {
      // No data yet, use idle polling
      return IDLE_POLL_INTERVAL
    }

    // Stop polling for terminal states
    if (data.status === 'submitted' || data.status === 'expired') {
      return false
    }

    // Poll more frequently when actively collecting
    if (data.status === 'collecting') {
      return COLLECTING_POLL_INTERVAL
    }

    // Ready state - keep polling in case it changes
    return IDLE_POLL_INTERVAL
  }, [])

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<SignatureStatus | null>({
    queryKey: ['resolution-signatures', betId],
    queryFn: () => fetchSignatureStatus(betId),
    enabled: enabled && betId > 0,
    refetchInterval: getRefetchInterval,
    staleTime: COLLECTING_POLL_INTERVAL,
  })

  // Determine if polling is active
  const isPolling = isFetching && data?.status === 'collecting'

  return {
    data: data ?? null,
    isLoading,
    error: error as Error | null,
    isPolling,
    refetch,
  }
}

/**
 * Update signature status in cache from SSE event
 *
 * Used by useBetsSSE to update cache when SSE events are received
 */
export function updateSignatureStatusFromEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  event: SignatureCollectedEvent | ResolutionSubmittedEvent
): void {
  const betId = event.betId

  if (event.type === 'signature-collected') {
    const sseEvent = event as SignatureCollectedEvent
    queryClient.setQueryData<SignatureStatus | null>(
      ['resolution-signatures', betId],
      (oldData) => {
        if (!oldData) {
          // Create initial state from event
          return {
            betId,
            totalKeepers: sseEvent.totalKeepers,
            signedCount: sseEvent.signedCount,
            requiredCount: sseEvent.requiredCount,
            status: 'collecting',
            keepers: [{
              address: sseEvent.keeperAddress,
              status: 'signed',
              signedAt: new Date().toISOString(),
            }],
          }
        }

        // Update existing data
        const updatedKeepers = [...oldData.keepers]
        const keeperIndex = updatedKeepers.findIndex(
          k => k.address.toLowerCase() === sseEvent.keeperAddress.toLowerCase()
        )

        if (keeperIndex >= 0) {
          updatedKeepers[keeperIndex] = {
            ...updatedKeepers[keeperIndex],
            status: 'signed',
            signedAt: new Date().toISOString(),
          }
        } else {
          updatedKeepers.push({
            address: sseEvent.keeperAddress,
            status: 'signed',
            signedAt: new Date().toISOString(),
          })
        }

        return {
          ...oldData,
          signedCount: sseEvent.signedCount,
          totalKeepers: sseEvent.totalKeepers,
          requiredCount: sseEvent.requiredCount,
          keepers: updatedKeepers,
          status: sseEvent.signedCount >= sseEvent.requiredCount ? 'ready' : 'collecting',
        }
      }
    )
  } else if (event.type === 'resolution-submitted') {
    const sseEvent = event as ResolutionSubmittedEvent
    queryClient.setQueryData<SignatureStatus | null>(
      ['resolution-signatures', betId],
      (oldData) => {
        if (!oldData) {
          return {
            betId,
            totalKeepers: sseEvent.signersCount,
            signedCount: sseEvent.signersCount,
            requiredCount: Math.ceil(sseEvent.signersCount * 0.51),
            status: 'submitted',
            keepers: [],
            txHash: sseEvent.txHash,
          }
        }

        return {
          ...oldData,
          status: 'submitted',
          txHash: sseEvent.txHash,
        }
      }
    )
  }
}

/**
 * Invalidate signature status query
 *
 * Forces a refetch of signature status
 */
export function invalidateSignatureStatus(
  queryClient: ReturnType<typeof useQueryClient>,
  betId: number
): void {
  queryClient.invalidateQueries({ queryKey: ['resolution-signatures', betId] })
}
