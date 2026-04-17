/**
 * Resolution Signature Types for BLS Gasless Resolution
 *
 * Story 14.3, Task 8: Resolution signature types
 * - Tracks BLS signature collection progress
 * - Keeper signature status for frontend display
 */

/**
 * Status of resolution signature collection
 */
export type ResolutionCollectionStatus = 'collecting' | 'ready' | 'submitted' | 'expired'

/**
 * Status of an individual keeper's signature
 */
export type KeeperSignatureStatus = 'pending' | 'signed' | 'failed' | 'timeout'

/**
 * Individual keeper signature information
 */
export interface KeeperSignature {
  /** Keeper's Ethereum address */
  address: string
  /** Current signature status */
  status: KeeperSignatureStatus
  /** ISO timestamp when signature was received */
  signedAt?: string
  /** Error message if failed */
  error?: string
}

/**
 * Full signature collection status for a bet
 */
export interface SignatureStatus {
  /** Bet ID */
  betId: number
  /** Total number of active keepers */
  totalKeepers: number
  /** Number of signatures collected */
  signedCount: number
  /** Number of signatures required (51% threshold) */
  requiredCount: number
  /** Current collection status */
  status: ResolutionCollectionStatus
  /** Individual keeper statuses */
  keepers: KeeperSignature[]
  /** ISO timestamp when collection started */
  startedAt?: string
  /** Transaction hash if submitted */
  txHash?: string
}

/**
 * API response for resolution signatures endpoint
 */
export interface SignatureStatusResponse {
  success: boolean
  data?: SignatureStatus
  error?: string
}

/**
 * SSE event for signature collected
 */
export interface SignatureCollectedEvent {
  type: 'signature-collected'
  betId: number
  keeperAddress: string
  signedCount: number
  totalKeepers: number
  requiredCount: number
}

/**
 * SSE event for resolution submitted
 */
export interface ResolutionSubmittedEvent {
  type: 'resolution-submitted'
  betId: number
  txHash: string
  signersCount: number
}

/**
 * Calculate progress percentage
 */
export function calculateSignatureProgress(signedCount: number, requiredCount: number): number {
  if (requiredCount === 0) return 0
  return Math.min((signedCount / requiredCount) * 100, 100)
}

/**
 * Check if signature threshold is met
 */
export function isThresholdMet(signedCount: number, requiredCount: number): boolean {
  return signedCount >= requiredCount
}

/**
 * Format time ago for signature display
 */
export function formatSignedTimeAgo(signedAt: string): string {
  const diff = Date.now() - new Date(signedAt).getTime()
  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) {
    return `${seconds}s ago`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}
