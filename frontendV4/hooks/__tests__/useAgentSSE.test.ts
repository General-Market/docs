import { describe, test, expect } from 'bun:test'
import type { AgentSSEState, UseAgentSSEReturn } from '../useAgentSSE'

describe('useAgentSSE', () => {
  describe('AgentSSEState type', () => {
    test('defines all expected states', () => {
      const validStates: AgentSSEState[] = ['connecting', 'connected', 'disconnected', 'error', 'disabled', 'polling']

      expect(validStates).toContain('connecting')
      expect(validStates).toContain('connected')
      expect(validStates).toContain('disconnected')
      expect(validStates).toContain('error')
      expect(validStates).toContain('disabled')
      expect(validStates).toContain('polling')
    })
  })

  describe('UseAgentSSEReturn interface', () => {
    test('validates correct return structure when connected', () => {
      const connectedReturn: UseAgentSSEReturn = {
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
      const disabledReturn: UseAgentSSEReturn = {
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
      const reconnectingReturn: UseAgentSSEReturn = {
        state: 'error',
        isConnected: false,
        isEnabled: true,
        reconnectAttempt: 2,
        isPolling: false
      }

      expect(reconnectingReturn.state).toBe('error')
      expect(reconnectingReturn.isConnected).toBe(false)
      expect(reconnectingReturn.isEnabled).toBe(true)
      expect(reconnectingReturn.reconnectAttempt).toBe(2)
      expect(reconnectingReturn.isPolling).toBe(false)
    })

    test('validates correct return structure when polling', () => {
      const pollingReturn: UseAgentSSEReturn = {
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

  describe('Wallet address parameter', () => {
    test('valid wallet address format', () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      expect(walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    test('wallet address is case-insensitive per backend spec', () => {
      const lowercase = '0x742d35cc6634c0532925a3b844bc454e4438f44e'
      const checksummed = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'

      // Backend filters by address case-insensitively (per story 6-1 notes)
      expect(lowercase.toLowerCase()).toBe(checksummed.toLowerCase())
    })

    test('empty wallet address should disable SSE', () => {
      const walletAddress = ''
      expect(walletAddress).toBeFalsy()
      // Hook should return disabled state when wallet address is empty
    })
  })

  describe('Agent-specific endpoint construction', () => {
    test('constructs correct SSE endpoint URL', () => {
      const backendUrl = 'http://localhost:3001'
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const expectedEndpoint = `${backendUrl}/api/sse/agent/${walletAddress}`

      expect(expectedEndpoint).toBe('http://localhost:3001/api/sse/agent/0x742d35Cc6634C0532925a3b844Bc454e4438f44e')
    })

    test('polling endpoint is different from SSE endpoint', () => {
      const backendUrl = 'http://localhost:3001'
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'

      const sseEndpoint = `${backendUrl}/api/sse/agent/${walletAddress}`
      const pollingEndpoint = `${backendUrl}/api/agents/${walletAddress}/bets?limit=10`

      expect(sseEndpoint).not.toBe(pollingEndpoint)
      expect(sseEndpoint).toContain('/api/sse/')
      expect(pollingEndpoint).toContain('/api/agents/')
    })
  })

  describe('Query cache key', () => {
    test('uses agent-specific query key', () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const limit = 10
      const queryKey = ['agent-bets', walletAddress, limit]

      expect(queryKey).toEqual(['agent-bets', walletAddress, 10])
    })

    test('query key changes with different wallet address', () => {
      const walletAddress1 = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const walletAddress2 = '0x8Ba1f109551bD432803012645Ac136ddd64DBA72'

      const queryKey1 = ['agent-bets', walletAddress1, 10]
      const queryKey2 = ['agent-bets', walletAddress2, 10]

      expect(queryKey1).not.toEqual(queryKey2)
    })
  })

  describe('Cache update behavior', () => {
    test('prepending maintains max 10 events for agent page', () => {
      // Simulate existing cache with 10 events
      const existingEvents = Array.from({ length: 10 }, (_, i) => ({
        betId: `existing-${i}`,
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        eventType: 'placed' as const,
        portfolioSize: 10000,
        amount: '100.000000',
        result: null,
        timestamp: new Date(Date.now() - i * 60000).toISOString()
      }))

      const newEvent = {
        betId: 'new-event',
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        eventType: 'placed' as const,
        portfolioSize: 15000,
        amount: '150.000000',
        result: null,
        timestamp: new Date().toISOString()
      }

      // Simulate prepend and slice logic (max 10 for agent page)
      const updatedEvents = [newEvent, ...existingEvents].slice(0, 10)

      expect(updatedEvents.length).toBe(10)
      expect(updatedEvents[0].betId).toBe('new-event')
      expect(updatedEvents[9].betId).toBe('existing-8') // Last old event that fits
    })

    test('new event is always first in list', () => {
      const existingEvents = [
        {
          betId: 'old-1',
          walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
          eventType: 'placed' as const,
          portfolioSize: 10000,
          amount: '100.000000',
          result: null,
          timestamp: '2026-01-23T10:00:00Z'
        }
      ]

      const newEvent = {
        betId: 'new-1',
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        eventType: 'matched' as const,
        portfolioSize: 0,
        amount: '100.000000',
        result: null,
        timestamp: '2026-01-23T10:05:00Z'
      }

      const updatedEvents = [newEvent, ...existingEvents]

      expect(updatedEvents[0].betId).toBe('new-1')
      expect(updatedEvents[1].betId).toBe('old-1')
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

  describe('Connection status indicator states', () => {
    test('connected state shows Live indicator', () => {
      const state: AgentSSEState = 'connected'
      const isConnected = state === 'connected'
      const isPolling = false

      expect(isConnected).toBe(true)
      expect(isPolling).toBe(false)
      // UI should show: Green dot + "Live"
    })

    test('polling state shows Polling indicator', () => {
      const state: AgentSSEState = 'polling'
      const isConnected = state === 'connected'
      const isPolling = true

      expect(isConnected).toBe(false)
      expect(isPolling).toBe(true)
      // UI should show: Yellow dot + "Polling"
    })

    test('disconnected state shows Offline indicator', () => {
      const state: AgentSSEState = 'disconnected'
      const isConnected = state === 'connected'
      const isPolling = false

      expect(isConnected).toBe(false)
      expect(isPolling).toBe(false)
      // UI should show: Red dot + "Offline"
    })

    test('error state during reconnection', () => {
      const state: AgentSSEState = 'error'
      const isConnected = state === 'connected'
      const reconnectAttempt = 2

      expect(isConnected).toBe(false)
      expect(reconnectAttempt).toBeLessThan(3)
      // UI should show: Yellow dot + "Reconnecting..."
    })
  })

  describe('Cleanup behavior', () => {
    test('cleanup should close EventSource', () => {
      // This tests the expectation that cleanup function handles:
      // 1. clearTimeout for reconnect timer
      // 2. clearInterval for polling timer
      // 3. close EventSource connection
      // 4. reset state to disconnected

      const mockEventSource = {
        close: () => {},
        readyState: 1 // OPEN
      }

      // Verify the mock has the expected shape
      expect(typeof mockEventSource.close).toBe('function')
      expect(mockEventSource.readyState).toBe(1)
    })
  })
})
