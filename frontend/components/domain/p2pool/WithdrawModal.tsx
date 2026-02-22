'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { useWithdraw } from '@/hooks/p2pool/useWithdraw'
import { useClaim } from '@/hooks/p2pool/useClaim'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { WalletActionButton } from '@/components/ui/WalletActionButton'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

type Mode = 'choose' | 'withdraw' | 'claim'

interface WithdrawModalProps {
  batchId: number
  onClose: () => void
}

/**
 * Modal for withdrawing or claiming rewards from a P2Pool batch.
 *
 * Provides two options:
 * - "Withdraw All": fetches BLS proof from issuer, calls Vision.withdraw()
 * - "Claim Rewards": fetches BLS proof with tick range, calls Vision.claimRewards()
 *
 * Both require a BLS-signed balance proof from the issuer nodes.
 * Withdraw deducts a 0.3% fee on profit.
 */
export function WithdrawModal({ batchId, onClose }: WithdrawModalProps) {
  const t = useTranslations('p2pool')
  const { address, isConnected } = useAccount()
  const [mode, setMode] = useState<Mode>('choose')

  // Read on-chain position
  const { data: position } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'getPosition',
    args: address ? [BigInt(batchId), address] : undefined,
    query: { enabled: !!address && VISION_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })

  const pos = position as {
    bitmapHash: string
    stakePerTick: bigint
    startTick: bigint
    balance: bigint
    lastClaimedTick: bigint
    joinTimestamp: bigint
    totalDeposited: bigint
    totalClaimed: bigint
  } | undefined

  const onChainBalance = pos?.balance ?? 0n
  const totalDeposited = pos?.totalDeposited ?? 0n
  const totalClaimed = pos?.totalClaimed ?? 0n
  const lastClaimedTick = pos?.lastClaimedTick ?? 0n
  const startTick = pos?.startTick ?? 0n

  // Profit calculation: balance - totalDeposited + totalClaimed (net profit)
  const profit = onChainBalance > totalDeposited ? onChainBalance - totalDeposited + totalClaimed : 0n
  const estimatedFee = (profit * 3n) / 1000n // 0.3% on profit

  // --- Withdraw hook ---
  const {
    withdraw,
    withdrawHash,
    step: withdrawStep,
    isPending: isWithdrawPending,
    isConfirming: isWithdrawConfirming,
    proof: withdrawProof,
    error: withdrawError,
    reset: resetWithdraw,
  } = useWithdraw()

  // --- Claim hook ---
  const {
    claim,
    claimHash,
    step: claimStep,
    isPending: isClaimPending,
    isConfirming: isClaimConfirming,
    proof: claimProof,
    error: claimError,
    reset: resetClaim,
  } = useClaim()

  // Read batch info for current tick
  const { data: batchData } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'getBatch',
    args: [BigInt(batchId)],
    query: { enabled: VISION_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })

  const batchInfo = batchData as {
    creator: string
    marketIds: string[]
    resolutionTypes: number[]
    tickDuration: bigint
    customThresholds: bigint[]
    createdAtTick: bigint
    paused: boolean
  } | undefined

  // Compute claimable tick range
  const fromTick = lastClaimedTick > 0n ? lastClaimedTick + 1n : startTick
  // createdAtTick + elapsed is approximate; the real current tick comes from the batch state
  // For now use a reasonable estimate — the issuer will validate
  const hasClaimableTicks = lastClaimedTick < (batchInfo?.createdAtTick ?? 0n) + 100n // rough check

  const handleWithdraw = useCallback(() => {
    setMode('withdraw')
    withdraw(BigInt(batchId))
  }, [batchId, withdraw])

  const handleClaim = useCallback(() => {
    setMode('claim')
    // fromTick = lastClaimedTick + 1, toTick = we pass 0 and let issuer determine current tick
    // In practice the frontend should know the current resolved tick from batch state
    const from = lastClaimedTick > 0n ? lastClaimedTick + 1n : startTick
    // toTick = 0 means "up to latest resolved tick" — issuer handles this
    claim(BigInt(batchId), from, 0n)
  }, [batchId, lastClaimedTick, startTick, claim])

  const handleReset = useCallback(() => {
    setMode('choose')
    resetWithdraw()
    resetClaim()
  }, [resetWithdraw, resetClaim])

  const activeStep = mode === 'withdraw' ? withdrawStep : mode === 'claim' ? claimStep : 'idle'
  const activeError = mode === 'withdraw' ? withdrawError : mode === 'claim' ? claimError : null
  const activePending = mode === 'withdraw' ? isWithdrawPending : isClaimPending
  const activeConfirming = mode === 'withdraw' ? isWithdrawConfirming : isClaimConfirming
  const isProcessing = activePending || activeConfirming || activeStep === 'fetching-proof'

  const stepLabel = (() => {
    if (activeStep === 'fetching-proof') return 'Fetching BLS balance proof from issuer...'
    if (activeStep === 'withdrawing') return activePending ? 'Confirm withdrawal in wallet...' : 'Submitting withdrawal...'
    if (activeStep === 'claiming') return activePending ? 'Confirm claim in wallet...' : 'Submitting claim...'
    if (activeStep === 'done') return mode === 'withdraw' ? 'Withdrawal successful!' : 'Claim successful!'
    return ''
  })()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border-light rounded-xl shadow-modal max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              {mode === 'withdraw' ? t('withdraw_modal.title_withdraw', { id: batchId }) : mode === 'claim' ? t('withdraw_modal.title_claim', { id: batchId }) : t('withdraw_modal.title_choose', { id: batchId })}
            </h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl leading-none">&times;</button>
          </div>

          {!isConnected ? (
            <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
              <p className="text-text-secondary">{t('withdraw_modal.connect_wallet')}</p>
            </div>
          ) : activeStep === 'done' ? (
            <div className="space-y-4">
              <div className="bg-surface-up border border-color-up/30 rounded-xl p-6 text-center">
                <p className="text-color-up font-semibold text-lg mb-1">
                  {mode === 'withdraw' ? t('withdraw_modal.withdrawal_successful') : t('withdraw_modal.claim_successful')}
                </p>
                {mode === 'withdraw' && withdrawProof && (
                  <p className="text-text-secondary text-sm">
                    {t('withdraw_modal.usdc_returned', { amount: parseFloat(formatUnits(BigInt(withdrawProof.balance), 6)).toFixed(2) })}
                  </p>
                )}
                {mode === 'claim' && claimProof && (
                  <p className="text-text-secondary text-sm">
                    {t('withdraw_modal.rewards_claimed', { from: claimProof.fromTick, to: claimProof.toTick })}
                  </p>
                )}
                {(withdrawHash || claimHash) && (
                  <p className="text-xs text-text-muted font-mono mt-2 break-all">
                    Tx: {withdrawHash || claimHash}
                  </p>
                )}
              </div>
              <button
                onClick={handleReset}
                className="w-full py-3 bg-muted text-text-primary font-medium rounded-lg border border-border-light hover:bg-surface transition-colors"
              >
                {t('withdraw_modal.back')}
              </button>
              <button
                onClick={onClose}
                className="w-full text-center text-sm text-text-muted hover:text-text-primary py-2 transition-colors"
              >
                {t('withdraw_modal.close')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Position overview */}
              <div className="bg-muted border border-border-light rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('withdraw_modal.on_chain_balance')}</span>
                  <span className="text-lg font-bold text-text-primary tabular-nums font-mono">
                    {onChainBalance > 0n ? parseFloat(formatUnits(onChainBalance, 6)).toFixed(2) : '0.00'} USDC
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('withdraw_modal.total_deposited')}</span>
                  <span className="text-sm text-text-secondary tabular-nums font-mono">
                    {totalDeposited > 0n ? parseFloat(formatUnits(totalDeposited, 6)).toFixed(2) : '0.00'} USDC
                  </span>
                </div>
                {profit > 0n && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('withdraw_modal.profit')}</span>
                      <span className="text-sm text-color-up tabular-nums font-mono">
                        +{parseFloat(formatUnits(profit, 6)).toFixed(2)} USDC
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('withdraw_modal.est_fee')}</span>
                      <span className="text-sm text-text-muted tabular-nums font-mono">
                        -{parseFloat(formatUnits(estimatedFee, 6)).toFixed(2)} USDC
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Step indicator */}
              {activeStep !== 'idle' && activeStep !== 'error' && (
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
                  <p className="font-medium">{t('withdraw_modal.error_title')}</p>
                  <p className="text-sm mt-1 break-all">{activeError}</p>
                  <button
                    onClick={handleReset}
                    className="text-xs text-color-down underline mt-2"
                  >
                    {t('withdraw_modal.try_again')}
                  </button>
                </div>
              )}

              {/* Action buttons — show only in choose mode or when not processing */}
              {mode === 'choose' && !isProcessing && (
                <div className="space-y-3">
                  {/* Withdraw All */}
                  <WalletActionButton
                    onClick={handleWithdraw}
                    disabled={onChainBalance === 0n}
                    className="w-full py-4 bg-color-down text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  >
                    {t('withdraw_modal.withdraw_all')}
                  </WalletActionButton>
                  <p className="text-xs text-text-muted text-center">
                    {t('withdraw_modal.withdraw_description')}
                  </p>

                  <div className="border-t border-border-light my-2" />

                  {/* Claim Rewards */}
                  <WalletActionButton
                    onClick={handleClaim}
                    disabled={onChainBalance === 0n}
                    className="w-full py-4 bg-muted text-text-primary font-medium rounded-lg border border-border-light hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('withdraw_modal.claim_rewards')}
                  </WalletActionButton>
                  <p className="text-xs text-text-muted text-center">
                    {t('withdraw_modal.claim_description')}
                  </p>
                </div>
              )}

              {/* Cancel during processing */}
              {isProcessing && (
                <button
                  onClick={handleReset}
                  className="w-full text-center text-sm text-text-muted hover:text-text-primary py-2 transition-colors"
                >
                  {t('withdraw_modal.cancel')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
