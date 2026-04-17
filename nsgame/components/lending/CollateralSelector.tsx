'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useTranslations } from 'next-intl'
import { useSSENav, useSSEBalances, type NavSnapshot } from '@/hooks/useSSE'
import { getMorphoMarketForItp, hasLendingMarket } from '@/lib/contracts/morpho-markets-registry'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

export interface SelectedCollateral {
  itpId: string
  name: string
  symbol: string
  settlementAddress: string
  market: MorphoMarketEntry
  balance: bigint
  nav: number
}

interface CollateralSelectorProps {
  onSelect: (collateral: SelectedCollateral) => void
}

/**
 * Lists user's ITPs that have lending markets.
 * User picks one to use as collateral for borrowing USDC.
 */
export function CollateralSelector({ onSelect }: CollateralSelectorProps) {
  const t = useTranslations('lending.collateral_selector')
  const navSnapshots = useSSENav()
  const balances = useSSEBalances()

  const eligibleItps = useMemo(() => {
    if (!balances?.itp_shares || navSnapshots.length === 0) return []

    const items: (NavSnapshot & { balance: bigint; market: MorphoMarketEntry })[] = []

    for (const [itpId, balStr] of Object.entries(balances.itp_shares)) {
      const bal = BigInt(balStr || '0')
      if (bal === 0n) continue

      // Find the nav snapshot for this ITP
      const nav = navSnapshots.find(n => n.itp_id.toLowerCase() === itpId.toLowerCase())
      if (!nav?.settlement_address) continue

      // Check if a lending market exists
      const market = getMorphoMarketForItp(nav.settlement_address)
      if (!market) continue

      items.push({ ...nav, balance: bal, market })
    }

    // Sort by balance descending
    items.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0))
    return items
  }, [navSnapshots, balances])

  if (eligibleItps.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-text-secondary text-sm">{t('no_itps')}</p>
        <p className="text-text-muted text-xs mt-1">{t('no_itps_hint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-text-primary mb-1">{t('title')}</p>
      <p className="text-xs text-text-muted mb-3">{t('description')}</p>
      {eligibleItps.map(itp => {
        const balFormatted = parseFloat(formatUnits(itp.balance, 18)).toFixed(2)
        return (
          <button
            key={itp.itp_id}
            onClick={() => onSelect({
              itpId: itp.itp_id,
              name: itp.name,
              symbol: itp.symbol,
              settlementAddress: itp.settlement_address!,
              market: itp.market,
              balance: itp.balance,
              nav: itp.nav_per_share,
            })}
            className="w-full flex items-center justify-between px-4 py-3 border border-border-light rounded-lg hover:bg-black/[0.02] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center shrink-0">
                <span className="text-text-primary text-micro font-bold">{itp.symbol.slice(0, 3)}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{itp.name}</p>
                <p className="text-xs text-text-muted font-mono">${itp.symbol}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono tabular-nums text-text-primary">{balFormatted}</p>
              <p className="text-xs text-text-muted font-mono">{t('nav')} ${itp.nav_per_share.toFixed(4)}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
