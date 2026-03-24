'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useTranslations } from 'next-intl'
import { useAllMorphoMarkets } from '@/hooks/useAllMorphoMarkets'
import { useSSENav, useSSEPositions, type MorphoPositionSnapshot } from '@/hooks/useSSE'
import { getMorphoMarketForItp, type MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

export interface MarketRow {
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

export interface MarketsTableProps {
  onSelectRow: (row: MarketRow) => void
  selectedCollateralToken: string | null
}

function hasActivePosition(pos: MorphoPositionSnapshot | undefined | null): boolean {
  if (!pos) return false
  return BigInt(pos.collateral || '0') > 0n || BigInt(pos.borrow_shares || '0') > 0n
}

function Bone({ w = 'w-20', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-black/[0.06] rounded animate-pulse`} />
}

export function MarketsTable({ onSelectRow, selectedCollateralToken }: MarketsTableProps) {
  const t = useTranslations('lending')
  const { data: allMarketData, isLoading } = useAllMorphoMarkets()
  const navSnapshots = useSSENav()
  const positions = useSSEPositions()

  const rows = useMemo<MarketRow[]>(() => {
    if (allMarketData.size === 0 || navSnapshots.length === 0) return []

    const result: MarketRow[] = []

    for (const [collateralToken, mktData] of allMarketData) {
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

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full">
        <h3 className="text-sm font-semibold text-text-primary px-4 py-2 border-b border-border-light">
          {t('markets_table.title', { fallback: 'Collateral Markets' })}
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted border-b border-black/[0.06]">
              <th className="text-left px-4 py-2">{t('markets_table.header.market')}</th>
              <th className="text-right px-4 py-2">{t('markets_table.header.borrow_apy')}</th>
              <th className="text-right px-4 py-2 hidden sm:table-cell">{t('markets_table.header.tvl')}</th>
              <th className="text-right px-4 py-2 hidden sm:table-cell">{t('markets_table.header.lltv')}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-black/[0.04]">
                <td className="px-4 py-2"><div className="flex items-center gap-2"><div className="w-6 h-6 bg-black/[0.06] rounded-full animate-pulse shrink-0" /><Bone w="w-24" h="h-3" /></div></td>
                <td className="px-4 py-2 text-right"><Bone w="w-12" h="h-3" /></td>
                <td className="px-4 py-2 text-right hidden sm:table-cell"><Bone w="w-16" h="h-3" /></td>
                <td className="px-4 py-2 text-right hidden sm:table-cell"><Bone w="w-10" h="h-3" /></td>
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
    <div className="w-full border border-border-light">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted border-b border-black/[0.06]">
              <th className="text-left px-4 py-2">{t('markets_table.header.market')}</th>
              <th className="text-right px-4 py-2">{t('markets_table.header.borrow_apy')}</th>
              <th className="text-right px-4 py-2 hidden sm:table-cell">{t('markets_table.header.tvl')}</th>
              <th className="text-right px-4 py-2 hidden sm:table-cell">{t('markets_table.header.lltv')}</th>
              <th className="text-center px-4 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = selectedCollateralToken?.toLowerCase() === row.collateralToken.toLowerCase()
              return (
                <tr
                  key={row.collateralToken}
                  onClick={() => onSelectRow(row)}
                  className={`border-b border-black/[0.04] last:border-0 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-black/[0.04]'
                      : 'hover:bg-black/[0.02]'
                  }`}
                >
                  {/* Market */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center shrink-0">
                        <span className="text-text-primary text-[9px] font-bold">
                          {row.symbol.slice(0, 3)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-text-primary block truncate">
                          {row.name}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono block">
                          / USDC
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Borrow APY */}
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-xs text-text-primary">
                    {row.borrowApy.toFixed(2)}%
                  </td>

                  {/* Available */}
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-xs text-text-primary hidden sm:table-cell">
                    ${row.available.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>

                  {/* LLTV */}
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-xs text-text-primary hidden sm:table-cell">
                    {row.lltv.toFixed(0)}%
                  </td>

                  {/* Position indicator */}
                  <td className="px-4 py-2 text-center">
                    {row.hasPosition && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-color-up" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
