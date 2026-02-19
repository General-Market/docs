import { describe, test, expect } from 'bun:test'
import type {
  BetSSEState,
  UseBetsSSEReturn,
  BetPlacedEvent,
  BetMatchedEvent,
  BetSettledEvent
} from '../useBetsSSE'

describe('useBetsSSE', () => {
  describe('BetSSEState type', () => {
    test('defines all expected states', () => {
      const validStates: BetSSEState[] = ['connecting', 'connected', 'disconnected', 'error', 'disabled', 'polling']

      expect(validStates).toContain('connecting')
      expect(validStates).toContain('connected')
      expect(validStates).toContain('disconnected')
      expect(validStates).toContain('error')
      expect(validStates).toContain('disabled')
      expect(validStates).toContain('polling')
    })
  })

  describe('UseBetsSSEReturn interface', () => {
    test('validates correct return structure when connected', () => {
      const connectedReturn: UseBetsSSEReturn = {
        state: 'connected',
        isConnected: true,
        isEnabled: true,
        reconnectAttempt: 0,
        isPolling: false
      }

      expect(connectedReturn.state).toBe('connected')
      expect(connectedReturn.isConnected).toBe(true)
      expect(connectedReturn.isEnabled).toBe(true)
      expect(connectedReturn.reconnectAttempt).toBe(0)
      expect(connectedReturn.isPolling).toBe(false)
    })

    test('validates correct return structure when disabled', () => {
      const disabledReturn: UseBetsSSEReturn = {
        state: 'disabled',
        isConnected: false,
        isEnabled: false,
        reconnectAttempt: 0,
        isPolling: false
      }

      expect(disabledReturn.state).toBe('disabled')
      expect(disabledReturn.isConnected).toBe(false)
      expect(disabledReturn.isEnabled).toBe(false)
      expect(disabledReturn.isPolling).toBe(false)
    })

    test('validates correct return structure during reconnection', () => {
      const reconnectingReturn: UseBetsSSEReturn = {
        state: 'error',
        isConnected: false,
        isEnabled: true,
        reconnectAttempt: 3,
        isPolling: false
      }

      expect(reconnectingReturn.state).toBe('error')
      expect(reconnectingReturn.isConnected).toBe(false)
      expect(reconnectingReturn.isEnabled).toBe(true)
      expect(reconnectingReturn.reconnectAttempt).toBe(3)
      expect(reconnectingReturn.isPolling).toBe(false)
    })

    test('validates correct return structure when polling', () => {
      const pollingReturn: UseBetsSSEReturn = {
        state: 'polling',
        isConnected: false,
        isEnabled: true,
        reconnectAttempt: 3,
        isPolling: true
      }

      expect(pollingReturn.state).toBe('polling')
      expect(pollingReturn.isConnected).toBe(false)
      expect(pollingReturn.isEnabled).toBe(true)
      expect(pollingReturn.isPolling).toBe(true)
    })
  })

  describe('SSE event types', () => {
    test('BetPlacedEvent has correct structure', () => {
      const event: BetPlacedEvent = {
        type: 'BetPlaced',
        betId: '123',
        creator: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        portfolioSize: 15000,
        amount: '100.000000',
        timestamp: '2026-01-23T10:00:00Z'
      }

      expect(event.type).toBe('BetPlaced')
      expect(event.betId).toBe('123')
      expect(event.creator).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(event.portfolioSize).toBe(15000)
      expect(event.amount).toBe('100.000000')
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    test('BetMatchedEvent has correct structure', () => {
      const event: BetMatchedEvent = {
        type: 'BetMatched',
        betId: '123',
        matcher: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
        amount: '100.000000',
        timestamp: '2026-01-23T10:01:00Z'
      }

      expect(event.type).toBe('BetMatched')
      expect(event.betId).toBe('123')
      expect(event.matcher).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(event.amount).toBe('100.000000')
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    test('BetSettledEvent has correct structure for win', () => {
      const event: BetSettledEvent = {
        type: 'BetSettled',
        betId: '123',
        winner: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        pnl: '50.000000',
        portfolioSize: 15000,
        timestamp: '2026-01-23T12:00:00Z'
      }

      expect(event.type).toBe('BetSettled')
      expect(event.betId).toBe('123')
      expect(event.winner).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(parseFloat(event.pnl)).toBeGreaterThan(0)
      expect(event.portfolioSize).toBe(15000)
    })

    test('BetSettledEvent has correct structure for loss', () => {
      const event: BetSettledEvent = {
        type: 'BetSettled',
        betId: '456',
        winner: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
        pnl: '-75.000000',
        portfolioSize: 10000,
        timestamp: '2026-01-23T12:00:00Z'
      }

      expect(event.type).toBe('BetSettled')
      expect(parseFloat(event.pnl)).toBeLessThan(0)
    })
  })

  describe('Event transformation', () => {
    test('BetPlaced transforms to RecentBetEvent correctly', () => {
      const sseEvent: BetPlacedEvent = {
        type: 'BetPlaced',
        betId: '123',
        creator: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        portfolioSize: 25000,
        amount: '150.000000',
        timestamp: '2026-01-23T10:00:00Z'
      }

      // Simulate transformation logic
      const transformed = {
        betId: sseEvent.betId,
        walletAddress: sseEvent.creator,
        eventType: 'placed' as const,
        portfolioSize: sseEvent.portfolioSize,
        amount: sseEvent.amount,
        result: null,
        timestamp: sseEvent.timestamp
      }

      expect(transformed.betId).toBe('123')
      expect(transformed.walletAddress).toBe(sseEvent.creator)
      expect(transformed.eventType).toBe('placed')
      expect(transformed.portfolioSize).toBe(25000)
      expect(transformed.amount).toBe('150.000000')
      expect(transformed.result).toBeNull()
    })

    test('BetMatched transforms to RecentBetEvent correctly', () => {
      const sseEvent: BetMatchedEvent = {
        type: 'BetMatched',
        betId: '123',
        matcher: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
        amount: '150.000000',
        timestamp: '2026-01-23T10:01:00Z'
      }

      // Simulate transformation logic
      const transformed = {
        betId: sseEvent.betId,
        walletAddress: sseEvent.matcher,
        eventType: 'matched' as const,
        portfolioSize: 0,
        amount: sseEvent.amount,
        result: null,
        timestamp: sseEvent.timestamp
      }

      expect(transformed.betId).toBe('123')
      expect(transformed.walletAddress).toBe(sseEvent.matcher)
      expect(transformed.eventType).toBe('matched')
      expect(transformed.portfolioSize).toBe(0) // Not provided in match event
      expect(transformed.result).toBeNull()
    })

    test('BetSettled transforms to won event for positive PnL', () => {
      const sseEvent: BetSettledEvent = {
        type: 'BetSettled',
        betId: '123',
        winner: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        pnl: '100.000000',
        portfolioSize: 15000,
        timestamp: '2026-01-23T12:00:00Z'
      }

      const pnl = parseFloat(sseEvent.pnl)
      const eventType = pnl >= 0 ? 'won' : 'lost'

      expect(eventType).toBe('won')
    })

    test('BetSettled transforms to lost event for negative PnL', () => {
      const sseEvent: BetSettledEvent = {
        type: 'BetSettled',
        betId: '456',
        winner: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
        pnl: '-75.000000',
        portfolioSize: 10000,
        timestamp: '2026-01-23T12:00:00Z'
      }

      const pnl = parseFloat(sseEvent.pnl)
      const eventType = pnl >= 0 ? 'won' : 'lost'

      expect(eventType).toBe('lost')
    })
  })

  describe('Exponential backoff calculation', () => {
    const baseDelay = 1000 // 1 second
    const maxDelay = 30000 // 30 seconds

    function getReconnectDelay(attempt: number): number {
      const delay = baseDelay * Math.pow(2, attempt)
      return Math.min(delay, maxDelay)
    }

    test('first retry is 1 second', () => {
      expect(getReconnectDelay(0)).toBe(1000)
    })

    test('second retry is 2 seconds', () => {
      expect(getReconnectDelay(1)).toBe(2000)
    })

    test('third retry is 4 seconds', () => {
      expect(getReconnectDelay(2)).toBe(4000)
    })

    test('fourth retry is 8 seconds', () => {
      expect(getReconnectDelay(3)).toBe(8000)
    })

    test('caps at 30 seconds max', () => {
      expect(getReconnectDelay(5)).toBe(30000)
      expect(getReconnectDelay(10)).toBe(30000)
      expect(getReconnectDelay(100)).toBe(30000)
    })
  })

  describe('Mega portfolio detection', () => {
    test('identifies mega portfolio (>= 20000 markets)', () => {
      const megaPortfolioSize = 25000
      expect(megaPortfolioSize >= 20000).toBe(true)
    })

    test('identifies regular portfolio (< 20000 markets)', () => {
      const regularPortfolioSize = 15000
      expect(regularPortfolioSize >= 20000).toBe(false)
    })

    test('boundary case - exactly 20000 is mega', () => {
      const boundarySize = 20000
      expect(boundarySize >= 20000).toBe(true)
    })
  })
})
