'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DATA_NODE_URL } from '@/lib/config'
import { encodeBitmap, hashBitmap, type BetDirection } from '@/lib/vision/bitmap'

// ── Types ──

export interface SignedBatchMarket {
  assetId: string
  resolutionType: string
  thresholdBps: number
  thresholdSource: string
}

export interface SignedBatch {
  sourceId: string
  displayName: string
  configHash: string
  tickDurationSecs: number
  lockOffsetSecs: number
  markets: SignedBatchMarket[]
  blsSignature: string
  signersBitmask: number
  referenceNonce: number
  signedAt: string
}

interface SignedBatchesResponse {
  generatedAt: string
  batches: SignedBatch[]
}

// ── Constants ──

const NORMAL_POLL_MS = 15_000
const FAST_POLL_MS = 5_000 // near tick boundary

// ── Hook ──

export function useSignedBatches() {
  const [batches, setBatches] = useState<Record<string, SignedBatch>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const resp = await fetch(`${DATA_NODE_URL}/batches/signed`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data: SignedBatchesResponse = await resp.json()

      // Key by sourceId for O(1) lookup
      const map: Record<string, SignedBatch> = {}
      for (const b of data.batches ?? []) {
        map[b.sourceId] = b
      }
      setBatches(map)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch signed batches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, NORMAL_POLL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  /** Check if config changed since user loaded (call before submitting tx) */
  const hasConfigChanged = useCallback(
    (sourceId: string, knownHash: string): boolean => {
      const current = batches[sourceId]
      return current ? current.configHash !== knownHash : false
    },
    [batches],
  )

  return { batches, loading, error, refresh, hasConfigChanged }
}

// ── Bitmap helpers ──

/**
 * Build a bitmap from user market selections.
 *
 * Markets MUST be sorted by assetId (same order as hash computation)
 * before calling this — the function sorts internally to be safe.
 *
 * Uses the existing encodeBitmap() from bitmap.ts which uses the
 * MSB-first convention (7 - (index % 8)), matching the resolver.
 *
 * @param markets - The batch's market list
 * @param selections - Map of assetId → 'UP' | 'DOWN' | null
 * @returns bitmap bytes and keccak256 hash
 */
export function buildBitmapFromSelections(
  markets: SignedBatchMarket[],
  selections: Map<string, 'UP' | 'DOWN' | null>,
): { bitmap: Uint8Array; bitmapHash: `0x${string}` } {
  // Sort by assetId to match config hash ordering
  const sorted = [...markets].sort((a, b) => a.assetId.localeCompare(b.assetId))

  const bets: BetDirection[] = sorted.map((m) => {
    const sel = selections.get(m.assetId)
    return sel ?? 'DOWN' // null = skip = DOWN (no opinion)
  })

  const bitmap = encodeBitmap(bets, sorted.length)
  const bitmapHash = hashBitmap(bitmap)
  return { bitmap, bitmapHash }
}
