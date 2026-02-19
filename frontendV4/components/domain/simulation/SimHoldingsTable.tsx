'use client'

import { useSimHoldings } from '@/hooks/useSimHoldings'

interface SimHoldingsTableProps {
  runId: number | null
  date?: string | null
}

export function SimHoldingsTable({ runId, date }: SimHoldingsTableProps) {
  const { holdings, isLoading, error } = useSimHoldings(runId, date)

  if (!runId) return null

  if (isLoading) {
    return (
      <div className="text-white/40 text-xs font-mono py-4 text-center">
        Loading holdings...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-accent text-xs font-mono py-4 text-center">
        Error: {error}
      </div>
    )
  }

  if (!holdings.length) {
    return (
      <div className="text-white/40 text-xs font-mono py-4 text-center">
        No holdings data
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-white/60 text-[10px] font-mono border-b border-white/10 uppercase">
            <th className="text-left pb-2 pr-2">#</th>
            <th className="text-left pb-2 pr-2">Coin</th>
            <th className="text-left pb-2 pr-2">Symbol</th>
            <th className="text-right pb-2 pr-2">Weight</th>
            <th className="text-right pb-2 pr-2">Price</th>
            <th className="text-right pb-2">Value</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => (
            <tr key={h.coin_id} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-1.5 pr-2 text-white/40 text-xs font-mono">{i + 1}</td>
              <td className="py-1.5 pr-2 text-white text-xs font-mono">{h.coin_id}</td>
              <td className="py-1.5 pr-2 text-white/70 text-xs font-mono">{h.symbol}</td>
              <td className="py-1.5 pr-2 text-right text-white/70 text-xs font-mono">
                {(h.weight * 100).toFixed(2)}%
              </td>
              <td className="py-1.5 pr-2 text-right text-white/70 text-xs font-mono">
                ${h.price_usd.toFixed(4)}
              </td>
              <td className="py-1.5 text-right text-white text-xs font-mono">
                ${(h.quantity * h.price_usd).toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
