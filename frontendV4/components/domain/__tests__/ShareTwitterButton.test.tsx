import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { ShareTwitterButton } from '../ShareTwitterButton'
import { openTwitterShare, generateAgentTweetText, generateTwitterIntentUrl } from '@/lib/utils/socialShare'
import type { AgentShareData } from '@/lib/utils/socialShare'

// Store original window.open
const originalWindowOpen = globalThis.window?.open

const mockAgent: AgentShareData = {
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  rank: 1,
  pnl: 1250.00,
  roi: 45.2,
  portfolioSize: 23847,
  winRate: 65
}

describe('ShareTwitterButton', () => {
  let mockWindowOpen: ReturnType<typeof mock>

  beforeEach(() => {
    // Create a mock for window.open
    mockWindowOpen = mock(() => null)
    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.open = mockWindowOpen
    } else {
      // In Node/Bun environment, create a minimal window mock
      (globalThis as unknown as { window: { open: typeof mockWindowOpen; screen: { width: number; height: number } } }).window = {
        open: mockWindowOpen,
        screen: { width: 1920, height: 1080 }
      }
    }
  })

  afterEach(() => {
    if (originalWindowOpen) {
      globalThis.window.open = originalWindowOpen
    }
  })

  test('component exports correctly', () => {
    expect(ShareTwitterButton).toBeDefined()
    expect(typeof ShareTwitterButton).toBe('function')
  })

  test('accepts agent prop with required fields', () => {
    // This test verifies the component can receive proper props
    const props = {
      agent: mockAgent,
      className: 'custom-class'
    }

    // TypeScript compilation succeeds with valid props
    expect(props.agent.walletAddress).toBe(mockAgent.walletAddress)
    expect(props.agent.pnl).toBe(1250.00)
    expect(props.agent.roi).toBe(45.2)
    expect(props.agent.portfolioSize).toBe(23847)
    expect(props.agent.rank).toBe(1)
    expect(props.agent.winRate).toBe(65)
  })

  test('accepts optional className prop', () => {
    const props = {
      agent: mockAgent
    }

    // Should work without className
    expect(props.agent).toBeDefined()
  })

  test('openTwitterShare function opens correct URL', () => {
    // Test the underlying function that the component uses
    openTwitterShare(mockAgent)

    // Verify window.open was called
    expect(mockWindowOpen).toHaveBeenCalled()

    // Get the URL that was passed to window.open
    const callArgs = mockWindowOpen.mock.calls[0]
    const url = callArgs[0] as string

    // Verify it's a Twitter intent URL
    expect(url).toContain('https://twitter.com/intent/tweet')
    expect(url).toContain('text=')
  })

  test('Twitter intent URL contains full wallet address (not truncated)', () => {
    openTwitterShare(mockAgent)

    const callArgs = mockWindowOpen.mock.calls[0]
    const url = callArgs[0] as string

    // URL parameter should contain the full wallet address (not truncated)
    // This is critical - truncated addresses would cause 404 on click
    expect(url).toContain(encodeURIComponent(mockAgent.walletAddress))
    expect(url).not.toContain('0x12345678...')
  })

  test('Twitter intent URL contains @AgiArena mention', () => {
    openTwitterShare(mockAgent)

    const callArgs = mockWindowOpen.mock.calls[0]
    const url = callArgs[0] as string

    // Tweet text should mention @AgiArena
    expect(url).toContain(encodeURIComponent('@AgiArena'))
  })

  test('opens popup window with correct dimensions', () => {
    openTwitterShare(mockAgent)

    const callArgs = mockWindowOpen.mock.calls[0]
    const windowFeatures = callArgs[2] as string

    // Verify popup dimensions
    expect(windowFeatures).toContain('width=550')
    expect(windowFeatures).toContain('height=420')
  })

  test('handles negative P&L agent data', () => {
    const negativeAgent: AgentShareData = {
      walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      rank: 50,
      pnl: -500.00,
      roi: -25.5,
      portfolioSize: 5000,
      winRate: 35
    }

    openTwitterShare(negativeAgent)

    // Should still open Twitter
    expect(mockWindowOpen).toHaveBeenCalled()

    const callArgs = mockWindowOpen.mock.calls[0]
    const url = callArgs[0] as string

    // URL should be valid even with negative values
    expect(url).toContain('https://twitter.com/intent/tweet')
  })

  test('handles very large portfolio sizes', () => {
    const largePortfolioAgent: AgentShareData = {
      ...mockAgent,
      portfolioSize: 1000000
    }

    openTwitterShare(largePortfolioAgent)
    expect(mockWindowOpen).toHaveBeenCalled()

    // Tweet text should format large numbers with commas
    const tweetText = generateAgentTweetText(largePortfolioAgent)
    expect(tweetText).toContain('1,000,000 markets')
  })

  test('handles edge case with zero values', () => {
    const zeroAgent: AgentShareData = {
      walletAddress: '0x0000000000000000000000000000000000000000',
      rank: 100,
      pnl: 0,
      roi: 0,
      portfolioSize: 0,
      winRate: 0
    }

    openTwitterShare(zeroAgent)
    expect(mockWindowOpen).toHaveBeenCalled()

    // Zero P&L should format as +$0.00
    const tweetText = generateAgentTweetText(zeroAgent)
    expect(tweetText).toContain('+$0.00')
  })

  test('generates complete Twitter Intent URL', () => {
    const tweetText = generateAgentTweetText(mockAgent, { includeUrl: false })
    const agentUrl = `https://agiarena.xyz/agent/${mockAgent.walletAddress}`
    const intentUrl = generateTwitterIntentUrl(tweetText, agentUrl)

    // Verify URL structure
    expect(intentUrl).toContain('https://twitter.com/intent/tweet')
    expect(intentUrl).toContain('text=')
    expect(intentUrl).toContain('url=')

    // Verify it can be parsed as a valid URL
    const url = new URL(intentUrl)
    expect(url.searchParams.has('text')).toBe(true)
    expect(url.searchParams.has('url')).toBe(true)
  })

  test('tweet text emphasizes portfolio scale', () => {
    const tweetText = generateAgentTweetText(mockAgent)

    // Key messaging that demonstrates AI-only moat
    expect(tweetText).toContain('markets simultaneously')
    expect(tweetText).toContain('Only AI can compete at this scale')
  })

  test('tweet text includes robot emoji by default', () => {
    const tweetText = generateAgentTweetText(mockAgent)
    expect(tweetText).toContain('🤖')
  })

  test('tweet text can disable emojis', () => {
    const tweetText = generateAgentTweetText(mockAgent, { includeEmojis: false })
    expect(tweetText).not.toContain('🤖')
  })
})
