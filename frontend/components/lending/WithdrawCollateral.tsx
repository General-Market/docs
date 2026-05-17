'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { formatUnits } from 'viem'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { useMorphoActions } from '@/hooks/useMorphoActions'
import { calculateHealthFactor } from '@/lib/types/morpho'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { useToast } from '@/lib/contexts/ToastContext'
import { getTxUrl } from '@/lib/utils/explorer'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

interface WithdrawCollateralProps {
  market?: MorphoMarketEntry
  onSuccess?: () => void
}

/**
 * WithdrawCollateral component (AC6)
 *
 * Allows users to withdraw ITP collateral.
 * - If no debt, allows full withdrawal
 * - If debt exists, limits withdrawal to maintain health factor > 1.0
 */
export function WithdrawCollateral({ market, onSuccess }: WithdrawCollateralProps) {
  const t = useTranslations('lending')
  const { capture } = usePostHogTracker()
  const { showSuccess, showError } = useToast()
  const [amount, setAmount] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [step, setStep] = useState<'input' | 'withdrawing' | 'success'>('input')

  const lltv = market?.lltv ?? BigInt('770000000000000000')

  const { position, oraclePrice, refetch: refetchPosition } = useMorphoPosition(market)
  const {
    withdrawCollateral,
    isPending,
    isConfirming,
    isSuccess,
    error: actionError,
    reset: resetAction,
    txHash: withdrawTxHash,
  } = useMorphoActions(market)

  const collateralAmount = position?.collateralAmount ?? 0n
  const debtAmount = position?.debtAmount ?? 0n
  const maxWithdraw = position?.maxWithdraw ?? 0n

  // Parse amount (18 decimals for ITP)
  let parsedAmount = 0n
  try {
    if (amount) {
      const [whole, decimal = ''] = amount.split('.')
      const paddedDecimal = decimal.padEnd(18, '0').slice(0, 18)
      parsedAmount = BigInt(whole || '0') * BigInt(1e18) + BigInt(paddedDecimal)
    }
  } catch {
    parsedAmount = 0n
  }

  // Calculate projected health factor after withdrawal
  let projectedHealthFactor = Infinity
  if (oraclePrice && collateralAmount > 0n && parsedAmount > 0n && debtAmount > 0n) {
    const newCollateral = collateralAmount - parsedAmount
    if (newCollateral > 0n) {
      projectedHealthFactor = calculateHealthFactor(
        newCollateral,
        oraclePrice,
        debtAmount,
        lltv
      )
    } else {
      projectedHealthFactor = 0
    }
  }

  const canWithdraw = debtAmount === 0n
    ? parsedAmount <= collateralAmount
    : projectedHealthFactor >= 1.0 && parsedAmount <= maxWithdraw

  // Track success state
  const successHandled = useRef(false)

  useEffect(() => {
    if (isSuccess && !successHandled.current) {
      successHandled.current = true
      setStep('success')
      const amt = amount || '0'
      showSuccess(`Withdrew ${parseFloat(amt).toFixed(4)} DTF collateral`, withdrawTxHash ? { url: getTxUrl(withdrawTxHash, 'l3'), text: 'View tx' } : undefined)
      capture('lend_completed', { itp_id: market?.collateralToken, action: 'withdraw', tx_hash: withdrawTxHash })
      refetchPosition()
      onSuccess?.()
      window.dispatchEvent(new Event('lending-refresh'))
      setTimeout(() => {
        setStep('input')
        setAmount('')
        resetAction()
        successHandled.current = false
      }, 2000)
    }
  }, [isSuccess, refetchPosition, onSuccess, resetAction])

  useEffect(() => {
    if (actionError) {
      const errMsg = actionError.message || t('common.transaction_failed')
      setTxError(errMsg)
      showError(`Withdraw failed: ${errMsg.slice(0, 80)}`)
      capture('lend_failed', { itp_id: market?.collateralToken, action: 'withdraw', error_message: errMsg })
      setStep('input')
      resetAction()
    }
  }, [actionError, resetAction])

  const handleWithdraw = useCallback(() => {
    if (!amount || parsedAmount === 0n || !canWithdraw) return
    capture('lend_withdraw_submitted', { itp_id: market?.collateralToken, amount: amount })
    successHandled.current = false
    setTxError(null)
    setStep('withdrawing')
    withdrawCollateral(parsedAmount)
  }, [amount, parsedAmount, canWithdraw, withdrawCollateral, capture, market?.collateralToken])

  const handleMax = () => {
    const raw = debtAmount === 0n ? collateralAmount : maxWithdraw
    const parsed = parseFloat(formatUnits(raw, 18))
    // Truncate (floor) to 4 decimals so we never exceed the on-chain max
    setAmount((Math.floor(parsed * 10000) / 10000).toFixed(4))
  }

  const [stuckWarning, setStuckWarning] = useState(false)

  // Detect stuck transactions — warn after 30s of confirming
  useEffect(() => {
    if (!isConfirming) {
      setStuckWarning(false)
      return
    }
    const timer = setTimeout(() => setStuckWarning(true), 30_000)
    return () => clearTimeout(timer)
  }, [isConfirming])

  const handleCancel = useCallback(() => {
    resetAction()
    setStep('input')
    setTxError(null)
    setStuckWarning(false)
    successHandled.current = false
  }, [resetAction])

  const isProcessing = isPending || isConfirming

  const buttonText = isPending
    ? t('withdraw_collateral.button.confirm_wallet')
    : isConfirming
    ? t('withdraw_collateral.button.withdrawing')
    : step === 'success'
    ? t('withdraw_collateral.button.withdrawn')
    : t('withdraw_collateral.button.withdraw_collateral')

  const formattedCollateral = formatUnits(collateralAmount, 18)
  const formattedMaxWithdraw = formatUnits(maxWithdraw, 18)

  // Check if position will be closed
  const willClosePosition = parsedAmount === collateralAmount && debtAmount === 0n

  const isDisabled = !amount || parsedAmount === 0n || isProcessing || !canWithdraw
  const isSuccessState = step === 'success'
  const maxDisabled = isProcessing || collateralAmount === 0n
  const healthColor =
    projectedHealthFactor >= 1.5 ? '#16a34a' :
    projectedHealthFactor >= 1.0 ? '#b45309' :
    '#dc2626'

  return (
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text-secondary)',
              }}
            >
              {t('withdraw_collateral.amount_label')}
            </label>
            <span
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 12,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text-tertiary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {debtAmount === 0n
                ? t('withdraw_collateral.deposited_label', { amount: parseFloat(formattedCollateral).toFixed(4) })
                : t('withdraw_collateral.max_withdraw_label', { amount: parseFloat(formattedMaxWithdraw).toFixed(4) })}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.1"
              disabled={isProcessing}
              style={{
                width: '100%',
                padding: '12px 56px 12px 14px',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 17,
                fontWeight: 500,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text)',
                background: 'var(--apple-panel)',
                border: '1px solid var(--apple-line)',
                borderRadius: 12,
                outline: 'none',
                transition: 'border-color 200ms var(--apple-ease-default), box-shadow 200ms var(--apple-ease-default)',
                fontVariantNumeric: 'tabular-nums',
                opacity: isProcessing ? 0.5 : 1,
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#0071e3'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.18)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--apple-line)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
            <button
              onClick={handleMax}
              disabled={maxDisabled}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px 10px',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-tight)',
                color: '#0071e3',
                background: 'rgba(0,113,227,0.08)',
                border: 'none',
                borderRadius: 6,
                cursor: maxDisabled ? 'not-allowed' : 'pointer',
                opacity: maxDisabled ? 0.5 : 1,
                transition: 'background 180ms var(--apple-ease-default)',
              }}
            >
              {t('actions.max')}
            </button>
          </div>
        </div>

        {/* Projected Health Factor (only if has debt) */}
        {debtAmount > 0n && amount && parsedAmount > 0n && (
          <div
            style={{
              background: 'var(--apple-surface)',
              border: '1px solid var(--apple-line)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div className="flex justify-between items-center">
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text-secondary)',
                }}
              >
                {t('withdraw_collateral.projected_health_factor')}
              </span>
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: healthColor,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {projectedHealthFactor === Infinity ? '∞' : projectedHealthFactor.toFixed(2)}
              </span>
            </div>
            {projectedHealthFactor < 1.0 && (
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 12,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: '#dc2626',
                  margin: '8px 0 0 0',
                }}
              >
                {t('withdraw_collateral.cannot_withdraw_health')}
              </p>
            )}
          </div>
        )}

        {/* Close position notice */}
        {willClosePosition && (
          <div
            style={{
              padding: 12,
              background: 'rgba(0,113,227,0.06)',
              border: '1px solid rgba(0,113,227,0.2)',
              borderRadius: 12,
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--apple-font-text)',
                fontSize: 13,
                letterSpacing: 'var(--apple-track-tight)',
                color: '#0071e3',
              }}
            >
              {t('withdraw_collateral.close_position_notice')}
            </p>
          </div>
        )}

        <button
          onClick={handleWithdraw}
          disabled={isDisabled}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: isDisabled && !isSuccessState ? 'var(--apple-text-tertiary)' : '#fff',
            background: isSuccessState ? '#16a34a' : isDisabled ? '#e5e5ea' : '#0071e3',
            border: 'none',
            borderRadius: 12,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            transition: 'background 180ms var(--apple-ease-default), opacity 180ms var(--apple-ease-default)',
          }}
        >
          {buttonText}
        </button>

        {step === 'success' && withdrawTxHash && (
          <a
            href={getTxUrl(withdrawTxHash, 'l3')}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '6px 0',
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              letterSpacing: 'var(--apple-track-tight)',
              color: '#0071e3',
              textDecoration: 'none',
            }}
          >
            {t('common.view_on_explorer')} ↗
          </a>
        )}

        {isProcessing && (
          <button
            onClick={handleCancel}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              padding: '8px 0',
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t('actions.cancel')}
          </button>
        )}

        {stuckWarning && (
          <div
            style={{
              padding: 12,
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 12,
              color: '#b45309',
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              letterSpacing: 'var(--apple-track-tight)',
            }}
          >
            <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>{t('common.tx_stuck_title')}</p>
            <p style={{ fontSize: 12, color: '#92400e', marginTop: 4, marginBottom: 0 }}>{t('common.tx_stuck_description')}</p>
          </div>
        )}

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
              : <span style={{ wordBreak: 'break-all' }}>{txError}</span>}
          </div>
        )}
      </div>
  )
}
