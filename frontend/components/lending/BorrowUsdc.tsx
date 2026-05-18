'use client'

import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { parseUnits, formatUnits } from 'viem'
import { useMorphoPosition } from '@/hooks/useMorphoPosition'
import { useMorphoActions } from '@/hooks/useMorphoActions'
import { useLendingQuote } from '@/hooks/useLendingQuote'
import { useBundlerExec } from '@/hooks/useBundlerExec'
import { calculateHealthFactor } from '@/lib/types/morpho'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { useToast } from '@/lib/contexts/ToastContext'
import { getTxUrl } from '@/lib/utils/explorer'
import { preparePosition, QuoteApiError } from '@/lib/api/curator-api'
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
  const t = useTranslations('lending')
  const { capture } = usePostHogTracker()
  const { showSuccess, showError } = useToast()
  const [amount, setAmount] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [step, setStep] = useState<'input' | 'preparing' | 'borrowing' | 'success'>('input')

  const lltv = market?.lltv ?? BigInt('770000000000000000')

  const { position, oraclePrice, refetch: refetchPosition } = useMorphoPosition(market)
  const {
    borrow,
    isPending,
    isConfirming,
    isSuccess,
    error: actionError,
    reset: resetAction,
    txHash: borrowTxHash,
  } = useMorphoActions(market)

  // Quote API integration (intent-based flow)
  const [useQuoteMode, setUseQuoteMode] = useState(false)
  const { quote, isLoading: isQuoteLoading, error: quoteError, isExpired, fetchQuote } = useLendingQuote({
    itpAddress: market?.collateralToken,
    collateralAmount: position?.collateralAmount?.toString(),
    borrowAmount: amount ? parseUnits(amount, 18).toString() : undefined,
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

  let parsedAmount = 0n
  try { if (amount) parsedAmount = parseUnits(amount, 18) } catch { /* invalid input */ }
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
      const amt = amount || '0'
      showSuccess(`Borrowed ${parseFloat(amt).toFixed(2)} USDC`, borrowTxHash ? { url: getTxUrl(borrowTxHash, 'l3'), text: 'View tx' } : undefined)
      capture('lend_completed', { itp_id: market?.collateralToken, action: 'borrow', tx_hash: borrowTxHash })
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
      showError(`Borrow failed: ${errMsg.slice(0, 80)}`)
      capture('lend_failed', { itp_id: market?.collateralToken, action: 'borrow', error_message: errMsg })
      setStep('input')
      resetAction()
    }
  }, [actionError, resetAction])

  const handleBorrow = useCallback(async () => {
    if (!amount || parsedAmount === 0n || !canBorrow || !market?.marketId) return
    capture('lend_borrow_submitted', { itp_id: market?.collateralToken, amount: amount })
    successHandled.current = false
    setTxError(null)

    // Step 1: ask the curator to route enough vault liquidity into this
    // market for the borrow. Reverts here are fatal — the borrow tx would
    // revert too if we skipped it.
    setStep('preparing')
    try {
      const prep = await preparePosition({
        marketId: market.marketId,
        borrowAmount: parsedAmount.toString(),
      })
      capture('lend_prepare_done', {
        itp_id: market.collateralToken,
        already_funded: prep.alreadyFunded,
        tx_hash: prep.txHash,
      })
    } catch (err) {
      const apiErr = err as QuoteApiError
      const msg = apiErr?.isCuratorUnreachable
        ? 'Curator unavailable — try again in a minute'
        : apiErr?.isPrepareTimeout
        ? 'Liquidity routing timed out — retry'
        : apiErr?.message ?? 'Failed to route liquidity'
      setTxError(msg)
      capture('lend_prepare_failed', { itp_id: market?.collateralToken, error_message: msg })
      setStep('input')
      return
    }

    // Step 2: fire the actual borrow tx now that the target has liquidity.
    setStep('borrowing')
    borrow(parsedAmount)
  }, [amount, parsedAmount, canBorrow, borrow, capture, market?.collateralToken, market?.marketId])

  const isProcessing = step === 'preparing' || isPending || isConfirming

  const buttonText = step === 'preparing'
    ? 'Routing liquidity…'
    : isPending
    ? t('borrow_usdc.button.confirm_wallet')
    : isConfirming
    ? t('borrow_usdc.button.borrowing')
    : step === 'success'
    ? t('borrow_usdc.button.borrowed')
    : t('borrow_usdc.button.borrow_usdc')

  const formatMaxBorrow = maxBorrow ? formatUnits(maxBorrow, 18) : '0'

  const maxDisabled = isProcessing || maxBorrow === 0n
  const directDisabled = !amount || parsedAmount === 0n || isProcessing || !canBorrow
  const isSuccessState = step === 'success'
  const bundlerDisabled = isBundlerPending || isBundlerConfirming
  const healthColor = (hf: number) =>
    hf >= 1.5 ? '#16a34a' :
    hf >= 1.0 ? '#b45309' :
    '#dc2626'
  const quoteHealth = quote ? parseFloat(quote.terms.healthFactor) : 0

  const primaryButtonStyle = (disabled: boolean, success: boolean): CSSProperties => ({
    width: '100%',
    padding: '12px 16px',
    fontFamily: 'var(--apple-font-text)',
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tight)',
    color: disabled && !success ? 'var(--apple-text-tertiary)' : '#fff',
    background: success ? '#16a34a' : disabled ? '#e5e5ea' : '#0071e3',
    border: 'none',
    borderRadius: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 180ms var(--apple-ease-default), opacity 180ms var(--apple-ease-default)',
  })

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
              {t('borrow_usdc.amount_label')}
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
              {t('borrow_usdc.max_borrow_label', { amount: parseFloat(formatMaxBorrow).toFixed(2) })}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
              onClick={() => {
                // Truncate (floor) to 2 decimals to avoid exceeding maxBorrow
                const raw = parseFloat(formatMaxBorrow)
                setAmount((Math.floor(raw * 100) / 100).toFixed(2))
              }}
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

        {/* Projected Health Factor */}
        {amount && parsedAmount > 0n && (
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
                {t('borrow_usdc.projected_health_factor')}
              </span>
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: healthColor(projectedHealthFactor),
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
                {t('borrow_usdc.cannot_borrow_health')}
              </p>
            )}
            {projectedHealthFactor >= 1.0 && projectedHealthFactor < 1.5 && (
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 12,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: '#b45309',
                  margin: '8px 0 0 0',
                }}
              >
                {t('borrow_usdc.low_health_warning')}
              </p>
            )}
          </div>
        )}

        {/* Quote API Terms (when in quote mode) */}
        {useQuoteMode && quote && !isExpired && (
          <div
            className="space-y-2"
            style={{
              padding: 12,
              background: 'rgba(0,113,227,0.06)',
              border: '1px solid rgba(0,113,227,0.2)',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-loose)',
                textTransform: 'uppercase',
                color: '#0071e3',
              }}
            >
              {t('borrow_usdc.quote.title')}
            </div>
            <div className="flex justify-between items-center">
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text-secondary)',
                }}
              >
                {t('borrow_usdc.quote.borrow_apr')}
              </span>
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {quote.terms.borrowRate}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text-secondary)',
                }}
              >
                {t('borrow_usdc.quote.health_factor')}
              </span>
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: healthColor(quoteHealth),
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {quote.terms.healthFactor}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text-secondary)',
                }}
              >
                {t('borrow_usdc.quote.liquidation_price')}
              </span>
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ${quote.terms.liquidationPrice}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text-secondary)',
                }}
              >
                {t('borrow_usdc.quote.max_borrow')}
              </span>
              <span
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: 'var(--apple-text)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {t('borrow_usdc.quote.max_borrow_value', { amount: quote.terms.maxBorrow })}
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 12,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text-tertiary)',
              }}
            >
              {t('borrow_usdc.quote.bundle_steps', { steps: quote.bundler.steps.join(' \u2192 ') })}
            </div>
          </div>
        )}

        {useQuoteMode && isExpired && (
          <div
            style={{
              padding: 8,
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 12,
              color: '#b45309',
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              letterSpacing: 'var(--apple-track-tight)',
              textAlign: 'center',
            }}
          >
            {t('borrow_usdc.quote.expired')}{' '}
            <button
              onClick={fetchQuote}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#0071e3',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 12,
                letterSpacing: 'var(--apple-track-tight)',
                padding: 0,
              }}
            >
              {t('borrow_usdc.quote.refresh')}
            </button>
          </div>
        )}

        {/* Borrow button (direct or bundler) */}
        {useQuoteMode && quote && !isExpired ? (
          <button
            onClick={() => executeBundler(quote)}
            disabled={bundlerDisabled}
            style={primaryButtonStyle(bundlerDisabled, isBundlerSuccess)}
          >
            {isBundlerPending ? t('borrow_usdc.quote.confirm_wallet') :
             isBundlerConfirming ? t('borrow_usdc.quote.executing_bundle') :
             isBundlerSuccess ? t('borrow_usdc.quote.borrowed') :
             t('borrow_usdc.quote.execute_bundle')}
          </button>
        ) : (
          <WalletActionButton
            onClick={handleBorrow}
            disabled={directDisabled}
            style={primaryButtonStyle(directDisabled, isSuccessState)}
          >
            {buttonText}
          </WalletActionButton>
        )}

        {/* Quote mode toggle — hidden, direct borrow is default */}

        {(txError || quoteError || bundlerError) && (
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
            {(() => {
              const msg = txError || quoteError?.message || bundlerError?.message || 'Unknown error'
              if (msg.includes('User rejected') || msg.includes('denied')) return t('common.transaction_rejected')
              if (quoteError?.isMarketFrozen) return t('common.market_frozen')
              if (quoteError?.isRateLimited) return t('common.rate_limited', { seconds: quoteError.retryAfter ?? 0 })
              return <span style={{ wordBreak: 'break-all' }}>{msg}</span>
            })()}
          </div>
        )}
      </div>
  )
}
