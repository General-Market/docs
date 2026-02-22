'use client'

import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { P2POOL_ISSUER_URLS } from '@/lib/config'
import { bitmapToHex, hashBitmap, encodeBitmap, type BetDirection } from '@/lib/p2pool/bitmap'

export interface SubmitBitmapParams {
  batchId: number
  bitmap: Uint8Array
  bitmapHash: `0x${string}`
}

export interface SubmitBitmapResult {
  /** Number of issuers that accepted the bitmap */
  acceptedCount: number
  /** Total number of issuers attempted */
  totalCount: number
  /** Per-issuer results */
  results: Array<{ url: string; accepted: boolean; error?: string }>
}

export interface UseSubmitBitmapReturn {
  /** Submit a pre-encoded bitmap to all issuer nodes */
  submitBitmap: (params: SubmitBitmapParams) => Promise<SubmitBitmapResult>
  /** Convenience: encode bets, hash, and submit in one call */
  submitBets: (batchId: number, bets: BetDirection[], marketCount: number) => Promise<SubmitBitmapResult>
  /** Whether a submission is in progress */
  isSubmitting: boolean
  /** Last submission result */
  lastResult: SubmitBitmapResult | null
  /** Error from last submission */
  error: string | null
}

/**
 * Hook to submit bitmap bytes to issuer nodes after on-chain commitment.
 *
 * After joinBatch (or updateBitmap) commits the bitmap hash on-chain,
 * the player must reveal the actual bitmap bytes to all issuer nodes
 * before the reveal deadline. Each issuer verifies:
 *   1. keccak256(bitmap) == expected_hash
 *   2. expected_hash matches the player's on-chain commitment
 *
 * The bitmap is submitted to all issuers in parallel.
 */
export function useSubmitBitmap(): UseSubmitBitmapReturn {
  const { address } = useAccount()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<SubmitBitmapResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submitBitmap = useCallback(async (params: SubmitBitmapParams): Promise<SubmitBitmapResult> => {
    if (!address) {
      const err = 'Wallet not connected'
      setError(err)
      throw new Error(err)
    }

    setIsSubmitting(true)
    setError(null)

    const body = JSON.stringify({
      player: address,
      batch_id: params.batchId,
      bitmap_hex: bitmapToHex(params.bitmap),
      expected_hash: params.bitmapHash,
    })

    // Submit to all issuers in parallel
    const results = await Promise.all(
      P2POOL_ISSUER_URLS.map(async (url) => {
        try {
          const res = await fetch(`${url}/p2pool/bitmap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          })
          if (res.ok) {
            return { url, accepted: true }
          }
          const errBody = await res.text().catch(() => 'Unknown error')
          return { url, accepted: false, error: `HTTP ${res.status}: ${errBody.slice(0, 200)}` }
        } catch (e) {
          return { url, accepted: false, error: (e as Error).message }
        }
      })
    )

    const acceptedCount = results.filter(r => r.accepted).length
    const result: SubmitBitmapResult = {
      acceptedCount,
      totalCount: results.length,
      results,
    }

    setLastResult(result)
    setIsSubmitting(false)

    if (acceptedCount === 0) {
      const errMsg = 'No issuers accepted the bitmap'
      setError(errMsg)
    }

    return result
  }, [address])

  const submitBets = useCallback(async (
    batchId: number,
    bets: BetDirection[],
    marketCount: number,
  ): Promise<SubmitBitmapResult> => {
    const bitmap = encodeBitmap(bets, marketCount)
    const hash = hashBitmap(bitmap)
    return submitBitmap({ batchId, bitmap, bitmapHash: hash })
  }, [submitBitmap])

  return {
    submitBitmap,
    submitBets,
    isSubmitting,
    lastResult,
    error,
  }
}
