'use client'

/**
 * Tiny PostHog wrapper. The SDK is already initialised by `@/lib/posthog`
 * on import — that's where the project token, session-replay config, and
 * autocapture live. This module is the narrow waist for product events:
 * three calls, two functions, no extra init, no SSR surprises.
 *
 * No-ops cleanly when the project key is absent (local dev without a
 * `.env.local`). Errors inside posthog-js are swallowed — analytics must
 * never take the trading flow down with them.
 */

import { posthog } from '@/lib/posthog'

function isLoaded(): boolean {
  // posthog-js sets `__loaded` once `init` has run. The init call itself
  // is gated on a window check + a present project key.
  if (typeof window === 'undefined') return false
  return Boolean((posthog as unknown as { __loaded?: boolean }).__loaded)
}

export function track(event: string, props: Record<string, unknown> = {}): void {
  if (!isLoaded()) return
  try {
    posthog.capture(event, props)
  } catch {
    // Never let analytics raise into the caller.
  }
}

export function identify(distinctId: string, props?: Record<string, unknown>): void {
  if (!isLoaded()) return
  try {
    posthog.identify(distinctId, props)
  } catch {
    // Same contract — analytics is fire-and-forget.
  }
}
