import { describe, test, expect } from 'bun:test'
import {
  generateAgentTweetText,
  generateTwitterIntentUrl,
  truncateAddress,
  type AgentShareData
} from '../socialShare'

const mockAgent: AgentShareData = {
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  rank: 1,
  pnl: 1250.00,
  roi: 45.2,
  portfolioSize: 23847,
  winRate: 65
}

describe('truncateAddress', () => {
  test('truncates long wallet address', () => {
    const result = truncateAddress('0x1234567890abcdef1234567890abcdef12345678')
    expect(result).toBe('0x12345678...')
  })

  test('returns short address unchanged', () => {
    const result = truncateAddress('0x1234ab')
    expect(result).toBe('0x1234ab')
  })

  test('handles address at threshold length', () => {
    // Exactly 14 characters should not be truncated
    const result = truncateAddress('0x123456789012')
    expect(result).toBe('0x123456789012')
  })
})

describe('generateAgentTweetText', () => {
  test('generates tweet with positive P&L', () => {
    const result = generateAgentTweetText(mockAgent)

    expect(result).toContain('My AI agent just crushed it on @AgiArena')
    expect(result).toContain('🤖')
    expect(result).toContain('23,847 markets simultaneously')
    expect(result).toContain('+$1,250.00')
    expect(result).toContain('+45.2% ROI')
    expect(result).toContain('Think you can beat that? Only AI can compete at this scale.')
    // URL should contain FULL wallet address (not truncated) for valid deep link
    expect(result).toContain(`https://agiarena.xyz/agent/${mockAgent.walletAddress}`)
  })

  test('uses full wallet address in URL (not truncated)', () => {
    const result = generateAgentTweetText(mockAgent)

    // Verify the URL contains the FULL wallet address
    // Truncated addresses would cause 404 on the agent detail page
    expect(result).toContain(mockAgent.walletAddress)
    expect(result).not.toContain('0x12345678...')  // Should NOT be truncated
  })

  test('generates tweet with negative P&L', () => {
    const negativeAgent: AgentShareData = {
      ...mockAgent,
      pnl: -500.00,
      roi: -12.5
    }
    const result = generateAgentTweetText(negativeAgent)

    expect(result).toContain('-$500.00')
    expect(result).toContain('-12.5% ROI')
  })

  test('formats large portfolio size with commas', () => {
    const largePortfolio: AgentShareData = {
      ...mockAgent,
      portfolioSize: 100000
    }
    const result = generateAgentTweetText(largePortfolio)

    expect(result).toContain('100,000 markets')
  })

  test('respects includeEmojis option', () => {
    const result = generateAgentTweetText(mockAgent, { includeEmojis: false })

    expect(result).not.toContain('🤖')
    expect(result).toContain('My AI agent just crushed it on @AgiArena')
  })

  test('respects includeUrl option', () => {
    const result = generateAgentTweetText(mockAgent, { includeUrl: false })

    expect(result).not.toContain('https://agiarena.xyz')
  })

  test('respects custom baseUrl option', () => {
    const result = generateAgentTweetText(mockAgent, { baseUrl: 'https://custom.example.com' })

    expect(result).toContain('https://custom.example.com/agent/')
  })

  test('handles zero P&L correctly', () => {
    const zeroAgent: AgentShareData = {
      ...mockAgent,
      pnl: 0,
      roi: 0
    }
    const result = generateAgentTweetText(zeroAgent)

    expect(result).toContain('+$0.00')
    expect(result).toContain('+0.0% ROI')
  })

  test('formats large P&L with commas', () => {
    const bigWinner: AgentShareData = {
      ...mockAgent,
      pnl: 1234567.89,
      roi: 150.5
    }
    const result = generateAgentTweetText(bigWinner)

    expect(result).toContain('+$1,234,567.89')
    expect(result).toContain('+150.5% ROI')
  })

  test('includes @AgiArena mention', () => {
    const result = generateAgentTweetText(mockAgent)

    expect(result).toContain('@AgiArena')
  })
})

describe('generateTwitterIntentUrl', () => {
  test('generates valid Twitter intent URL', () => {
    const tweetText = 'Hello world'
    const result = generateTwitterIntentUrl(tweetText)

    expect(result).toBe('https://twitter.com/intent/tweet?text=Hello+world')
  })

  test('encodes special characters in tweet text', () => {
    const tweetText = 'P&L: +$1,250.00 (+45.2% ROI)'
    const result = generateTwitterIntentUrl(tweetText)

    expect(result).toContain('intent/tweet?text=')
    // URL should be properly encoded
    expect(result).toContain('%24')  // $ encoded
    expect(result).toContain('%26')  // & encoded
  })

  test('includes URL parameter when provided', () => {
    const tweetText = 'Check this out!'
    const agentUrl = 'https://agiarena.xyz/agent/0x1234'
    const result = generateTwitterIntentUrl(tweetText, agentUrl)

    expect(result).toContain('text=')
    expect(result).toContain('url=')
    expect(result).toContain(encodeURIComponent(agentUrl))
  })

  test('omits URL parameter when not provided', () => {
    const tweetText = 'Hello world'
    const result = generateTwitterIntentUrl(tweetText)

    expect(result).not.toContain('&url=')
  })

  test('handles newlines in tweet text', () => {
    const tweetText = 'Line 1\nLine 2\nLine 3'
    const result = generateTwitterIntentUrl(tweetText)

    // Newlines should be encoded
    expect(result).toContain('%0A')
  })

  test('full tweet text encoding works correctly', () => {
    const result = generateTwitterIntentUrl(
      generateAgentTweetText(mockAgent, { includeUrl: false })
    )

    // Should be a valid URL
    expect(result.startsWith('https://twitter.com/intent/tweet?')).toBe(true)

    // Verify it can be parsed as URL
    const url = new URL(result)
    expect(url.searchParams.has('text')).toBe(true)
  })
})
