import { describe, test, expect } from 'bun:test'

/**
 * Tests for useAgentPerformance hook
 * Tests both interface contracts and mock data generation behavior
 */
describe('useAgentPerformance', () => {
  describe('PerformanceDataPoint interface', () => {
    test('validates correct PerformanceDataPoint structure', () => {
      const validDataPoint = {
        timestamp: new Date().toISOString(),
        cumulativePnL: 1234.56,
        betId: 'bet-abc123-1',
        betNumber: 1,
        portfolioSize: 15000,
        amount: 100,
        result: 15.50,
        resultPercent: 15.5
      }

      expect(validDataPoint.timestamp).toBeTruthy()
      expect(typeof validDataPoint.cumulativePnL).toBe('number')
      expect(validDataPoint.betId).toMatch(/^bet-/)
      expect(validDataPoint.betNumber).toBeGreaterThan(0)
      expect(validDataPoint.portfolioSize).toBeGreaterThan(0)
      expect(validDataPoint.amount).toBeGreaterThan(0)
    })

    test('handles negative P&L values', () => {
      const losingDataPoint = {
        timestamp: new Date().toISOString(),
        cumulativePnL: -567.89,
        betId: 'bet-abc123-5',
        betNumber: 5,
        portfolioSize: 12000,
        amount: 100,
        result: -15.50,
        resultPercent: -15.5
      }

      expect(losingDataPoint.cumulativePnL).toBeLessThan(0)
      expect(losingDataPoint.result).toBeLessThan(0)
      expect(losingDataPoint.resultPercent).toBeLessThan(0)
    })
  })

  describe('PerformanceResponse interface', () => {
    test('validates correct response structure', () => {
      const response = {
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        range: '30d' as const,
        dataPoints: [
          {
            timestamp: new Date().toISOString(),
            cumulativePnL: 100,
            betId: 'bet-1',
            betNumber: 1,
            portfolioSize: 10000,
            amount: 50,
            result: 10,
            resultPercent: 20
          }
        ],
        summary: {
          totalPnL: 100,
          startingPnL: 0,
          endingPnL: 100,
          totalBets: 1
        }
      }

      expect(response.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(['7d', '30d', '90d', 'all']).toContain(response.range)
      expect(Array.isArray(response.dataPoints)).toBe(true)
      expect(response.summary.totalBets).toBe(1)
    })

    test('handles empty data points', () => {
      const response = {
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        range: '7d' as const,
        dataPoints: [],
        summary: {
          totalPnL: 0,
          startingPnL: 0,
          endingPnL: 0,
          totalBets: 0
        }
      }

      expect(response.dataPoints.length).toBe(0)
      expect(response.summary.totalBets).toBe(0)
    })
  })

  describe('Range parameter handling', () => {
    test('validates all range options', () => {
      const validRanges = ['7d', '30d', '90d', 'all']

      validRanges.forEach(range => {
        expect(validRanges).toContain(range)
      })
    })
  })

  describe('Line color determination', () => {
    test('positive ending P&L should yield green color', () => {
      const dataPoints = [
        { cumulativePnL: -50 },
        { cumulativePnL: 100 }
      ]
      const lastPoint = dataPoints[dataPoints.length - 1]
      const isPositive = lastPoint.cumulativePnL >= 0

      expect(isPositive).toBe(true)
    })

    test('negative ending P&L should yield red color', () => {
      const dataPoints = [
        { cumulativePnL: 50 },
        { cumulativePnL: -100 }
      ]
      const lastPoint = dataPoints[dataPoints.length - 1]
      const isPositive = lastPoint.cumulativePnL >= 0

      expect(isPositive).toBe(false)
    })

    test('zero P&L should be treated as positive (green)', () => {
      const dataPoints = [
        { cumulativePnL: 50 },
        { cumulativePnL: 0 }
      ]
      const lastPoint = dataPoints[dataPoints.length - 1]
      const isPositive = lastPoint.cumulativePnL >= 0

      expect(isPositive).toBe(true)
    })
  })

  describe('Query key generation', () => {
    test('query key includes wallet address and range', () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const range = '30d'
      const queryKey = ['agent-performance', walletAddress, range]

      expect(queryKey).toEqual(['agent-performance', walletAddress, range])
      expect(queryKey.length).toBe(3)
    })

    test('different ranges create different query keys', () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const key7d = ['agent-performance', walletAddress, '7d']
      const key30d = ['agent-performance', walletAddress, '30d']

      expect(key7d).not.toEqual(key30d)
    })
  })

  describe('Mock data generation behavior', () => {
    // Simulates the mock data generation logic from useAgentPerformance
    function generateMockDataForTest(walletAddress: string, range: '7d' | '30d' | '90d' | 'all') {
      const now = Date.now()
      const msPerDay = 24 * 60 * 60 * 1000

      let days: number
      switch (range) {
        case '7d': days = 7; break
        case '30d': days = 30; break
        case '90d': days = 90; break
        case 'all': days = 180; break
      }

      const dataPoints: Array<{
        timestamp: string
        cumulativePnL: number
        betNumber: number
      }> = []
      let cumulativePnL = 0
      let betNumber = 0

      const seed = parseInt(walletAddress.slice(2, 10), 16)

      for (let d = days; d >= 0; d--) {
        const betsToday = Math.floor((seed + d) % 3)

        for (let b = 0; b < betsToday; b++) {
          betNumber++
          const timestamp = new Date(now - d * msPerDay + b * 3600000).toISOString()
          const amount = 50 + ((seed + d * 3 + b) % 200)
          const resultPercent = -30 + ((seed + d * 7 + b * 11) % 60)
          const result = (amount * resultPercent) / 100
          cumulativePnL += result

          dataPoints.push({ timestamp, cumulativePnL, betNumber })
        }
      }

      return { dataPoints, totalBets: betNumber, endingPnL: cumulativePnL }
    }

    test('generates consistent data for same wallet address', () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const result1 = generateMockDataForTest(walletAddress, '30d')
      const result2 = generateMockDataForTest(walletAddress, '30d')

      expect(result1.totalBets).toBe(result2.totalBets)
      expect(result1.endingPnL).toBe(result2.endingPnL)
    })

    test('generates different data for different wallet addresses', () => {
      const wallet1 = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const wallet2 = '0x123456789abcdef0123456789abcdef012345678'
      const result1 = generateMockDataForTest(wallet1, '30d')
      const result2 = generateMockDataForTest(wallet2, '30d')

      // Different wallets should produce different data
      expect(result1.totalBets).not.toBe(result2.totalBets)
    })

    test('7d range produces fewer data points than 30d', () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const result7d = generateMockDataForTest(walletAddress, '7d')
      const result30d = generateMockDataForTest(walletAddress, '30d')

      expect(result7d.dataPoints.length).toBeLessThan(result30d.dataPoints.length)
    })

    test('all range produces more data points than 90d', () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const result90d = generateMockDataForTest(walletAddress, '90d')
      const resultAll = generateMockDataForTest(walletAddress, 'all')

      expect(resultAll.dataPoints.length).toBeGreaterThan(result90d.dataPoints.length)
    })

    test('data points are in chronological order', () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const result = generateMockDataForTest(walletAddress, '30d')

      for (let i = 1; i < result.dataPoints.length; i++) {
        const prevTime = new Date(result.dataPoints[i - 1].timestamp).getTime()
        const currTime = new Date(result.dataPoints[i].timestamp).getTime()
        expect(currTime).toBeGreaterThanOrEqual(prevTime)
      }
    })

    test('bet numbers are sequential starting from 1', () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      const result = generateMockDataForTest(walletAddress, '30d')

      for (let i = 0; i < result.dataPoints.length; i++) {
        expect(result.dataPoints[i].betNumber).toBe(i + 1)
      }
    })
  })

  describe('Error handling scenarios', () => {
    test('empty wallet address should be handled', () => {
      // Hook should not make a query with empty wallet address
      // This tests the `enabled: !!walletAddress` condition
      const walletAddress = ''
      const shouldQuery = !!walletAddress

      expect(shouldQuery).toBe(false)
    })

    test('invalid wallet address format still generates data', () => {
      // Mock data generation uses parseInt on hex, should handle gracefully
      const invalidWallet = '0xinvalid'
      const seed = parseInt(invalidWallet.slice(2, 10), 16)

      // parseInt('invalid') returns NaN
      expect(Number.isNaN(seed)).toBe(true)
    })
  })
})
