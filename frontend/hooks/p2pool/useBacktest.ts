import { useMutation } from '@tanstack/react-query'
import { DATA_NODE_URL } from '@/lib/config'

export interface BacktestParams {
  batchId: number
  /** Python strategy code */
  code: string
  /** Number of historical ticks to backtest over (default: 50) */
  ticks?: number
}

export interface BacktestResult {
  /** Win rate as a decimal 0..1 */
  winRate: number
  /** PnL curve over time */
  pnlCurve: { tick: number; pnl: number }[]
  /** Total PnL at end of backtest period */
  totalPnl: number
}

/**
 * Mutation hook that sends strategy code to the backtest endpoint.
 * Uses useMutation (not useQuery) because this is an on-demand action.
 */
export function useBacktest() {
  return useMutation<BacktestResult, Error, BacktestParams>({
    mutationFn: async (params: BacktestParams) => {
      const res = await fetch(`${DATA_NODE_URL}/p2pool/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: params.batchId,
          code: params.code,
          ticks: params.ticks ?? 50,
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`)
        throw new Error(`Backtest failed: ${text}`)
      }

      const data = await res.json()
      return {
        winRate: data.win_rate ?? data.winRate ?? 0,
        pnlCurve: (data.pnl_curve ?? data.pnlCurve ?? []).map(
          (p: { tick: number; pnl: number }) => ({
            tick: p.tick,
            pnl: p.pnl,
          })
        ),
        totalPnl: data.total_pnl ?? data.totalPnl ?? 0,
      } satisfies BacktestResult
    },
  })
}
