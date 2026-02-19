'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount } from 'wagmi'
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
  /** Oracle price (36 decimals) from backend */
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
 * Hook to fetch user's Morpho position from the backend /morpho-position endpoint.
 *
 * Returns collateral, debt, health factor, and other position metrics.
 */
export function useMorphoPosition(market?: MorphoMarketEntry): UseMorphoPositionReturn {
  const { address } = useAccount()
  const [data, setData] = useState<MorphoPosition | null>(null)
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
        setData(result)
        setError(null)
      }
    } catch (e: any) {
      if (!data) setError(new Error(e.message || 'Failed to fetch position'))
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setIsLoading(true)
    setData(null)
    refetch()
  }, [address, refetch])

  useEffect(() => {
    if (!address) return
    const interval = setInterval(refetch, 15000)
    return () => clearInterval(interval)
  }, [address, refetch])

  // Derive typed values from backend response
  const collateralAmount = data ? safeBigInt(data.collateral) : undefined
  const borrowShares = data ? safeBigInt(data.borrow_shares) : undefined
  const debtAmount = data ? safeBigInt(data.debt_amount) : undefined
  const oraclePrice = data ? safeBigInt(data.oracle_price) : undefined

  let position: UserPosition | undefined
  if (collateralAmount !== undefined && debtAmount !== undefined && oraclePrice !== undefined) {
    const healthFactor = calculateHealthFactor(collateralAmount, oraclePrice, debtAmount, lltv)
    const liquidationPrice = calculateLiquidationPrice(collateralAmount, debtAmount, lltv)

    const maxBorrow = safeBigInt(data?.max_borrow)
    const maxWithdraw = safeBigInt(data?.max_withdraw)

    position = {
      collateralAmount,
      debtAmount,
      healthFactor,
      liquidationPrice,
      maxBorrow,
      maxWithdraw,
    }
  }

  return {
    position,
    collateralAmount,
    borrowShares,
    oraclePrice,
    isLoading,
    error,
    refetch,
  }
}
