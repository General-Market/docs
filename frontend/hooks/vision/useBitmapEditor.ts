/**
 * Local bitmap state management for the Vision sources UI.
 *
 * Stores in-progress prediction edits (UP/DOWN/empty per market)
 * before submission to the batch. Persists draft to localStorage
 * so state survives page navigation.
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { getSourceForMarket } from '@/lib/vision/sources'
import { encodeBitmap, type BetDirection } from '@/lib/vision/bitmap'

export type CellState = 'up' | 'down' | 'empty'

export interface BitmapCounts {
  up: number
  down: number
  empty: number
  total: number
}

export interface BitmapEditor {
  /** Full state: marketId → cell state */
  state: Record<string, CellState>

  /** Toggle a single cell: empty → up → down → empty */
  toggleCell(marketId: string): void

  /** Set a specific cell to a specific state */
  setCell(marketId: string, value: CellState): void

  /** Get bitmap state filtered to a specific source */
  getSourceBitmap(sourceId: string): Record<string, CellState>

  /** Get counts, optionally filtered by source or explicit market ID list */
  getCounts(sourceId?: string, marketIds?: string[]): BitmapCounts

  /** Bulk-apply a strategy function */
  applyStrategy(fn: (marketIds: string[]) => Record<string, 'up' | 'down'>): void

  /** Encode current state for on-chain submission */
  getBitmapForSubmission(marketIds: string[]): Uint8Array

  /** Reset all predictions */
  reset(): void

  /** Number of markets with a prediction set */
  setCount: number
}

const STORAGE_KEY = 'gm-vision-bitmap-draft'
const STORAGE_MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes

function loadDraft(): Record<string, CellState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > STORAGE_MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return {}
    }
    return data as Record<string, CellState>
  } catch {
    return {}
  }
}

function saveDraft(state: Record<string, CellState>) {
  if (typeof window === 'undefined') return
  try {
    // Only save non-empty entries
    const filtered: Record<string, CellState> = {}
    for (const [k, v] of Object.entries(state)) {
      if (v !== 'empty') filtered[k] = v
    }
    if (Object.keys(filtered).length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: filtered, ts: Date.now() }))
    }
  } catch { /* quota exceeded */ }
}

export function useBitmapEditor(): BitmapEditor {
  const [state, setState] = useState<Record<string, CellState>>(() => loadDraft())

  // Persist on change
  useEffect(() => {
    saveDraft(state)
  }, [state])

  const toggleCell = useCallback((marketId: string) => {
    setState(prev => {
      const current = prev[marketId] ?? 'empty'
      let next: CellState
      if (current === 'empty') next = 'up'
      else if (current === 'up') next = 'down'
      else next = 'empty'
      return { ...prev, [marketId]: next }
    })
  }, [])

  const setCell = useCallback((marketId: string, value: CellState) => {
    setState(prev => ({ ...prev, [marketId]: value }))
  }, [])

  const getSourceBitmap = useCallback((sourceId: string): Record<string, CellState> => {
    const result: Record<string, CellState> = {}
    for (const [marketId, cellState] of Object.entries(state)) {
      const source = getSourceForMarket(marketId)
      if (source?.id === sourceId) {
        result[marketId] = cellState
      }
    }
    return result
  }, [state])

  const getCounts = useCallback((sourceId?: string, marketIds?: string[]): BitmapCounts => {
    let entries: [string, CellState][]

    if (marketIds) {
      // Use explicit market ID list — most reliable for per-source pages
      entries = marketIds.map(id => [id, state[id] ?? 'empty'])
    } else if (sourceId) {
      entries = Object.entries(state).filter(([mId]) => getSourceForMarket(mId)?.id === sourceId)
    } else {
      entries = Object.entries(state)
    }

    let up = 0, down = 0, empty = 0
    for (const [, v] of entries) {
      if (v === 'up') up++
      else if (v === 'down') down++
      else empty++
    }
    return { up, down, empty, total: up + down + empty }
  }, [state])

  const applyStrategy = useCallback((fn: (marketIds: string[]) => Record<string, 'up' | 'down'>) => {
    setState(prev => {
      const marketIds = Object.keys(prev)
      const result = fn(marketIds)
      const next = { ...prev }
      for (const [mId, dir] of Object.entries(result)) {
        next[mId] = dir
      }
      return next
    })
  }, [])

  const getBitmapForSubmission = useCallback((marketIds: string[]): Uint8Array => {
    const bets: BetDirection[] = marketIds.map(id => {
      const s = state[id]
      if (s === 'up') return 'UP'
      if (s === 'down') return 'DOWN'
      return 'DOWN' // default unset to DOWN
    })
    return encodeBitmap(bets, marketIds.length)
  }, [state])

  const reset = useCallback(() => {
    setState({})
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const setCount = useMemo(() => {
    return Object.values(state).filter(v => v !== 'empty').length
  }, [state])

  return {
    state,
    toggleCell,
    setCell,
    getSourceBitmap,
    getCounts,
    applyStrategy,
    getBitmapForSubmission,
    reset,
    setCount,
  }
}
