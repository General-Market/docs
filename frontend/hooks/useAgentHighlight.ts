'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

export interface UseAgentHighlightReturn {
  highlightedAddress: string | null
  setHighlightedAddress: (address: string | null) => void
  clearHighlight: () => void
}

const HIGHLIGHT_TIMEOUT_MS = 5000

/**
 * Helper to build URL with or without highlight param
 * Uses fresh window.location.search to avoid stale closure issues
 */
function buildUrlWithHighlight(pathname: string, address: string | null): string {
  // Get fresh params from window to avoid stale closure
  const currentParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams()

  if (address) {
    currentParams.set('highlight', address)
  } else {
    currentParams.delete('highlight')
  }

  return currentParams.toString() ? `${pathname}?${currentParams.toString()}` : pathname
}

/**
 * Hook for managing agent highlight state with URL synchronization
 * - Reads highlight param from URL on load
 * - Updates URL when highlight changes
 * - Auto-clears highlight after 5 seconds
 */
export function useAgentHighlight(): UseAgentHighlightReturn {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Track if we've initialized from URL
  const initializedRef = useRef(false)

  // Store pathname in ref to avoid stale closure in timeout
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  // Initialize from URL param
  const [highlightedAddress, setHighlightedAddressState] = useState<string | null>(null)

  // Timeout ref for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Stable clear function that uses refs to avoid stale closures
  const clearHighlightTimeout = useCallback(() => {
    setHighlightedAddressState(null)
    const newUrl = buildUrlWithHighlight(pathnameRef.current, null)
    router.replace(newUrl, { scroll: false })
  }, [router])

  // Initialize from URL on mount
  useEffect(() => {
    if (!initializedRef.current) {
      const urlHighlight = searchParams.get('highlight')
      if (urlHighlight) {
        setHighlightedAddressState(urlHighlight)
        // Set auto-clear timeout for URL-based highlights too
        timeoutRef.current = setTimeout(clearHighlightTimeout, HIGHLIGHT_TIMEOUT_MS)
      }
      initializedRef.current = true
    }
  }, [searchParams, clearHighlightTimeout])

  // Update URL and state
  const setHighlightedAddress = useCallback((address: string | null) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Update state
    setHighlightedAddressState(address)

    // Update URL using fresh params
    const newUrl = buildUrlWithHighlight(pathnameRef.current, address)
    router.replace(newUrl, { scroll: false })

    // Set auto-clear timeout (5 seconds)
    if (address) {
      timeoutRef.current = setTimeout(clearHighlightTimeout, HIGHLIGHT_TIMEOUT_MS)
    }
  }, [router, clearHighlightTimeout])

  const clearHighlight = useCallback(() => {
    setHighlightedAddress(null)
  }, [setHighlightedAddress])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { highlightedAddress, setHighlightedAddress, clearHighlight }
}
