/**
 * Bilateral Bet types for the new bilateral custody system
 * Story 4-2: Frontend types for bilateral bets from CollateralVault
 *
 * These types represent bets committed through the CollateralVault contract
 * where both parties lock collateral and resolution happens either by
 * mutual agreement, keeper arbitration, or custom payout.
 */

/**
 * Status of a bilateral bet
 * - active: Bet committed, awaiting settlement
 * - in_arbitration: Dispute requested, keepers resolving
 * - settled: Resolved by agreement or arbitration
 * - custom_payout: Resolved with custom split amounts
 */
export type BilateralBetStatus = 'active' | 'in_arbitration' | 'settled' | 'custom_payout'

/**
 * Resolution type for settled bets
 * - agreement: Settled by mutual agreement between parties
 * - arbitration: Settled by keeper arbitration (BLS signatures)
 * - custom: Custom payout split executed
 */
export type ResolutionType = 'agreement' | 'arbitration' | 'custom'

/**
 * Bilateral bet from CollateralVault contract
 * Amounts are stored as decimal strings (WIND, 18 decimals)
 */
export interface BilateralBet {
  /** On-chain bet ID from CollateralVault */
  betId: number
  /** Creator (party A) address */
  creator: string
  /** Filler (party B) address */
  filler: string
  /** Merkle root of trades for verification (bytes32 hex) */
  tradesRoot: string
  /** Creator's locked stake (WIND amount as decimal string) */
  creatorAmount: string
  /** Filler's locked stake (WIND amount as decimal string) */
  fillerAmount: string
  /** Total locked amount (creator + filler) */
  totalAmount: string
  /** Resolution deadline (ISO 8601 timestamp) */
  deadline: string
  /** Current bet status */
  status: BilateralBetStatus
  /** Winner address (null until settled) */
  winner?: string
  /** Creator's payout (for custom payout scenarios) */
  creatorPayout?: string
  /** Filler's payout (for custom payout scenarios) */
  fillerPayout?: string
  /** How the bet was resolved */
  resolutionType?: ResolutionType
  /** Number of keepers in arbitration resolution */
  keeperCount?: number
  /** When the bet was committed (ISO 8601) */
  committedAt?: string
  /** When the bet was settled (ISO 8601) */
  settledAt?: string
  /** Block number of the commitment transaction */
  blockNumber?: number
  /** Transaction hash of the commitment */
  txHash?: string
}

/**
 * Arbitration request information
 * Created when a party requests keeper arbitration
 */
export interface ArbitrationInfo {
  /** Bet ID this arbitration is for */
  betId: number
  /** Address that requested arbitration */
  requestedBy: string
  /** When arbitration was requested (ISO 8601) */
  requestedAt: string
  /** When arbitration was resolved (ISO 8601, null if pending) */
  resolvedAt?: string
  /** Winner determined by keepers (null if pending) */
  outcomeWinner?: string
  /** Number of keeper signatures collected */
  keeperCount?: number
}

/**
 * Response from listing bilateral bets
 */
export interface BilateralBetsListResponse {
  /** List of bilateral bets */
  bets: BilateralBet[]
  /** Total count matching filters */
  total: number
  /** Results limit */
  limit: number
  /** Results offset */
  offset: number
}

// ============================================================================
// Status Display Helpers
// ============================================================================

/**
 * Get human-readable display text for a bilateral bet status
 */
export function getStatusDisplay(status: BilateralBetStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'in_arbitration':
      return 'Disputed'
    case 'settled':
      return 'Settled'
    case 'custom_payout':
      return 'Settled (Custom)'
    default:
      return status
  }
}

/**
 * Get Tailwind color class for a bilateral bet status
 */
export function getStatusColor(status: BilateralBetStatus): string {
  switch (status) {
    case 'active':
      return 'text-green-400'
    case 'in_arbitration':
      return 'text-orange-400'
    case 'settled':
      return 'text-cyan-400'
    case 'custom_payout':
      return 'text-purple-400'
    default:
      return 'text-white/60'
  }
}

/**
 * Get background color class for status badges
 */
export function getStatusBgColor(status: BilateralBetStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-900/30 border-green-700/50'
    case 'in_arbitration':
      return 'bg-orange-900/30 border-orange-700/50'
    case 'settled':
      return 'bg-cyan-900/30 border-cyan-700/50'
    case 'custom_payout':
      return 'bg-purple-900/30 border-purple-700/50'
    default:
      return 'bg-white/10 border-white/20'
  }
}

/**
 * Get resolution type display text
 */
export function getResolutionTypeDisplay(resolutionType: ResolutionType | undefined): string {
  switch (resolutionType) {
    case 'agreement':
      return 'Mutual Agreement'
    case 'arbitration':
      return 'Keeper Arbitration'
    case 'custom':
      return 'Custom Split'
    default:
      return 'Unknown'
  }
}

/**
 * Check if a bet is in a terminal state (settled or custom_payout)
 */
export function isBetTerminal(status: BilateralBetStatus): boolean {
  return status === 'settled' || status === 'custom_payout'
}

/**
 * Check if a bet can still be disputed (active and not past deadline)
 */
export function canRequestArbitration(bet: BilateralBet): boolean {
  if (bet.status !== 'active') return false
  const deadline = new Date(bet.deadline)
  return deadline > new Date()
}

/**
 * Format WIND amount for display (18 decimals to human-readable)
 */
export function formatWINDAmount(amount: string, decimals: number = 2): string {
  try {
    const value = parseFloat(amount)
    if (isNaN(value)) return '0.00'
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  } catch {
    return '0.00'
  }
}

/**
 * Truncate an address for display
 */
export function truncateAddress(address: string, chars: number = 6): string {
  if (!address) return ''
  if (address.length <= chars * 2 + 2) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}
