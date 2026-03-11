/**
 * E2E global setup — runs once before any test workers start.
 *
 * 1. Warms up Next.js dev server (compiles pages on first request)
 * 2. Pre-funds VISION_PLAYER with L3 USDC (so ensureUsdcBalance is a no-op
 *    during parallel execution — critical for nonce safety with 2 workers)
 */
import { IS_ANVIL, FRONTEND_URL, VISION_PLAYER_ADDRESS } from './env'

async function globalSetup() {
  const baseURL = FRONTEND_URL;
  // Only warm pages that actually exist — /portfolio 404s and triggers
  // _not-found recompilation storms (5315 modules each time, blocks all requests)
  const pages = ['/', '/index'];

  for (const path of pages) {
    try {
      await fetch(`${baseURL}${path}`);
    } catch {
      // Server not ready — tests will fail anyway, don't block setup
    }
  }

  // Pre-fund VISION_PLAYER with L3 USDC.
  // This runs single-process before workers spawn, so no nonce conflict with DEPLOYER.
  if (IS_ANVIL) {
    try {
      const { ensureUsdcBalance } = await import('./helpers/vision-api')
      const amount = 100000n * 10n ** 18n // 100,000 USDC (18 decimals on L3)
      await ensureUsdcBalance(VISION_PLAYER_ADDRESS, amount)
      console.log(`[global-setup] Pre-funded VISION_PLAYER ${VISION_PLAYER_ADDRESS} with 100k L3 USDC`)
    } catch (err) {
      console.warn(`[global-setup] Failed to pre-fund VISION_PLAYER: ${(err as Error).message}`)
    }
  }
}

export default globalSetup;
