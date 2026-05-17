'use client'

import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useUserState } from '@/hooks/useUserState'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { useMorphoActions } from '@/hooks/useMorphoActions'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { useToast } from '@/lib/contexts/ToastContext'
import { getTxUrl } from '@/lib/utils/explorer'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

interface RepayDebtProps {
  market?: MorphoMarketEntry
  itpId?: string
  onSuccess?: () => void
}

/**
 * RepayDebt component (AC5)
 *
 * Allows users to repay USDC debt.
 * Handles USDC approval flow if not approved for Morpho.
 */
export function RepayDebt({ market, itpId, onSuccess }: RepayDebtProps) {
  const t = useTranslations('lending')
  const { address } = useAccount()
  const { capture } = usePostHogTracker()
  const { showSuccess, showError } = useToast()
  const [amount, setAmount] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [step, setStep] = useState<'input' | 'approving' | 'repaying' | 'success'>('input')
  const [pendingRepayAmount, setPendingRepayAmount] = useState<bigint>(0n)

  const loanToken = market?.loanToken ?? MORPHO_ADDRESSES.loanToken
  const morphoAddress = market?.morpho ?? MORPHO_ADDRESSES.morpho

  const { position, borrowShares, refetch: refetchPosition } = useMorphoPosition(market)
  const currentDebt = position?.debtAmount ?? 0n

  // Fetch user's USDC balance and allowance from backend
  const userState = useUserState(itpId)
  const usdcBalance = userState.usdcBalance
  const usdcAllowanceMorpho = userState.usdcAllowanceMorpho
  const refetchBalance = userState.refetch

  // Approval transaction
  const {
    writeContract: writeApproval,
    data: approvalTxHash,
    isPending: isApprovalPending,
    error: approvalError,
    reset: resetApproval,
  } = useChainWriteContract()

  const {
    isLoading: isApprovalConfirming,
    isSuccess: isApprovalConfirmed,
  } = useWaitForTransactionReceipt({ hash: approvalTxHash })

  const {
    repay,
    repayAll,
    isPending,
    isConfirming,
    isSuccess,
    error: actionError,
    reset: resetAction,
    txHash: repayTxHash,
  } = useMorphoActions(market)

  const [isMaxRepay, setIsMaxRepay] = useState(false)

  const parsedAmount = amount ? parseUnits(amount, 18) : 0n
  const needsApproval = usdcAllowanceMorpho < parsedAmount
  const formattedBalance = usdcBalance ? formatUnits(usdcBalance, 18) : '0'
  const formattedDebt = formatUnits(currentDebt, 18)

  // Track success state
  const successHandled = useRef(false)
  const approvalHandled = useRef(false)

  // Handle approval confirmation - proceed to repay
  useEffect(() => {
    if (isApprovalConfirmed && step === 'approving' && pendingRepayAmount > 0n && !approvalHandled.current) {
      approvalHandled.current = true
      refetchBalance()
      // Small delay to ensure allowance is updated on-chain
      setTimeout(() => {
        setStep('repaying')
        if (isMaxRepay && borrowShares && borrowShares > 0n) {
          repayAll(borrowShares)
        } else {
          repay(pendingRepayAmount)
        }
      }, 500)
    }
  }, [isApprovalConfirmed, step, pendingRepayAmount, refetchBalance, repay, repayAll, isMaxRepay, borrowShares])

  useEffect(() => {
    if (isSuccess && !successHandled.current) {
      successHandled.current = true
      setStep('success')
      const amt = amount || '0'
      showSuccess(`Repaid ${parseFloat(amt).toFixed(2)} USDC`, repayTxHash ? { url: getTxUrl(repayTxHash, 'l3'), text: 'View tx' } : undefined)
      capture('lend_completed', { itp_id: itpId, action: 'repay', tx_hash: repayTxHash })
      refetchPosition()
      refetchBalance()
      onSuccess?.()
      window.dispatchEvent(new Event('lending-refresh'))
      setTimeout(() => {
        setStep('input')
        setAmount('')
        setPendingRepayAmount(0n)
        setIsMaxRepay(false)
        resetAction()
        resetApproval()
        successHandled.current = false
        approvalHandled.current = false
      }, 2000)
    }
  }, [isSuccess, refetchPosition, refetchBalance, onSuccess, resetAction, resetApproval])

  useEffect(() => {
    if (actionError || approvalError) {
      const errMsg = (actionError || approvalError)?.message || t('common.transaction_failed')
      setTxError(errMsg)
      showError(`Repay failed: ${errMsg.slice(0, 80)}`)
      capture('lend_failed', { itp_id: itpId, action: 'repay', error_message: errMsg })
      setStep('input')
      setPendingRepayAmount(0n)
      setIsMaxRepay(false)
      resetAction()
      resetApproval()
      approvalHandled.current = false
    }
  }, [actionError, approvalError, resetAction, resetApproval])

  const handleRepay = useCallback(() => {
    if (!amount || parsedAmount === 0n) return
    successHandled.current = false
    setTxError(null)
    setStep('repaying')
    // Shares-based repay for MAX to avoid dust debt
    if (isMaxRepay && borrowShares && borrowShares > 0n) {
      repayAll(borrowShares)
    } else {
      repay(parsedAmount)
    }
  }, [amount, parsedAmount, repay, repayAll, isMaxRepay, borrowShares])

  const handleApprove = useCallback(() => {
    if (!amount || parsedAmount === 0n) return
    setTxError(null)
    setStep('approving')
    setPendingRepayAmount(parsedAmount)
    approvalHandled.current = false
    // Approve 2x the amount to reduce future approval needs
    writeApproval({
      address: loanToken,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [morphoAddress, parsedAmount * 2n],
    })
  }, [amount, parsedAmount, writeApproval, loanToken, morphoAddress])

  const handleSubmit = () => {
    capture('lend_repay_submitted', { itp_id: itpId, amount: amount })
    if (needsApproval) {
      handleApprove()
    } else {
      handleRepay()
    }
  }

  const handleMax = () => {
    // Set to min of debt and balance
    const maxRepay = currentDebt < usdcBalance ? currentDebt : usdcBalance
    const parsed = parseFloat(formatUnits(maxRepay, 18))
    // Truncate (floor) to 2 decimals so we never exceed on-chain max
    setAmount((Math.floor(parsed * 100) / 100).toFixed(2))
    setIsMaxRepay(true)
  }

  const [stuckWarning, setStuckWarning] = useState(false)

  // Detect stuck transactions — warn after 30s of confirming
  useEffect(() => {
    if (!isConfirming && !isApprovalConfirming) {
      setStuckWarning(false)
      return
    }
    const timer = setTimeout(() => setStuckWarning(true), 30_000)
    return () => clearTimeout(timer)
  }, [isConfirming, isApprovalConfirming])

  const handleCancel = useCallback(() => {
    resetAction()
    resetApproval()
    setStep('input')
    setTxError(null)
    setStuckWarning(false)
    setPendingRepayAmount(0n)
    setIsMaxRepay(false)
    successHandled.current = false
    approvalHandled.current = false
  }, [resetAction, resetApproval])

  const isProcessing = isPending || isConfirming || isApprovalPending || isApprovalConfirming

  const buttonText = isApprovalPending
    ? t('repay_debt.button.confirm_approval')
    : isApprovalConfirming
    ? t('repay_debt.button.approving_usdc')
    : isPending
    ? t('repay_debt.button.confirm_wallet')
    : isConfirming
    ? t('repay_debt.button.repaying')
    : step === 'success'
    ? t('repay_debt.button.repaid')
    : needsApproval
    ? t('repay_debt.button.approve_and_repay')
    : t('repay_debt.button.repay_debt')

  const isInsufficient = Boolean(amount) && parsedAmount > usdcBalance
  const isDisabled = !amount || parsedAmount === 0n || isProcessing || parsedAmount > usdcBalance

  const submitStyle: CSSProperties = isDisabled
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
        background: step === 'success' ? '#16a34a' : '#0071e3',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'background 180ms var(--apple-ease-default), opacity 180ms var(--apple-ease-default)',
      }

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
              {t('repay_debt.amount_label')}
            </label>
            <div
              className="flex items-center gap-2"
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 12,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text-tertiary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>{t('repay_debt.debt_label', { amount: parseFloat(formattedDebt).toFixed(2) })}</span>
              <span style={{ color: 'var(--apple-line)' }}>|</span>
              <span>{t('repay_debt.balance_label', { amount: parseFloat(formattedBalance).toFixed(2) })}</span>
            </div>
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setIsMaxRepay(false) }}
              placeholder="0.00"
              min="0"
              step="1"
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
              disabled={isProcessing || currentDebt === 0n}
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
                cursor: isProcessing || currentDebt === 0n ? 'not-allowed' : 'pointer',
                opacity: isProcessing || currentDebt === 0n ? 0.5 : 1,
                transition: 'background 180ms var(--apple-ease-default)',
              }}
            >
              {t('actions.max')}
            </button>
          </div>
          {isInsufficient && (
            <p
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 12,
                letterSpacing: 'var(--apple-track-tight)',
                color: '#dc2626',
                margin: '6px 0 0 0',
              }}
            >
              {t('repay_debt.insufficient_balance')}
            </p>
          )}
        </div>

        <button onClick={handleSubmit} disabled={isDisabled} style={submitStyle}>
          {buttonText}
        </button>

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
            <p style={{ fontSize: 12, color: '#92400e', marginTop: 4, marginBottom: 0 }}>
              {t('common.tx_stuck_description')}
            </p>
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
              : <span>{txError}</span>}
          </div>
        )}
      </div>
  )
}
