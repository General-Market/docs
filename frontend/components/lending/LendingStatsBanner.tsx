'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { formatUnits } from 'viem'
import { useAllMorphoMarkets } from '@/hooks/useAllMorphoMarkets'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'

function Bone({ w = 'w-16' }: { w?: string }) {
  return <div className={`${w} h-5 bg-border-light rounded animate-pulse`} />
}

export function LendingStatsBanner() {
  const t = useTranslations('lending')
  const { data: marketsMap, isLoading: marketsLoading } = useAllMorphoMarkets()
  const { vaultInfo, isLoading: vaultLoading } = useMetaMorphoVault()

  const aggregated = useMemo(() => {
    if (marketsMap.size === 0) return null

    let totalSupply = 0n
    let totalBorrow = 0n
    let weightedBorrowApy = 0
    let totalBorrowFloat = 0

    for (const m of marketsMap.values()) {
      totalSupply += m.totalSupplyAssets
      totalBorrow += m.totalBorrowAssets
      const borrowFloat = parseFloat(formatUnits(m.totalBorrowAssets, 18))
      weightedBorrowApy += m.borrowApy * borrowFloat
      totalBorrowFloat += borrowFloat
    }

    const borrowApy = totalBorrowFloat > 0 ? weightedBorrowApy / totalBorrowFloat : 0
    const utilization = totalSupply > 0n
      ? Number((totalBorrow * 10000n) / totalSupply) / 100
      : 0
    const supplyApy = utilization > 0 ? (borrowApy * utilization) / 100 : 0

    return { borrowApy, supplyApy, utilization }
  }, [marketsMap])

  const isLoading = marketsLoading || vaultLoading

  const tvlDisplay = vaultInfo
    ? `$${parseFloat(formatUnits(vaultInfo.totalAssets, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : null

  const items = [
    {
      label: t('stats.vault_tvl'),
      value: tvlDisplay,
      color: 'text-text-primary',
    },
    {
      label: t('stats.supply_apy'),
      value: aggregated ? `${aggregated.supplyApy.toFixed(2)}%` : null,
      color: aggregated && aggregated.supplyApy > 0 ? 'text-color-up' : 'text-text-primary',
    },
    {
      label: t('stats.borrow_apy'),
      value: aggregated ? `${aggregated.borrowApy.toFixed(2)}%` : null,
      color: 'text-text-primary',
    },
    {
      label: t('stats.utilization'),
      value: aggregated ? `${aggregated.utilization.toFixed(1)}%` : null,
      color: 'text-text-primary',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4">
      {items.map((item, idx) => (
        <div
          key={item.label}
          className={`flex flex-col gap-0.5 px-4 py-2 ${
            idx < items.length - 1 ? 'lg:border-r border-black/[0.06]' : ''
          } ${idx >= 2 ? 'border-t lg:border-t-0 border-black/[0.06]' : ''}`}
        >
          <span className="text-micro font-semibold uppercase tracking-[0.08em] text-text-muted">
            {item.label}
          </span>
          {isLoading || !item.value ? (
            <Bone w={idx === 0 ? 'w-20' : 'w-14'} />
          ) : (
            <span className={`text-sm font-bold font-mono tabular-nums ${item.color}`}>
              {item.value}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
