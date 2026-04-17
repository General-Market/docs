import { describe, test, expect } from 'vitest'
import {
  calculateSignatureProgress,
  isThresholdMet,
  formatSignedTimeAgo,
  type SignatureStatus,
  type KeeperSignature,
  type KeeperSignatureStatus,
  type ResolutionCollectionStatus,
  type SignatureCollectedEvent,
  type ResolutionSubmittedEvent,
} from '@/lib/types/resolution'

/**
 * Tests for Resolution Signature Types and Utilities
 *
 * Story 14.3, Task 13: Frontend tests for signature collection
 */

describe('Resolution Signature Types', () => {
  describe('SignatureStatus interface', () => {
    test('creates valid signature status for collecting state', () => {
      const status: SignatureStatus = {
        betId: 123,
        totalKeepers: 5,
        signedCount: 2,
        requiredCount: 3,
        status: 'collecting',
        keepers: [],
      }

      expect(status.betId).toBe(123)
      expect(status.totalKeepers).toBe(5)
      expect(status.signedCount).toBe(2)
      expect(status.requiredCount).toBe(3)
      expect(status.status).toBe('collecting')
    })

    test('creates valid signature status for ready state', () => {
      const status: SignatureStatus = {
        betId: 456,
        totalKeepers: 5,
        signedCount: 3,
        requiredCount: 3,
        status: 'ready',
        keepers: [],
      }

      expect(status.status).toBe('ready')
      expect(status.signedCount).toBe(status.requiredCount)
    })

    test('creates valid signature status for submitted state with txHash', () => {
      const status: SignatureStatus = {
        betId: 789,
        totalKeepers: 5,
        signedCount: 4,
        requiredCount: 3,
        status: 'submitted',
        keepers: [],
        txHash: '0xabcdef1234567890',
      }

      expect(status.status).toBe('submitted')
      expect(status.txHash).toBe('0xabcdef1234567890')
    })

    test('creates valid signature status for expired state', () => {
      const status: SignatureStatus = {
        betId: 101,
        totalKeepers: 5,
        signedCount: 1,
        requiredCount: 3,
        status: 'expired',
        keepers: [],
      }

      expect(status.status).toBe('expired')
      expect(status.signedCount).toBeLessThan(status.requiredCount)
    })
  })

  describe('KeeperSignature interface', () => {
    test('creates valid keeper signature with signed status', () => {
      const keeper: KeeperSignature = {
        address: '0x1234567890123456789012345678901234567890',
        status: 'signed',
        signedAt: '2026-01-31T10:00:00Z',
      }

      expect(keeper.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(keeper.status).toBe('signed')
      expect(keeper.signedAt).toBeDefined()
    })

    test('creates valid keeper signature with pending status', () => {
      const keeper: KeeperSignature = {
        address: '0xabcdef0123456789abcdef0123456789abcdef01',
        status: 'pending',
      }

      expect(keeper.status).toBe('pending')
      expect(keeper.signedAt).toBeUndefined()
    })

    test('creates valid keeper signature with failed status', () => {
      const keeper: KeeperSignature = {
        address: '0x9876543210987654321098765432109876543210',
        status: 'failed',
        error: 'Connection refused',
      }

      expect(keeper.status).toBe('failed')
      expect(keeper.error).toBe('Connection refused')
    })

    test('creates valid keeper signature with timeout status', () => {
      const keeper: KeeperSignature = {
        address: '0xfedcba0987654321fedcba0987654321fedcba09',
        status: 'timeout',
      }

      expect(keeper.status).toBe('timeout')
    })
  })

  describe('KeeperSignatureStatus type', () => {
    test('includes all expected status values', () => {
      const validStatuses: KeeperSignatureStatus[] = ['pending', 'signed', 'failed', 'timeout']

      expect(validStatuses).toContain('pending')
      expect(validStatuses).toContain('signed')
      expect(validStatuses).toContain('failed')
      expect(validStatuses).toContain('timeout')
    })
  })

  describe('ResolutionCollectionStatus type', () => {
    test('includes all expected collection status values', () => {
      const validStatuses: ResolutionCollectionStatus[] = ['collecting', 'ready', 'submitted', 'expired']

      expect(validStatuses).toContain('collecting')
      expect(validStatuses).toContain('ready')
      expect(validStatuses).toContain('submitted')
      expect(validStatuses).toContain('expired')
    })
  })
})

describe('Progress Calculation', () => {
  describe('calculateSignatureProgress', () => {
    test('calculates 0% progress with no signatures', () => {
      const progress = calculateSignatureProgress(0, 3)
      expect(progress).toBe(0)
    })

    test('calculates partial progress', () => {
      const progress = calculateSignatureProgress(1, 3)
      expect(progress).toBeCloseTo(33.33, 1)
    })

    test('calculates 50% progress', () => {
      const progress = calculateSignatureProgress(2, 4)
      expect(progress).toBe(50)
    })

    test('calculates 100% progress when threshold met', () => {
      const progress = calculateSignatureProgress(3, 3)
      expect(progress).toBe(100)
    })

    test('caps progress at 100% when exceeding required', () => {
      const progress = calculateSignatureProgress(5, 3)
      expect(progress).toBe(100)
    })

    test('returns 0 when required count is 0', () => {
      const progress = calculateSignatureProgress(2, 0)
      expect(progress).toBe(0)
    })
  })

  describe('isThresholdMet', () => {
    test('returns false when below threshold', () => {
      expect(isThresholdMet(2, 3)).toBe(false)
    })

    test('returns true when at threshold', () => {
      expect(isThresholdMet(3, 3)).toBe(true)
    })

    test('returns true when above threshold', () => {
      expect(isThresholdMet(4, 3)).toBe(true)
    })

    test('returns true with 0 required', () => {
      expect(isThresholdMet(0, 0)).toBe(true)
    })
  })
})

describe('Time Formatting', () => {
  describe('formatSignedTimeAgo', () => {
    test('formats seconds ago', () => {
      const recentTime = new Date(Date.now() - 30 * 1000).toISOString()
      const result = formatSignedTimeAgo(recentTime)
      expect(result).toMatch(/^\d+s ago$/)
    })

    test('formats minutes ago', () => {
      const minutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const result = formatSignedTimeAgo(minutesAgo)
      expect(result).toMatch(/^\d+m ago$/)
    })

    test('formats hours ago', () => {
      const hoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const result = formatSignedTimeAgo(hoursAgo)
      expect(result).toMatch(/^\d+h ago$/)
    })

    test('handles edge case at exactly 60 seconds', () => {
      const exactlyOneMinute = new Date(Date.now() - 60 * 1000).toISOString()
      const result = formatSignedTimeAgo(exactlyOneMinute)
      // Should show 1m ago, not 60s ago
      expect(result).toBe('1m ago')
    })
  })
})

describe('SSE Event Types', () => {
  describe('SignatureCollectedEvent', () => {
    test('has correct structure', () => {
      const event: SignatureCollectedEvent = {
        type: 'signature-collected',
        betId: 123,
        keeperAddress: '0x1234567890123456789012345678901234567890',
        signedCount: 3,
        totalKeepers: 5,
        requiredCount: 3,
      }

      expect(event.type).toBe('signature-collected')
      expect(event.betId).toBe(123)
      expect(event.keeperAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(event.signedCount).toBe(3)
      expect(event.totalKeepers).toBe(5)
      expect(event.requiredCount).toBe(3)
    })
  })

  describe('ResolutionSubmittedEvent', () => {
    test('has correct structure', () => {
      const event: ResolutionSubmittedEvent = {
        type: 'resolution-submitted',
        betId: 456,
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        signersCount: 4,
      }

      expect(event.type).toBe('resolution-submitted')
      expect(event.betId).toBe(456)
      expect(event.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(event.signersCount).toBe(4)
    })
  })
})

describe('51% Threshold Calculation', () => {
  test('calculates threshold for different keeper counts', () => {
    const calculateRequired = (total: number) => Math.ceil((total * 51) / 100)

    expect(calculateRequired(1)).toBe(1)  // 1 keeper: need 1
    expect(calculateRequired(2)).toBe(2)  // 2 keepers: need 2 (51% of 2 = 1.02, ceil = 2)
    expect(calculateRequired(3)).toBe(2)  // 3 keepers: need 2 (51% of 3 = 1.53, ceil = 2)
    expect(calculateRequired(4)).toBe(3)  // 4 keepers: need 3
    expect(calculateRequired(5)).toBe(3)  // 5 keepers: need 3
    expect(calculateRequired(7)).toBe(4)  // 7 keepers: need 4
    expect(calculateRequired(10)).toBe(6) // 10 keepers: need 6
  })
})

describe('Integration Scenarios', () => {
  describe('Full signature collection flow', () => {
    test('simulates collecting to ready transition', () => {
      // Initial state
      const initialStatus: SignatureStatus = {
        betId: 100,
        totalKeepers: 5,
        signedCount: 1,
        requiredCount: 3,
        status: 'collecting',
        keepers: [
          { address: '0x1111111111111111111111111111111111111111', status: 'signed', signedAt: new Date().toISOString() },
          { address: '0x2222222222222222222222222222222222222222', status: 'pending' },
          { address: '0x3333333333333333333333333333333333333333', status: 'pending' },
          { address: '0x4444444444444444444444444444444444444444', status: 'pending' },
          { address: '0x5555555555555555555555555555555555555555', status: 'pending' },
        ],
      }

      expect(calculateSignatureProgress(initialStatus.signedCount, initialStatus.requiredCount)).toBeCloseTo(33.33, 1)
      expect(isThresholdMet(initialStatus.signedCount, initialStatus.requiredCount)).toBe(false)

      // After collecting 3 signatures
      const readyStatus: SignatureStatus = {
        ...initialStatus,
        signedCount: 3,
        status: 'ready',
        keepers: [
          { address: '0x1111111111111111111111111111111111111111', status: 'signed', signedAt: new Date().toISOString() },
          { address: '0x2222222222222222222222222222222222222222', status: 'signed', signedAt: new Date().toISOString() },
          { address: '0x3333333333333333333333333333333333333333', status: 'signed', signedAt: new Date().toISOString() },
          { address: '0x4444444444444444444444444444444444444444', status: 'pending' },
          { address: '0x5555555555555555555555555555555555555555', status: 'failed', error: 'Connection refused' },
        ],
      }

      expect(calculateSignatureProgress(readyStatus.signedCount, readyStatus.requiredCount)).toBe(100)
      expect(isThresholdMet(readyStatus.signedCount, readyStatus.requiredCount)).toBe(true)
      expect(readyStatus.status).toBe('ready')
    })

    test('simulates submission after threshold met', () => {
      const submittedStatus: SignatureStatus = {
        betId: 200,
        totalKeepers: 5,
        signedCount: 4,
        requiredCount: 3,
        status: 'submitted',
        keepers: [
          { address: '0x1111111111111111111111111111111111111111', status: 'signed', signedAt: new Date().toISOString() },
          { address: '0x2222222222222222222222222222222222222222', status: 'signed', signedAt: new Date().toISOString() },
          { address: '0x3333333333333333333333333333333333333333', status: 'signed', signedAt: new Date().toISOString() },
          { address: '0x4444444444444444444444444444444444444444', status: 'signed', signedAt: new Date().toISOString() },
          { address: '0x5555555555555555555555555555555555555555', status: 'timeout' },
        ],
        txHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      }

      expect(submittedStatus.status).toBe('submitted')
      expect(submittedStatus.txHash).toBeDefined()
      expect(submittedStatus.keepers.filter(k => k.status === 'signed').length).toBe(4)
    })

    test('simulates expiration when threshold not met', () => {
      const expiredStatus: SignatureStatus = {
        betId: 300,
        totalKeepers: 5,
        signedCount: 1,
        requiredCount: 3,
        status: 'expired',
        keepers: [
          { address: '0x1111111111111111111111111111111111111111', status: 'signed', signedAt: new Date().toISOString() },
          { address: '0x2222222222222222222222222222222222222222', status: 'timeout' },
          { address: '0x3333333333333333333333333333333333333333', status: 'failed', error: 'Keeper offline' },
          { address: '0x4444444444444444444444444444444444444444', status: 'timeout' },
          { address: '0x5555555555555555555555555555555555555555', status: 'timeout' },
        ],
      }

      expect(expiredStatus.status).toBe('expired')
      expect(isThresholdMet(expiredStatus.signedCount, expiredStatus.requiredCount)).toBe(false)
      expect(expiredStatus.keepers.filter(k => k.status === 'timeout').length).toBe(3)
      expect(expiredStatus.keepers.filter(k => k.status === 'failed').length).toBe(1)
    })
  })
})
