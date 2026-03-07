'use client'

import { useState, useCallback } from 'react'
import { useAccount, useChainId, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { useDepositBalance } from '@/hooks/vision/useDepositBalance'
import { useDepositToVision } from '@/hooks/vision/useDepositToVision'
import { useVisionBalance } from '@/hooks/vision/useVisionBalance'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { VISION_USDC_DECIMALS, SETTLEMENT_USDC_DECIMALS, SETTLEMENT_USDC_ADDRESS } from '@/lib/vision/constants'
import { USDC_ADDRESS } from '@/lib/contracts/addresses'
import { indexL3, settlementChain } from '@/lib/wagmi'

const ERC20_BALANCE_ABI = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const

type Mode = 'choose' | 'l3' | 'settlement'

interface BalanceDepositModalProps {
  onClose: () => void
}

/**
 * Modal for depositing USDC into the user's global Vision balance.
 *
 * Two paths:
 * - "From L3 wallet": uses useDepositBalance (approve L3 USDC -> Vision.depositBalance)
 * - "From Settlement": uses useDepositToVision (approve Settlement USDC -> SettlementBridgeCustody.depositToVision)
 */
export function BalanceDepositModal({ onClose }: BalanceDepositModalProps) {
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { capture } = usePostHogTracker()
  const { refetch: refetchBalance } = useVisionBalance()

  const [mode, setMode] = useState<Mode>('choose')
  const [amount, setAmount] = useState('')
  const [minting, setMinting] = useState(false)
  const [mintResult, setMintResult] = useState<string | null>(null)

  // --- L3 deposit hook ---
  const {
    deposit: depositL3,
    step: l3Step,
    approveHash: l3ApproveHash,
    depositHash: l3DepositHash,
    error: l3Error,
    reset: resetL3,
  } = useDepositBalance()

  // --- Settlement deposit hook ---
  const {
    deposit: depositSettlement,
    step: settlementStep,
    orderId,
    error: settlementError,
    reset: resetSettlement,
  } = useDepositToVision()

  const activeStep = mode === 'l3' ? l3Step : mode === 'settlement' ? settlementStep : 'idle'
  const activeError = mode === 'l3' ? l3Error : mode === 'settlement' ? settlementError : null
  const isProcessing = activeStep !== 'idle' && activeStep !== 'done' && activeStep !== 'error'

  const decimals = mode === 'settlement' ? SETTLEMENT_USDC_DECIMALS : VISION_USDC_DECIMALS
  const parsedAmount = amount ? parseUnits(amount, decimals) : 0n

  const handleDeposit = useCallback(() => {
    if (!amount || parsedAmount === 0n) return

    if (mode === 'l3') {
      capture('vision_balance_deposit_l3', { amount })
      depositL3(parsedAmount)
    } else if (mode === 'settlement') {
      capture('vision_balance_deposit_settlement', { amount })
      depositSettlement(parsedAmount)
    }
  }, [amount, parsedAmount, mode, depositL3, depositSettlement, capture])

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

  const isOnSettlement = chainId === settlementChain.id
  const isOnL3 = chainId === indexL3.id

  // Read wallet USDC balance on L3 (always read, regardless of connected chain)
  const { data: l3UsdcRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address },
  })

  // Read wallet USDC balance on Settlement
  const { data: settlementUsdcRaw } = useReadContract({
    address: SETTLEMENT_USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: settlementChain.id,
    query: { enabled: !!address },
  })

  const l3WalletBalance = l3UsdcRaw !== undefined
    ? parseFloat(formatUnits(l3UsdcRaw, VISION_USDC_DECIMALS)).toFixed(2)
    : null
  const settlementWalletBalance = settlementUsdcRaw !== undefined
    ? parseFloat(formatUnits(settlementUsdcRaw, SETTLEMENT_USDC_DECIMALS)).toFixed(2)
    : null

  const stepLabel = (() => {
    if (mode === 'l3') {
      switch (l3Step) {
        case 'approving': return 'Approving USDC on L3...'
        case 'depositing': return 'Depositing to Vision balance...'
        case 'done': return 'Deposit successful!'
        default: return ''
      }
    }
    if (mode === 'settlement') {
      switch (settlementStep) {
        case 'approving': return 'Approving USDC on Settlement...'
        case 'depositing': return 'Locking USDC in SettlementBridgeCustody...'
        case 'polling': return 'Waiting for issuers to credit your balance...'
        case 'done': return 'Deposit credited!'
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
            <h2 className="text-lg font-semibold text-text-primary">Deposit to Vision</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl leading-none">&times;</button>
          </div>

          {!isConnected ? (
            <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
              <p className="text-text-secondary">Connect your wallet to deposit</p>
            </div>
          ) : activeStep === 'done' ? (
            <div className="space-y-4">
              <div className="bg-surface-up border border-color-up/30 rounded-xl p-6 text-center">
                <p className="text-color-up font-semibold text-lg mb-1">Deposit Successful</p>
                <p className="text-text-secondary text-sm">
                  {amount} USDC deposited to your Vision balance
                  {mode === 'settlement' ? ' (via Settlement)' : ' (from L3)'}
                </p>
                {orderId && (
                  <p className="text-xs text-text-muted font-mono mt-2 break-all">
                    Order: {orderId}
                  </p>
                )}
              </div>
              <button
                onClick={handleDone}
                className="w-full py-3 bg-color-up text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          ) : mode === 'choose' ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary mb-4">
                Choose where to deposit USDC from:
              </p>

              {/* Faucet: mint test USDC */}
              <button
                onClick={async () => {
                  if (!address || minting) return
                  setMinting(true)
                  setMintResult(null)
                  try {
                    const res = await fetch('/api/faucet', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ address, amount: '1000' }),
                    })
                    const data = await res.json()
                    if (data.success) {
                      setMintResult('1,000 USDC minted to your wallet!')
                    } else {
                      setMintResult(`Error: ${data.error}`)
                    }
                  } catch (e: any) {
                    setMintResult(`Error: ${e.message}`)
                  } finally {
                    setMinting(false)
                  }
                }}
                disabled={minting || !address}
                className="w-full text-left p-4 rounded-xl border border-dashed border-yellow-400 bg-yellow-50/50 hover:bg-yellow-50 transition-colors disabled:opacity-50"
              >
                <div className="flex justify-between items-center">
                  <p className="text-sm font-bold text-yellow-700">
                    {minting ? 'Minting...' : 'Mint Test USDC'}
                  </p>
                  <span className="text-xs font-mono text-yellow-600">Testnet faucet</span>
                </div>
                <p className="text-xs text-yellow-600/80 mt-1">
                  Get 1,000 USDC on L3 for testing (free)
                </p>
                {mintResult && (
                  <p className={`text-xs mt-2 font-medium ${mintResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                    {mintResult}
                  </p>
                )}
              </button>

              {/* From L3 wallet */}
              <button
                onClick={() => setMode('l3')}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  isOnL3
                    ? 'border-color-up bg-surface-up/20 hover:bg-surface-up/30'
                    : 'border-border-light bg-muted hover:bg-surface'
                }`}
              >
                <div className="flex justify-between items-center">
                  <p className="text-sm font-bold text-text-primary">From L3 Wallet</p>
                  {l3WalletBalance !== null && (
                    <span className="text-sm font-bold font-mono tabular-nums text-text-primary">{l3WalletBalance} USDC</span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Deposit L3 USDC directly into your Vision balance
                </p>
                {isOnL3 && (
                  <span className="inline-block mt-2 text-[10px] font-mono text-color-up">Currently connected</span>
                )}
              </button>

              {/* From Settlement */}
              <button
                onClick={() => setMode('settlement')}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  isOnSettlement
                    ? 'border-color-up bg-surface-up/20 hover:bg-surface-up/30'
                    : 'border-border-light bg-muted hover:bg-surface'
                }`}
              >
                <div className="flex justify-between items-center">
                  <p className="text-sm font-bold text-text-primary">From Settlement</p>
                  {settlementWalletBalance !== null && (
                    <span className="text-sm font-bold font-mono tabular-nums text-text-primary">{settlementWalletBalance} USDC</span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Lock USDC on Settlement. Issuers credit your virtual balance on L3.
                </p>
                {isOnSettlement && (
                  <span className="inline-block mt-2 text-[10px] font-mono text-color-up">Currently connected</span>
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

              {/* Mode label + wallet balance */}
              <div className="bg-muted border border-border-light rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    {mode === 'l3' ? 'Deposit from L3 Wallet' : 'Deposit from Settlement'}
                  </p>
                  {mode === 'l3' && l3WalletBalance !== null && (
                    <span className="text-sm font-bold font-mono tabular-nums text-text-primary">{l3WalletBalance} USDC</span>
                  )}
                  {mode === 'settlement' && settlementWalletBalance !== null && (
                    <span className="text-sm font-bold font-mono tabular-nums text-text-primary">{settlementWalletBalance} USDC</span>
                  )}
                </div>
                {mode === 'settlement' && !isOnSettlement && (
                  <p className="text-xs text-color-warning mt-1">
                    Switch your wallet to Settlement to proceed
                  </p>
                )}
                {mode === 'l3' && !isOnL3 && (
                  <p className="text-xs text-color-warning mt-1">
                    Switch your wallet to L3 to proceed
                  </p>
                )}
              </div>

              {/* Amount input */}
              <div className="bg-muted border border-border-light rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    Amount
                  </label>
                  {mode === 'l3' && l3WalletBalance !== null && (
                    <button
                      onClick={() => setAmount(l3WalletBalance)}
                      className="text-xs font-mono font-bold text-text-secondary hover:text-text-primary transition-colors"
                    >
                      MAX
                    </button>
                  )}
                  {mode === 'settlement' && settlementWalletBalance !== null && (
                    <button
                      onClick={() => setAmount(settlementWalletBalance)}
                      className="text-xs font-mono font-bold text-text-secondary hover:text-text-primary transition-colors"
                    >
                      MAX
                    </button>
                  )}
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
              </div>

              {/* Step indicator */}
              {isProcessing && (
                <div className="bg-muted border border-border-light rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-border-medium border-t-terminal rounded-full animate-spin" />
                    <span className="text-sm text-text-secondary">{stepLabel}</span>
                  </div>
                  {l3ApproveHash && (
                    <p className="text-xs text-text-muted font-mono mt-2 break-all">
                      Approve tx: {l3ApproveHash}
                    </p>
                  )}
                  {l3DepositHash && (
                    <p className="text-xs text-text-muted font-mono mt-2 break-all">
                      Deposit tx: {l3DepositHash}
                    </p>
                  )}
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
                  onClick={handleDeposit}
                  disabled={!amount || parsedAmount === 0n}
                  className="w-full py-4 bg-color-up text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  {mode === 'l3' ? 'Deposit from L3' : 'Deposit from Settlement'}
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
