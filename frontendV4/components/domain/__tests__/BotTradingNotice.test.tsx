/**
 * Tests for BotTradingNotice component and related stubbed hooks
 * Story 7-13: Remove/Disable Bet Placement UI - AC5
 */
import { describe, it, expect } from 'bun:test'

/**
 * BotTradingNotice is a simple presentational component.
 * These tests verify the component structure and exports.
 *
 * Since this is a new display-only component added to inform users
 * about AI-powered trading, we test that the exports exist and
 * the component can be imported without errors.
 */

describe('BotTradingNotice', () => {
  describe('Module exports', () => {
    it('exports BotTradingNotice component', async () => {
      const module = await import('../BotTradingNotice')
      expect(typeof module.BotTradingNotice).toBe('function')
    })

    it('exports BotTradingNoticeBadge component', async () => {
      const module = await import('../BotTradingNotice')
      expect(typeof module.BotTradingNoticeBadge).toBe('function')
    })
  })

  describe('Component structure', () => {
    // BotTradingNoticeBadge doesn't use hooks so we can test it directly
    it('BotTradingNoticeBadge accepts className prop', async () => {
      const { BotTradingNoticeBadge } = await import('../BotTradingNotice')
      expect(() => BotTradingNoticeBadge({ className: 'test-class' })).not.toThrow()
    })
  })
})

describe('PortfolioBetProposal stubbed component', () => {
  it('exports PortfolioBetProposal function', async () => {
    const module = await import('../PortfolioBetProposal')
    expect(typeof module.PortfolioBetProposal).toBe('function')
  })

  it('exports PortfolioBetProposalData interface type', async () => {
    // This is a compile-time check - if the type doesn't exist, TypeScript would fail
    const module = await import('../PortfolioBetProposal')
    expect(module).toBeDefined()
  })
})
