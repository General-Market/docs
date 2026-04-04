'use client'

import type { SSEConnectionState } from '@/hooks/useSSEConnection'

export type BetSSEState = SSEConnectionState

/**
 * SSE event types from backend (Story 6-1)
 */
export interface BetPlacedEvent {
  type: 'BetPlaced'
  betId: string
  creator: string
  portfolioSize: number
  tradeCount?: number
  amount: string
  timestamp: string
}

export interface BetMatchedEvent {
  type: 'BetMatched'
  betId: string
  matcher: string
  amount: string
  timestamp: string
}

export interface BetSettledEvent {
  type: 'BetSettled'
  betId: string
  winner: string
  pnl: string
  portfolioSize: number
  tradeCount?: number
  timestamp: string
}

export interface BetEarlyExitEvent {
  type: 'BetEarlyExit'
  betId: string
  creator: string
  filler: string
  creatorAmount: string
  fillerAmount: string
  timestamp: string
}

export interface UseBetsSSEReturn {
  state: BetSSEState
  isConnected: boolean
  isEnabled: boolean
  reconnectAttempt: number
  isPolling: boolean
}

/**
 * SSE hook for the global bet feed — currently disabled.
 * The backend SSE endpoint never existed. Recent bets now come from
 * the on-chain API route (/api/bets/recent) via useRecentBets polling.
 * This hook is a no-op until a real SSE transport is built.
 */
export function useBetsSSE(): UseBetsSSEReturn {
  return {
    state: 'disconnected' as BetSSEState,
    isConnected: false,
    isEnabled: false,
    reconnectAttempt: 0,
    isPolling: false,
  }
}
