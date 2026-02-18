/**
 * Curator Quote API client
 *
 * Calls the curator's REST API to get lending quotes with pre-computed
 * bundler calldata for atomic collateral+borrow transactions.
 */

import type { QuoteRequest, QuoteResponse, QuoteErrorResponse } from '@/lib/types/lending-quote'

/** Default curator API base URL (overridable via env) */
const CURATOR_API_URL = process.env.NEXT_PUBLIC_CURATOR_API_URL ?? 'http://localhost:8080'

/**
 * Fetch a lending quote from the curator API
 *
 * @throws QuoteApiError on failure
 */
export async function fetchLendingQuote(request: QuoteRequest): Promise<QuoteResponse> {
  const response = await fetch(`${CURATOR_API_URL}/api/lending/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new QuoteApiError(
      body.error ?? `HTTP ${response.status}`,
      response.status,
      body.code,
      body.retryAfter
    )
  }

  return response.json()
}

/** Typed error from the Quote API */
export class QuoteApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly retryAfter?: number
  ) {
    super(message)
    this.name = 'QuoteApiError'
  }

  get isMarketFrozen() { return this.code === 'MARKET_FROZEN' }
  get isRateLimited() { return this.code === 'RATE_LIMITED' }
  get isMarketNotFound() { return this.code === 'MARKET_NOT_FOUND' }
}
