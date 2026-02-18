/**
 * Social sharing utilities for agent performance
 * Generates tweet text and handles Twitter Web Intent API
 */

/**
 * Data needed for sharing an agent's performance
 */
export interface AgentShareData {
  walletAddress: string
  rank: number
  pnl: number
  roi: number
  portfolioSize: number
  winRate: number
}

/**
 * Options for tweet text generation
 */
export interface TweetTextOptions {
  includeEmojis?: boolean
  includeUrl?: boolean
  baseUrl?: string
}

/**
 * Formats a number as USD currency
 * @param amount - The amount in dollars (can be negative)
 * @returns Formatted string like "+$1,250.00" or "-$500.00"
 */
function formatPnLForTweet(amount: number): string {
  const sign = amount >= 0 ? '+' : '-'
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${sign}$${formatted}`
}

/**
 * Formats ROI percentage with sign
 * @param roi - The ROI percentage value
 * @returns Formatted string like "+45.2%" or "-12.5%"
 */
function formatRoiForTweet(roi: number): string {
  const sign = roi >= 0 ? '+' : ''
  return `${sign}${roi.toFixed(1)}%`
}

/**
 * Truncates wallet address for display in tweet URL
 * @param address - Full wallet address (0x...)
 * @returns Truncated address like "0x1234ab...5678"
 */
export function truncateAddress(address: string): string {
  if (!address || address.length <= 14) return address || ''
  return `${address.slice(0, 10)}...`
}

/**
 * Generates tweet text for sharing agent performance
 * Emphasizes portfolio scale to demonstrate AI-only moat
 *
 * @param agent - Agent data for sharing
 * @param options - Optional customization options
 * @returns Formatted tweet text
 */
export function generateAgentTweetText(
  agent: AgentShareData,
  options: TweetTextOptions = {}
): string {
  const {
    includeEmojis = true,
    includeUrl = true,
    baseUrl = 'https://agiarena.xyz'
  } = options

  const emoji = includeEmojis ? ' 🤖' : ''
  // Use full wallet address for valid deep link (truncated would 404)
  const agentUrl = `${baseUrl}/agent/${agent.walletAddress}`
  const url = includeUrl ? `\n\n${agentUrl}` : ''

  return `My AI agent just crushed it on @AgiArena${emoji}

Portfolio: ${(agent.portfolioSize ?? 0).toLocaleString()} markets simultaneously
P&L: ${formatPnLForTweet(agent.pnl)} (${formatRoiForTweet(agent.roi)} ROI)

Think you can beat that? Only AI can compete at this scale.${url}`
}

/**
 * Generates the Twitter Web Intent URL for sharing
 * @param tweetText - The text content of the tweet
 * @param agentUrl - Optional URL to include (separate from text for better previews)
 * @returns Full Twitter Intent URL
 */
export function generateTwitterIntentUrl(tweetText: string, agentUrl?: string): string {
  const intentUrl = new URL('https://twitter.com/intent/tweet')
  intentUrl.searchParams.set('text', tweetText)

  if (agentUrl) {
    intentUrl.searchParams.set('url', agentUrl)
  }

  return intentUrl.toString()
}

/**
 * Logs share analytics event
 * Tracks social shares for viral metrics and marketing insights
 * @param walletAddress - Wallet address of agent being shared
 * @param platform - Social platform (twitter, etc.)
 */
export function logShareEvent(walletAddress: string, platform: string): void {
  const shareData = {
    event: 'agent_share',
    platform,
    walletAddress: truncateAddress(walletAddress),
    timestamp: new Date().toISOString()
  }

  // Always log share events (useful for debugging and analytics)
  if (typeof window !== 'undefined') {
    // Client-side: use console.info for production visibility
    console.info('[Share Analytics]', shareData)
  }

  // Send to backend analytics endpoint (fire-and-forget, non-blocking)
  if (typeof fetch !== 'undefined') {
    fetch('/api/analytics/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        platform,
        timestamp: Date.now()
      })
    }).catch(() => {
      // Analytics failure is non-critical - silently ignore
      // Backend endpoint may not exist yet (MVP)
    })
  }
}

/**
 * Opens Twitter share dialog in a new window
 * @param agent - Agent data for sharing
 * @param options - Optional customization options
 */
export function openTwitterShare(
  agent: AgentShareData,
  options: TweetTextOptions = {}
): void {
  const baseUrl = options.baseUrl ?? 'https://agiarena.xyz'

  // Log share event for analytics
  logShareEvent(agent.walletAddress, 'twitter')

  // Generate tweet without URL in text (we'll pass it separately)
  const tweetText = generateAgentTweetText(agent, { ...options, includeUrl: false })
  const agentUrl = `${baseUrl}/agent/${agent.walletAddress}`

  const intentUrl = generateTwitterIntentUrl(tweetText, agentUrl)

  // Open in centered popup window
  const width = 550
  const height = 420
  const left = Math.round((window.screen.width - width) / 2)
  const top = Math.round((window.screen.height - height) / 2)

  window.open(
    intentUrl,
    '_blank',
    `width=${width},height=${height},left=${left},top=${top}`
  )
}
