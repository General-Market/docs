'use client'

import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { useWithdrawBalance } from '@/hooks/vision/useWithdrawBalance'
import { useWithdrawToSettlement } from '@/hooks/vision/useWithdrawToSettlement'
import { useVisionBalance } from '@/hooks/vision/useVisionBalance'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'
import { SpringModal, SpringBackdrop, glass, ModalClose } from '@/components/ui/spring'
import { getTxUrl } from '@/lib/utils/explorer'

type Mode = 'choose' | 'l3' | 'settlement'

interface BalanceWithdrawModalProps {
  onClose: () => void
}

/**
 * Modal for withdrawing USDC from the user's global Vision balance.
 *
 * Two paths:
 * - "To L3 wallet": uses useWithdrawBalance (debits realBalance, sends L3 USDC)
 * - "To Settlement": uses useWithdrawToSettlement (debits virtualBalance, oracles release on Settlement)
 */
export function BalanceWithdrawModal({ onClose }: BalanceWithdrawModalProps) {
  const { isConnected } = useAccount()
  const { capture } = usePostHogTracker()
  const { realBalance, virtualBalance, refetch: refetchBalance } = useVisionBalance()

  const [mode, setMode] = useState<Mode>('choose')
  const [amount, setAmount] = useState('')

  // --- L3 withdraw hook ---
  const {
    withdraw: withdrawL3,
    step: l3Step,
    txHash: l3TxHash,
    error: l3Error,
    reset: resetL3,
  } = useWithdrawBalance()

  // --- Settlement withdraw hook ---
  const {
    withdraw: withdrawSettlement,
    step: settlementStep,
    txHash: settlementTxHash,
    error: settlementError,
    reset: resetSettlement,
  } = useWithdrawToSettlement()

  const activeStep = mode === 'l3' ? l3Step : mode === 'settlement' ? settlementStep : 'idle'
  const activeError = mode === 'l3' ? l3Error : mode === 'settlement' ? settlementError : null
  const isProcessing = activeStep !== 'idle' && activeStep !== 'done' && activeStep !== 'error'

  // Withdrawals are always in L3 USDC decimals (18) since both balance types are stored on L3
  const parsedAmount = amount ? parseUnits(amount, VISION_USDC_DECIMALS) : 0n

  const maxBalance = mode === 'l3' ? realBalance : mode === 'settlement' ? virtualBalance : 0n
  const insufficientBalance = parsedAmount > 0n && parsedAmount > maxBalance

  const fmtBal = (v: bigint) => parseFloat(formatUnits(v, VISION_USDC_DECIMALS)).toFixed(2)

  const handleWithdraw = useCallback(() => {
    if (!amount || parsedAmount === 0n || insufficientBalance) return

    if (mode === 'l3') {
      capture('vision_balance_withdraw_l3', { amount })
      withdrawL3(parsedAmount)
    } else if (mode === 'settlement') {
      capture('vision_balance_withdraw_settlement', { amount })
      withdrawSettlement(parsedAmount)
    }
  }, [amount, parsedAmount, insufficientBalance, mode, withdrawL3, withdrawSettlement, capture])

  const handleReset = useCallback(() => {
    setMode('choose')
    setAmount('')
    resetL3()
    resetSettlement()
  }, [resetL3, resetSettlement])

  const handleDone = useCallback(() => {
    refetchBalance()
    onClose()
  }, [refetchBalance, onClose])

  const handleMax = useCallback(() => {
    if (maxBalance > 0n) {
      setAmount(formatUnits(maxBalance, VISION_USDC_DECIMALS))
    }
  }, [maxBalance])

  const stepLabel = (() => {
    if (mode === 'l3') {
      switch (l3Step) {
        case 'withdrawing': return 'Withdrawing to L3 wallet...'
        case 'done': return 'Withdrawal successful!'
        default: return ''
      }
    }
    if (mode === 'settlement') {
      switch (settlementStep) {
        case 'withdrawing': return 'Submitting withdrawal request...'
        case 'polling': return 'Waiting for oracles to release on Settlement...'
        case 'done': return 'Withdrawal initiated! USDC will arrive on Settlement shortly.'
        default: return ''
      }
    }
    return ''
  })()

  return (
    <SpringBackdrop className={glass.backdrop} onClick={onClose}>
      <SpringModal className={`${glass.modal} max-w-md w-full`} onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Withdraw from Vision</h2>
            <ModalClose onClick={onClose} />
          </div>

          {!isConnected ? (
            <div className={`${glass.section} p-8 text-center`}>
              <p className="text-text-secondary">Connect your wallet to withdraw</p>
            </div>
          ) : activeStep === 'done' ? (
            <div className="space-y-4">
              <div className={`${glass.success} p-6 text-center`}>
                <p className="text-color-up font-semibold text-lg mb-1">Withdrawal Successful</p>
                <p className="text-text-secondary text-sm">
                  {amount} USDC withdrawn
                  {mode === 'settlement' ? ' to Settlement' : ' to L3 wallet'}
                </p>
                {(l3TxHash || settlementTxHash) && (
                  <a
                    href={getTxUrl((l3TxHash || settlementTxHash)!, l3TxHash ? 'l3' : 'settlement')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-text-muted font-mono mt-2 break-all hover:text-text-primary transition-colors inline-block"
                  >
                    Tx: {((l3TxHash || settlementTxHash)!).slice(0, 10)}...{((l3TxHash || settlementTxHash)!).slice(-8)} ↗
                  </a>
                )}
                {mode === 'settlement' && (
                  <p className="text-xs text-text-muted mt-2">
                    USDC will arrive on Settlement once oracles process the release.
                  </p>
                )}
              </div>
              <button
                onClick={handleDone}
                className={glass.ctaSecondary}
              >
                Done
              </button>
            </div>
          ) : mode === 'choose' ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary mb-4">
                Choose where to withdraw USDC to:
              </p>

              {/* To L3 wallet */}
              <button
                onClick={() => setMode('l3')}
                disabled={realBalance === 0n}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  realBalance > 0n
                    ? 'border-black/[0.06] bg-black/[0.02] hover:bg-black/[0.04]'
                    : 'border-black/[0.06] bg-black/[0.02] opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-text-primary">To L3 Wallet</p>
                    <p className="text-xs text-text-muted mt-1">
                      Withdraw real balance as L3 USDC to your wallet
                    </p>
                  </div>
                  <span className="text-xs font-mono text-text-secondary">
                    {fmtBal(realBalance)} USDC
                  </span>
                </div>
                {realBalance === 0n && (
                  <span className="inline-block mt-2 text-micro text-text-muted">No real balance</span>
                )}
              </button>

              {/* To Settlement */}
              <button
                onClick={() => setMode('settlement')}
                disabled={virtualBalance === 0n}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  virtualBalance > 0n
                    ? 'border-black/[0.06] bg-black/[0.02] hover:bg-black/[0.04]'
                    : 'border-black/[0.06] bg-black/[0.02] opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-text-primary">To Settlement</p>
                    <p className="text-xs text-text-muted mt-1">
                      Release virtual balance USDC on Settlement via oracles
                    </p>
                  </div>
                  <span className="text-xs font-mono text-text-secondary">
                    {fmtBal(virtualBalance)} USDC
                  </span>
                </div>
                {virtualBalance === 0n && (
                  <span className="inline-block mt-2 text-micro text-text-muted">No virtual balance</span>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Back to choose */}
              {!isProcessing && (
                <button
                  onClick={handleReset}
                  className="text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  &larr; Back
                </button>
              )}

              {/* Mode label */}
              <div className={`${glass.section} p-3`}>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
                    {mode === 'l3' ? 'Withdraw to L3 Wallet' : 'Withdraw to Settlement'}
                  </p>
                  <span className="text-xs font-mono text-text-secondary">
                    Max: {fmtBal(maxBalance)} USDC
                  </span>
                </div>
              </div>

              {/* Amount input */}
              <div className={`${glass.section} p-4`}>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
                    Amount (USDC)
                  </label>
                  <button
                    onClick={handleMax}
                    className="text-xs text-terminal hover:underline font-mono"
                  >
                    MAX
                  </button>
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g., 100"
                  min="0"
                  step="1"
                  disabled={isProcessing}
                  className={glass.input}
                />
                {insufficientBalance && (
                  <p className="text-color-down text-xs mt-1">
                    Exceeds available {mode === 'l3' ? 'real' : 'virtual'} balance
                  </p>
                )}
              </div>

              {/* Step indicator */}
              {isProcessing && (
                <div className={`${glass.section} p-4`}>
                  <div className="flex items-center gap-3">
                    <div className={glass.spinner} />
                    <span className="text-sm text-text-secondary">{stepLabel}</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {activeError && (
                <div className={`${glass.error} p-4 text-color-down`}>
                  <p className="font-medium">Error</p>
                  <p className="text-sm mt-1 break-all">{activeError}</p>
                  <button
                    onClick={handleReset}
                    className="text-xs text-color-down underline mt-2"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Action button */}
              {!isProcessing && activeStep !== 'error' && (
                <WalletActionButton
                  onClick={handleWithdraw}
                  disabled={!amount || parsedAmount === 0n || insufficientBalance}
                  className={glass.ctaDown}
                >
                  {mode === 'l3' ? 'Withdraw to L3 Wallet' : 'Withdraw to Settlement'}
                </WalletActionButton>
              )}

              {/* Cancel during processing */}
              {isProcessing && (
                <button
                  onClick={handleReset}
                  className={glass.cancel}
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </SpringModal>
    </SpringBackdrop>
  )
}
