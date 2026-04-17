'use client'

import { useTranslations } from 'next-intl'
import { formatUnits } from 'viem'
import { useAllUserPositions } from '@/hooks/useAllUserPositions'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

interface YourPositionsProps {
  onSelectMarket: (
    market: MorphoMarketEntry,
    itpInfo: { name: string; symbol: string; itpId: string; settlementAddress: string }
  ) => void
}

export function YourPositions({ onSelectMarket }: YourPositionsProps) {
  const t = useTranslations('lending')
  const { positions, isLoading } = useAllUserPositions()

  if (isLoading || positions.length === 0) return null

  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-text-primary mb-2">
        {t('positions.title')}
      </h3>
      <div className="border border-border-light divide-y divide-border-light">
        {positions.map((pos) => {
          const collateralValue =
            parseFloat(formatUnits(pos.collateralAmount, 18)) * pos.nav
          const debtValue = parseFloat(formatUnits(pos.debtAmount, 18))
          const hf = pos.healthFactor

          const badgeClass =
            hf >= 1.5
              ? 'bg-color-up/10 text-color-up'
              : hf >= 1.0
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-color-down/10 text-color-down'

          return (
            <button
              key={pos.marketId}
              type="button"
              onClick={() =>
                onSelectMarket(pos.market, {
                  name: pos.itpName,
                  symbol: pos.itpSymbol,
                  itpId: pos.marketId,
                  settlementAddress: pos.collateralToken,
                })
              }
              className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
            >
              {/* Left: avatar + name */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded-full bg-zinc-200 flex-shrink-0" />
                <span className="text-sm font-medium text-text-primary truncate">
                  {pos.itpName}
                </span>
              </div>

              {/* Middle: values */}
              <div className="flex items-center gap-3 text-xs text-text-muted font-mono tabular-nums whitespace-nowrap">
                <span>${collateralValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span>${debtValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} debt</span>
              </div>

              {/* Right: health badge */}
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold flex-shrink-0 ${badgeClass}`}
              >
                {hf === Infinity ? '∞' : hf.toFixed(2)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
