'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
      <div className="bg-terminal-dark border border-white/10 rounded-lg p-6">
        <h2 className="text-lg font-bold text-white mb-4">ITP Markets</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-white/10 rounded w-full" />
          <div className="h-10 bg-white/10 rounded w-full" />
        </div>
      </div>
    )
  }

  // If on-chain data available, show full table
  if (!error && markets.length > 0) {
    return (
      <div className="bg-terminal-dark border border-white/10 rounded-lg p-6">
        <h2 className="text-lg font-bold text-white mb-4">ITP Markets</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-white/60 text-xs font-mono border-b border-white/10">
                <th className="text-left pb-3">Collateral</th>
                <th className="text-right pb-3">NAV Price</th>
                <th className="text-right pb-3">LTV</th>
                <th className="text-right pb-3">Utilization</th>
                <th className="text-right pb-3">Borrow APY</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m) => (
                <tr key={m.marketId} className="border-b border-white/5 last:border-0">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                        <span className="text-accent text-xs font-bold">{itpSymbol.slice(0, 3)}</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{itpName} / USDC</p>
                        <p className="text-white/40 text-xs font-mono truncate max-w-[180px]">
                          {collateralToken.slice(0, 10)}...
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <span className="text-white font-mono">
                      ${formatOraclePrice(m.navPrice).toFixed(4)}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <span className="text-accent font-mono font-bold">
                      {m.lltvPercent.toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <span className={`font-mono ${
                      m.utilization > 90 ? 'text-red-400' :
                      m.utilization > 70 ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {m.utilization.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <span className="text-white font-mono">
                      {m.borrowApy.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Key metrics summary */}
        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-white/40">Loan Asset</p>
            <p className="text-sm text-white font-mono">USDC</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/40">Max LTV</p>
            <p className="text-sm text-accent font-mono font-bold">{markets[0].lltvPercent.toFixed(0)}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/40">Borrow Rate (SERM)</p>
            <p className="text-sm text-white font-mono">{markets[0].borrowApy.toFixed(2)}% APR</p>
          </div>
        </div>
      </div>
    )
  }

  // Fallback: show static config data when on-chain reads fail
  return (
    <div className="bg-terminal-dark border border-white/10 rounded-lg p-6">
      <h2 className="text-lg font-bold text-white mb-4">ITP Markets</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-white/60 text-xs font-mono border-b border-white/10">
              <th className="text-left pb-3">Collateral</th>
              <th className="text-right pb-3">NAV Price</th>
              <th className="text-right pb-3">LTV</th>
              <th className="text-right pb-3">Borrow APY</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/5">
              <td className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                    <span className="text-accent text-xs font-bold">{itpSymbol.slice(0, 3)}</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{itpName} / USDC</p>
                    <p className="text-white/40 text-xs font-mono truncate max-w-[180px]">
                      {collateralToken.slice(0, 10)}...
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-4 text-right">
                <span className="text-white/40 font-mono text-sm">Unavailable</span>
              </td>
              <td className="py-4 text-right">
                <span className="text-accent font-mono font-bold">
                  {STATIC_LTV.toFixed(0)}%
                </span>
              </td>
              <td className="py-4 text-right">
                <span className="text-white/40 font-mono text-sm">--</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Always show key metrics from config */}
      <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-xs text-white/40">Loan Asset</p>
          <p className="text-sm text-white font-mono">USDC</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-white/40">Max LTV</p>
          <p className="text-sm text-accent font-mono font-bold">{STATIC_LTV.toFixed(0)}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-white/40">Protocol</p>
          <p className="text-sm text-white font-mono">Morpho Blue</p>
        </div>
      </div>

      {error && (
        <p className="text-white/30 text-xs mt-3 text-center">Live market data unavailable — showing config parameters</p>
      )}
    </div>
  )
}
