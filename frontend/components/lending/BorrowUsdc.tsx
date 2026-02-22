'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { parseUnits, formatUnits } from 'viem'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { useMorphoActions } from '@/hooks/useMorphoActions'
import { useLendingQuote } from '@/hooks/useLendingQuote'
import { useBundlerExec } from '@/hooks/useBundlerExec'
import { calculateHealthFactor } from '@/lib/types/morpho'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

interface BorrowUsdcProps {
  market?: MorphoMarketEntry
  onSuccess?: () => void
}

/**
 * BorrowUsdc component (AC3, AC4)
 *
 * Allows users to borrow USDC against their deposited ITP collateral.
 * Shows projected health factor and prevents borrowing if health factor < 1.0.
 */
export function BorrowUsdc({ market, onSuccess }: BorrowUsdcProps) {
  const [amount, setAmount] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [step, setStep] = useState<'input' | 'borrowing' | 'success'>('input')

  const lltv = market?.lltv ?? BigInt('770000000000000000')

  const { position, oraclePrice, refetch: refetchPosition } = useMorphoPosition(market)
  const {
    borrow,
    isPending,
    isConfirming,
    isSuccess,
    error: actionError,
    reset: resetAction,
  } = useMorphoActions(market)

  // Quote API integration (intent-based flow)
  const [useQuoteMode, setUseQuoteMode] = useState(false)
  const { quote, isLoading: isQuoteLoading, error: quoteError, isExpired, fetchQuote } = useLendingQuote({
    itpAddress: market?.collateralToken,
    collateralAmount: position?.collateralAmount?.toString(),
    borrowAmount: amount ? parseUnits(amount, 6).toString() : undefined,
    enabled: useQuoteMode && !!amount,
  })
  const {
    execute: executeBundler,
    isPending: isBundlerPending,
    isConfirming: isBundlerConfirming,
    isSuccess: isBundlerSuccess,
    error: bundlerError,
    reset: resetBundler,
  } = useBundlerExec()

  const parsedAmount = amount ? parseUnits(amount, 6) : 0n
  const maxBorrow = position?.maxBorrow ?? 0n
  const currentDebt = position?.debtAmount ?? 0n
  const collateralAmount = position?.collateralAmount ?? 0n

  // Calculate projected health factor after borrowing
  let projectedHealthFactor = Infinity
  if (oraclePrice && collateralAmount > 0n && parsedAmount > 0n) {
    const newDebt = currentDebt + parsedAmount
    projectedHealthFactor = calculateHealthFactor(
      collateralAmount,
      oraclePrice,
      newDebt,
      lltv
    )
  }

  const canBorrow = projectedHealthFactor >= 1.0 && parsedAmount <= maxBorrow

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

  const handleBorrow = useCallback(() => {
    if (!amount || parsedAmount === 0n || !canBorrow) return
    successHandled.current = false
    setTxError(null)
    setStep('borrowing')
    borrow(parsedAmount)
  }, [amount, parsedAmount, canBorrow, borrow])

  const isProcessing = isPending || isConfirming

  const buttonText = isPending
    ? 'Confirm in wallet...'
    : isConfirming
    ? 'Borrowing...'
    : step === 'success'
    ? 'Borrowed!'
    : 'Borrow USDC'

  const formatMaxBorrow = maxBorrow ? formatUnits(maxBorrow, 6) : '0'

  return (
    <div className="bg-white rounded-xl shadow-card border border-border-light p-6">
      <h2 className="text-lg font-bold text-text-primary mb-4">Borrow USDC</h2>
      <p className="text-text-secondary text-sm mb-4">
        Borrow USDC against your ITP collateral
      </p>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-text-secondary">Amount (USDC)</label>
            <span className="text-xs text-text-muted">
              Max borrow: {parseFloat(formatMaxBorrow).toFixed(2)} USDC
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="1"
              disabled={isProcessing}
              className="w-full bg-muted border border-border-medium rounded-lg px-4 py-3 text-text-primary text-lg focus:border-zinc-900 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => setAmount(formatMaxBorrow)}
              disabled={isProcessing || maxBorrow === 0n}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-900 font-medium hover:text-zinc-700 disabled:opacity-50"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Projected Health Factor */}
        {amount && parsedAmount > 0n && (
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
                Cannot borrow: health factor would be below 1.0
              </p>
            )}
            {projectedHealthFactor >= 1.0 && projectedHealthFactor < 1.5 && (
              <p className="text-color-warning text-xs mt-2">
                Warning: Low health factor increases liquidation risk
              </p>
            )}
          </div>
        )}

        {/* Quote API Terms (when in quote mode) */}
        {useQuoteMode && quote && !isExpired && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
            <div className="text-xs text-blue-700 font-bold uppercase tracking-wider">Quote Terms</div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Borrow APR</span>
              <span className="text-text-primary font-mono tabular-nums">{quote.terms.borrowRate}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Health Factor</span>
              <span className={`font-mono tabular-nums font-bold ${
                parseFloat(quote.terms.healthFactor) >= 1.5 ? 'text-color-up' :
                parseFloat(quote.terms.healthFactor) >= 1.0 ? 'text-color-warning' :
                'text-color-down'
              }`}>{quote.terms.healthFactor}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Liquidation Price</span>
              <span className="text-text-primary font-mono tabular-nums">${quote.terms.liquidationPrice}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Max Borrow</span>
              <span className="text-text-primary font-mono tabular-nums">{quote.terms.maxBorrow} USDC</span>
            </div>
            <div className="text-xs text-text-muted">
              Bundle: {quote.bundler.steps.join(' → ')}
            </div>
          </div>
        )}

        {useQuoteMode && isExpired && (
          <div className="bg-surface-warning border border-orange-300 rounded-xl p-2 text-orange-700 text-xs text-center">
            Quote expired -- <button onClick={fetchQuote} className="underline">refresh</button>
          </div>
        )}

        {/* Borrow button (direct or bundler) */}
        {useQuoteMode && quote && !isExpired ? (
          <button
            onClick={() => executeBundler(quote)}
            disabled={isBundlerPending || isBundlerConfirming}
            className="w-full py-3 font-bold rounded-lg transition-colors bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-muted disabled:text-text-muted disabled:cursor-not-allowed"
          >
            {isBundlerPending ? 'Confirm in wallet...' :
             isBundlerConfirming ? 'Executing bundle...' :
             isBundlerSuccess ? 'Borrowed!' :
             'Execute Bundle'}
          </button>
        ) : (
          <WalletActionButton
            onClick={handleBorrow}
            disabled={!amount || parsedAmount === 0n || isProcessing || !canBorrow}
            className={`w-full py-3 font-bold rounded-lg transition-colors ${
              step === 'success'
                ? 'bg-color-up text-white'
                : 'bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-muted disabled:text-text-muted disabled:cursor-not-allowed'
            }`}
          >
            {buttonText}
          </WalletActionButton>
        )}

        {/* Quote mode toggle — hidden, direct borrow is default */}

        {(txError || quoteError || bundlerError) && (
          <div className="bg-surface-down border border-red-300 rounded-xl p-3 text-color-down text-sm">
            {(() => {
              const msg = txError || quoteError?.message || bundlerError?.message || 'Unknown error'
              if (msg.includes('User rejected') || msg.includes('denied')) return 'Transaction rejected'
              if (quoteError?.isMarketFrozen) return 'Market is frozen during emergency'
              if (quoteError?.isRateLimited) return `Rate limited, retry in ${quoteError.retryAfter}s`
              return <span className="break-all">{msg}</span>
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
