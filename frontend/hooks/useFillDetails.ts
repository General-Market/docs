'use client'

import { useOrderStatus } from './useOrderStatus'

interface FillDetails {
  fillPrice: bigint
  fillAmount: bigint
  cycleNumber: bigint
}

interface UseFillDetailsReturn {
  fill: FillDetails | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Fetches FillConfirmed data for a specific order.
 * Now delegates to useOrderStatus which includes fill data from the backend.
 */
export function useFillDetails(orderId: bigint | null): UseFillDetailsReturn {
  const { fill, isLoading, error, refresh } = useOrderStatus(orderId)
  return { fill, isLoading, error, refresh }
}
