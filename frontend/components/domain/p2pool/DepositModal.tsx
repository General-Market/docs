'use client'

import { useState, useCallback } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { useDeposit } from '@/hooks/p2pool/useDeposit'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { WalletActionButton } from '@/components/ui/WalletActionButton'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

interface DepositModalProps {
  batchId: number
  /** Current on-chain balance in the batch (USDC, 6 decimals) */
  currentBalance?: string
  onClose: () => void
}

/**
 * Modal for depositing additional USDC into a P2Pool batch.
 * Follows the same approve + contract call pattern as BuyItpModal.
 */
export function DepositModal({ batchId, currentBalance, onClose }: DepositModalProps) {
  const { address, isConnected } = useAccount()
  const [amount, setAmount] = useState('')

  const {
    deposit,
    approveHash,
    depositHash,
    step,
    isPending,
    isConfirming,
    error,
    reset,
  } = useDeposit()

  // Read USDC address from Vision contract
  const { data: usdcAddress } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'USDC',
    query: { enabled: VISION_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })

  // Read user's USDC balance
  const { data: usdcBalance } = useReadContract({
    address: usdcAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!usdcAddress },
  })

  const parsedAmount = amount ? parseUnits(amount, 6) : 0n
  const balance = (usdcBalance as bigint | undefined) ?? 0n
  const insufficientBalance = parsedAmount > 0n && parsedAmount > balance

  const handleDeposit = useCallback(() => {
    if (!amount || parsedAmount === 0n) return
    deposit(BigInt(batchId), parsedAmount)
  }, [amount, parsedAmount, batchId, deposit])

  const handleReset = useCallback(() => {
    setAmount('')
    reset()
  }, [reset])

  const isProcessing = isPending || isConfirming

  const stepLabel = (() => {
    switch (step) {
      case 'approving': return isPending ? 'Confirm USDC approval in wallet...' : 'Approving USDC...'
      case 'depositing': return isPending ? 'Confirm deposit in wallet...' : 'Depositing USDC...'
      case 'done': return 'Deposit successful!'
      case 'error': return 'Transaction failed'
      default: return ''
    }
  })()

  const buttonText = (() => {
    if (step === 'approving') return isPending ? 'Confirm in wallet...' : 'Approving...'
    if (step === 'depositing') return isPending ? 'Confirm in wallet...' : 'Depositing...'
    return 'Deposit USDC'
  })()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border-light rounded-xl shadow-modal max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Deposit to Batch #{batchId}</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl leading-none">&times;</button>
          </div>

          {!isConnected ? (
            <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
              <p className="text-text-secondary">Connect your wallet to deposit</p>
            </div>
          ) : step === 'done' ? (
            <div className="space-y-4">
              <div className="bg-surface-up border border-color-up/30 rounded-xl p-6 text-center">
                <p className="text-color-up font-semibold text-lg mb-1">Deposit Successful</p>
                <p className="text-text-secondary text-sm">
                  {amount} USDC deposited to batch #{batchId}
                </p>
                {depositHash && (
                  <p className="text-xs text-text-muted font-mono mt-2 break-all">
                    Tx: {depositHash}
                  </p>
                )}
              </div>
              <button
                onClick={handleReset}
                className="w-full py-3 bg-color-up text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Deposit More
              </button>
              <button
                onClick={onClose}
                className="w-full text-center text-sm text-text-muted hover:text-text-primary py-2 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current batch balance */}
              {currentBalance && (
                <div className="bg-muted border border-border-light rounded-xl p-4 flex justify-between items-center">
                  <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Batch Balance</span>
                  <span className="text-lg font-bold text-text-primary tabular-nums font-mono">
                    {parseFloat(formatUnits(BigInt(currentBalance), 6)).toFixed(2)} USDC
                  </span>
                </div>
              )}

              {/* Amount input */}
              <div className="bg-muted border border-border-light rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-text-muted">Amount (USDC)</label>
                  <span className="text-xs text-text-muted font-mono">
                    Balance: {balance > 0n ? parseFloat(formatUnits(balance, 6)).toFixed(2) : '0.00'} USDC
                  </span>
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
                  <p className="text-color-down text-xs mt-1">Insufficient USDC balance</p>
                )}
              </div>

              {/* Step indicator */}
              {step !== 'idle' && step !== 'error' && (
                <div className="bg-muted border border-border-light rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-border-medium border-t-terminal rounded-full animate-spin" />
                    <span className="text-sm text-text-secondary">{stepLabel}</span>
                  </div>
                  {approveHash && (
                    <p className="text-xs text-text-muted font-mono mt-2 break-all">
                      Approve tx: {approveHash}
                    </p>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-surface-down border border-color-down/30 rounded-lg p-4 text-color-down">
                  <p className="font-medium">Error</p>
                  <p className="text-sm mt-1 break-all">{error}</p>
                </div>
              )}

              {/* Action button */}
              <WalletActionButton
                onClick={handleDeposit}
                disabled={!amount || parsedAmount === 0n || insufficientBalance || isProcessing}
                className="w-full py-4 bg-color-up text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {buttonText}
              </WalletActionButton>

              {/* Cancel */}
              {isProcessing && (
                <button
                  onClick={() => { reset(); }}
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
