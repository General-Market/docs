/**
 * Curator Quote API client
 *
 * Calls the curator's REST API to get lending quotes with pre-computed
 * bundler calldata for atomic collateral+borrow transactions.
 *
 * Browser → /api/lending/* proxies on this Next.js app → curator on its VPS.
 * The curator binds to localhost; the proxies are the only reachable surface.
 */

import type { QuoteRequest, QuoteResponse } from '@/lib/types/lending-quote'

/**
 * Fetch a lending quote from the curator API
 *
 * @throws QuoteApiError on failure
 */
export async function fetchLendingQuote(request: QuoteRequest): Promise<QuoteResponse> {
  const response = await fetch('/api/lending/quote', {
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

/** Request body for prepare (intent-based reallocate). */
export interface PrepareRequest {
  /** Hex bytes32 market id (with or without 0x prefix). */
  marketId: string
  /** Borrow amount in USDC base units, decimal string (18 dec on L3). */
  borrowAmount: string
}

/** Curator's reply when prepare has finished (or no-op'd). */
export interface PrepareResponse {
  /** True when the target market already had enough liquidity. */
  alreadyFunded: boolean
  /** Tx hash of the reallocate, if one was executed. */
  txHash: string | null
  /** Block number of the receipt — reserved for future use. */
  blockNumber: number | null
}

/**
 * Ask the curator to route enough idle liquidity into `marketId` to cover
 * a pending borrow of `borrowAmount`. Resolves once the reallocate tx is
 * confirmed (or immediately when no reallocation was needed).
 *
 * @throws QuoteApiError on failure
 */
export async function preparePosition(request: PrepareRequest): Promise<PrepareResponse> {
  const response = await fetch('/api/lending/prepare', {
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
  get isCuratorUnreachable() {
    return this.code === 'CURATOR_UNREACHABLE' || this.code === 'ALLOCATOR_UNAVAILABLE'
  }
  get isPrepareTimeout() { return this.code === 'PREPARE_TIMEOUT' }
}
