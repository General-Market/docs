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
  const [expanded, setExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit')

  const tvlDisplay = vaultInfo
    ? `$${parseFloat(formatUnits(vaultInfo.totalAssets, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : '—'

  const userDisplay =
    userPosition && userPosition.value > 0n
      ? `$${parseFloat(formatUnits(userPosition.value, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : null

  const labelMicro: React.CSSProperties = {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-loose)',
    textTransform: 'uppercase',
    color: 'var(--apple-text-tertiary)',
  }

  const valueText: React.CSSProperties = {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tight)',
    color: 'var(--apple-text)',
    fontVariantNumeric: 'tabular-nums',
  }

  return (
    <div
      style={{
        background: 'var(--apple-panel)',
        border: '1px solid var(--apple-line)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between"
        style={{
          padding: '14px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 180ms var(--apple-ease-default)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.02)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <div className="flex items-center gap-3 text-left">
          <span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 'var(--apple-fs-19)',
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tighter)',
              color: 'var(--apple-text)',
            }}
          >
            {t('vault_supply.title')}
          </span>
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text-secondary)',
            }}
          >
            {t('vault_supply.description')}
          </span>
        </div>
        <svg
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{
            color: 'var(--apple-text-tertiary)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms var(--apple-ease-default)',
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div
          style={{
            padding: '16px 20px 20px',
            borderTop: '1px solid var(--apple-line)',
          }}
          className="space-y-4"
        >
          <div className="flex gap-8">
            <div className="flex flex-col gap-1">
              <span style={labelMicro}>{t('vault_supply.vault_tvl')}</span>
              <span style={valueText}>
                {isLoading ? '…' : tvlDisplay}
              </span>
            </div>
            {userDisplay && (
              <div className="flex flex-col gap-1">
                <span style={labelMicro}>{t('vault_supply.your_deposits')}</span>
                <span style={{ ...valueText, color: '#16a34a' }}>
                  {userDisplay}
                </span>
              </div>
            )}
          </div>

          <div
            className="inline-flex"
            style={{
              background: 'var(--apple-surface)',
              borderRadius: 10,
              padding: 3,
              gap: 2,
            }}
          >
            {(['deposit', 'withdraw'] as const).map(tab => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '6px 14px',
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: 'var(--apple-track-tight)',
                    color: isActive ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
                    background: isActive ? 'var(--apple-panel)' : 'transparent',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04)' : 'none',
                    transition: 'background 200ms var(--apple-ease-default), color 200ms var(--apple-ease-default)',
                  }}
                >
                  {t(`actions.${tab}`)}
                </button>
              )
            })}
          </div>

          {activeTab === 'deposit' ? <VaultDeposit /> : <VaultPosition />}
        </div>
      )}
    </div>
  )
}
