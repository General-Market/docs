'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { formatUnits } from 'viem'
import { useAllMorphoMarkets } from '@/hooks/useAllMorphoMarkets'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'

function Bone({ w = 80 }: { w?: number }) {
  return (
    <div
      className="animate-pulse rounded"
      style={{ width: w, height: 22, background: 'var(--apple-line)' }}
    />
  )
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
    : (vaultLoading ? null : '$0')

  const items: { label: string; value: string | null; accent?: boolean }[] = [
    {
      label: t('stats.vault_tvl'),
      value: tvlDisplay,
    },
    {
      label: t('stats.supply_apy'),
      value: aggregated ? `${aggregated.supplyApy.toFixed(2)}%` : (marketsLoading ? null : '0.00%'),
      accent: aggregated != null && aggregated.supplyApy > 0,
    },
    {
      label: t('stats.borrow_apy'),
      value: aggregated ? `${aggregated.borrowApy.toFixed(2)}%` : (marketsLoading ? null : '0.00%'),
    },
    {
      label: t('stats.utilization'),
      value: aggregated ? `${aggregated.utilization.toFixed(1)}%` : (marketsLoading ? null : '0.0%'),
    },
  ]

  return (
    <div
      style={{
        background: 'var(--apple-panel)',
        border: '1px solid var(--apple-line)',
        borderRadius: 12,
        padding: '20px 24px',
      }}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {items.map(item => (
          <div key={item.label} className="flex flex-col gap-1">
            <span
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-loose)',
                textTransform: 'uppercase',
                color: 'var(--apple-text-tertiary)',
              }}
            >
              {item.label}
            </span>
            {isLoading || !item.value ? (
              <Bone w={72} />
            ) : (
              <span
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 'var(--apple-fs-24)',
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tighter)',
                  color: item.accent ? '#16a34a' : 'var(--apple-text)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {item.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
