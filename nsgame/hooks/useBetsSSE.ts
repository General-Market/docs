'use client'

// SSE stream of live bet events from the event indexer. No transport
// exists yet — this hook exists so consumers have a stable import path.
//
// TODO: wire to the indexer's SSE once the event shapes stabilize.

export type BetSSEState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface BetPlacedSSEEvent {
  type: 'BetPlaced'
  marketPda: string
  owner: string
  sourceId: number
  thresholdBps: number
  amount: string
  signature: string
  timestamp: string
}

export interface BetExitedSSEEvent {
  type: 'BetExited'
  marketPda: string
  owner: string
  amount: string
  signature: string
  timestamp: string
}

export interface MarketInstantiatedSSEEvent {
  type: 'MarketInstantiated'
  marketPda: string
  sourceId: number
  thresholdBps: number
  closeTime: string
  settlementTime: string
  signature: string
  timestamp: string
}

export interface MarketClosedSSEEvent {
  type: 'MarketClosed'
  marketPda: string
  baselinePrice: string
  signature: string
  timestamp: string
}

export interface MarketResolvedSSEEvent {
  type: 'MarketResolved'
  marketPda: string
  finalPrice: string
  outcomeYes: boolean
  forceResolved: boolean
  signature: string
  timestamp: string
}

export interface ClaimedSSEEvent {
  type: 'Claimed'
  marketPda: string
  owner: string
  netAmount: string
  feeAmount: string
  signature: string
  timestamp: string
}

export type BetSSEEvent =
  | BetPlacedSSEEvent
  | BetExitedSSEEvent
  | MarketInstantiatedSSEEvent
  | MarketClosedSSEEvent
  | MarketResolvedSSEEvent
  | ClaimedSSEEvent

export interface UseBetsSSEReturn {
  state: BetSSEState
  isConnected: boolean
  isEnabled: boolean
  reconnectAttempt: number
  isPolling: boolean
}

export function useBetsSSE(): UseBetsSSEReturn {
  return {
    state: 'disconnected',
    isConnected: false,
    isEnabled: false,
    reconnectAttempt: 0,
    isPolling: false,
  }
}
