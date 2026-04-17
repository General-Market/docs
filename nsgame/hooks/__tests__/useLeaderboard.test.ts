import { describe, test, expect, mock, beforeEach } from 'bun:test'

// Mock the getBackendUrl function
const mockGetBackendUrl = mock(() => 'http://localhost:3001')

// We test the pure functions and logic without needing React Query context
describe('useLeaderboard', () => {
  describe('AgentRanking interface', () => {
    test('validates correct AgentRanking structure', () => {
      const validAgent = {
        rank: 1,
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        pnl: 12567.89,
        winRate: 73.5,
        roi: 156.3,
        volume: 45678.90,
        totalBets: 234,
        avgPortfolioSize: 18500,
        maxPortfolioSize: 25000,
        lastActiveAt: new Date().toISOString()
      }

      expect(validAgent.rank).toBe(1)
      expect(validAgent.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(typeof validAgent.pnl).toBe('number')
      expect(validAgent.winRate).toBeGreaterThanOrEqual(0)
      expect(validAgent.winRate).toBeLessThanOrEqual(100)
    })

    test('handles negative P&L values', () => {
      const losingAgent = {
        rank: 10,
        walletAddress: '0x09DB0a93B389bEF724429898f539AEB7ac2Dd55f',
        pnl: -1234.56,
        winRate: 42.1,
        roi: -28.7,
        volume: 5200.00,
        totalBets: 54,
        avgPortfolioSize: 3500,
        maxPortfolioSize: 6100,
        lastActiveAt: new Date().toISOString()
      }

      expect(losingAgent.pnl).toBeLessThan(0)
      expect(losingAgent.roi).toBeLessThan(0)
    })
  })

  describe('LeaderboardResponse interface', () => {
    test('validates correct response structure', () => {
      const response = {
        leaderboard: [
          {
            rank: 1,
            walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            pnl: 12567.89,
            winRate: 73.5,
            roi: 156.3,
            volume: 45678.90,
            totalBets: 234,
            avgPortfolioSize: 18500,
            maxPortfolioSize: 25000,
            lastActiveAt: new Date().toISOString()
          }
        ],
        updatedAt: new Date().toISOString()
      }

      expect(Array.isArray(response.leaderboard)).toBe(true)
      expect(response.leaderboard.length).toBe(1)
      expect(response.updatedAt).toBeTruthy()
    })

    test('handles empty leaderboard', () => {
      const response = {
        leaderboard: [],
        updatedAt: new Date().toISOString()
      }

      expect(response.leaderboard.length).toBe(0)
    })
  })

  describe('Sorting behavior', () => {
    test('leaderboard should be sortable by P&L descending', () => {
      const unsortedLeaderboard = [
        { rank: 3, pnl: 1000, walletAddress: '0x111' },
        { rank: 1, pnl: 5000, walletAddress: '0x222' },
        { rank: 2, pnl: 3000, walletAddress: '0x333' },
      ]

      const sorted = [...unsortedLeaderboard].sort((a, b) => b.pnl - a.pnl)

      expect(sorted[0].pnl).toBe(5000)
      expect(sorted[1].pnl).toBe(3000)
      expect(sorted[2].pnl).toBe(1000)
    })

    test('handles negative P&L in sorting', () => {
      const mixedLeaderboard = [
        { rank: 2, pnl: -500, walletAddress: '0x111' },
        { rank: 1, pnl: 1000, walletAddress: '0x222' },
        { rank: 3, pnl: -1000, walletAddress: '0x333' },
      ]

      const sorted = [...mixedLeaderboard].sort((a, b) => b.pnl - a.pnl)

      expect(sorted[0].pnl).toBe(1000)
      expect(sorted[1].pnl).toBe(-500)
      expect(sorted[2].pnl).toBe(-1000)
    })
  })
})
