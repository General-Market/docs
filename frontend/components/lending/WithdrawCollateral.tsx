'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { formatUnits } from 'viem'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { useMorphoActions } from '@/hooks/useMorphoActions'
import { calculateHealthFactor } from '@/lib/types/morpho'
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
      refetchPosition()
      onSuccess?.()
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
      setTxError(actionError.message || 'Transaction failed')
      setStep('input')
      resetAction()
    }
  }, [actionError, resetAction])

  const handleWithdraw = useCallback(() => {
    if (!amount || parsedAmount === 0n || !canWithdraw) return
    successHandled.current = false
    setTxError(null)
    setStep('withdrawing')
    withdrawCollateral(parsedAmount)
  }, [amount, parsedAmount, canWithdraw, withdrawCollateral])

  const handleMax = () => {
    if (debtAmount === 0n) {
      // No debt - can withdraw all
      setAmount(formatUnits(collateralAmount, 18))
    } else {
      // Has debt - limit to maxWithdraw
      setAmount(formatUnits(maxWithdraw, 18))
    }
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
    ? 'Confirm in wallet...'
    : isConfirming
    ? 'Withdrawing...'
    : step === 'success'
    ? 'Withdrawn!'
    : 'Withdraw Collateral'

  const formattedCollateral = formatUnits(collateralAmount, 18)
  const formattedMaxWithdraw = formatUnits(maxWithdraw, 18)

  // Check if position will be closed
  const willClosePosition = parsedAmount === collateralAmount && debtAmount === 0n

  return (
    <div className="bg-white rounded-xl shadow-card border border-border-light p-6">
      <h2 className="text-lg font-bold text-text-primary mb-4">Withdraw Collateral</h2>
      <p className="text-text-secondary text-sm mb-4">
        {debtAmount === 0n
          ? 'Withdraw your ITP collateral'
          : 'Withdraw available collateral (limited by debt)'}
      </p>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-text-secondary">Amount (ITP)</label>
            <span className="text-xs text-text-muted">
              {debtAmount === 0n
                ? `Deposited: ${parseFloat(formattedCollateral).toFixed(4)}`
                : `Max withdraw: ${parseFloat(formattedMaxWithdraw).toFixed(4)}`}
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
              onClick={handleMax}
              disabled={isProcessing || collateralAmount === 0n}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-900 font-medium hover:text-zinc-700 disabled:opacity-50"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Projected Health Factor (only if has debt) */}
        {debtAmount > 0n && amount && parsedAmount > 0n && (
          <div className="bg-muted rounded-xl p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">Projected Health Factor</span>
              <span className={`font-mono tabular-nums font-bold ${
                projectedHealthFactor >= 1.5 ? 'text-color-up' :
                projectedHealthFactor >= 1.0 ? 'text-color-warning' :
                'text-color-down'
              }`}>
                {projectedHealthFactor === Infinity ? '∞' : projectedHealthFactor.toFixed(2)}
              </span>
            </div>
            {projectedHealthFactor < 1.0 && (
              <p className="text-color-down text-xs mt-2">
                Cannot withdraw: health factor would be below 1.0
              </p>
            )}
          </div>
        )}

        {/* Close position notice */}
        {willClosePosition && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-blue-700 text-sm">
              This will close your position and return all ITP to your wallet.
            </p>
          </div>
        )}

        <button
          onClick={handleWithdraw}
          disabled={!amount || parsedAmount === 0n || isProcessing || !canWithdraw}
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
