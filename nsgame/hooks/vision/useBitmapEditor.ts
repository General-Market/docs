/**
 * Local bitmap state management for the Vision sources UI.
 *
 * Stores in-progress prediction edits (UP/DOWN/empty per market)
 * before submission to the batch. Persists draft to localStorage
 * so state survives page navigation.
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
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

function loadDraft(): Record<string, CellState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    // Support both old { data, ts } shape and new { data } shape
    const data = parsed.data ?? parsed
    if (typeof data !== 'object' || data === null) return {}
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: filtered }))
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

  const getSourceBitmap = useCallback((_sourceId: string): Record<string, CellState> => {
    // Source-level filtering requires a registry lookup not available here.
    // Callers should use getCounts(undefined, marketIds) with an explicit list instead.
    return {}
  }, [])

  const getCounts = useCallback((sourceId?: string, marketIds?: string[]): BitmapCounts => {
    let entries: [string, CellState][]

    if (marketIds) {
      // Use explicit market ID list — most reliable for per-source pages
      entries = marketIds.map(id => [id, state[id] ?? 'empty'])
    } else if (sourceId) {
      // Source-level filtering without an explicit market list is not supported.
      // Pass marketIds explicitly. Falls through to full state as fallback.
      entries = Object.entries(state)
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
