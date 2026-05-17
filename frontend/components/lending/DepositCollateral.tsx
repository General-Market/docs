'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount, useReadContract } from 'wagmi'
import { parseUnits, formatUnits, erc20Abi } from 'viem'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { indexL3 } from '@/lib/wagmi'
import { useItpApproval } from '@/hooks/useItpApproval'
import { useMorphoActions } from '@/hooks/useMorphoActions'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { useToast } from '@/lib/contexts/ToastContext'
import { getTxUrl } from '@/lib/utils/explorer'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

interface DepositCollateralProps {
  market?: MorphoMarketEntry
  itpId?: string
  onSuccess?: () => void
}

/**
 * DepositCollateral component (AC2)
 *
 * Allows users to deposit ITP tokens as collateral for borrowing USDC.
 * Handles approval flow if ITP is not approved for Morpho.
 */
export function DepositCollateral({ market, itpId, onSuccess }: DepositCollateralProps) {
  const t = useTranslations('lending')
  const { address } = useAccount()
  const { capture } = usePostHogTracker()
  const { showSuccess, showError } = useToast()
  const [amount, setAmount] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [step, setStep] = useState<'input' | 'approving' | 'depositing' | 'success'>('input')
  const [pendingDepositAmount, setPendingDepositAmount] = useState<bigint>(0n)

  const collateralToken = market?.collateralToken ?? MORPHO_ADDRESSES.collateralToken

  // Read ITP share balance directly from chain (collateral token ERC20 on L3)
  const { data: itpBalance = 0n, refetch: refetchBalance } = useReadContract({
    address: collateralToken as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && !!collateralToken, refetchInterval: 10_000 },
  })

  // Approval hook
  const {
    isApprovalNeeded,
    approve,
    state: approvalState,
    refetch: refetchAllowance,
  } = useItpApproval(market ? { collateralToken: market.collateralToken, morpho: market.morpho } : undefined)

  // Morpho actions
  const {
    supplyCollateral,
    isPending,
    isConfirming,
    isSuccess,
    error: actionError,
    reset: resetAction,
    txHash: depositTxHash,
  } = useMorphoActions(market)

  const parsedAmount = amount ? parseUnits(amount, 18) : 0n
  const needsApproval = isApprovalNeeded(parsedAmount)
  const formattedBalance = itpBalance ? formatUnits(itpBalance, 18) : '0'

  // Track success state
  const successHandled = useRef(false)
  // Track if approval has been processed to prevent double-deposit
  const approvalProcessed = useRef(false)

  // Define handleDeposit early so it can be used in effects
  const handleDeposit = useCallback(() => {
    if (!amount || parsedAmount === 0n) return
    successHandled.current = false
    setTxError(null)
    setStep('depositing')
    supplyCollateral(parsedAmount)
  }, [amount, parsedAmount, supplyCollateral])

  // Handle approval success - wait for confirmation before depositing
  useEffect(() => {
    if (approvalState === 'approved' && step === 'approving' && pendingDepositAmount > 0n && !approvalProcessed.current) {
      approvalProcessed.current = true
      refetchAllowance()
      // Small delay to ensure blockchain state is updated
      setTimeout(() => {
        setStep('depositing')
        supplyCollateral(pendingDepositAmount)
      }, 500)
    }
  }, [approvalState, step, pendingDepositAmount, refetchAllowance, supplyCollateral])

  useEffect(() => {
    if (isSuccess && !successHandled.current) {
      successHandled.current = true
      setStep('success')
      const amt = amount || '0'
      showSuccess(`Deposited ${amt} DTF as collateral`, depositTxHash ? { url: getTxUrl(depositTxHash, 'l3'), text: 'View tx' } : undefined)
      capture('lend_completed', { itp_id: itpId, action: 'deposit', tx_hash: depositTxHash })
      refetchBalance()
      refetchAllowance()
      onSuccess?.()
      window.dispatchEvent(new Event('lending-refresh'))
      // Reset after showing success
      setTimeout(() => {
        setStep('input')
        setAmount('')
        setPendingDepositAmount(0n)
        resetAction()
        successHandled.current = false
        approvalProcessed.current = false
      }, 2000)
    }
  }, [isSuccess, refetchBalance, refetchAllowance, onSuccess, resetAction])

  // Handle errors
  useEffect(() => {
    if (actionError) {
      const errMsg = actionError.message || t('common.transaction_failed')
      setTxError(errMsg)
      showError(`Deposit failed: ${errMsg.slice(0, 80)}`)
      capture('lend_failed', { itp_id: itpId, action: 'deposit', error_message: errMsg })
      setStep('input')
      setPendingDepositAmount(0n)
      resetAction()
      approvalProcessed.current = false
    }
  }, [actionError, resetAction])

  const handleApprove = useCallback(() => {
    if (!amount || parsedAmount === 0n) return
    setTxError(null)
    setStep('approving')
    setPendingDepositAmount(parsedAmount)
    approvalProcessed.current = false
    // Approve 2x amount to avoid repeated approvals
    approve(parsedAmount * 2n)
  }, [amount, parsedAmount, approve])

  const handleSubmit = () => {
    capture('lend_deposit_submitted', { itp_id: itpId, amount: amount })
    if (needsApproval) {
      handleApprove()
    } else {
      handleDeposit()
    }
  }

  const [stuckWarning, setStuckWarning] = useState(false)

  // Detect stuck transactions — warn after 30s of confirming
  useEffect(() => {
    if (!isConfirming && approvalState !== 'approving') {
      setStuckWarning(false)
      return
    }
    const timer = setTimeout(() => setStuckWarning(true), 30_000)
    return () => clearTimeout(timer)
  }, [isConfirming, approvalState])

  const handleCancel = useCallback(() => {
    resetAction()
    setStep('input')
    setTxError(null)
    setStuckWarning(false)
    setPendingDepositAmount(0n)
    successHandled.current = false
    approvalProcessed.current = false
  }, [resetAction])

  const isProcessing = isPending || isConfirming || approvalState === 'approving'

  const buttonText = approvalState === 'approving'
    ? t('deposit_collateral.button.approving_itp')
    : isPending
    ? t('deposit_collateral.button.confirm_wallet')
    : isConfirming
    ? t('deposit_collateral.button.depositing')
    : step === 'success'
    ? t('deposit_collateral.button.deposited')
    : needsApproval
    ? t('deposit_collateral.button.approve_and_deposit')
    : t('deposit_collateral.button.deposit_collateral')

  const isDisabled = !amount || parsedAmount === 0n || isProcessing || parsedAmount > itpBalance
  const isSuccessState = step === 'success'

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
              {t('deposit_collateral.amount_label')}
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
              {t('deposit_collateral.balance_label', { amount: parseFloat(formattedBalance).toFixed(4) })}
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
              onClick={() => {
                const parsed = parseFloat(formattedBalance)
                setAmount((Math.floor(parsed * 10000) / 10000).toFixed(4))
              }}
              disabled={isProcessing}
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
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.5 : 1,
                transition: 'background 180ms var(--apple-ease-default)',
              }}
            >
              {t('actions.max')}
            </button>
          </div>
          {amount && parsedAmount > itpBalance && (
            <p
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 12,
                letterSpacing: 'var(--apple-track-tight)',
                color: '#dc2626',
                margin: '6px 0 0 0',
              }}
            >
              {t('deposit_collateral.insufficient_balance')}
            </p>
          )}
        </div>

        <button
          onClick={handleSubmit}
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

        {step === 'success' && depositTxHash && (
          <a
            href={getTxUrl(depositTxHash, 'l3')}
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
