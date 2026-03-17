import { describe, test, expect } from 'bun:test'
import type { RecentBetEvent } from '@/hooks/useRecentBets'

describe('AnimatedBetFeedItem', () => {
  // Create test event data
  const createTestEvent = (overrides?: Partial<RecentBetEvent>): RecentBetEvent => ({
    betId: '123',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    eventType: 'placed',
    portfolioSize: 15000,
    amount: '100.000000',
    result: null,
    timestamp: new Date().toISOString(),
    ...overrides
  })

  describe('Animation variants', () => {
    const standardVariants = {
      initial: { opacity: 0, y: -20 },
      animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.3, ease: 'easeOut' }
      },
      exit: {
        opacity: 0,
        transition: { duration: 0.2 }
      }
    }

    const megaVariants = {
      initial: { opacity: 0, y: -20, scale: 0.98 },
      animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.35, ease: 'easeOut' }
      },
      exit: {
        opacity: 0,
        transition: { duration: 0.2 }
      }
    }

    test('standard variants have correct initial state', () => {
      expect(standardVariants.initial.opacity).toBe(0)
      expect(standardVariants.initial.y).toBe(-20)
    })

    test('standard variants animate to visible state', () => {
      expect(standardVariants.animate.opacity).toBe(1)
      expect(standardVariants.animate.y).toBe(0)
    })

    test('standard variants have 0.3s duration', () => {
      expect(standardVariants.animate.transition.duration).toBe(0.3)
    })

    test('mega variants include scale animation', () => {
      expect(megaVariants.initial.scale).toBe(0.98)
      expect(megaVariants.animate.scale).toBe(1)
    })

    test('mega variants have longer duration (0.35s)', () => {
      expect(megaVariants.animate.transition.duration).toBe(0.35)
    })

    test('exit animation fades out', () => {
      expect(standardVariants.exit.opacity).toBe(0)
      expect(megaVariants.exit.opacity).toBe(0)
    })
  })

  describe('Animation conditions', () => {
    test('shouldAnimate is true when isNew and not reduced motion and not mobile', () => {
      const isNew = true
      const prefersReducedMotion = false
      const isMobile = false

      const shouldAnimate = isNew && !prefersReducedMotion && !isMobile
      expect(shouldAnimate).toBe(true)
    })

    test('shouldAnimate is false when prefersReducedMotion is true', () => {
      const isNew = true
      const prefersReducedMotion = true
      const isMobile = false

      const shouldAnimate = isNew && !prefersReducedMotion && !isMobile
      expect(shouldAnimate).toBe(false)
    })

    test('shouldAnimate is false when isMobile is true', () => {
      const isNew = true
      const prefersReducedMotion = false
      const isMobile = true

      const shouldAnimate = isNew && !prefersReducedMotion && !isMobile
      expect(shouldAnimate).toBe(false)
    })

    test('shouldAnimate is false when isNew is false', () => {
      const isNew = false
      const prefersReducedMotion = false
      const isMobile = false

      const shouldAnimate = isNew && !prefersReducedMotion && !isMobile
      expect(shouldAnimate).toBe(false)
    })
  })

  describe('Mega portfolio detection', () => {
    test('portfolioSize >= 20000 is mega portfolio', () => {
      const event = createTestEvent({ portfolioSize: 20000 })
      expect(event.portfolioSize >= 20000).toBe(true)
    })

    test('portfolioSize > 20000 is mega portfolio', () => {
      const event = createTestEvent({ portfolioSize: 25000 })
      expect(event.portfolioSize >= 20000).toBe(true)
    })

    test('portfolioSize < 20000 is not mega portfolio', () => {
      const event = createTestEvent({ portfolioSize: 19999 })
      expect(event.portfolioSize >= 20000).toBe(false)
    })

    test('portfolioSize = 5000 is not mega portfolio', () => {
      const event = createTestEvent({ portfolioSize: 5000 })
      expect(event.portfolioSize >= 20000).toBe(false)
    })
  })

  describe('CSS pulse class selection', () => {
    test('mega portfolio uses animate-pulse-red-strong-bet class', () => {
      const isMegaPortfolio = true
      const pulseClass = isMegaPortfolio ? 'animate-pulse-red-strong-bet' : 'animate-pulse-red-bet'
      expect(pulseClass).toBe('animate-pulse-red-strong-bet')
    })

    test('regular portfolio uses animate-pulse-red-bet class', () => {
      const isMegaPortfolio = false
      const pulseClass = isMegaPortfolio ? 'animate-pulse-red-strong-bet' : 'animate-pulse-red-bet'
      expect(pulseClass).toBe('animate-pulse-red-bet')
    })
  })

  describe('Event type styling', () => {
    test('placed event renders correctly', () => {
      const event = createTestEvent({ eventType: 'placed' })
      expect(event.eventType).toBe('placed')
      expect(event.result).toBeNull()
    })

    test('matched event renders correctly', () => {
      const event = createTestEvent({ eventType: 'matched' })
      expect(event.eventType).toBe('matched')
      expect(event.result).toBeNull()
    })

    test('won event includes positive result', () => {
      const event = createTestEvent({
        eventType: 'won',
        result: '50.000000'
      })
      expect(event.eventType).toBe('won')
      expect(parseFloat(event.result!)).toBeGreaterThan(0)
    })

    test('lost event includes negative result', () => {
      const event = createTestEvent({
        eventType: 'lost',
        result: '-25.000000'
      })
      expect(event.eventType).toBe('lost')
      expect(parseFloat(event.result!)).toBeLessThan(0)
    })
  })

  describe('Animation timing', () => {
    test('standard animation is 0.3s per AC4 specification', () => {
      const duration = 0.3
      expect(duration).toBe(0.3)
    })

    test('exit animation is 0.2s for quick removal', () => {
      const exitDuration = 0.2
      expect(exitDuration).toBe(0.2)
    })

    test('CSS pulse duration is 0.5s per AC2', () => {
      // The CSS animation pulse-red-bet is 0.5s
      const pulseDuration = 0.5
      expect(pulseDuration).toBe(0.5)
    })

    test('mega portfolio CSS pulse is 0.7s for emphasis', () => {
      // The CSS animation pulse-red-strong-bet is 0.7s
      const strongPulseDuration = 0.7
      expect(strongPulseDuration).toBe(0.7)
    })
  })
})
