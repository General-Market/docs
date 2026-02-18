/**
 * HTTP client for the AgiArena backend API (Rust/Axum at :3001).
 *
 * Response types match the actual camelCase shapes from /Users/maxguillabert/Downloads/AA/backend.
 */

// ---------------------------------------------------------------------------
// Response types — matching AA backend exactly
// ---------------------------------------------------------------------------

// -- Snapshots --

export interface SnapshotHashes {
  '1K': string
  '10K': string
  ALL: string
}

export interface SnapshotInfo {
  snapshotId: string
  createdAt: string
  expiresAt: string
  hashes: SnapshotHashes
}

/** GET /api/snapshots/current → { snapshots: { [categoryId]: SnapshotInfo } } */
export interface CurrentSnapshotsResponse {
  snapshots: Record<string, SnapshotInfo>
}

export interface SnapshotTrade {
  tradeId: string
  ticker: string
  source: string
  method: string
  position: 'LONG' | 'SHORT' | 'YES' | 'NO'
  entryPrice: string
}

export interface SnapshotTradeListResponse {
  snapshotId: string
  category: string
  size: '1K' | '10K' | 'ALL'
  tradesHash: string
  tradesCount: number
  trades: SnapshotTrade[]
}

// -- Propositions --

export interface Proposition {
  propositionHash: string
  creator: string
  tradesHash: string
  snapshotId: string
  categoryId: string | null
  listSize: string | null
  creatorStake: string
  requiredMatch: string
  oddsBps: number
  oddsDisplay: string
  resolutionDeadline: string
  expiry: string
  status: 'open' | 'matched' | 'expired'
  matchedBy: string | null
  matchedAt: string | null
  createdAt: string
}

export interface PropositionsListResponse {
  propositions: Proposition[]
  total: number
  page: number
  limit: number
}

// -- Bets --

export interface BetSummary {
  betId: string
  creatorAddress: string
  betHash: string
  snapshotId: string
  categoryId: string
  listSize: string
  tradeCount: number
  amount: string
  creatorStake: string
  requiredMatch: string
  fillerAddress: string | null
  fillerStake: string | null
  oddsBps: number
  status: 'open' | 'matched' | 'settled' | 'cancelled'
  txHash: string | null
  blockNumber: number | null
  createdAt: string
  updatedAt: string
  resolutionDeadline: string | null
  earlyExit: boolean | null
}

export interface BetTrade {
  tradeId: string
  ticker: string
  source: string
  method: string
  position: 'LONG' | 'SHORT' | 'YES' | 'NO'
  entryPrice: string
  exitPrice: string | null
  won: boolean | null
  cancelled: boolean
}

export interface BetTradesResponse {
  trades: BetTrade[]
  winsCount: number | null
  validTrades: number | null
}

export interface BetPortfolioEntry {
  marketId: string
  position: string
  confidence: number
}

// -- Markets --

export interface MarketEntry {
  marketId: string
  title: string
  priceYes: string
  priceNo: string
  volume: string
  category: string
  lastUpdated: string
}

export interface MarketsListResponse {
  markets: MarketEntry[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
}

// -- Crypto Prices --

export interface CryptoPrice {
  coinId: string
  symbol: string
  name: string
  priceUsd: string
  marketCap: string
  volume24h: string
  priceChange24h: string
  imageUrl: string | null
  lastUpdated: string
}

export interface CryptoPricesResponse {
  prices: CryptoPrice[]
  pagination: { page: number; limit: number; total: number; hasMore: boolean }
}

// -- Market Prices --

export interface MarketPricePoint {
  source: string
  assetId: string
  price: number
  timestamp: string
}

// -- Categories --

export interface Category {
  id: string
  name: string
  emoji: string
  sources: string[]
  snapshotFreq: string
  rankingBy: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CategoriesResponse {
  categories: Category[]
  total: number
}

// -- Resolutions --

export interface Resolution {
  betId: string
  tradesHash: string
  winsCount: number
  validTrades: number
  winRate: number
  creatorWins: boolean | null
  isTie: boolean
  isCancelled: boolean
  cancelReason: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  status: 'pending' | 'resolved' | 'cancelled'
  createdAt: string
  updatedAt: string
}

// -- Agents --

export interface AgentStats {
  rank: number
  walletAddress: string
  displayName: string | null
  pnl: string
  winRate: string
  roi: string
  volume: string
  portfolioBets: number
  avgPortfolioSize: string
  largestPortfolio: number
  bestBet: { betId: string; amount: string; result: string; portfolioSize: number } | null
  worstBet: { betId: string; amount: string; result: string; portfolioSize: number } | null
}

// -- Leaderboard --

export interface LeaderboardEntry {
  rank: number
  walletAddress: string
  pnl: string
  winRate: string
  roi: string
  totalVolume: string
  portfolioBets: number
  avgPortfolioSize: string
  largestPortfolio: number
  lastActiveAt: string | null
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
  updatedAt: string
}

// -- Config --

export interface BackendConfig {
  contractAddress: string
  resolutionDaoAddress: string
  chainId: number
  rpcUrl: string
  collateralToken: { address: string; symbol: string; decimals: number }
  minBetAmount: string
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 10_000

export class BackendClient {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  // -- Health / Config --

  async getHealth(): Promise<{ status: string }> {
    return this.get<{ status: string }>('/health')
  }

  async getConfig(): Promise<BackendConfig> {
    return this.get<BackendConfig>('/api/config')
  }

  // -- Snapshots --

  /** GET /api/snapshots/current — current snapshot per category */
  async getCurrentSnapshots(): Promise<CurrentSnapshotsResponse> {
    return this.get<CurrentSnapshotsResponse>('/api/snapshots/current')
  }

  /** GET /api/snapshots/:id — specific snapshot details */
  async getSnapshot(snapshotId: string): Promise<SnapshotInfo> {
    return this.get<SnapshotInfo>(`/api/snapshots/${enc(snapshotId)}`)
  }

  /** GET /api/snapshots/:id/trades/:size — trade list for a snapshot */
  async getSnapshotTrades(
    snapshotId: string,
    size: '1K' | '10K' | 'ALL',
    params?: { offset?: number; limit?: number },
  ): Promise<SnapshotTradeListResponse> {
    const qs = new URLSearchParams()
    if (params?.offset != null) qs.set('offset', String(params.offset))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    return this.get<SnapshotTradeListResponse>(
      `/api/snapshots/${enc(snapshotId)}/trades/${enc(size)}`,
      qs,
    )
  }

  // -- Propositions --

  /** GET /api/propositions — list with filtering */
  async getPropositions(params?: {
    status?: string
    categoryId?: string
    snapshotId?: string
    creator?: string
    page?: number
    limit?: number
  }): Promise<PropositionsListResponse> {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.categoryId) qs.set('categoryId', params.categoryId)
    if (params?.snapshotId) qs.set('snapshotId', params.snapshotId)
    if (params?.creator) qs.set('creator', params.creator)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    return this.get<PropositionsListResponse>('/api/propositions', qs)
  }

  /** GET /api/propositions/:hash — single proposition */
  async getProposition(hash: string): Promise<Proposition> {
    return this.get<Proposition>(`/api/propositions/${enc(hash)}`)
  }

  // -- Bets --

  /** GET /api/bets — list with optional filters */
  async getBets(params?: {
    status?: string
    creator?: string
    page?: number
    limit?: number
  }): Promise<BetSummary[]> {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.creator) qs.set('creator', params.creator)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    return this.get<BetSummary[]>('/api/bets', qs)
  }

  /** GET /api/bets/:betId — single bet details */
  async getBet(betId: string): Promise<BetSummary> {
    return this.get<BetSummary>(`/api/bets/${enc(betId)}`)
  }

  /** GET /api/bets/:betId/trades — trade list for a bet */
  async getBetTrades(betId: string): Promise<BetTradesResponse> {
    return this.get<BetTradesResponse>(`/api/bets/${enc(betId)}/trades`)
  }

  /** GET /api/bets/:betId/portfolio — portfolio positions */
  async getBetPortfolio(betId: string): Promise<BetPortfolioEntry[]> {
    return this.get<BetPortfolioEntry[]>(`/api/bets/${enc(betId)}/portfolio`)
  }

  /** GET /api/bets/user/:address — bets for a wallet */
  async getBetsByUser(address: string): Promise<BetSummary[]> {
    return this.get<BetSummary[]>(`/api/bets/user/${enc(address)}`)
  }

  // -- Markets --

  /** GET /api/markets — list with pagination/filters */
  async getMarkets(params?: {
    page?: number
    limit?: number
    active?: boolean
    open?: boolean
    category?: string
  }): Promise<MarketsListResponse> {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.active != null) qs.set('active', String(params.active))
    if (params?.open != null) qs.set('open', String(params.open))
    if (params?.category) qs.set('category', params.category)
    return this.get<MarketsListResponse>('/api/markets', qs)
  }

  /** GET /api/markets/:market_id — single market */
  async getMarket(marketId: string): Promise<MarketEntry> {
    return this.get<MarketEntry>(`/api/markets/${enc(marketId)}`)
  }

  /** GET /api/markets/:market_id/price — current market price */
  async getMarketPrice(marketId: string): Promise<{ priceYes: string; priceNo: string }> {
    return this.get<{ priceYes: string; priceNo: string }>(`/api/markets/${enc(marketId)}/price`)
  }

  // -- Crypto Prices --

  /** GET /api/crypto/prices — paginated crypto prices */
  async getCryptoPrices(params?: {
    page?: number
    limit?: number
    symbols?: string
    sortBy?: string
  }): Promise<CryptoPricesResponse> {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.symbols) qs.set('symbols', params.symbols)
    if (params?.sortBy) qs.set('sortBy', params.sortBy)
    return this.get<CryptoPricesResponse>('/api/crypto/prices', qs)
  }

  /** GET /api/crypto/prices/:coin_id — single coin */
  async getCryptoPrice(coinId: string): Promise<CryptoPrice> {
    return this.get<CryptoPrice>(`/api/crypto/prices/${enc(coinId)}`)
  }

  /** GET /api/crypto/prices/:coin_id/history — price history */
  async getCryptoPriceHistory(coinId: string): Promise<MarketPricePoint[]> {
    return this.get<MarketPricePoint[]>(`/api/crypto/prices/${enc(coinId)}/history`)
  }

  // -- Market Prices (multi-source) --

  /** GET /api/market-prices/:source/:asset_id/history — historical price data */
  async getMarketPriceHistory(source: string, assetId: string): Promise<MarketPricePoint[]> {
    return this.get<MarketPricePoint[]>(
      `/api/market-prices/${enc(source)}/${enc(assetId)}/history`,
    )
  }

  // -- Categories --

  /** GET /api/categories — all active categories */
  async getCategories(): Promise<CategoriesResponse> {
    return this.get<CategoriesResponse>('/api/categories')
  }

  // -- Resolutions --

  /** GET /api/resolutions/:bet_id — resolution for a bet */
  async getResolution(betId: string): Promise<Resolution> {
    return this.get<Resolution>(`/api/resolutions/${enc(betId)}`)
  }

  /** GET /api/resolutions/recent — recent resolutions */
  async getRecentResolutions(params?: { page?: number; limit?: number }): Promise<Resolution[]> {
    const qs = new URLSearchParams()
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    return this.get<Resolution[]>('/api/resolutions/recent', qs)
  }

  // -- Agents --

  /** GET /api/agents/:address — agent details + stats */
  async getAgent(address: string): Promise<AgentStats> {
    return this.get<AgentStats>(`/api/agents/${enc(address)}`)
  }

  /** GET /api/agents/:address/performance — performance metrics */
  async getAgentPerformance(address: string): Promise<AgentStats> {
    return this.get<AgentStats>(`/api/agents/${enc(address)}/performance`)
  }

  // -- Leaderboard --

  /** GET /api/leaderboard — cached full leaderboard */
  async getLeaderboard(): Promise<LeaderboardResponse> {
    return this.get<LeaderboardResponse>('/api/leaderboard')
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private async get<T>(path: string, params?: URLSearchParams): Promise<T> {
    let url = `${this.baseUrl}${path}`
    const qs = params?.toString()
    if (qs) url += `?${qs}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '<unreadable>')
        throw new BackendClientError(
          `GET ${path} failed: ${res.status} ${res.statusText} - ${body}`,
          res.status,
        )
      }

      return (await res.json()) as T
    } catch (err) {
      if (err instanceof BackendClientError) throw err

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new BackendClientError(
          `GET ${path} timed out after ${DEFAULT_TIMEOUT_MS}ms`,
          0,
        )
      }

      throw new BackendClientError(
        `GET ${path} network error: ${err instanceof Error ? err.message : String(err)}`,
        0,
      )
    } finally {
      clearTimeout(timer)
    }
  }
}

function enc(s: string): string {
  return encodeURIComponent(s)
}

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

export class BackendClientError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'BackendClientError'
    this.statusCode = statusCode
  }
}
