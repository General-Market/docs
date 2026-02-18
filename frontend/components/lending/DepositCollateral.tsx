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
    <div className="bg-terminal-dark border border-white/10 rounded-lg p-6">
      <h2 className="text-lg font-bold text-white mb-4">Deposit Collateral</h2>
      <p className="text-white/60 text-sm mb-4">
        Deposit ITP tokens as collateral to borrow USDC
      </p>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-white/70">Amount (ITP)</label>
            <span className="text-xs text-white/40">
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
              className="w-full bg-terminal border border-white/20 rounded px-4 py-3 text-white text-lg focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => setAmount(formattedBalance)}
              disabled={isProcessing}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-accent hover:text-accent/80 disabled:opacity-50"
            >
              MAX
            </button>
          </div>
          {amount && parsedAmount > itpBalance && (
            <p className="text-red-400 text-xs mt-1">Insufficient ITP balance</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!amount || parsedAmount === 0n || isProcessing || parsedAmount > itpBalance}
          className={`w-full py-3 font-bold rounded-lg transition-colors ${
            step === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-accent text-terminal hover:bg-accent/90 disabled:bg-white/20 disabled:text-white/50 disabled:cursor-not-allowed'
          }`}
        >
          {buttonText}
        </button>

        {isProcessing && (
          <button
            onClick={handleCancel}
            className="w-full text-center text-sm text-white/50 hover:text-white/80 py-2 transition-colors"
          >
            Cancel
          </button>
        )}

        {stuckWarning && (
          <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
            <p className="font-bold">Transaction may be stuck</p>
            <p className="text-xs mt-1">Not confirmed after 30s. You can cancel and try again.</p>
          </div>
        )}

        {txError && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
            {txError.includes('User rejected') || txError.includes('denied')
              ? 'Transaction rejected'
              : <span className="break-all">{txError}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
