'use client'

import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { useMetaMorphoVault } from '@/hooks/useMetaMorphoVault'
import { useVaultDeposit } from '@/hooks/useVaultDeposit'

export function VaultPosition() {
  const t = useTranslations('lending')
  useAccount()
  const [txError, setTxError] = useState<string | null>(null)

  const { userPosition, vaultInfo, refetch: refetchVault, isLoading } = useMetaMorphoVault()
  const {
    redeem,
    isPending,
    isConfirming,
    isSuccess,
    error: actionError,
    reset,
  } = useVaultDeposit()

  const successHandled = useRef(false)

  useEffect(() => {
    if (isSuccess && !successHandled.current) {
      successHandled.current = true
      refetchVault()
      setTimeout(() => {
        reset()
        successHandled.current = false
      }, 2000)
    }
  }, [isSuccess, refetchVault, reset])

  useEffect(() => {
    if (actionError) {
      setTxError(actionError.message || t('common.withdrawal_failed'))
      reset()
    }
  }, [actionError, reset])

  const handleWithdraw = useCallback(() => {
    if (!userPosition || userPosition.shares === 0n) return
    successHandled.current = false
    setTxError(null)
    redeem(userPosition.shares)
  }, [userPosition, redeem])

  if (isLoading) return null
  if (!userPosition || userPosition.shares === 0n) return null

  const sharesDecimals = vaultInfo?.decimals ?? 18
  const sharesFormatted = formatUnits(userPosition.shares, sharesDecimals)
  const valueFormatted = formatUnits(userPosition.value, 18)

  const isProcessing = isPending || isConfirming

  const labelMicro: CSSProperties = {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-loose)',
    color: 'var(--apple-text-tertiary)',
    textTransform: 'uppercase',
    margin: 0,
  }
  const valueText: CSSProperties = {
    fontFamily: 'var(--apple-font-display)',
    fontSize: 24,
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tighter)',
    color: 'var(--apple-text)',
    fontVariantNumeric: 'tabular-nums',
    margin: '4px 0 2px 0',
  }
  const subText: CSSProperties = {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 12,
    letterSpacing: 'var(--apple-track-tight)',
    color: 'var(--apple-text-tertiary)',
    margin: 0,
  }

  const isDisabled = isProcessing || userPosition.shares === 0n

  const withdrawStyle: CSSProperties = isDisabled
    ? {
        width: '100%',
        padding: '12px 16px',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: 'var(--apple-track-tight)',
        color: 'var(--apple-text-tertiary)',
        background: '#e5e5ea',
        border: 'none',
        borderRadius: 12,
        cursor: 'not-allowed',
        transition: 'background 180ms var(--apple-ease-default), opacity 180ms var(--apple-ease-default)',
      }
    : {
        width: '100%',
        padding: '12px 16px',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: 'var(--apple-track-tight)',
        color: '#fff',
        background: isSuccess ? '#16a34a' : '#0071e3',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'background 180ms var(--apple-ease-default), opacity 180ms var(--apple-ease-default)',
      }

  return (
    <div className="space-y-4">
      <div
        className="grid grid-cols-2"
        style={{
          background: 'var(--apple-surface)',
          border: '1px solid var(--apple-line)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 16px' }}>
          <p style={labelMicro}>{t('vault_position.vault_shares')}</p>
          <p style={valueText}>{parseFloat(sharesFormatted).toFixed(4)}</p>
          <p style={subText}>{vaultInfo?.symbol ?? t('vault_position.shares_fallback')}</p>
        </div>
        <div style={{ padding: '14px 16px', borderLeft: '1px solid var(--apple-line)' }}>
          <p style={labelMicro}>{t('vault_position.current_value')}</p>
          <p style={{ ...valueText, color: '#16a34a' }}>${parseFloat(valueFormatted).toFixed(2)}</p>
          <p style={subText}>USDC</p>
        </div>
      </div>

      <button onClick={handleWithdraw} disabled={isDisabled} style={withdrawStyle}>
        {isPending
          ? t('vault_position.button.confirm_wallet')
          : isConfirming
          ? t('vault_position.button.withdrawing')
          : isSuccess
          ? t('vault_position.button.withdrawn')
          : t('vault_position.button.withdraw_all')}
      </button>

      {txError && (
        <div
          style={{
            padding: 12,
            background: 'rgba(220, 38, 38, 0.06)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            borderRadius: 12,
            color: '#b91c1c',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            letterSpacing: 'var(--apple-track-tight)',
            wordBreak: 'break-word',
          }}
        >
          {txError.includes('User rejected') || txError.includes('denied')
            ? t('common.transaction_rejected')
            : txError.length > 100
            ? txError.slice(0, 100) + '...'
            : txError}
        </div>
      )}
    </div>
  )
}
