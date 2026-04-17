/**
 * Scrolls to and highlights an agent row in the leaderboard
 * Uses retry mechanism to handle cases where DOM isn't ready yet
 * @param walletAddress - The wallet address to scroll to
 * @param maxRetries - Maximum number of retry attempts (default: 5)
 * @param retryDelayMs - Delay between retries in ms (default: 100)
 * @returns true if the element was found and scrolled to, false otherwise
 */
export function scrollToAgentRow(
  walletAddress: string,
  maxRetries: number = 5,
  retryDelayMs: number = 100
): boolean {
  // Case-insensitive DOM query
  const selector = `[data-wallet="${walletAddress.toLowerCase()}"]`
  const row = document.querySelector(selector)

  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return true
  }

  // If element not found and we have retries left, schedule a retry
  if (maxRetries > 0) {
    setTimeout(() => {
      scrollToAgentRow(walletAddress, maxRetries - 1, retryDelayMs)
    }, retryDelayMs)
  }

  return false
}

/**
 * Scrolls to agent row with a Promise-based API for async usage
 * @param walletAddress - The wallet address to scroll to
 * @param maxWaitMs - Maximum time to wait for element (default: 1000ms)
 * @returns Promise that resolves to true if found and scrolled, false otherwise
 */
export function scrollToAgentRowAsync(
  walletAddress: string,
  maxWaitMs: number = 1000
): Promise<boolean> {
  return new Promise((resolve) => {
    const selector = `[data-wallet="${walletAddress.toLowerCase()}"]`
    const startTime = Date.now()
    const checkInterval = 50

    const checkAndScroll = () => {
      const row = document.querySelector(selector)

      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        resolve(true)
        return
      }

      // Check if we've exceeded the timeout
      if (Date.now() - startTime >= maxWaitMs) {
        resolve(false)
        return
      }

      // Schedule next check
      setTimeout(checkAndScroll, checkInterval)
    }

    checkAndScroll()
  })
}
