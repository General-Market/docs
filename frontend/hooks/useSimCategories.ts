'use client'

import { useState, useEffect } from 'react'
import { DATA_NODE_URL } from '@/lib/config'

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

// Module-level cache: fetch once, share across all component instances
let _cachedCategories: SimCategory[] | null = null
let _fetchPromise: Promise<SimCategory[]> | null = null

function fetchCategories(): Promise<SimCategory[]> {
  if (_cachedCategories) return Promise.resolve(_cachedCategories)
  if (_fetchPromise) return _fetchPromise
  _fetchPromise = fetch(`${DATA_NODE_URL}/sim/categories`, { signal: AbortSignal.timeout(30_000) })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    .then(data => {
      const cats: SimCategory[] = data.categories || []
      _cachedCategories = cats
      return cats
    })
    .catch(e => {
      _fetchPromise = null // allow retry on error
      throw e
    })
  return _fetchPromise
}

// Preload immediately on module import — categories are ready before any component mounts
fetchCategories().catch(() => {})

export function useSimCategories(): UseSimCategoriesResult {
  const [categories, setCategories] = useState<SimCategory[]>(_cachedCategories || [])
  const [isLoading, setIsLoading] = useState(!_cachedCategories)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (_cachedCategories) {
      setCategories(_cachedCategories)
      setIsLoading(false)
      return
    }

    let cancelled = false
    fetchCategories()
      .then(cats => {
        if (!cancelled) {
          setCategories(cats)
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
