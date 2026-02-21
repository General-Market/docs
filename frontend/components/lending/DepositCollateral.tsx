'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { useUserState } from '@/hooks/useUserState'
import { useItpApproval } from '@/hooks/useItpApproval'
import { useMorphoActions } from '@/hooks/useMorphoActions'
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
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [step, setStep] = useState<'input' | 'approving' | 'depositing' | 'success'>('input')
  const [pendingDepositAmount, setPendingDepositAmount] = useState<bigint>(0n)

  const collateralToken = market?.collateralToken ?? MORPHO_ADDRESSES.collateralToken

  // Fetch user's ITP balance from backend
  const userState = useUserState(itpId)
  const itpBalance = userState.bridgedItpBalance
  const refetchBalance = userState.refetch

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
      refetchBalance()
      refetchAllowance()
      onSuccess?.()
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
      setTxError(actionError.message || 'Transaction failed')
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
    ? 'Approving ITP...'
    : isPending
    ? 'Confirm in wallet...'
    : isConfirming
    ? 'Depositing...'
    : step === 'success'
    ? 'Deposited!'
    : needsApproval
    ? 'Approve & Deposit'
    : 'Deposit Collateral'

  return (
    <div className="bg-white rounded-xl shadow-card border border-border-light p-6">
      <h2 className="text-lg font-bold text-text-primary mb-4">Deposit Collateral</h2>
      <p className="text-text-secondary text-sm mb-4">
        Deposit ITP tokens as collateral to borrow USDC
      </p>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-text-secondary">Amount (ITP)</label>
            <span className="text-xs text-text-muted">
              Balance: {parseFloat(formattedBalance).toFixed(4)} ITP
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.1"
              disabled={isProcessing}
              className="w-full bg-muted border border-border-medium rounded-lg px-4 py-3 text-text-primary text-lg focus:border-zinc-900 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => setAmount(formattedBalance)}
              disabled={isProcessing}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-900 font-medium hover:text-zinc-700 disabled:opacity-50"
            >
              MAX
            </button>
          </div>
          {amount && parsedAmount > itpBalance && (
            <p className="text-color-down text-xs mt-1">Insufficient ITP balance</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!amount || parsedAmount === 0n || isProcessing || parsedAmount > itpBalance}
          className={`w-full py-3 font-bold rounded-lg transition-colors ${
            step === 'success'
              ? 'bg-color-up text-white'
              : 'bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-muted disabled:text-text-muted disabled:cursor-not-allowed'
          }`}
        >
          {buttonText}
        </button>

        {isProcessing && (
          <button
            onClick={handleCancel}
            className="w-full text-center text-sm text-text-muted hover:text-text-secondary py-2 transition-colors"
          >
            Cancel
          </button>
        )}

        {stuckWarning && (
          <div className="bg-surface-warning border border-orange-300 rounded-xl p-3 text-orange-700 text-sm">
            <p className="font-bold">Transaction may be stuck</p>
            <p className="text-xs mt-1">Not confirmed after 30s. You can cancel and try again.</p>
          </div>
        )}

        {txError && (
          <div className="bg-surface-down border border-red-300 rounded-xl p-3 text-color-down text-sm">
            {txError.includes('User rejected') || txError.includes('denied')
              ? 'Transaction rejected'
              : <span className="break-all">{txError}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
