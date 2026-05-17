export type Tone = 'pos' | 'neg' | 'neutral'

export interface VisionLeaderboardEntry {
  rank: number
  walletAddress: string
  pnl: number           // USDC, already decimal-scaled by issuer
  roi: number           // percentage, e.g. 12.5 = 12.5%
  totalVolume: number   // USDC
  roundsPlayed: number
  portfolioBets: number
  winRate: number       // 0–100
}

export interface VisionLeaderboardResponse {
  leaderboard: VisionLeaderboardEntry[]
  updatedAt: string
}
