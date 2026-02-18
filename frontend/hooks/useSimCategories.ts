'use client'

import { useState, useEffect } from 'react'

const DATA_NODE_URL = process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'

export interface SimCategory {
  id: string
  name: string
  coin_count: number
  market_cap: number | null
}

interface UseSimCategoriesResult {
  categories: SimCategory[]
  isLoading: boolean
  error: string | null
}

export function useSimCategories(): UseSimCategoriesResult {
  const [categories, setCategories] = useState<SimCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`${DATA_NODE_URL}/sim/categories`, { signal: AbortSignal.timeout(30_000) })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (!cancelled) {
          setCategories(data.categories || [])
          setIsLoading(false)
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e.message)
          setIsLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [])

  return { categories, isLoading, error }
}
