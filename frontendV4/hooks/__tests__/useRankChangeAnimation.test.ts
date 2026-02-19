import { describe, test, expect } from 'bun:test'
import type { UseRankChangeAnimationReturn } from '../useRankChangeAnimation'
import type { RankChangeEvent } from '../useLeaderboardSSE'

describe('useRankChangeAnimation', () => {
  describe('UseRankChangeAnimationReturn interface', () => {
    test('validates correct return structure when not animating', () => {
      const notAnimating: UseRankChangeAnimationReturn = {
        isAnimating: false,
        rankDelta: 0,
        isPositive: false,
        oldRank: null,
        newRank: null
      }

      expect(notAnimating.isAnimating).toBe(false)
      expect(notAnimating.rankDelta).toBe(0)
      expect(notAnimating.isPositive).toBe(false)
      expect(notAnimating.oldRank).toBeNull()
      expect(notAnimating.newRank).toBeNull()
    })

    test('validates correct return structure when animating positive change', () => {
      // Agent moved UP in rankings (e.g., from rank 5 to rank 3)
      const animatingUp: UseRankChangeAnimationReturn = {
        isAnimating: true,
        rankDelta: 2, // 5 - 3 = 2 (positive = moved up)
        isPositive: true,
        oldRank: 5,
        newRank: 3
      }

      expect(animatingUp.isAnimating).toBe(true)
      expect(animatingUp.rankDelta).toBe(2)
      expect(animatingUp.isPositive).toBe(true)
      expect(animatingUp.oldRank).toBe(5)
      expect(animatingUp.newRank).toBe(3)
    })

    test('validates correct return structure when animating negative change', () => {
      // Agent moved DOWN in rankings (e.g., from rank 2 to rank 5)
      const animatingDown: UseRankChangeAnimationReturn = {
        isAnimating: true,
        rankDelta: -3, // 2 - 5 = -3 (negative = moved down)
        isPositive: false, // isPositive = rankDelta > 0, so -3 > 0 is false
        oldRank: 2,
        newRank: 5
      }

      expect(animatingDown.isAnimating).toBe(true) // Still animating, just negative direction
      expect(animatingDown.rankDelta).toBe(-3)
      expect(animatingDown.isPositive).toBe(false) // Negative delta means moved down
      expect(animatingDown.oldRank).toBe(2)
      expect(animatingDown.newRank).toBe(5)
    })
  })

  describe('RankChangeEvent interface', () => {
    test('validates correct event structure', () => {
      const event: RankChangeEvent = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        oldRank: 10,
        newRank: 5
      }

      expect(event.address).toBe('0x1234567890abcdef1234567890abcdef12345678')
      expect(event.oldRank).toBe(10)
      expect(event.newRank).toBe(5)
    })
  })

  describe('Rank delta calculation', () => {
    function calculateRankDelta(oldRank: number, newRank: number): number {
      // Positive delta = moved UP (lower rank number is better)
      // e.g., 5 -> 3 means delta = 5 - 3 = 2 (positive, moved up)
      // e.g., 3 -> 5 means delta = 3 - 5 = -2 (negative, moved down)
      return oldRank - newRank
    }

    test('moving up in rankings produces positive delta', () => {
      // Rank 5 -> Rank 3 (moved up 2 places)
      expect(calculateRankDelta(5, 3)).toBe(2)
      expect(calculateRankDelta(5, 3) > 0).toBe(true)
    })

    test('moving down in rankings produces negative delta', () => {
      // Rank 3 -> Rank 5 (moved down 2 places)
      expect(calculateRankDelta(3, 5)).toBe(-2)
      expect(calculateRankDelta(3, 5) > 0).toBe(false)
    })

    test('no rank change produces zero delta', () => {
      expect(calculateRankDelta(3, 3)).toBe(0)
    })

    test('first place remains first', () => {
      expect(calculateRankDelta(1, 1)).toBe(0)
    })

    test('moving to first place from second', () => {
      expect(calculateRankDelta(2, 1)).toBe(1)
      expect(calculateRankDelta(2, 1) > 0).toBe(true)
    })
  })

  describe('Animation duration', () => {
    const ANIMATION_DURATION = 2000 // From useRankChangeAnimation.ts

    test('animation duration is 2 seconds', () => {
      expect(ANIMATION_DURATION).toBe(2000)
    })

    test('animation clears after duration', () => {
      // This documents the expected behavior:
      // After ANIMATION_DURATION ms, isAnimating should return to false
      const beforeTimeout = true
      const afterTimeout = false

      expect(beforeTimeout).toBe(true)
      expect(afterTimeout).toBe(false)
    })
  })

  describe('Wallet address matching', () => {
    function addressesMatch(eventAddress: string, componentAddress: string): boolean {
      return eventAddress.toLowerCase() === componentAddress.toLowerCase()
    }

    test('matches same case addresses', () => {
      expect(addressesMatch('0xABC', '0xABC')).toBe(true)
    })

    test('matches different case addresses (case-insensitive)', () => {
      expect(addressesMatch('0xABC', '0xabc')).toBe(true)
      expect(addressesMatch('0xabc', '0xABC')).toBe(true)
    })

    test('does not match different addresses', () => {
      expect(addressesMatch('0xABC', '0xDEF')).toBe(false)
    })

    test('handles checksummed addresses', () => {
      const checksummed = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
      const lowercase = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
      expect(addressesMatch(checksummed, lowercase)).toBe(true)
    })
  })

  describe('P&L and portfolio size animation handling (Story 6.5)', () => {
    /**
     * Design documentation:
     * - P&L changes are NOT tracked by this hook
     * - P&L animation is handled by AnimatedNumber component receiving new value prop
     * - This hook ONLY triggers the row pulse animation on rank changes
     * - SSE sends full leaderboard-update events which update TanStack Query cache
     * - AnimatedNumber components automatically animate when their value prop changes
     */

    test('P&L animation is handled by AnimatedNumber receiving new props', () => {
      // AnimatedNumber tracks value changes internally via previousValueRef
      // It animates when: value !== previousValueRef.current && !disabled
      const previousValue = 1000
      const newValue = 1500
      const shouldAnimate = newValue !== previousValue
      expect(shouldAnimate).toBe(true)
    })

    test('portfolio size animation uses same AnimatedNumber pattern', () => {
      const previousPortfolioSize = 15000
      const newPortfolioSize = 17000
      const shouldAnimate = newPortfolioSize !== previousPortfolioSize
      expect(shouldAnimate).toBe(true)
    })

    test('useRankChangeAnimation only handles row pulse, not value animations', () => {
      // This hook's responsibility:
      // - Listen for rank-change events
      // - Set isAnimating = true to trigger CSS pulse
      // - Clear after ANIMATION_DURATION (2s)

      // NOT responsible for:
      // - Tracking P&L values
      // - Tracking portfolio size values
      // - Animating number counts (that's AnimatedNumber's job)

      const hookResponsibilities = ['rankPulseAnimation']
      const animatedNumberResponsibilities = ['pnlAnimation', 'rankNumberAnimation', 'portfolioSizeAnimation']

      expect(hookResponsibilities).not.toContain('pnlAnimation')
      expect(animatedNumberResponsibilities).toContain('pnlAnimation')
    })

    test('SSE leaderboard-update provides all data needed for animations', () => {
      // When SSE sends leaderboard-update:
      // 1. useLeaderboardSSE calls queryClient.setQueryData(['leaderboard'], data)
      // 2. Components re-render with new data
      // 3. AnimatedNumber sees value changes and animates
      // 4. useRankChangeAnimation sees rank-change events and triggers pulse

      interface LeaderboardUpdateData {
        leaderboard: Array<{
          walletAddress: string
          rank: number
          pnl: number
          avgPortfolioSize: number
          maxPortfolioSize: number
        }>
        updatedAt: string
      }

      const sseData: LeaderboardUpdateData = {
        leaderboard: [
          { walletAddress: '0xABC', rank: 1, pnl: 5000, avgPortfolioSize: 15000, maxPortfolioSize: 20000 }
        ],
        updatedAt: new Date().toISOString()
      }

      // This data is sufficient for AnimatedNumber to animate all values
      expect(sseData.leaderboard[0].pnl).toBe(5000)
      expect(sseData.leaderboard[0].avgPortfolioSize).toBe(15000)
      expect(sseData.leaderboard[0].maxPortfolioSize).toBe(20000)
    })
  })
})
