'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { fetchLendingQuote, QuoteApiError } from '@/lib/api/curator-api'
import type { QuoteResponse } from '@/lib/types/lending-quote'

interface UseLendingQuoteParams {
  itpAddress?: string
  collateralAmount?: string
  borrowAmount?: string
  /** Whether to auto-fetch when params change */
  enabled?: boolean
}

interface UseLendingQuoteReturn {
  /** Current quote (null if not fetched) */
  quote: QuoteResponse | null
  /** Whether a quote is being fetched */
  isLoading: boolean
  /** Error from the last fetch */
  error: QuoteApiError | null
  /** Whether the quote has expired */
  isExpired: boolean
  /** Manually fetch/refresh the quote */
  fetchQuote: () => Promise<void>
}

/**
 * Hook for fetching lending quotes from the Curator API
 *
 * Returns quote terms (APR, HF, liquidation price, max borrow) and
 * bundler calldata for atomic collateral+borrow transactions.
 *
 * Auto-invalidates when the quote expires.
 */
export function useLendingQuote({
  itpAddress,
  collateralAmount,
  borrowAmount,
  enabled = true,
}: UseLendingQuoteParams): UseLendingQuoteReturn {
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<QuoteApiError | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear expiry timer on unmount
  useEffect(() => {
    return () => {
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current)
    }
  }, [])

  const fetchQuote = useCallback(async () => {
    if (!itpAddress || !collateralAmount || !borrowAmount) return

    setIsLoading(true)
    setError(null)
    setIsExpired(false)

    try {
      const result = await fetchLendingQuote({
        itpAddress,
        collateralAmount,
        borrowAmount,
      })

      setQuote(result)

      // Set expiry timer
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current)
      const expiresInMs = (result.expiresAt * 1000) - Date.now()
      if (expiresInMs > 0) {
        expiryTimerRef.current = setTimeout(() => {
          setIsExpired(true)
        }, expiresInMs)
      } else {
        setIsExpired(true)
      }
    } catch (err) {
      if (err instanceof QuoteApiError) {
        setError(err)
      } else {
        setError(new QuoteApiError(
          err instanceof Error ? err.message : 'Network error',
          0
        ))
      }
      setQuote(null)
    } finally {
      setIsLoading(false)
    }
  }, [itpAddress, collateralAmount, borrowAmount])

  // Auto-fetch when enabled and params change
  useEffect(() => {
    if (enabled && itpAddress && collateralAmount && borrowAmount) {
      fetchQuote()
    }
  }, [enabled, itpAddress, collateralAmount, borrowAmount, fetchQuote])

  return {
    quote,
    isLoading,
    error,
    isExpired,
    fetchQuote,
  }
}
