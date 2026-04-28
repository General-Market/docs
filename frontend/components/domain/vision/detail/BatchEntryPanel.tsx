'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSharedCountdown } from '@/hooks/useSharedCountdown'
import { useAccount, useReadContract, useConnect, usePublicClient } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import type { BitmapEditor } from '@/hooks/vision/useBitmapEditor'
import { useBatches } from '@/hooks/vision/useBatches'
import { useJoinBatch } from '@/hooks/vision/useJoinBatch'
import { useL3GasBalance } from '@/hooks/vision/useL3GasBalance'
import { usePlayerPosition } from '@/hooks/vision/usePlayerPosition'
import { useSubmitBitmap } from '@/hooks/vision/useSubmitBitmap'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3, getWalletRpcUrls } from '@/lib/wagmi'
import type { BetDirection } from '@/lib/vision/bitmap'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'
import { SpringPress } from '@/components/ui/spring'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import StrategyList from './StrategyList'
import { useTranslations } from 'next-intl'
import { useDeployment } from '@/hooks/useDeployment'

interface BatchEntryPanelProps {
  bitmapEditor: BitmapEditor
  sourceId: string
  /** All market IDs relevant to this source */
  marketIds?: string[]
  /** ISO timestamp when betting closes for current round */
  bettingEnd?: string | null
}

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

type RoundPhase = 'betting' | 'closed' | 'settling'

function useRoundPhase(bettingEnd: string | null | undefined, tickDuration: number): RoundPhase {
  const remaining = useSharedCountdown(bettingEnd ?? null)

  if (!bettingEnd || tickDuration <= 0) return 'betting'
  if (remaining > 0) return 'betting'

  // Past bettingEnd, check if within settlement window
  const now = Date.now()
  const end = new Date(bettingEnd).getTime()
  const settlementStart = end + tickDuration * 1000
  if (now < settlementStart) return 'closed'
  return 'settling'
}

export default function BatchEntryPanel({
  bitmapEditor,
  sourceId,
  marketIds = [],
  bettingEnd,
}: BatchEntryPanelProps) {
  const t = useTranslations('vision')
  const queryClient = useQueryClient()

  // -- Contract addresses from deployment.json (auto-synced) --
  const { getAddress } = useDeployment()
  const visionAddress = getAddress('Vision')
  const usdcAddress = getAddress('L3_WUSDC')

  // -- Batch data --
  const { data: batches } = useBatches()
  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    const matching = batches
      .filter(b => b.sourceId === sourceId && !b.paused)
      .sort((a, b) => b.id - a.id)
    return matching[0] ?? batches.find(b => b.sourceId === sourceId) ?? null
  }, [batches, sourceId])

  // -- Round phase: betting → closed → settling --
  const tickDuration = activeBatch?.tickDuration ?? 0
  const roundPhase = useRoundPhase(bettingEnd, tickDuration)

  // -- Read configHash from on-chain batch state --
  // If getBatch reverts, the batch no longer exists on-chain (settled/deleted)
  // even if the oracle API still reports it as active. Treat as no batch.
  const activeBatchId = activeBatch?.id ?? null
  const { data: onChainBatch, isError: batchOnChainError, error: batchError } = useReadContract({
    address: visionAddress,
    abi: VISION_ABI,
    functionName: 'getBatch',
    args: activeBatchId !== null ? [BigInt(activeBatchId)] : undefined,
    chainId: indexL3.id,
    query: {
      enabled: activeBatchId !== null && visionAddress !== '0x0000000000000000000000000000000000000000',
      retry: false,
    },
  })
  const batchExistsOnChain = !batchOnChainError && batchError === null && onChainBatch !== undefined
  const configHash = batchExistsOnChain
    ? ((onChainBatch as any)?.configHash as `0x${string}` | undefined)
    : undefined

  // -- Player position: detect if user already joined this batch --
  const { isJoined, position, refetch: refetchPosition } = usePlayerPosition(activeBatch?.id)

  // -- Wallet connection --
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const handleConnectWallet = useCallback(async () => {
    const injectedConnector = connectors.find(c => c.id === 'injected')
    if (!injectedConnector) return
    const chainIdHex = `0x${indexL3.id.toString(16)}`
    const provider = (window as any).ethereum
    if (provider) {
      try { await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: chainIdHex, chainName: indexL3.name, nativeCurrency: indexL3.nativeCurrency, rpcUrls: getWalletRpcUrls(indexL3) }] }) } catch { /* chain may exist */ }
      try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] }) } catch { /* user rejected */ }
    }
    connect({ connector: injectedConnector, chainId: indexL3.id })
  }, [connect, connectors])

  // -- Wallet USDC balance (round-based: no Vision balance pool) --
  const { data: walletUsdcRaw, isLoading: isBalanceLoading, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && usdcAddress !== '0x0000000000000000000000000000000000000000', refetchInterval: 10_000 },
  })
  const walletUsdc = (walletUsdcRaw as bigint | undefined) ?? 0n
  const hasZeroBalance = !isBalanceLoading && walletUsdc === 0n

  // -- Wallet L3 GM gas balance — guards the Sign step from running out of gas --
  const { isLow: hasLowGas, refetch: refetchGas } = useL3GasBalance()

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

  const {
    submitBitmap,
    isSubmitting,
    error: submitError,
  } = useSubmitBitmap()

  // -- Local state --
  const [stakeInput, setStakeInput] = useState('')
  const [faucetLoading, setFaucetLoading] = useState(false)
  const [faucetSuccess, setFaucetSuccess] = useState(false)
  const [faucetError, setFaucetError] = useState<string | null>(null)

  // -- After on-chain join succeeds, submit bitmap to oracles --
  useEffect(() => {
    if (joinStep !== 'done' || !encodedBitmap || !bitmapHash || !activeBatch) return
    submitBitmap({
      batchId: activeBatch.id,
      bitmap: encodedBitmap,
      bitmapHash,
    }).finally(() => {
      resetJoin()
      refetchPosition()
      // Invalidate round/batch queries so BatchHistory picks up the new player count
      // without waiting for the next 5s/10s poll cycle
      queryClient.invalidateQueries({ queryKey: ['vision-rounds'] })
      queryClient.invalidateQueries({ queryKey: ['vision-batches'] })
    })
  }, [joinStep, encodedBitmap, bitmapHash, activeBatch, submitBitmap, resetJoin, refetchPosition, queryClient])

  // -- Get public client for direct reads --
  const publicClient = usePublicClient({ chainId: indexL3.id })

  // -- Derived --
  const counts = bitmapEditor.getCounts(sourceId, marketIds)
  const stakeValue = parseFloat(stakeInput) || 0
  const hasStake = stakeValue > 0
  const hasPredictions = counts.up + counts.down > 0
  const allMarketsSet = counts.empty === 0 && marketIds.length > 0
  const depositAmount = hasStake ? BigInt(Math.round(stakeValue * 1e18)) : 0n
  const exceedsBalance = isConnected && hasStake && depositAmount > walletUsdc
  const marketCountMismatch = !!(activeBatch?.marketCount && marketIds.length > 0
    && marketIds.length < activeBatch.marketCount)
  // Block join when round is closed/settling. The contract enforces the real deadline
  // but letting the tx revert wastes gas and confuses users.
  const isBettingOpen = roundPhase === 'betting'
  const canSubmit = isConnected && hasStake && joinStep === 'idle'
    && !isJoined && allMarketsSet && !!configHash && !exceedsBalance && !marketCountMismatch
    && isBettingOpen

  // -- Enter round handler --
  const handleEnterBatch = useCallback(async () => {
    if (!activeBatch || !canSubmit) return

    // Convert USDC amount to 18-decimal bigint (L3 USDC = 18 decimals)
    const depositAmount = BigInt(Math.round(stakeValue * 1e18))

    // Re-read configHash from on-chain RIGHT BEFORE joinBatchDirect
    let liveConfigHash = configHash
    if (!liveConfigHash) return

    try {
      if (publicClient) {
        const batchData = await publicClient.readContract({
          address: visionAddress,
          abi: VISION_ABI,
          functionName: 'getBatch',
          args: [BigInt(activeBatch.id)],
        })
        liveConfigHash = (batchData as any)?.configHash ?? configHash
      }
    } catch (e) {
      console.warn('Failed to re-read configHash, using cached value', e)
    }

    // Validate bitmap covers ALL markets in the batch config.
    // A short bitmap means uncovered markets → diluted stake → silent losses.
    if (activeBatch.marketCount && marketIds.length < activeBatch.marketCount) {
      console.error(
        `Bitmap underflow: snapshot has ${marketIds.length} markets, batch config has ${activeBatch.marketCount}. Refresh and retry.`
      )
      return
    }

    // Build bets array from bitmap state in market order
    const bets: BetDirection[] = marketIds.map((id) => {
      const cell = bitmapEditor.state[id]
      if (cell === 'up') return 'UP'
      if (cell === 'down') return 'DOWN'
      return 'DOWN'
    })

    // Use batch's authoritative market count, not snapshot length.
    // The snapshot can lag behind the batch config if assets become
    // healthy between snapshot fetch and join time.
    const bitmapMarketCount = activeBatch.marketCount || marketIds.length

    join({
      batchId: BigInt(activeBatch.id),
      configHash: liveConfigHash!,
      depositAmount,
      bets,
      marketCount: bitmapMarketCount,
    })
  }, [activeBatch, canSubmit, configHash, stakeValue, marketIds, bitmapEditor.state, join, publicClient])

  // -- Faucet handler --
  const handleFaucet = useCallback(async () => {
    if (!address || faucetLoading) return
    setFaucetLoading(true)
    setFaucetError(null)
    setFaucetSuccess(false)
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: '1000', scope: 'vision' }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setFaucetError(data.error || 'Faucet request failed')
      } else if (data.vision?.usdc?.error) {
        setFaucetError(`USDC mint failed: ${data.vision.usdc.error}`)
      } else if (data.vision?.gas?.error) {
        setFaucetError(`Gas drip failed: ${data.vision.gas.error}`)
      } else {
        setFaucetSuccess(true)
        setTimeout(() => { refetchBalance(); refetchGas() }, 2000)
        setTimeout(() => setFaucetSuccess(false), 4000)
      }
    } catch (e: any) {
      setFaucetError(e.message || 'Network error')
    } finally {
      setFaucetLoading(false)
    }
  }, [address, faucetLoading, refetchBalance, refetchGas])

  // -- Quick-stake buttons --
  const quickAmounts = [1, 5, 10, 50, 100]

  // -- Button label --
  const bettingRemaining = useSharedCountdown(bettingEnd ?? null)

  const buttonLabel = useMemo(() => {
    if (!isConnected) return t('batch_entry_panel.connect_wallet_button')
    if (isJoined || joinStep === 'done') return t('batch_detail.in_round')
    if (!isBettingOpen) return t('batch_detail.round_closed')
    if (isSubmitting) return t('batch_entry_panel.submitting')
    if (isJoinConfirming) return t('batch_entry_panel.confirming')
    if (isJoinPending) return t('batch_entry_panel.waiting_for_wallet')
    if (joinStep === 'approving') return t('batch_detail.approving_usdc')
    if (joinStep === 'joining') return t('batch_entry_panel.joining_batch')
    if (stakeValue > 0) return t('batch_entry_panel.enter_batch_amount', { amount: stakeValue.toString() })
    return t('batch_entry_panel.enter_batch')
  }, [isConnected, joinStep, isJoinPending, isJoinConfirming, isSubmitting, stakeValue, isJoined, isBettingOpen])

  const isProcessing = joinStep !== 'idle' && joinStep !== 'error' && joinStep !== 'done'

  const displayError = joinError || submitError

  // -- Settlement countdown (only relevant in 'closed' phase) --
  const settlementTarget = (roundPhase === 'closed' && bettingEnd && tickDuration > 0)
    ? new Date(new Date(bettingEnd).getTime() + tickDuration * 1000).toISOString()
    : null
  const settlementRemaining = useSharedCountdown(settlementTarget)
  const settlementCountdown = settlementTarget
    ? `${Math.floor(settlementRemaining / 60)}:${(settlementRemaining % 60).toString().padStart(2, '0')}`
    : ''

  return (
    <div>
      {/* -- Active Position Banner (round-based) -- */}
      {batchExistsOnChain && isJoined && position && (() => {
        const deposit = position.totalDeposited
        const depositNum = parseFloat(formatUnits(deposit, VISION_USDC_DECIMALS))
        return (
          <div className="border-2 border-emerald-400 bg-emerald-50 px-4 py-3 mb-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-[0.06em]">
                  {t('batch_entry_panel_extra.in_batch_status', { id: activeBatch?.id ?? '' })}
                </span>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400">{t('deposit_modal.button_deposit')}</div>
                <div className="text-[22px] font-black font-mono text-neutral-900 tabular-nums leading-tight">
                  {depositNum.toFixed(2)}
                  <span className="text-[11px] font-medium text-neutral-400 ml-1">USDC</span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-neutral-400 text-center">
              {t('batch_entry_panel_extra.settlement_auto')}
            </p>
          </div>
        )
      })()}

      {/* -- Not Joined Banner -- */}
      {isConnected && !isJoined && activeBatch && batchExistsOnChain && (
        <div className="border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-neutral-300" />
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.06em]">
              {t('batch_entry_panel_extra.not_in_batch_status', { id: activeBatch.id })}
            </span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">{t('batch_entry_panel.set_predictions_prompt')}</p>
        </div>
      )}

      <div className="border border-neutral-200 bg-white px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              {isJoined ? t('batch_entry_panel.update_predictions') : t('batch_entry_panel.set_predictions')}
            </h2>
            <p className="text-[10px] text-text-muted">
              {activeBatch && batchExistsOnChain ? `${t('batch_detail.batch')} #${activeBatch.id}` : t('batch_entry_panel.waiting_for_batch')}
            </p>
          </div>
        </div>

        {/* -- Phase: CLOSED (between bettingEnd and settlement) -- */}
        {roundPhase === 'closed' && (
          <div className="py-6 text-center">
            <div className="inline-block w-3 h-3 rounded-full bg-amber-400 mb-2" />
            <p className="text-[13px] font-bold text-neutral-700">{t('batch_detail.round_closed')}</p>
            <p className="text-[11px] text-neutral-500 mt-1">{t('batch_detail.awaiting_settlement')}</p>
            {settlementCountdown && (
              <p className="text-[20px] font-black font-mono text-neutral-900 mt-3 tabular-nums">
                {settlementCountdown}
              </p>
            )}
          </div>
        )}

        {/* -- Phase: SETTLING -- */}
        {roundPhase === 'settling' && (
          <div className="py-6 text-center">
            <div className="inline-block w-3 h-3 rounded-full bg-neutral-400 animate-pulse mb-2" />
            <p className="text-[13px] font-bold text-neutral-700">{t('batch_detail.settling')}</p>
            <p className="text-[11px] text-neutral-500 mt-1">{t('batch_detail.results_incoming')}</p>
          </div>
        )}

        {/* -- Phase: BETTING (full prediction UI) -- */}
        {roundPhase === 'betting' && (
          <>
            {/* Bitmap summary */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                <span className="text-color-up">{t('batch_entry_panel.up_count', { count: counts.up })}</span>
                <span className="text-color-down">{t('batch_entry_panel.down_count', { count: counts.down })}</span>
                <span className="text-text-muted">{t('batch_entry_panel.unset_count', { count: counts.empty })}</span>
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

            {/* Connect wallet prompt */}
            {!isConnected && !isJoined && (
              <button
                type="button"
                onClick={handleConnectWallet}
                className="w-full mb-3 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-left hover:bg-neutral-100 transition-colors"
              >
                <p className="text-[11px] font-bold text-neutral-700">{t('batch_entry_panel.connect_wallet')}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">{t('batch_entry_panel.connect_wallet_prompt')}</p>
              </button>
            )}

            {/* Wallet hint when USDC is empty OR L3 gas is too low to sign */}
            {isConnected && (hasZeroBalance || hasLowGas) && !isJoined && (
              <div className="w-full mb-3 rounded-md border border-dashed border-yellow-400 bg-yellow-50 px-3 py-2">
                <p className="text-[11px] font-bold text-yellow-700">
                  {hasZeroBalance ? t('batch_detail.no_usdc') : t('batch_detail.no_gas')}
                </p>
                <p className="text-[10px] text-yellow-600 mt-0.5">
                  {hasZeroBalance ? t('batch_detail.no_usdc_detail') : t('batch_detail.no_gas_detail')}
                </p>
                {faucetSuccess ? (
                  <p className="text-[10px] font-semibold text-emerald-600 mt-1.5">{t('batch_detail.usdc_minted')}</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleFaucet}
                    disabled={faucetLoading}
                    className="mt-1.5 w-full rounded border border-yellow-500 bg-yellow-100 py-1 text-[11px] font-semibold text-yellow-800 hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-wait transition-colors"
                  >
                    {faucetLoading
                      ? 'Minting...'
                      : hasZeroBalance
                        ? t('batch_detail.get_test_usdc')
                        : t('batch_detail.get_test_gas')}
                  </button>
                )}
                {faucetError && (
                  <p className="text-[10px] text-red-600 mt-1">{faucetError}</p>
                )}
              </div>
            )}

            {/* Stake input + quick buttons */}
            {!isJoined && (
              <div className="mb-3">
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
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
                {/* Balance display + max button */}
                {isConnected && (
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-neutral-400">
                      Balance: {parseFloat(formatUnits(walletUsdc, VISION_USDC_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const max = parseFloat(formatUnits(walletUsdc, VISION_USDC_DECIMALS))
                        if (max > 0) setStakeInput(String(Math.floor(max * 100) / 100))
                      }}
                      className="text-[10px] font-semibold text-neutral-500 hover:text-neutral-700 transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                )}
                {exceedsBalance && (
                  <p className="text-[10px] text-red-500 mt-1">
                    Insufficient balance. You have {parseFloat(formatUnits(walletUsdc, VISION_USDC_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC.
                  </p>
                )}
                {marketCountMismatch && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    Market data out of sync, batch expects {activeBatch?.marketCount} markets but only {marketIds.length} loaded. Refresh the page.
                  </p>
                )}
              </div>
            )}

            {/* Error display */}
            {displayError && (
              <div className="text-[11px] text-red-600 mb-2 flex items-start justify-between gap-2">
                <p className="line-clamp-2">{displayError}</p>
                <button
                  type="button"
                  onClick={() => resetJoin()}
                  className="text-neutral-400 hover:text-neutral-600 text-xs flex-shrink-0"
                  title={t('batch_entry_panel.dismiss')}
                >
                  &times;
                </button>
              </div>
            )}

            {/* Closing soon warning */}
            {!isJoined && isBettingOpen && bettingRemaining > 0 && bettingRemaining <= 30 && (
              <div className="mb-2 px-2 py-1.5 rounded bg-amber-50 border border-amber-200 text-center">
                <span className="text-[11px] font-bold text-amber-700">
                  Closing in {bettingRemaining}s
                </span>
              </div>
            )}

            {/* Enter round button */}
            {!isJoined && (
              <SpringPress disabled={!canSubmit || isProcessing}>
                <WalletActionButton
                  onClick={handleEnterBatch}
                  disabled={!canSubmit || isProcessing}
                  className="w-full rounded-lg bg-neutral-900 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors"
                >
                  {buttonLabel}
                </WalletActionButton>
              </SpringPress>
            )}

            {/* Strategy list */}
            <StrategyList
              bitmapEditor={bitmapEditor}
              sourceId={sourceId}
              marketIds={marketIds}
            />
          </>
        )}

        {/* Batch info footer */}
        {activeBatch && batchExistsOnChain && (
          <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
            <span>{t('batch_entry_panel.players', { count: activeBatch.playerCount })}</span>
            <span>{t('batch_entry_panel.markets', { count: activeBatch.marketCount || marketIds.length })}</span>
          </div>
        )}
      </div>
    </div>
  )
}
