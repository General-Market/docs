'use client'

import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { useWithdrawBalance } from '@/hooks/vision/useWithdrawBalance'
import { useWithdrawToArb } from '@/hooks/vision/useWithdrawToArb'
import { useVisionBalance } from '@/hooks/vision/useVisionBalance'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'

type Mode = 'choose' | 'l3' | 'arb'

interface BalanceWithdrawModalProps {
  onClose: () => void
}

/**
 * Modal for withdrawing USDC from the user's global Vision balance.
 *
 * Two paths:
 * - "To L3 wallet": uses useWithdrawBalance (debits realBalance, sends L3 USDC)
 * - "To Arbitrum": uses useWithdrawToArb (debits virtualBalance, issuers release on Arb)
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

  // --- Arb withdraw hook ---
  const {
    withdraw: withdrawArb,
    step: arbStep,
    txHash: arbTxHash,
    error: arbError,
    reset: resetArb,
  } = useWithdrawToArb()

  const activeStep = mode === 'l3' ? l3Step : mode === 'arb' ? arbStep : 'idle'
  const activeError = mode === 'l3' ? l3Error : mode === 'arb' ? arbError : null
  const isProcessing = activeStep !== 'idle' && activeStep !== 'done' && activeStep !== 'error'

  // Withdrawals are always in L3 USDC decimals (18) since both balance types are stored on L3
  const parsedAmount = amount ? parseUnits(amount, VISION_USDC_DECIMALS) : 0n

  const maxBalance = mode === 'l3' ? realBalance : mode === 'arb' ? virtualBalance : 0n
  const insufficientBalance = parsedAmount > 0n && parsedAmount > maxBalance

  const fmtBal = (v: bigint) => parseFloat(formatUnits(v, VISION_USDC_DECIMALS)).toFixed(2)

  const handleWithdraw = useCallback(() => {
    if (!amount || parsedAmount === 0n || insufficientBalance) return

    if (mode === 'l3') {
      capture('vision_balance_withdraw_l3', { amount })
      withdrawL3(parsedAmount)
    } else if (mode === 'arb') {
      capture('vision_balance_withdraw_arb', { amount })
      withdrawArb(parsedAmount)
    }
  }, [amount, parsedAmount, insufficientBalance, mode, withdrawL3, withdrawArb, capture])

  const handleReset = useCallback(() => {
    setMode('choose')
    setAmount('')
    resetL3()
    resetArb()
  }, [resetL3, resetArb])

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
    if (mode === 'arb') {
      switch (arbStep) {
        case 'withdrawing': return 'Submitting withdrawal request...'
        case 'polling': return 'Waiting for issuers to release on Arbitrum...'
        case 'done': return 'Withdrawal initiated! USDC will arrive on Arbitrum shortly.'
        default: return ''
      }
    }
    return ''
  })()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border-light rounded-xl shadow-modal max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Withdraw from Vision</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl leading-none">&times;</button>
          </div>

          {!isConnected ? (
            <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
              <p className="text-text-secondary">Connect your wallet to withdraw</p>
            </div>
          ) : activeStep === 'done' ? (
            <div className="space-y-4">
              <div className="bg-surface-up border border-color-up/30 rounded-xl p-6 text-center">
                <p className="text-color-up font-semibold text-lg mb-1">Withdrawal Successful</p>
                <p className="text-text-secondary text-sm">
                  {amount} USDC withdrawn
                  {mode === 'arb' ? ' to Arbitrum' : ' to L3 wallet'}
                </p>
                {(l3TxHash || arbTxHash) && (
                  <p className="text-xs text-text-muted font-mono mt-2 break-all">
                    Tx: {l3TxHash || arbTxHash}
                  </p>
                )}
                {mode === 'arb' && (
                  <p className="text-xs text-text-muted mt-2">
                    USDC will arrive on Arbitrum once issuers process the release.
                  </p>
                )}
              </div>
              <button
                onClick={handleDone}
                className="w-full py-3 bg-muted text-text-primary font-medium rounded-lg border border-border-light hover:bg-surface transition-colors"
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
                    ? 'border-border-light bg-muted hover:bg-surface'
                    : 'border-border-light bg-muted opacity-50 cursor-not-allowed'
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
                  <span className="inline-block mt-2 text-[10px] text-text-muted">No real balance</span>
                )}
              </button>

              {/* To Arbitrum */}
              <button
                onClick={() => setMode('arb')}
                disabled={virtualBalance === 0n}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  virtualBalance > 0n
                    ? 'border-border-light bg-muted hover:bg-surface'
                    : 'border-border-light bg-muted opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-text-primary">To Arbitrum</p>
                    <p className="text-xs text-text-muted mt-1">
                      Release virtual balance USDC on Arbitrum via issuers
                    </p>
                  </div>
                  <span className="text-xs font-mono text-text-secondary">
                    {fmtBal(virtualBalance)} USDC
                  </span>
                </div>
                {virtualBalance === 0n && (
                  <span className="inline-block mt-2 text-[10px] text-text-muted">No virtual balance</span>
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
              <div className="bg-muted border border-border-light rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    {mode === 'l3' ? 'Withdraw to L3 Wallet' : 'Withdraw to Arbitrum'}
                  </p>
                  <span className="text-xs font-mono text-text-secondary">
                    Max: {fmtBal(maxBalance)} USDC
                  </span>
                </div>
              </div>

              {/* Amount input */}
              <div className="bg-muted border border-border-light rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
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
                  className="w-full bg-card border border-border-medium rounded-lg px-4 py-3 text-text-primary text-lg font-mono tabular-nums focus:border-zinc-600 focus:outline-none disabled:opacity-50"
                />
                {insufficientBalance && (
                  <p className="text-color-down text-xs mt-1">
                    Exceeds available {mode === 'l3' ? 'real' : 'virtual'} balance
                  </p>
                )}
              </div>

              {/* Step indicator */}
              {isProcessing && (
                <div className="bg-muted border border-border-light rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-border-medium border-t-terminal rounded-full animate-spin" />
                    <span className="text-sm text-text-secondary">{stepLabel}</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {activeError && (
                <div className="bg-surface-down border border-color-down/30 rounded-lg p-4 text-color-down">
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
                  className="w-full py-4 bg-color-down text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  {mode === 'l3' ? 'Withdraw to L3 Wallet' : 'Withdraw to Arbitrum'}
                </WalletActionButton>
              )}

              {/* Cancel during processing */}
              {isProcessing && (
                <button
                  onClick={handleReset}
                  className="w-full text-center text-sm text-text-muted hover:text-text-primary py-2 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
