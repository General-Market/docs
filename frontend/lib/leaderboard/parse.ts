import type { VisionLeaderboardEntry, VisionLeaderboardResponse } from './types'

function parseNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function parseLeaderboardResponse(raw: unknown): VisionLeaderboardResponse {
  const obj = (raw ?? {}) as Record<string, unknown>
  const entries = Array.isArray(obj.leaderboard) ? obj.leaderboard : []

  const leaderboard: VisionLeaderboardEntry[] = entries.map((rawEntry, i) => {
    const e = rawEntry as Record<string, unknown>
    const rank = parseNum(e.rank)
    return {
      rank: rank > 0 ? rank : i + 1,
      walletAddress: typeof e.walletAddress === 'string' ? e.walletAddress : '',
      pnl: parseNum(e.pnl),
      roi: parseNum(e.roi),
      totalVolume: parseNum(e.totalVolume),
      roundsPlayed: parseNum(e.roundsPlayed),
      portfolioBets: parseNum(e.portfolioBets),
      winRate: parseNum(e.winRate),
    }
  })

  return {
    leaderboard,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
  }
}
