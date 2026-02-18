'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useUserState } from '@/hooks/useUserState'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { useMorphoActions } from '@/hooks/useMorphoActions'
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
  const { address } = useAccount()
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
  } = useMorphoActions(market)

  const [isMaxRepay, setIsMaxRepay] = useState(false)

  const parsedAmount = amount ? parseUnits(amount, 6) : 0n
  const needsApproval = usdcAllowanceMorpho < parsedAmount
  const formattedBalance = usdcBalance ? formatUnits(usdcBalance, 6) : '0'
  const formattedDebt = formatUnits(currentDebt, 6)

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
      refetchPosition()
      refetchBalance()
      onSuccess?.()
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
      setTxError((actionError || approvalError)?.message || 'Transaction failed')
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
    if (needsApproval) {
      handleApprove()
    } else {
      handleRepay()
    }
  }

  const handleMax = () => {
    // Set to min of debt and balance
    const maxRepay = currentDebt < usdcBalance ? currentDebt : usdcBalance
    setAmount(formatUnits(maxRepay, 6))
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
    ? 'Confirm approval...'
    : isApprovalConfirming
    ? 'Approving USDC...'
    : isPending
    ? 'Confirm in wallet...'
    : isConfirming
    ? 'Repaying...'
    : step === 'success'
    ? 'Repaid!'
    : needsApproval
    ? 'Approve & Repay'
    : 'Repay Debt'

  return (
    <div className="bg-terminal-dark border border-white/10 rounded-lg p-6">
      <h2 className="text-lg font-bold text-white mb-4">Repay Debt</h2>
      <p className="text-white/60 text-sm mb-4">
        Repay your USDC debt to improve your health factor
      </p>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-white/70">Amount (USDC)</label>
            <div className="text-xs text-white/40 space-x-2">
              <span>Debt: {parseFloat(formattedDebt).toFixed(2)}</span>
              <span>|</span>
              <span>Balance: {parseFloat(formattedBalance).toFixed(2)}</span>
            </div>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setIsMaxRepay(false) }}
              placeholder="0.00"
              min="0"
              step="1"
              disabled={isProcessing}
              className="w-full bg-terminal border border-white/20 rounded px-4 py-3 text-white text-lg focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleMax}
              disabled={isProcessing || currentDebt === 0n}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-accent hover:text-accent/80 disabled:opacity-50"
            >
              MAX
            </button>
          </div>
          {amount && parsedAmount > usdcBalance && (
            <p className="text-red-400 text-xs mt-1">Insufficient USDC balance</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!amount || parsedAmount === 0n || isProcessing || parsedAmount > usdcBalance}
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
