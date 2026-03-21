'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount, useReadContract, useConnect, usePublicClient } from 'wagmi'
import { formatUnits } from 'viem'
import type { BitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { useBatches } from '@/hooks/vision/useBatches'
import { useJoinBatch } from '@/hooks/vision/useJoinBatch'
import { useDeposit } from '@/hooks/vision/useDeposit'
import { useVisionBalance } from '@/hooks/vision/useVisionBalance'
import { usePlayerPosition } from '@/hooks/vision/usePlayerPosition'
import { usePlayerProfile } from '@/hooks/usePlayerProfile'
import { useBalanceChangeNotification } from '@/hooks/vision/useBalanceChangeNotification'
import { useSubmitBitmap } from '@/hooks/vision/useSubmitBitmap'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import type { BetDirection } from '@/lib/vision/bitmap'
import { getBatchTickState } from '@/lib/vision/tick'
import { VISION_USDC_DECIMALS, VISION_ADDRESS } from '@/lib/vision/constants'
import { SpringPress } from '@/components/ui/spring'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { BalanceDepositModal } from '../BalanceDepositModal'
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
  // Fetch live batch list from issuers (for display: playerCount, tvl, currentTick)
  const { data: batches } = useBatches()
  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    return batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  // -- Read configHash from on-chain batch state --
  const activeBatchId = activeBatch?.id ?? null
  const { data: onChainBatch } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'getBatch',
    args: activeBatchId !== null ? [BigInt(activeBatchId)] : undefined,
    chainId: indexL3.id,
    query: { enabled: activeBatchId !== null && VISION_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  })
  const configHash = (onChainBatch as any)?.configHash as `0x${string}` | undefined

  // -- Player position: detect if user already joined this batch --
  const { isJoined, position, refetch: refetchPosition } = usePlayerPosition(activeBatch?.id)

  // -- Player profile for per-tick history --
  const { address, isConnected } = useAccount()
  const { profile } = usePlayerProfile(address ?? '0x0000000000000000000000000000000000000000')
  const batchTicks = useMemo(() => {
    if (!profile || !activeBatch) return []
    const batch = profile.batches.find(b => b.batchId === activeBatch.id)
    return batch?.ticks ?? []
  }, [profile, activeBatch])

  // -- Tick history expand/collapse --
  const [showTickHistory, setShowTickHistory] = useState(false)

  // -- Toast notification on tick resolution (balance change) --
  const { suppress: suppressBalanceToast } = useBalanceChangeNotification(position?.balance, isJoined)

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

  // -- Wallet connection --
  const { connect, connectors } = useConnect()
  const handleConnectWallet = useCallback(async () => {
    const injectedConnector = connectors.find(c => c.id === 'injected')
    if (!injectedConnector) return
    const chainIdHex = `0x${indexL3.id.toString(16)}`
    const provider = (window as any).ethereum
    if (provider) {
      try { await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: chainIdHex, chainName: indexL3.name, nativeCurrency: indexL3.nativeCurrency, rpcUrls: [indexL3.rpcUrls.default.http[0]] }] }) } catch { /* chain may exist */ }
      try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] }) } catch { /* user rejected */ }
    }
    connect({ connector: injectedConnector, chainId: indexL3.id })
  }, [connect, connectors])

  // -- Vision balance (for deposit prompt when empty) --
  const { total: visionBalance, isLoading: isBalanceLoading } = useVisionBalance()
  const hasZeroBalance = !isBalanceLoading && visionBalance === 0n

  // -- Local state --
  const [stakeInput, setStakeInput] = useState('')
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [betsSubmittedTick, setBetsSubmittedTick] = useState<number | null>(null)

  // -- Per-batch tick timer --
  const tickDuration = activeBatch?.tickDuration ?? 600
  const [tickState, setTickState] = useState(() => getBatchTickState(tickDuration))
  useEffect(() => {
    const td = activeBatch?.tickDuration ?? 600
    const interval = setInterval(() => {
      setTickState(getBatchTickState(td))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeBatch?.tickDuration])

  // -- Derived --
  const counts = bitmapEditor.getCounts(sourceId, marketIds)
  const stakeValue = parseFloat(stakeInput) || 0
  const hasStake = stakeValue > 0
  const hasPredictions = counts.up + counts.down > 0
  const activeStep = isJoined ? depositStep : joinStep
  // New joins require: stake + ALL markets set (up or down) + configHash.
  // Already-joined players can deposit more without setting new bets.
  const allMarketsSet = counts.empty === 0 && marketIds.length > 0
  const canSubmit = isConnected && hasStake && activeStep === 'idle'
    && (isJoined || (allMarketsSet && !!configHash))

  // -- After on-chain join succeeds, submit bitmap to issuers --
  useEffect(() => {
    if (joinStep !== 'done' || !encodedBitmap || !bitmapHash || !activeBatch) return
    submitBitmap({
      batchId: activeBatch.id,
      bitmap: encodedBitmap,
      bitmapHash,
    }).then(() => {
      setBetsSubmittedTick(activeBatch.currentTick)
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

  // -- When tick advances, clear the "just submitted" flag --
  // The oracle persists bitmaps across ticks (flip() keeps active entries),
  // so the player's predictions remain active even without re-submitting.
  // The UI uses hasPredictions (from bitmapEditor state) to show "carry forward".
  useEffect(() => {
    if (betsSubmittedTick !== null && activeBatch && activeBatch.currentTick > betsSubmittedTick) {
      setBetsSubmittedTick(null)
    }
  }, [activeBatch?.currentTick, betsSubmittedTick])

  // -- Get public client for direct reads --
  const publicClient = usePublicClient({ chainId: indexL3.id })

  // -- Enter batch handler --
  const handleEnterBatch = useCallback(async () => {
    if (!activeBatch || !canSubmit) return

    // Convert USDC amount to 18-decimal bigint (L3 USDC = 18 decimals)
    const depositAmount = BigInt(Math.round(stakeValue * 1e18))

    // Suppress the "tick resolved" toast — this balance change is user-initiated
    suppressBalanceToast()

    if (isJoined) {
      // Already in the batch — deposit additional funds instead of joinBatch
      depositMore(BigInt(activeBatch.id), depositAmount)
    } else {
      // First time joining — need configHash and bets
      // Re-read configHash from on-chain RIGHT BEFORE joinBatch to prevent promotion race
      let liveConfigHash = configHash
      if (!liveConfigHash) return

      try {
        if (publicClient) {
          const batchData = await publicClient.readContract({
            address: VISION_ADDRESS,
            abi: VISION_ABI,
            functionName: 'getBatch',
            args: [BigInt(activeBatch.id)],
          })
          liveConfigHash = (batchData as any)?.configHash ?? configHash
        }
      } catch (e) {
        console.warn('Failed to re-read configHash, using cached value', e)
        // Fall through to use cached configHash
      }

      // Build bets array from bitmap state in market order
      const bets: BetDirection[] = marketIds.map((id) => {
        const cell = bitmapEditor.state[id]
        if (cell === 'up') return 'UP'
        if (cell === 'down') return 'DOWN'
        return 'DOWN' // default unset to DOWN
      })

      join({
        batchId: BigInt(activeBatch.id),
        configHash: liveConfigHash!,
        depositAmount,
        stakePerTick: depositAmount, // stake entire deposit per tick for now
        bets,
        marketCount: marketIds.length,
      })
    }
  }, [activeBatch, canSubmit, configHash, stakeValue, marketIds, bitmapEditor.state, join, isJoined, depositMore, publicClient])

  // -- Quick-stake buttons --
  const quickAmounts = [1, 5, 10, 50, 100]

  // -- Button label --
  const buttonLabel = useMemo(() => {
    if (!isConnected) return 'Connect Wallet'
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
  }, [isConnected, joinStep, depositStep, isJoinPending, isJoinConfirming, isDepositPending, isDepositConfirming, isSubmitting, stakeValue, isJoined])

  const isProcessing = (joinStep !== 'idle' && joinStep !== 'error' && joinStep !== 'done')
    || (depositStep !== 'idle' && depositStep !== 'error' && depositStep !== 'done')

  const displayError = joinError || depositError || submitError

  // -- Tick history summary --
  const tickSummary = useMemo(() => {
    if (batchTicks.length === 0) return null
    const wins = batchTicks.filter(t => t.pnl > 0).length
    const losses = batchTicks.filter(t => t.pnl < 0).length
    const flats = batchTicks.filter(t => t.pnl === 0).length
    const totalPnl = batchTicks.reduce((sum, t) => sum + t.pnl, 0)
    return { wins, losses, flats, total: batchTicks.length, totalPnl }
  }, [batchTicks])

  return (
    <div>
      {/* ── Active Position Banner (top of panel, unmistakable) ── */}
      {isJoined && position && (() => {
        const balance = position.balance
        const deposited = position.totalDeposited
        const claimed = position.totalClaimed
        const pnl = balance - deposited + claimed
        const pnlPercent = deposited > 0n
          ? Number((pnl * 10000n) / deposited) / 100
          : 0
        const balanceNum = parseFloat(formatUnits(balance, VISION_USDC_DECIMALS))
        const pnlNum = parseFloat(formatUnits(pnl, VISION_USDC_DECIMALS))
        const stakeNum = parseFloat(formatUnits(position.stakePerTick, VISION_USDC_DECIMALS))
        const isUp = pnl > 0n
        const isDown = pnl < 0n
        return (
          <div className="border-2 border-emerald-400 bg-emerald-50 px-4 py-3 mb-1">
            {/* Status badge */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-[0.06em]">
                  In Batch #{activeBatch?.id}
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-600">
                {stakeNum.toFixed(2)} USDC/tick
              </span>
            </div>
            {/* Balance + PnL — large, at a glance */}
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">Balance</div>
                <div className="text-[22px] font-black font-mono text-neutral-900 tabular-nums leading-tight">
                  {balanceNum.toFixed(2)}
                  <span className="text-[11px] font-medium text-neutral-400 ml-1">USDC</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">PnL</div>
                <div className={`text-[18px] font-black font-mono tabular-nums leading-tight ${isUp ? 'text-color-up' : isDown ? 'text-color-down' : 'text-neutral-500'}`}>
                  {isUp ? '+' : ''}{pnlNum.toFixed(2)}
                  <span className="text-[10px] ml-0.5">({isUp ? '+' : ''}{pnlPercent.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
            {/* Win/Loss summary bar */}
            {tickSummary && (
              <div className="mt-2 pt-2 border-t border-emerald-200">
                <div className="flex items-center justify-between text-[10px] font-mono tabular-nums">
                  <span className="text-color-up font-bold">{tickSummary.wins}W</span>
                  <span className="text-color-down font-bold">{tickSummary.losses}L</span>
                  {tickSummary.flats > 0 && <span className="text-neutral-400 font-bold">{tickSummary.flats}F</span>}
                  <span className="text-neutral-400">{tickSummary.total} ticks</span>
                  <span className={`font-bold ${tickSummary.totalPnl >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                    {tickSummary.totalPnl >= 0 ? '+' : ''}{tickSummary.totalPnl.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Not Joined Banner ── */}
      {isConnected && !isJoined && activeBatch && (
        <div className="border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-neutral-300" />
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.06em]">
              Not in batch #{activeBatch.id}
            </span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">Set predictions and enter below to play.</p>
        </div>
      )}

      <div className="border border-neutral-200 bg-white px-4 py-3">
        {/* Header + Timer — single compact row */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">
                {isJoined ? 'Update predictions' : 'Set predictions for next tick'}
              </h2>
            </div>
            <p className="text-[10px] text-text-muted">
              {activeBatch ? `Tick ${activeBatch.currentTick}` : 'Waiting for batch...'}
            </p>
          </div>
          <p className="text-[24px] font-mono font-black tracking-tight leading-none text-black">
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

        {/* Tick status messages */}
        {isJoined && betsSubmittedTick !== null && (
          <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-emerald-700">Your bets are set for the next tick</p>
          </div>
        )}
        {isJoined && betsSubmittedTick === null && hasPredictions && (
          <div className="mb-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-sky-700">Bets carry forward from previous tick</p>
            <p className="text-[10px] text-sky-600 mt-0.5">Change predictions below, or deposit more to continue with current bets.</p>
          </div>
        )}
        {isJoined && betsSubmittedTick === null && !hasPredictions && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-amber-700">Sitting out this tick — no bets set</p>
          </div>
        )}

        {/* Connect wallet prompt when not connected */}
        {!isConnected && !isJoined && (
          <button
            type="button"
            onClick={handleConnectWallet}
            className="w-full mb-3 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-left hover:bg-neutral-100 transition-colors"
          >
            <p className="text-[11px] font-bold text-neutral-700">Connect Wallet</p>
            <p className="text-[10px] text-neutral-500 mt-0.5">Connect your wallet to start playing</p>
          </button>
        )}
        {/* Deposit prompt when connected but balance is 0 */}
        {isConnected && hasZeroBalance && !isJoined && (
          <button
            type="button"
            onClick={() => setShowDepositModal(true)}
            className="w-full mb-3 rounded-md border border-dashed border-yellow-400 bg-yellow-50 px-3 py-2 text-left hover:bg-yellow-100 transition-colors"
          >
            <p className="text-[11px] font-bold text-yellow-700">No Vision balance</p>
            <p className="text-[10px] text-yellow-600 mt-0.5">Deposit USDC to start playing</p>
          </button>
        )}

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
          <div className="flex gap-1 mt-1.5 fluid-btn-group">
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

        {/* Error display — with dismiss to reset state for retry */}
        {displayError && (
          <div className="text-[11px] text-red-600 mb-2 flex items-start justify-between gap-2">
            <div>
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
            <button
              type="button"
              onClick={() => { resetJoin(); resetDeposit() }}
              className="text-neutral-400 hover:text-neutral-600 text-xs flex-shrink-0"
              title="Dismiss"
            >
              &times;
            </button>
          </div>
        )}

        {/* Enter batch button — connects wallet when not connected */}
        <SpringPress disabled={!canSubmit || isProcessing}>
          <WalletActionButton
            onClick={handleEnterBatch}
            disabled={!canSubmit || isProcessing}
            className="w-full rounded-lg bg-neutral-900 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors"
          >
            {buttonLabel}
          </WalletActionButton>
        </SpringPress>

        {/* Batch info footer */}
        {activeBatch && (
          <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
            <span>{activeBatch.playerCount} players</span>
            <span>{activeBatch.marketCount || marketIds.length} markets</span>
          </div>
        )}

        {/* Strategy list */}
        <StrategyList
          bitmapEditor={bitmapEditor}
          sourceId={sourceId}
          marketIds={marketIds}
        />
      </div>

      {/* ── Tick History (separate section, always visible when joined) ── */}
      {isJoined && position && batchTicks.length > 0 && (() => {
        const stakePerTickNum = parseFloat(formatUnits(position.stakePerTick, VISION_USDC_DECIMALS))
        const sorted = [...batchTicks].sort((a, b) => b.tickId - a.tickId)
        const visibleTicks = showTickHistory ? sorted : sorted.slice(0, 5)
        return (
          <div className="mt-1 border border-neutral-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold text-neutral-700 uppercase tracking-[0.06em]">
                Tick History
              </h3>
              {tickSummary && (
                <span className={`text-[11px] font-bold font-mono tabular-nums ${tickSummary.totalPnl >= 0 ? 'text-color-up' : 'text-color-down'}`}>
                  {tickSummary.totalPnl >= 0 ? '+' : ''}{tickSummary.totalPnl.toFixed(2)} USDC
                </span>
              )}
            </div>
            {/* Column header */}
            <div className="flex items-center text-[9px] font-semibold uppercase tracking-[0.06em] text-neutral-300 mb-0.5 px-1">
              <span className="w-[40px]">Tick</span>
              <span className="w-[50px] text-right">Staked</span>
              <span className="flex-1 text-right">PnL</span>
              <span className="w-[48px] text-right">Result</span>
            </div>
            <div className={showTickHistory ? 'max-h-[300px] overflow-y-auto' : ''}>
              {visibleTicks.map((tick) => {
                const pnlSign = tick.pnl >= 0 ? '+' : ''
                return (
                  <div
                    key={tick.tickId}
                    className="flex items-center text-[10px] font-mono tabular-nums px-1 py-[3px] border-b border-neutral-100 last:border-b-0"
                  >
                    <span className="w-[40px] text-neutral-500">#{tick.tickId}</span>
                    <span className="w-[50px] text-right text-neutral-400">{stakePerTickNum.toFixed(2)}</span>
                    <span className={`flex-1 text-right font-semibold ${tick.pnl > 0 ? 'text-color-up' : tick.pnl < 0 ? 'text-color-down' : 'text-neutral-400'}`}>
                      {pnlSign}{tick.pnl.toFixed(2)}
                    </span>
                    <span className={`w-[48px] text-right text-[9px] font-bold ${
                      tick.pnl > 0 ? 'text-color-up' : tick.pnl < 0 ? 'text-color-down' : 'text-neutral-400'
                    }`}>
                      {tick.pnl > 0 ? 'Won' : tick.pnl < 0 ? 'Lost' : 'Flat'}
                    </span>
                  </div>
                )
              })}
            </div>
            {sorted.length > 5 && (
              <button
                type="button"
                onClick={() => setShowTickHistory(!showTickHistory)}
                className="mt-1.5 w-full text-center text-[10px] font-semibold text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                {showTickHistory ? 'Show less' : `Show all ${sorted.length} ticks`}
              </button>
            )}
            <p className="mt-2 text-[10px] text-neutral-400 text-center">
              Settlement is automatic. Payout credited to your Vision balance.
            </p>
          </div>
        )
      })()}

      {showDepositModal && <BalanceDepositModal onClose={() => setShowDepositModal(false)} />}
    </div>
  )
}
