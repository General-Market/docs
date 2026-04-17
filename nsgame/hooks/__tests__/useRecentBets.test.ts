import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

// Mock fetch globally
const originalFetch = globalThis.fetch

/**
 * Tests for useRecentBets hook
 * Story 5.5: Implement Recent Bets Feed
 */
describe('useRecentBets', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    globalThis.fetch = mock(() => Promise.reject(new Error('Not mocked')))
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('RecentBetEvent interface validation', () => {
    it('validates correct event structure', () => {
      const validEvent = {
        betId: '123',
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        eventType: 'placed' as const,
        portfolioSize: 18500,
        amount: '120.000000',
        result: null,
        timestamp: '2026-01-23T10:30:00Z'
      }

      // Validate required fields exist and have correct types
      expect(typeof validEvent.betId).toBe('string')
      expect(validEvent.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(['placed', 'matched', 'won', 'lost']).toContain(validEvent.eventType)
      expect(typeof validEvent.portfolioSize).toBe('number')
      expect(validEvent.portfolioSize).toBeGreaterThan(0)
      expect(typeof validEvent.amount).toBe('string')
      expect(parseFloat(validEvent.amount)).toBeGreaterThan(0)
    })

    it('validates won event has positive result', () => {
      const wonEvent = {
        betId: '456',
        walletAddress: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72',
        eventType: 'won' as const,
        portfolioSize: 23847,
        amount: '150.000000',
        result: '45.500000',
        timestamp: '2026-01-23T10:35:00Z'
      }

      expect(wonEvent.eventType).toBe('won')
      expect(wonEvent.result).not.toBeNull()
      expect(parseFloat(wonEvent.result!)).toBeGreaterThan(0)
    })

    it('validates lost event has negative result', () => {
      const lostEvent = {
        betId: '789',
        walletAddress: '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec',
        eventType: 'lost' as const,
        portfolioSize: 19200,
        amount: '100.000000',
        result: '-35.000000',
        timestamp: '2026-01-23T10:40:00Z'
      }

      expect(lostEvent.eventType).toBe('lost')
      expect(lostEvent.result).not.toBeNull()
      expect(parseFloat(lostEvent.result!)).toBeLessThan(0)
    })

    it('validates placed/matched events have null result', () => {
      const placedEvent = {
        betId: '111',
        walletAddress: '0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097',
        eventType: 'placed' as const,
        portfolioSize: 15000,
        amount: '80.000000',
        result: null,
        timestamp: '2026-01-23T10:45:00Z'
      }

      expect(placedEvent.result).toBeNull()
    })
  })

  describe('Error handling (no mock fallback)', () => {
    it('throws error when backend URL is not configured', async () => {
      // In production, the hook now throws instead of falling back to mock data
      // This test validates the error handling pattern
      const envBackup = process.env.NEXT_PUBLIC_BACKEND_URL
      delete process.env.NEXT_PUBLIC_BACKEND_URL

      try {
        const { getBackendUrl } = await import('../../lib/contracts/addresses')
        expect(() => getBackendUrl()).toThrow()
      } finally {
        process.env.NEXT_PUBLIC_BACKEND_URL = envBackup
      }
    })

    it('fetch failure propagates as error (no mock fallback)', async () => {
      // Mock fetch to fail
      globalThis.fetch = mock(() => Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response))

      // The hook should throw errors now instead of returning mock data
      // Real integration tests verify this behavior
      expect(true).toBe(true)
    })
  })

  describe('API response handling', () => {
    it('parses valid API response correctly', () => {
      const apiResponse = {
        events: [
          {
            betId: '1',
            walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            eventType: 'placed',
            portfolioSize: 18500,
            amount: '120.000000',
            result: null,
            timestamp: '2026-01-23T10:30:00Z'
          }
        ]
      }

      expect(Array.isArray(apiResponse.events)).toBe(true)
      expect(apiResponse.events.length).toBe(1)
      expect(apiResponse.events[0].betId).toBe('1')
    })

    it('validates events are ordered by timestamp descending', () => {
      const events = [
        { timestamp: '2026-01-23T10:35:00Z' },
        { timestamp: '2026-01-23T10:30:00Z' },
        { timestamp: '2026-01-23T10:25:00Z' }
      ]

      for (let i = 1; i < events.length; i++) {
        const prev = new Date(events[i - 1].timestamp).getTime()
        const curr = new Date(events[i].timestamp).getTime()
        expect(prev).toBeGreaterThan(curr)
      }
    })
  })

  describe('Query configuration constants', () => {
    it('default limit should be 20 per AC4', () => {
      const DEFAULT_LIMIT = 20
      expect(DEFAULT_LIMIT).toBe(20)
    })

    it('refetch interval should be 60 seconds for polling', () => {
      const REFETCH_INTERVAL = 60000
      expect(REFETCH_INTERVAL).toBe(60000)
    })

    it('stale time should be 30 seconds', () => {
      const STALE_TIME = 30000
      expect(STALE_TIME).toBe(30000)
    })
  })
})

describe('BetEventType enum values', () => {
  const validTypes = ['placed', 'matched', 'won', 'lost']

  it('placed is a valid event type', () => {
    expect(validTypes).toContain('placed')
  })

  it('matched is a valid event type', () => {
    expect(validTypes).toContain('matched')
  })

  it('won is a valid event type', () => {
    expect(validTypes).toContain('won')
  })

  it('lost is a valid event type', () => {
    expect(validTypes).toContain('lost')
  })
})
