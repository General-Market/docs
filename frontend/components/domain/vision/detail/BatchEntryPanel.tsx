'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import type { BitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { useBatches } from '@/hooks/vision/useBatches'
import { useJoinBatch } from '@/hooks/vision/useJoinBatch'
import { useDeposit } from '@/hooks/vision/useDeposit'
import { usePlayerPosition } from '@/hooks/vision/usePlayerPosition'
import { useBalanceChangeNotification } from '@/hooks/vision/useBalanceChangeNotification'
import { useSubmitBitmap } from '@/hooks/vision/useSubmitBitmap'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import type { BetDirection } from '@/lib/vision/bitmap'
import { getBatchTickState, getMultiplier } from '@/lib/vision/tick'
import { getSource } from '@/lib/vision/sources'
import { VISION_USDC_DECIMALS, VISION_ADDRESS } from '@/lib/vision/constants'
import batchConfig from '@/lib/contracts/vision-batches.json'
import { BalanceDepositModal } from '../BalanceDepositModal'
import { WithdrawModal } from '../WithdrawModal'
import StrategyList from './StrategyList'

interface BatchEntryPanelProps {
  bitmapEditor: BitmapEditor
  sourceId: string
  /** All market IDs relevant to this source */
  marketIds?: string[]
}

/**
 * Format seconds into MM:SS or HH:MM:SS display.
 */
function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${mm}:${ss}`
  }
  return `${mm}:${ss}`
}

export default function BatchEntryPanel({
  bitmapEditor,
  sourceId,
  marketIds = [],
}: BatchEntryPanelProps) {
  // -- Batch data --
  const { data: batches } = useBatches()
  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    // Use vision-batches.json to find the batchId for this source
    const entry = (batchConfig.batches as Record<string, { batchId: number }>)[sourceId]
    if (entry) {
      return batches.find(b => b.id === entry.batchId) ?? null
    }
    return batches[0] ?? null
  }, [batches, sourceId])

  // -- Read configHash from on-chain batch state --
  const { data: onChainBatch } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'getBatch',
    args: activeBatch ? [BigInt(activeBatch.id)] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!activeBatch && VISION_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })
  const configHash = (onChainBatch as any)?.configHash as `0x${string}` | undefined

  // -- Player position: detect if user already joined this batch --
  const { isJoined, position, refetch: refetchPosition } = usePlayerPosition(activeBatch?.id)

  // -- Toast notification on tick resolution (balance change) --
  useBalanceChangeNotification(position?.balance, isJoined)

  // -- Join + submit hooks --
  const {
    join,
    bitmap: encodedBitmap,
    bitmapHash,
    step: joinStep,
    isPending: isJoinPending,
    isConfirming: isJoinConfirming,
    error: joinError,
    reset: resetJoin,
  } = useJoinBatch()

  // -- Deposit hook (for adding funds when already joined) --
  const {
    deposit: depositMore,
    step: depositStep,
    isPending: isDepositPending,
    isConfirming: isDepositConfirming,
    error: depositError,
    reset: resetDeposit,
  } = useDeposit()

  const {
    submitBitmap,
    isSubmitting,
    error: submitError,
  } = useSubmitBitmap()

  // -- Local state --
  const [stakeInput, setStakeInput] = useState('')
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showClaimModal, setShowClaimModal] = useState(false)

  // -- Per-batch tick timer using category-specific duration --
  const sourceInfo = getSource(sourceId)
  const category = sourceInfo?.category ?? 'finance'
  const [tickState, setTickState] = useState(() =>
    activeBatch ? getBatchTickState(activeBatch.id, category) : getBatchTickState(0, category)
  )
  useEffect(() => {
    const interval = setInterval(() => {
      setTickState(activeBatch ? getBatchTickState(activeBatch.id, category) : getBatchTickState(0, category))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeBatch, category])
  const multiplier = getMultiplier(tickState.elapsed, tickState.tickDuration, tickState.lockOffset)

  // -- Derived --
  const counts = bitmapEditor.getCounts(sourceId, marketIds)
  const stakeValue = parseFloat(stakeInput) || 0
  const hasStake = stakeValue > 0
  const hasPredictions = bitmapEditor.setCount > 0
  const activeStep = isJoined ? depositStep : joinStep
  const canSubmit = hasStake && (isJoined || hasPredictions) && activeStep === 'idle' && !tickState.isLocked && (isJoined || !!configHash)

  // -- After on-chain join succeeds, submit bitmap to issuers --
  useEffect(() => {
    if (joinStep !== 'done' || !encodedBitmap || !bitmapHash || !activeBatch) return
    submitBitmap({
      batchId: activeBatch.id,
      bitmap: encodedBitmap,
      bitmapHash,
    }).finally(() => {
      resetJoin()
      refetchPosition()
    })
  }, [joinStep, encodedBitmap, bitmapHash, activeBatch, submitBitmap, resetJoin, refetchPosition])

  // -- After deposit succeeds, refetch position to update balance --
  useEffect(() => {
    if (depositStep !== 'done') return
    refetchPosition()
    resetDeposit()
  }, [depositStep, refetchPosition, resetDeposit])

  // -- Enter batch handler --
  const handleEnterBatch = useCallback(() => {
    if (!activeBatch || !canSubmit) return

    // Convert USDC amount to 18-decimal bigint (L3 USDC = 18 decimals)
    const depositAmount = BigInt(Math.round(stakeValue * 1e18))

    if (isJoined) {
      // Already in the batch — deposit additional funds instead of joinBatch
      depositMore(BigInt(activeBatch.id), depositAmount)
    } else {
      // First time joining — need configHash and bets
      if (!configHash) return

      // Build bets array from bitmap state in market order
      const bets: BetDirection[] = marketIds.map((id) => {
        const cell = bitmapEditor.state[id]
        if (cell === 'up') return 'UP'
        if (cell === 'down') return 'DOWN'
        return 'DOWN' // default unset to DOWN
      })

      join({
        batchId: BigInt(activeBatch.id),
        configHash,
        depositAmount,
        stakePerTick: depositAmount, // stake entire deposit per tick for now
        bets,
        marketCount: marketIds.length,
      })
    }
  }, [activeBatch, canSubmit, configHash, stakeValue, marketIds, bitmapEditor.state, join, isJoined, depositMore])

  // -- Quick-stake buttons --
  const quickAmounts = [1, 5, 10, 50, 100]

  // -- Button label --
  const buttonLabel = useMemo(() => {
    if (isSubmitting) return 'Submitting...'
    if (isJoinConfirming || isDepositConfirming) return 'Confirming...'
    if (isJoinPending || isDepositPending) return 'Waiting for wallet...'
    if (joinStep === 'checking-balance') return 'Checking balance...'
    if (joinStep === 'joining') return 'Joining batch...'
    if (depositStep === 'depositing') return 'Depositing...'
    if (isJoined) {
      if (stakeValue > 0) return `Deposit ${stakeValue} USDC`
      return 'Deposit More'
    }
    if (stakeValue > 0) return `Enter Batch \u2014 ${stakeValue} USDC`
    return 'Enter Batch'
  }, [joinStep, depositStep, isJoinPending, isJoinConfirming, isDepositPending, isDepositConfirming, isSubmitting, stakeValue, isJoined])

  const isProcessing = (joinStep !== 'idle' && joinStep !== 'error' && joinStep !== 'done')
    || (depositStep !== 'idle' && depositStep !== 'error' && depositStep !== 'done')

  const displayError = joinError || depositError || submitError

  return (
    <div>
      <div className="border border-neutral-200 bg-white px-4 py-3">
        {/* Header + Timer — single compact row */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">{isJoined ? 'Add Funds' : 'Enter Batch'}</h2>
              {activeBatch && (
                <span className="text-[10px] text-neutral-400 font-mono">#{activeBatch.id}</span>
              )}
            </div>
            <p className="text-[10px] text-text-muted">
              {tickState.isLocked
                ? `Bets locked — opens in ${tickState.remaining}s`
                : activeBatch
                  ? `Tick ${activeBatch.currentTick} · ${multiplier.label}`
                  : `Multiplier ${multiplier.label}`}
            </p>
          </div>
          <p className={`text-[24px] font-mono font-black tracking-tight leading-none ${tickState.isLocked ? 'text-red-600' : 'text-black'}`}>
            {formatCountdown(tickState.remaining)}
          </p>
        </div>

        {/* Bitmap summary — visual bar + labels */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
            <span className="text-color-up">{counts.up} UP</span>
            <span className="text-color-down">{counts.down} DN</span>
            <span className="text-text-muted">{counts.empty} unset</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-border-light">
            {counts.up > 0 && (
              <div
                className="bg-color-up transition-all"
                style={{ width: `${(counts.up / Math.max(counts.up + counts.down + counts.empty, 1)) * 100}%` }}
              />
            )}
            {counts.down > 0 && (
              <div
                className="bg-color-down transition-all"
                style={{ width: `${(counts.down / Math.max(counts.up + counts.down + counts.empty, 1)) * 100}%` }}
              />
            )}
          </div>
        </div>

        {/* Stake input + quick buttons */}
        <div className="mb-3">
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 pr-14 text-sm text-neutral-900 placeholder-neutral-300 focus:border-neutral-400 focus:outline-none focus:ring-0 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-neutral-400">
              USDC
            </span>
          </div>
          <div className="flex gap-1 mt-1.5">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setStakeInput(String(amt))}
                className="flex-1 rounded border border-neutral-200 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* Active position indicator + claim/withdraw */}
        {isJoined && position && (
          <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-emerald-700">Active position</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-700">
                  {parseFloat(formatUnits(position.balance, VISION_USDC_DECIMALS)).toFixed(2)} USDC
                </span>
                <button
                  type="button"
                  onClick={() => setShowClaimModal(true)}
                  className="px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-300 rounded hover:bg-emerald-100 transition-colors"
                >
                  Claim / Withdraw
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {displayError && (
          <div className="text-[11px] text-red-600 mb-2">
            <p className="line-clamp-2">{displayError}</p>
            {displayError.includes('Insufficient Vision balance') && (
              <button
                type="button"
                onClick={() => setShowDepositModal(true)}
                className="mt-1 px-3 py-1 text-[11px] font-semibold text-white bg-color-up rounded hover:opacity-90 transition-opacity"
              >
                Deposit USDC
              </button>
            )}
          </div>
        )}

        {/* Enter batch button */}
        <button
          type="button"
          onClick={handleEnterBatch}
          disabled={!canSubmit || isProcessing}
          className="w-full rounded-lg bg-neutral-900 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors"
        >
          {buttonLabel}
        </button>

        {/* Batch info footer */}
        {activeBatch && (
          <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
            <span>{activeBatch.playerCount} players</span>
            <span>{activeBatch.marketCount} markets</span>
          </div>
        )}

        {/* Strategy list */}
        <StrategyList
          bitmapEditor={bitmapEditor}
          sourceId={sourceId}
          marketIds={marketIds}
        />
      </div>
      {showDepositModal && <BalanceDepositModal onClose={() => setShowDepositModal(false)} />}
      {showClaimModal && activeBatch && (
        <WithdrawModal batchId={activeBatch.id} onClose={() => setShowClaimModal(false)} />
      )}
    </div>
  )
}
