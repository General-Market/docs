'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatUnits } from 'viem'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'
import { VaultDeposit } from './VaultDeposit'
import { VaultPosition } from './VaultPosition'

export function VaultSupplySection() {
  const t = useTranslations('lending')
  const { vaultInfo, userPosition, isLoading } = useMetaMorphoVault()
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit')

  const tvlDisplay = vaultInfo
    ? `$${parseFloat(formatUnits(vaultInfo.totalAssets, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : '—'

  const userDisplay =
    userPosition && userPosition.value > 0n
      ? `$${parseFloat(formatUnits(userPosition.value, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : null

  return (
    <div className="border border-border-light">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-secondary">
            {t('vault_supply.title')}
          </span>
          <span className="text-xs text-text-muted">
            — {t('vault_supply.description')}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body — collapsible */}
      {expanded && (
        <div className="border-t border-border-light px-4 py-4 space-y-4">
          {/* Summary row */}
          <div className="flex gap-6 text-xs">
            <div>
              <span className="text-text-muted uppercase tracking-wide font-semibold">
                {t('vault_supply.vault_tvl')}
              </span>
              <span className="ml-2 font-mono tabular-nums text-text-primary font-bold">
                {isLoading ? '...' : tvlDisplay}
              </span>
            </div>
            {userDisplay && (
              <div>
                <span className="text-text-muted uppercase tracking-wide font-semibold">
                  {t('vault_supply.your_deposits')}
                </span>
                <span className="ml-2 font-mono tabular-nums text-color-up font-bold">
                  {userDisplay}
                </span>
              </div>
            )}
          </div>

          {/* Tab toggle */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('deposit')}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
                activeTab === 'deposit'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-muted text-text-muted hover:text-text-primary'
              }`}
            >
              {t('actions.deposit')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('withdraw')}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
                activeTab === 'withdraw'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-muted text-text-muted hover:text-text-primary'
              }`}
            >
              {t('actions.withdraw')}
            </button>
          </div>

          {/* Inline form */}
          {activeTab === 'deposit' ? <VaultDeposit /> : <VaultPosition />}
        </div>
      )}
    </div>
  )
}
