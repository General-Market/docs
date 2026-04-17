'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Fetch ITP original requesters from the data-node.
 *
 * For bridge-created ITPs the data-node returns the Settlement request's `admin`
 * field — the actual user who called `requestCreateItp()` on Settlement.
 * For ITPs absent from the map the caller falls back to the on-chain `creator`
 * (which is always the deployer for non-bridge ITPs, so also correct).
 *
 * Returns a Map<itpId (lowercase), requesterAddress (lowercase)>.
 */
export function useItpCreators(_itpIds: string[]): {
  creators: Map<string, string>
  isLoading: boolean
} {
  const [creators, setCreators] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchRequesters = async () => {
      try {
        const res = await fetch('/api/dn/chain/itp-requesters', {
          signal: AbortSignal.timeout(10_000),
        })
        if (cancelled) return
        if (!res.ok) {
          setIsLoading(false)
          return
        }
        const data: Record<string, string> = await res.json()
        if (cancelled) return
        const map = new Map<string, string>()
        for (const [itpId, requester] of Object.entries(data)) {
          map.set(itpId.toLowerCase(), requester.toLowerCase())
        }
        setCreators(map)
      } catch {
        // Non-fatal: fall back to treating all ITPs as official.
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchRequesters()
    // Requester addresses don't change — poll infrequently.
    intervalRef.current = setInterval(fetchRequesters, 120_000)

    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { creators, isLoading }
}
