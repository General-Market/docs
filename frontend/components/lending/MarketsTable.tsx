'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useTranslations } from 'next-intl'
import { useAllMorphoMarkets } from '@/hooks/useAllMorphoMarkets'
import { useSSENav, useSSEPositions, type MorphoPositionSnapshot } from '@/hooks/useSSE'
import { getMorphoMarketForItp, type MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

export interface MarketsTableProps {
  onSelectMarket: (market: MorphoMarketEntry, itpInfo: { name: string; symbol: string; itpId: string; settlementAddress: string }) => void
}

interface MarketRow {
  collateralToken: string
  name: string
  symbol: string
  itpId: string
  settlementAddress: string
  borrowApy: number
  available: number
  lltv: number
  hasPosition: boolean
  market: MorphoMarketEntry
}

function hasActivePosition(pos: MorphoPositionSnapshot | undefined | null): boolean {
  if (!pos) return false
  return BigInt(pos.collateral || '0') > 0n || BigInt(pos.borrow_shares || '0') > 0n
}

function Bone({ w = 'w-20', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-black/[0.06] rounded animate-pulse`} />
}

export function MarketsTable({ onSelectMarket }: MarketsTableProps) {
  const t = useTranslations('lending')
  const { data: allMarketData, isLoading } = useAllMorphoMarkets()
  const navSnapshots = useSSENav()
  const positions = useSSEPositions()

  const rows = useMemo<MarketRow[]>(() => {
    if (allMarketData.size === 0 || navSnapshots.length === 0) return []

    const result: MarketRow[] = []

    for (const [collateralToken, mktData] of allMarketData) {
      // Cross-reference SSE nav to find ITP name/symbol
      const nav = navSnapshots.find(
        n => n.settlement_address?.toLowerCase() === collateralToken.toLowerCase()
      )
      if (!nav) continue

      const market = getMorphoMarketForItp(collateralToken)
      if (!market) continue

      const available = parseFloat(
        formatUnits(mktData.totalSupplyAssets - mktData.totalBorrowAssets, 18)
      )
      const lltv = Number(mktData.lltv) / 1e16

      const pos = positions?.[mktData.marketId]

      result.push({
        collateralToken,
        name: nav.name,
        symbol: nav.symbol,
        itpId: nav.itp_id,
        settlementAddress: nav.settlement_address!,
        borrowApy: mktData.borrowApy,
        available,
        lltv,
        hasPosition: hasActivePosition(pos),
        market,
      })
    }

    // Position holders first, then by available liquidity descending
    result.sort((a, b) => {
      if (a.hasPosition !== b.hasPosition) return a.hasPosition ? -1 : 1
      return b.available - a.available
    })

    return result
  }, [allMarketData, navSnapshots, positions])

  const handleRowClick = (row: MarketRow) => {
    onSelectMarket(row.market, {
      name: row.name,
      symbol: row.symbol,
      itpId: row.itpId,
      settlementAddress: row.settlementAddress,
    })
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-label font-semibold uppercase tracking-[0.08em] text-text-muted border-b border-black/[0.06]">
              <th className="text-left px-3 sm:px-4 py-3">{t('markets_table.header.market')}</th>
              <th className="text-right px-3 sm:px-4 py-3">{t('markets_table.header.borrow_apy')}</th>
              <th className="text-right px-3 sm:px-4 py-3 hidden sm:table-cell">{t('markets_table.header.tvl')}</th>
              <th className="text-right px-3 sm:px-4 py-3 hidden sm:table-cell">{t('markets_table.header.lltv')}</th>
              <th className="text-center px-3 sm:px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-black/[0.04]">
                <td className="px-3 sm:px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-black/[0.06] rounded-full animate-pulse shrink-0" />
                    <Bone w="w-32" h="h-4" />
                  </div>
                </td>
                <td className="px-3 sm:px-4 py-3 text-right"><Bone w="w-14" h="h-4" /></td>
                <td className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell"><Bone w="w-20" h="h-4" /></td>
                <td className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell"><Bone w="w-12" h="h-4" /></td>
                <td className="px-3 sm:px-4 py-3 text-center"><Bone w="w-2" h="h-2" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Empty state
  if (rows.length === 0) {
    return (
      <div className="w-full py-12 text-center text-sm text-text-muted">
        {t('markets_table.no_markets')}
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-label font-semibold uppercase tracking-[0.08em] text-text-muted border-b border-black/[0.06]">
            <th className="text-left px-3 sm:px-4 py-3">{t('markets_table.header.market')}</th>
            <th className="text-right px-3 sm:px-4 py-3">{t('markets_table.header.borrow_apy')}</th>
            <th className="text-right px-3 sm:px-4 py-3 hidden sm:table-cell">{t('markets_table.header.tvl')}</th>
            <th className="text-right px-3 sm:px-4 py-3 hidden sm:table-cell">{t('markets_table.header.lltv')}</th>
            <th className="text-center px-3 sm:px-4 py-3 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.collateralToken}
              onClick={() => handleRowClick(row)}
              className="border-b border-black/[0.04] last:border-0 cursor-pointer hover:bg-black/[0.02] transition-colors"
            >
              {/* Market */}
              <td className="px-3 sm:px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center shrink-0">
                    <span className="text-text-primary text-micro font-bold">
                      {row.symbol.slice(0, 3)}
                    </span>
                  </div>
                  <span className="font-semibold text-text-primary text-sm">
                    {t('markets_table.market_pair', { name: row.name })}
                  </span>
                </div>
              </td>

              {/* Borrow APY */}
              <td className="px-3 sm:px-4 py-3 text-right font-mono tabular-nums text-text-primary">
                {row.borrowApy.toFixed(2)}%
              </td>

              {/* Available (supply - borrows) */}
              <td className="px-3 sm:px-4 py-3 text-right font-mono tabular-nums text-text-primary hidden sm:table-cell">
                ${row.available.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>

              {/* LLTV */}
              <td className="px-3 sm:px-4 py-3 text-right font-mono tabular-nums text-text-primary hidden sm:table-cell">
                {row.lltv.toFixed(0)}%
              </td>

              {/* Position indicator */}
              <td className="px-3 sm:px-4 py-3 text-center">
                {row.hasPosition && (
                  <span className="inline-block w-2 h-2 rounded-full bg-color-up" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
