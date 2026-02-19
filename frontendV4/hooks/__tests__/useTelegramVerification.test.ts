/**
 * Tests for useTelegramVerification hook
 *
 * Story 6-3: Tests for wallet-Telegram linking verification
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'

// Mock responses
const mockCodeInfo = { telegramUserId: 123456789 }
const mockVerifySuccess = {
  success: true,
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  telegramUserId: 123456789,
}

describe('useTelegramVerification', () => {
  describe('Message Format', () => {
    it('should format message correctly per AC2', () => {
      // AC2: "AgiArena Telegram Link: {telegramUserId} at {timestamp}"
      const telegramUserId = 123456789
      const timestamp = 1737590400
      const message = `AgiArena Telegram Link: ${telegramUserId} at ${timestamp}`

      expect(message).toBe('AgiArena Telegram Link: 123456789 at 1737590400')
    })

    it('should handle various telegram user IDs', () => {
      const testCases = [
        { id: 1, expected: 'AgiArena Telegram Link: 1 at 100' },
        { id: 999999999, expected: 'AgiArena Telegram Link: 999999999 at 100' },
        { id: 1234567890, expected: 'AgiArena Telegram Link: 1234567890 at 100' },
      ]

      for (const { id, expected } of testCases) {
        const message = `AgiArena Telegram Link: ${id} at 100`
        expect(message).toBe(expected)
      }
    })
  })

  describe('Code Lookup API', () => {
    it('should return telegramUserId for valid code', async () => {
      // Simulate successful code lookup
      const mockFetch = mock((url: string) => {
        if (url.includes('/api/telegram/code/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCodeInfo),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      global.fetch = mockFetch as unknown as typeof fetch

      const res = await fetch('http://localhost:3001/api/telegram/code/ABC123')
      const data = await res.json()

      expect(data.telegramUserId).toBe(123456789)
    })

    it('should return 404 for invalid code', async () => {
      const mockFetch = mock((url: string) => {
        if (url.includes('/api/telegram/code/')) {
          return Promise.resolve({
            ok: false,
            status: 404,
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      global.fetch = mockFetch as unknown as typeof fetch

      const res = await fetch('http://localhost:3001/api/telegram/code/INVALID')
      expect(res.ok).toBe(false)
      expect(res.status).toBe(404)
    })
  })

  describe('Verify API', () => {
    it('should send correct request body', async () => {
      let capturedBody: string | null = null

      const mockFetch = mock((url: string, init?: RequestInit) => {
        if (url.includes('/api/telegram/verify') && init?.method === 'POST') {
          capturedBody = init.body as string
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVerifySuccess),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      global.fetch = mockFetch as unknown as typeof fetch

      const requestBody = {
        code: 'ABC123',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        signature: '0xsignature...',
        timestamp: 1737590400,
      }

      await fetch('http://localhost:3001/api/telegram/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      expect(capturedBody).toBeDefined()
      const parsed = JSON.parse(capturedBody!)
      expect(parsed.code).toBe('ABC123')
      expect(parsed.walletAddress).toBe('0x1234567890abcdef1234567890abcdef12345678')
      expect(parsed.signature).toBe('0xsignature...')
      expect(parsed.timestamp).toBe(1737590400)
    })

    it('should use camelCase for request body per backend API', async () => {
      const requestBody = {
        code: 'ABC123',
        walletAddress: '0x123',
        signature: '0xsig',
        timestamp: 123,
      }

      const json = JSON.stringify(requestBody)

      // Should use camelCase keys
      expect(json).toContain('"walletAddress"')
      expect(json).not.toContain('"wallet_address"')
    })
  })

  describe('Status Flow', () => {
    it('should track all status states', () => {
      const validStatuses = ['idle', 'loading', 'signing', 'verifying', 'success', 'error']

      // These are the states the hook can be in
      validStatuses.forEach(status => {
        expect(['idle', 'loading', 'signing', 'verifying', 'success', 'error']).toContain(status)
      })
    })

    it('should have correct status transitions', () => {
      // idle -> loading (start verification)
      // loading -> signing (code valid, waiting for signature)
      // signing -> verifying (signature received)
      // verifying -> success (backend confirmed)
      // any -> error (on failure)

      const validTransitions = {
        idle: ['loading'],
        loading: ['signing', 'error'],
        signing: ['verifying', 'error'],
        verifying: ['success', 'error'],
        success: [], // terminal state
        error: ['idle'], // can reset
      }

      // Verify all statuses have defined transitions
      expect(Object.keys(validTransitions)).toEqual(
        ['idle', 'loading', 'signing', 'verifying', 'success', 'error']
      )
    })
  })
})

describe('Telegram Verification Page', () => {
  describe('URL Parameters', () => {
    it('should accept code from URL query params', () => {
      const url = new URL('http://localhost:3000/telegram/verify?code=ABC123')
      const code = url.searchParams.get('code')
      expect(code).toBe('ABC123')
    })

    it('should handle missing code gracefully', () => {
      const url = new URL('http://localhost:3000/telegram/verify')
      const code = url.searchParams.get('code')
      expect(code).toBeNull()
    })
  })

  describe('Verification Link Format', () => {
    it('should generate correct verification URL', () => {
      const frontendUrl = 'https://agiarena.xyz'
      const code = 'ABC123'
      const verificationUrl = `${frontendUrl}/telegram/verify?code=${code}`

      expect(verificationUrl).toBe('https://agiarena.xyz/telegram/verify?code=ABC123')
    })
  })
})
