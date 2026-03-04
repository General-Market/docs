'use client'

import { useState, useEffect, useRef } from 'react'
import { VISION_API_URL, VISION_ISSUER_URLS } from '@/lib/config'

export type DepositStatus = 'pending' | 'credited' | 'refunded' | 'unknown'

export interface UseDepositStatusReturn {
  /** Current status of the deposit */
  status: DepositStatus
  /** Whether polling is active */
  isLoading: boolean
}

/**
 * Poll issuer API for the status of a cross-chain deposit order.
 * GET /vision/deposit/:orderId/status
 */
export function useDepositStatus(orderId: string | null): UseDepositStatusReturn {
  const [status, setStatus] = useState<DepositStatus>('unknown')
  const [isLoading, setIsLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!orderId) {
      setStatus('unknown')
      return
    }

    setIsLoading(true)

    const handleResponse = (data: { status: string }): boolean => {
      const s = data.status
      if (s === 'credited' || s === 'completed') {
        setStatus('credited')
        setIsLoading(false)
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        return true
      } else if (s === 'refunded') {
        setStatus('refunded')
        setIsLoading(false)
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        return true
      }
      setStatus('pending')
      return false
    }

    const poll = async () => {
      // Try proxied path first (same-origin, no CORS)
      try {
        const res = await fetch(`${VISION_API_URL}/vision/deposit/${orderId}/status`)
        if (res.ok) {
          const data = await res.json()
          if (handleResponse(data)) return
          return
        }
      } catch {
        // Proxy failed, try direct
      }

      // Fallback: direct issuer URLs
      for (const url of VISION_ISSUER_URLS) {
        try {
          const res = await fetch(`${url}/vision/deposit/${orderId}/status`)
          if (res.ok) {
            const data = await res.json()
            if (handleResponse(data)) return
            return
          }
        } catch {
          // Try next issuer
        }
      }
      setStatus('pending')
    }

    poll()
    pollRef.current = setInterval(poll, 5000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [orderId])

  return { status, isLoading }
}
