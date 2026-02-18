/**
 * Shared types for openclaw-agiarena plugin
 */

// ============================================================================
// Plugin API / OpenClaw Gateway
// ============================================================================

export interface OpenClawApi {
  /** Send a message to the user's active channel */
  sendMessage(channel: string, text: string): Promise<void>
  /** Register a tool the user can invoke */
  registerTool(tool: ToolDefinition): void
  /** Register a background service */
  registerService(service: ServiceDefinition): void
  /** Get plugin config value */
  getConfig<T>(key: string): T
  /** Set plugin config value */
  setConfig(key: string, value: unknown): void
  /** Get the active channel ID */
  getActiveChannel(): string | null
}

export interface ToolDefinition {
  name: string
  description: string
  args?: { name: string; description: string; required?: boolean }[]
  handler: (args: Record<string, string>, channel: string) => Promise<string>
}

export interface ServiceDefinition {
  name: string
  start: () => Promise<void>
  stop: () => Promise<void>
}

// ============================================================================
// Plugin Config
// ============================================================================

export interface PluginConfig {
  backendUrl: string
  dataNodeUrl: string
  chainRpc: string
  chainId: number
  dryRun: boolean
  maxBetWind: number
  maxDailyWind: number
  discoveryIntervalMin: number
  maxResearchMarkets: number
  autoApproveThreshold: number
  circuitBreakerDrawdownPct: number
  circuitBreakerConsecutiveLosses: number
  circuitBreakerCooldownMin: number
  improvementIntervalHours: number
  /** Override Claude model for API calls (default: claude-sonnet-4-20250514) */
  claudeModel?: string
  /** Private key for signing (loaded from env, not config file) */
  privateKey?: string
}

// ============================================================================
// Market Discovery
// ============================================================================

export type DiscoverySource =
  | 'polymarket'
  | 'aa_backend'
  | 'web_search'
  | 'coingecko'
  | 'aa_propositions'
  | 'dex_tracker'

export interface DiscoveredMarket {
  id: string
  source: DiscoverySource
  question: string
  /** Current market odds for YES (0-1), null if unknown */
  currentOddsYes: number | null
  /** Resolution date (ISO 8601) */
  resolutionDate: string | null
  /** 24h volume in USD */
  volume24h: number
  /** Urgency score (0-100) */
  urgencyScore: number
  /** Extra metadata depending on source */
  metadata: Record<string, unknown>
  discoveredAt: number
}

// ============================================================================
// Research
// ============================================================================

export interface ResearchResult {
  marketId: string
  source: DiscoverySource
  question: string
  probYes: number       // 0.0 to 1.0
  confidence: number    // 0.0 to 1.0
  reasoning: string
  sources: string[]     // URLs
  researchedAt: number
  expiresAt: number     // 24h TTL
}

// ============================================================================
// Strategy
// ============================================================================

export interface ScoredPosition {
  marketId: string
  position: 'YES' | 'NO' | 'LONG' | 'SHORT'
  calibratedProb: number
  edge: number
  halfKelly: number
  confidence: number
  reasoning: string
}

export interface Portfolio {
  positions: PortfolioPosition[]
  createdAt: string
  informedCount: number
  totalCount: number
}

export interface PortfolioPosition {
  marketId: string
  position: 'YES' | 'NO' | 'LONG' | 'SHORT'
  confidence: number
}

// ============================================================================
// Betting
// ============================================================================

export type BetAction = 'place' | 'match'

export interface PendingBet {
  id: string
  action: BetAction
  portfolio: Portfolio
  stakeWind: number
  oddsBps: number
  categoryId?: string
  /** Human-readable summary for approval message */
  summary: string
  createdAt: number
  status: 'pending_approval' | 'approved' | 'rejected' | 'executed' | 'failed'
  /** If matching, the existing bet ID to fill */
  matchBetId?: string
}

export interface BetRecord {
  id: string
  betId: string          // On-chain bet ID
  action: BetAction
  stakeWind: number
  oddsBps: number
  positions: PortfolioPosition[]
  informedCount: number
  totalCount: number
  txHash: string
  status: 'active' | 'settled' | 'cancelled'
  pnl: number | null     // Null until settled
  createdAt: number
  settledAt: number | null
}

// ============================================================================
// Safety
// ============================================================================

export interface KillSwitchState {
  active: boolean
  activatedAt: number | null
  reason: string | null
}

export interface CircuitBreakerState {
  tripped: boolean
  trippedAt: number | null
  reason: string | null
  cooldownUntil: number | null
}

// ============================================================================
// Self-improvement
// ============================================================================

export interface ImprovementResult {
  analysisDate: string
  resolvedBetCount: number
  aiWinRate: number
  randomWinRate: number
  suggestedChange: string
  backtestImprovement: number   // percentage points
  branchName: string | null
  status: 'proposed' | 'deployed' | 'rejected' | 'failed'
}
