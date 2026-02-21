'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useSSEPositions, useSSEOracle } from './useSSE'
import { fetchMorphoPosition, type MorphoPosition } from '@/lib/api/backend'
import {
  UserPosition,
  MORPHO_CONSTANTS,
  calculateHealthFactor,
  calculateLiquidationPrice,
} from '@/lib/types/morpho'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

interface UseMorphoPositionReturn {
  /** User's position data */
  position: UserPosition | undefined
  /** Raw collateral amount (ITP, 18 decimals) */
  collateralAmount: bigint | undefined
  /** Raw borrow shares */
  borrowShares: bigint | undefined
  /** Oracle price (36 decimals) from SSE */
  oraclePrice: bigint | undefined
  /** Whether data is loading */
  isLoading: boolean
  /** Error if any */
  error: Error | null
  /** Refetch function */
  refetch: () => void
}

function safeBigInt(s: string | undefined): bigint {
  if (!s || s === '') return 0n
  try { return BigInt(s) } catch { return 0n }
}

/**
 * Hook to fetch user's Morpho position.
 *
 * Primary: SSE `user-positions` for raw position data (collateral, borrow_shares).
 * Secondary: REST `/morpho-position` for computed fields (debt_amount, max_borrow,
 * max_withdraw) that require market-level data the SSE doesn't carry yet.
 *
 * Oracle price comes from SSE `oracle-prices` stream.
 */
export function useMorphoPosition(market?: MorphoMarketEntry): UseMorphoPositionReturn {
  const { address } = useAccount()

  // SSE streams — instant updates for raw position + oracle price
  const ssePosition = useSSEPositions()
  const sseOracle = useSSEOracle()

  // REST for computed fields (debt_amount, max_borrow, max_withdraw)
  const [restData, setRestData] = useState<MorphoPosition | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const addressRef = useRef(address)

  useEffect(() => { addressRef.current = address }, [address])

  const lltv = market?.lltv ?? BigInt('770000000000000000')

  const refetch = useCallback(async () => {
    const user = addressRef.current
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      const result = await fetchMorphoPosition(user)
      if (result) {
        setRestData(result)
        setError(null)
      }
    } catch (e: any) {
      if (!restData) setError(new Error(e.message || 'Failed to fetch position'))
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch REST data on mount and when address changes
  useEffect(() => {
    setIsLoading(true)
    setRestData(null)
    refetch()
  }, [address, refetch])

  // Poll REST every 30s for computed fields (reduced from 15s since SSE handles raw data)
  useEffect(() => {
    if (!address) return
    const interval = setInterval(refetch, 30_000)
    return () => clearInterval(interval)
  }, [address, refetch])

  // Prefer SSE for raw position data (instant), fall back to REST
  const collateralAmount = ssePosition
    ? safeBigInt(ssePosition.collateral)
    : restData
    ? safeBigInt(restData.collateral)
    : undefined

  const borrowShares = ssePosition
    ? safeBigInt(ssePosition.borrow_shares)
    : restData
    ? safeBigInt(restData.borrow_shares)
    : undefined

  // Oracle price from SSE (instant), fall back to REST
  const oraclePrice = sseOracle
    ? safeBigInt(sseOracle.price)
    : restData
    ? safeBigInt(restData.oracle_price)
    : undefined

  // Computed fields from REST (need market-level data)
  const debtAmount = restData ? safeBigInt(restData.debt_amount) : undefined

  let position: UserPosition | undefined
  if (collateralAmount !== undefined && debtAmount !== undefined && oraclePrice !== undefined) {
    const healthFactor = calculateHealthFactor(collateralAmount, oraclePrice, debtAmount, lltv)
    const liquidationPrice = calculateLiquidationPrice(collateralAmount, debtAmount, lltv)

    const maxBorrow = safeBigInt(restData?.max_borrow)
    const maxWithdraw = safeBigInt(restData?.max_withdraw)

    position = {
      collateralAmount,
      debtAmount,
      healthFactor,
      liquidationPrice,
      maxBorrow,
      maxWithdraw,
    }
  }

  // Consider loaded once either SSE or REST has delivered data
  const effectiveLoading = isLoading && !ssePosition

  return {
    position,
    collateralAmount,
    borrowShares,
    oraclePrice,
    isLoading: effectiveLoading,
    error,
    refetch,
  }
}
