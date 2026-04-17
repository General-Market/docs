'use client'

import { useSyncExternalStore } from 'react'

/**
 * Shared 1-second tick for all countdown consumers.
 *
 * Instead of N independent setInterval(fn, 1000) calls — each causing a
 * separate setState and re-render — all countdown consumers subscribe to
 * ONE global tick. The interval self-manages: starts when the first
 * subscriber appears, stops when the last one leaves.
 */

const listeners = new Set<() => void>()
let intervalId: ReturnType<typeof setInterval> | null = null

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!intervalId) {
    intervalId = setInterval(() => {
      for (const l of listeners) l()
    }, 1000)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}

function getSnapshot(): number {
  return Math.floor(Date.now() / 1000)
}

function getServerSnapshot(): number {
  return 0
}

/**
 * Returns seconds remaining until `target` (ISO string).
 * All callers share a single setInterval — 20 countdowns on one page
 * cost exactly 1 timer registration, not 20.
 */
export function useSharedCountdown(target: string | null | undefined): number {
  const nowSec = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (!target) return 0
  const endSec = Math.floor(new Date(target).getTime() / 1000)
  return Math.max(0, endSec - nowSec)
}
