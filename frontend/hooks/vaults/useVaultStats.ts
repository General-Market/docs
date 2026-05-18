'use client'

import { useQuery } from '@tanstack/react-query'

export interface VaultStats {
  vault: string
  lookbackBlocks: number
  trades: number
  settledTrades: number
  wins: number
  losses: number
  winRate: number | null
  avgWin: number | null
  avgLoss: number | null
  totalPnl: number
  headBlock: number
  // Trade-level risk — computed server-side from PlayerJoined/PlayerSettled
  // pairs. All null below `minTradesForRisk` so the panel can render "—"
  // honestly instead of annualising a six-trade sample.
  sharpe: number | null
  sortino: number | null
  volatility: number | null
  maxDrawdown: number | null
  annualizedReturn: number | null
  tradesPerYear: number
  observationSecs: number
  minTradesForRisk: number
}

/**
 * Fetches per-vault trading stats (win rate, avg win/loss, trade count)
 * by querying PlayerJoined + PlayerSettled logs over the last ~24h of blocks.
 * Refetched every 30s so the modal's performance panel keeps pace with the bot.
 */
export function useVaultStats(vaultAddress: string | undefined) {
  const { data, isLoading, isError } = useQuery<VaultStats>({
    queryKey: ['vault-stats', vaultAddress],
    queryFn: async () => {
      const res = await fetch(`/api/vision/vault/${vaultAddress}/stats`)
      if (!res.ok) throw new Error(`stats ${res.status}`)
      return res.json()
    },
    enabled: !!vaultAddress,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
  })

  return { stats: data ?? null, isLoading, isError }
}
