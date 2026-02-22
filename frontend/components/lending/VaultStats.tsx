'use client'

import { useTranslations } from 'next-intl'
import { formatUnits } from 'viem'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'

function Bone({ w = 'w-20', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-border-light rounded animate-pulse`} />
}

export function VaultStats() {
  const t = useTranslations('lending')
  const { vaultInfo, isLoading, error } = useMetaMorphoVault()

  const stats = [
    {
      label: t('vault_stats.supply_apy'),
      value: vaultInfo ? `${vaultInfo.apy.toFixed(2)}%` : null,
      color: 'text-color-up',
    },
    {
      label: t('vault_stats.total_deposits'),
      value: vaultInfo
        ? `$${parseFloat(formatUnits(vaultInfo.totalAssets, 6)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : null,
    },
    {
      label: t('vault_stats.utilization'),
      value: vaultInfo ? `${vaultInfo.utilization.toFixed(1)}%` : null,
      color: vaultInfo
        ? vaultInfo.utilization > 90 ? 'text-color-down'
        : vaultInfo.utilization > 70 ? 'text-color-warning'
        : 'text-color-up'
        : undefined,
    },
    {
      label: t('vault_stats.vault'),
      value: vaultInfo ? vaultInfo.name : null,
      fontSize: 'text-[16px]',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 py-5 border-b border-border-light">
      {stats.map((stat, idx) => (
        <div
          key={stat.label}
          className={`py-3 px-4 md:px-6 ${idx > 0 ? 'md:border-l border-border-light' : 'md:pl-0'} ${idx >= 2 ? 'border-t md:border-t-0 border-border-light' : ''}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1">{stat.label}</p>
          {isLoading || error || !stat.value ? (
            <Bone w={idx === 0 ? 'w-16' : 'w-24'} h="h-6" />
          ) : (
            <p className={`${stat.fontSize || 'text-[22px]'} font-extrabold font-mono tabular-nums ${stat.color || 'text-black'}`}>
              {stat.value}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
