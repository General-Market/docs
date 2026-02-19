'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect reduced motion preference
 * Respects user's prefers-reduced-motion system setting
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReduced(query.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }, [])

  return prefersReduced
}

/**
 * Hook to detect mobile viewport
 * Returns true when viewport width < 768px
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}
