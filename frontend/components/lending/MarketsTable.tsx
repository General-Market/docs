'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { usePublicClient } from 'wagmi'
import { useMorphoMarkets } from '@/hooks/useMorphoMarkets'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { BRIDGED_ITP_ABI } from '@/lib/contracts/index-protocol-abi'
import { formatOraclePrice } from '@/lib/types/morpho'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

interface MarketsTableProps {
  market?: MorphoMarketEntry
}

/**
 * MarketsTable component
 *
 * Displays available ITP markets with the actual ITP name, NAV price, LTV, utilization, and borrow APY.
 * Falls back to static config data when on-chain reads fail.
 */
export function MarketsTable({ market }: MarketsTableProps) {
  const t = useTranslations('lending')
  const { markets, isLoading, error } = useMorphoMarkets(market)
  const publicClient = usePublicClient()
  const [itpName, setItpName] = useState<string>('ITP')
  const [itpSymbol, setItpSymbol] = useState<string>('ITP')
  const publicClientRef = useRef(publicClient)

  const collateralToken = market?.collateralToken ?? MORPHO_ADDRESSES.collateralToken
  const lltv = market?.lltv ?? MORPHO_ADDRESSES.lltv

  // Static config fallback
  const STATIC_LTV = Number(lltv) / 1e16

  useEffect(() => { publicClientRef.current = publicClient }, [publicClient])

  // Fetch ITP token name/symbol from collateral token contract
  const fetchItpInfo = useCallback(async () => {
    const client = publicClientRef.current
    if (!client) return

    try {
      const [name, symbol] = await Promise.all([
        client.readContract({
          address: collateralToken,
          abi: BRIDGED_ITP_ABI,
          functionName: 'name',
        }).catch(() => 'ITP'),
        client.readContract({
          address: collateralToken,
          abi: BRIDGED_ITP_ABI,
          functionName: 'symbol',
        }).catch(() => 'ITP'),
      ])
      setItpName(name as string)
      setItpSymbol(symbol as string)
    } catch {
      // Keep defaults
    }
  }, [collateralToken])

  useEffect(() => { fetchItpInfo() }, [fetchItpInfo])

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-card border border-border-light p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4">{t('markets_detail.itp_markets')}</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-10 bg-muted rounded w-full" />
        </div>
      </div>
    )
  }

  // If on-chain data available, show full table
  if (!error && markets.length > 0) {
    return (
      <div className="bg-white rounded-xl shadow-card border border-border-light p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4">{t('markets_detail.itp_markets')}</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted text-xs font-medium uppercase tracking-wider text-text-muted border-b border-border-light">
                <th className="text-left pb-3 pt-2 px-2">{t('markets_detail.collateral')}</th>
                <th className="text-right pb-3 pt-2 px-2">{t('markets_detail.nav_price')}</th>
                <th className="text-right pb-3 pt-2 px-2">{t('markets_detail.ltv')}</th>
                <th className="text-right pb-3 pt-2 px-2">{t('markets_detail.utilization')}</th>
                <th className="text-right pb-3 pt-2 px-2">{t('markets_detail.borrow_apy')}</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m) => (
                <tr key={m.marketId} className="border-b border-border-light last:border-0">
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center">
                        <span className="text-zinc-900 text-xs font-bold">{itpSymbol.slice(0, 3)}</span>
                      </div>
                      <div>
                        <p className="text-text-primary font-medium">{itpName} / USDC</p>
                        <p className="text-text-muted text-xs font-mono truncate max-w-[180px]">
                          {collateralToken.slice(0, 10)}...
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <span className="text-text-primary font-mono tabular-nums">
                      ${formatOraclePrice(m.navPrice).toFixed(4)}
                    </span>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <span className="text-zinc-900 font-mono tabular-nums font-bold">
                      {m.lltvPercent.toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <span className={`font-mono tabular-nums ${
                      m.utilization > 90 ? 'text-color-down' :
                      m.utilization > 70 ? 'text-color-warning' :
                      'text-color-up'
                    }`}>
                      {m.utilization.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <span className="text-text-primary font-mono tabular-nums">
                      {m.borrowApy.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Key metrics summary */}
        <div className="mt-4 pt-4 border-t border-border-light grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('markets_detail.loan_asset')}</p>
            <p className="text-sm text-text-primary font-mono tabular-nums">USDC</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('markets_detail.max_ltv')}</p>
            <p className="text-sm text-zinc-900 font-mono tabular-nums font-bold">{markets[0].lltvPercent.toFixed(0)}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('markets_detail.borrow_rate_serm')}</p>
            <p className="text-sm text-text-primary font-mono tabular-nums">{markets[0].borrowApy.toFixed(2)}% APR</p>
          </div>
        </div>
      </div>
    )
  }

  // Fallback: show static config data when on-chain reads fail
  return (
    <div className="bg-white rounded-xl shadow-card border border-border-light p-6">
      <h2 className="text-lg font-bold text-text-primary mb-4">ITP Markets</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted text-xs font-medium uppercase tracking-wider text-text-muted border-b border-border-light">
              <th className="text-left pb-3 pt-2 px-2">{t('markets_detail.collateral')}</th>
              <th className="text-right pb-3 pt-2 px-2">{t('markets_detail.nav_price')}</th>
              <th className="text-right pb-3 pt-2 px-2">{t('markets_detail.ltv')}</th>
              <th className="text-right pb-3 pt-2 px-2">{t('markets_detail.borrow_apy')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border-light">
              <td className="py-4 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center">
                    <span className="text-zinc-900 text-xs font-bold">{itpSymbol.slice(0, 3)}</span>
                  </div>
                  <div>
                    <p className="text-text-primary font-medium">{itpName} / USDC</p>
                    <p className="text-text-muted text-xs font-mono truncate max-w-[180px]">
                      {collateralToken.slice(0, 10)}...
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-4 px-2 text-right">
                <span className="text-text-muted font-mono text-sm">{t('markets_detail.unavailable')}</span>
              </td>
              <td className="py-4 px-2 text-right">
                <span className="text-zinc-900 font-mono tabular-nums font-bold">
                  {STATIC_LTV.toFixed(0)}%
                </span>
              </td>
              <td className="py-4 px-2 text-right">
                <span className="text-text-muted font-mono text-sm">--</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Always show key metrics from config */}
      <div className="mt-4 pt-4 border-t border-border-light grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('markets_detail.loan_asset')}</p>
          <p className="text-sm text-text-primary font-mono tabular-nums">USDC</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('markets_detail.max_ltv')}</p>
          <p className="text-sm text-zinc-900 font-mono tabular-nums font-bold">{STATIC_LTV.toFixed(0)}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('markets_detail.protocol')}</p>
          <p className="text-sm text-text-primary font-mono tabular-nums">Morpho Blue</p>
        </div>
      </div>

      {error && (
        <p className="text-text-muted text-xs mt-3 text-center">{t('markets_detail.live_data_unavailable')}</p>
      )}
    </div>
  )
}
