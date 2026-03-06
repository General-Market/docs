'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAccount, useWaitForTransactionReceipt, usePublicClient, useReadContract } from 'wagmi'
import { parseUnits, formatUnits, decodeEventLog } from 'viem'
import { INDEX_PROTOCOL, COLLATERAL_DECIMALS } from '@/lib/contracts/addresses'
import { ERC20_ABI, INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { TransactionStepper } from '@/components/ui/TransactionStepper'
import type { MicroStep, VisibleStep } from '@/components/ui/TransactionStepper'
import { getTxUrl } from '@/lib/utils/basescan'
import { useUserState } from '@/hooks/useUserState'
import { useItpCostBasis } from '@/hooks/useItpCostBasis'
import { useItpNav } from '@/hooks/useItpNav'
import { useSSEOrders, useSSEBalances, type UserOrder } from '@/hooks/useSSE'
import { useToast } from '@/lib/contexts/ToastContext'
import { YouTubeLite, extractYouTubeId } from '@/components/ui/YouTubeLite'
import { useTranslations } from 'next-intl'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { indexL3 } from '@/lib/wagmi'

/**
 * Sell flow micro-steps — Direct L3 path (3 steps + Done):
 *
 * Step 1 "Submit":   SUBMIT (0)
 * Step 2 "Process":  BATCH (1), FILL (2)
 * Done:              DONE (3)
 *
 * No approval needed — Index contract deducts from _userShares internally.
 */
enum SellMicro {
  SUBMIT = 0,
  BATCH = 1,
  FILL = 2,
  DONE = 3,
}

interface SellItpModalProps {
  itpId: string
  videoUrl?: string
  onClose: () => void
}

export function SellItpModal({ itpId, videoUrl, onClose }: SellItpModalProps) {
  const t = useTranslations('sell-modal')
  const tc = useTranslations('common')
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { showSuccess } = useToast()
  const { capture } = usePostHogTracker()
  const sellStartTime = useRef<number>(0)

  const VISIBLE_STEPS: VisibleStep[] = [
    { label: t('steps.submit') },
    { label: t('steps.process') },
  ]

  const MICRO_LABELS: Record<number, string | ((ctx: { isPending: boolean }) => string)> = {
    [SellMicro.SUBMIT]: (ctx) => ctx.isPending ? t('micro_steps.submit_pending') : t('micro_steps.submit_confirming'),
    [SellMicro.BATCH]: () => t('micro_steps.batch'),
    [SellMicro.FILL]: () => t('micro_steps.fill'),
    [SellMicro.DONE]: () => t('micro_steps.usdc_received'),
  }

  const SLIPPAGE_TIERS = [
    { value: 0, label: '0.3%', description: t('slippage_label') },
    { value: 1, label: '1%', description: t('slippage_label') },
    { value: 2, label: '3%', description: t('slippage_label') },
  ]

  // SSE-driven order & balance tracking
  const sseOrders = useSSEOrders()
  const sseBalances = useSSEBalances()

  const [amount, setAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('0')
  const [slippageTier, setSlippageTier] = useState(2)
  const [showSlippage, setShowSlippage] = useState(false)
  const [deadlineHours, setDeadlineHours] = useState(1)
  const [micro, setMicro] = useState<number>(-1) // -1 = INPUT mode
  const [orderId, setOrderId] = useState<bigint | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [fillPrice, setFillPrice] = useState<bigint | null>(null)
  const [fillAmount, setFillAmount] = useState<bigint | null>(null)
  const [usdcProceeds, setUsdcProceeds] = useState<bigint | null>(null)
  const [initialL3Usdc, setInitialL3Usdc] = useState<bigint | null>(null)

  // Saved tx hashes
  const [savedSellHash, setSavedSellHash] = useState<string | null>(null)
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null)
  const [fillTxHash, setFillTxHash] = useState<string | null>(null)

  const { writeContract, data: hash, isPending, error: writeError, reset } = useChainWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  const sellHandled = useRef(false)

  // Keep useUserState for ITP name/symbol
  const userState = useUserState(itpId)
  const itpName = userState.bridgedItpName || 'ITP'
  const itpSymbol = userState.bridgedItpSymbol || ''

  // L3 user shares for this ITP — direct on-chain read
  const { data: l3SharesRaw } = useReadContract({
    address: INDEX_PROTOCOL.index,
    abi: INDEX_ABI,
    functionName: 'getUserShares',
    args: address ? [itpId as `0x${string}`, address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && !!itpId, refetchInterval: 5_000 },
  })
  const userShares = (l3SharesRaw as bigint) ?? 0n

  // L3 USDC balance (for detecting proceeds)
  const { data: l3UsdcRaw } = useReadContract({
    address: INDEX_PROTOCOL.l3Usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address, refetchInterval: 5_000 },
  })
  const l3UsdcBalance = (l3UsdcRaw as bigint) ?? 0n

  const { costBasis } = useItpCostBasis(itpId, address ?? null)
  const { navPerShare, navPerShareBn, totalAssetCount, pricedAssetCount, isLoading: isNavLoading } = useItpNav(itpId)

  const navPriceSet = useRef(false)
  useEffect(() => {
    if (navPriceSet.current || isNavLoading) return
    if (navPerShareBn > 0n) {
      const priceWithBuffer = (navPerShareBn * 95n) / 100n
      setLimitPrice(formatUnits(priceWithBuffer, 18))
      navPriceSet.current = true
    }
  }, [navPerShareBn, isNavLoading])

  // --- PostHog: sell_modal_opened ---
  useEffect(() => {
    capture('sell_modal_opened', {
      itp_id: itpId,
      user_shares: formatUnits(userShares, 18),
      itp_name: itpName,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const parsedAmount = amount ? parseUnits(amount, 18) : 0n
  const insufficientShares = parsedAmount > 0n && parsedAmount > userShares

  const snapshotBalances = useCallback(() => {
    setInitialL3Usdc(l3UsdcBalance)
  }, [l3UsdcBalance])

  const handleSell = useCallback(async () => {
    if (!publicClient || !amount || insufficientShares) return
    setTxError(null)
    sellHandled.current = false
    snapshotBalances()

    // --- PostHog: sell_submitted ---
    sellStartTime.current = Date.now()
    capture('sell_submitted', {
      itp_id: itpId,
      shares_amount: amount,
      limit_price: limitPrice,
      slippage_tier: SLIPPAGE_TIERS[slippageTier].label,
      needs_approval: false,
    })

    // Direct L3: no approval needed, Index contract deducts from _userShares
    setMicro(SellMicro.SUBMIT)

    let blockTimestamp: bigint
    try {
      const block = await publicClient.getBlock()
      blockTimestamp = block.timestamp
    } catch {
      blockTimestamp = BigInt(Math.floor(Date.now() / 1000))
    }

    const deadline = blockTimestamp + BigInt(deadlineHours * 3600)
    const priceBn = parseUnits(limitPrice || '0', 18)

    // Index.submitOrder(itpId, SELL=1, amount, limitPrice, slippageTier, deadline)
    writeContract({
      address: INDEX_PROTOCOL.index,
      abi: INDEX_ABI,
      functionName: 'submitOrder',
      args: [
        itpId as `0x${string}`,
        1, // side = SELL
        parsedAmount,
        priceBn,
        BigInt(slippageTier),
        deadline,
      ],
    })
  }, [publicClient, amount, insufficientShares, parsedAmount, writeContract, snapshotBalances, deadlineHours, limitPrice, slippageTier, itpId])

  // Handle tx success — extract orderId, advance to BATCH
  useEffect(() => {
    if (!isSuccess || !receipt || sellHandled.current) return

    if (micro === SellMicro.SUBMIT) {
      sellHandled.current = true
      if (hash) setSavedSellHash(hash)
      window.dispatchEvent(new Event('portfolio-refresh'))

      // Extract orderId from OrderSubmitted event
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === INDEX_PROTOCOL.index.toLowerCase()) {
          try {
            const decoded = decodeEventLog({ abi: INDEX_ABI, data: log.data, topics: log.topics })
            if (decoded.eventName === 'OrderSubmitted') {
              setOrderId((decoded.args as any).orderId as bigint)
              break
            }
          } catch {}
        }
      }

      // Direct L3 → skip to BATCH
      setMicro(SellMicro.BATCH)
      reset()
    }
  }, [isSuccess, receipt, micro, hash, reset])

  // SSE-driven order tracking: BATCH -> FILL -> DONE
  const trackedOrder = useMemo((): UserOrder | undefined => {
    if (micro < SellMicro.BATCH || micro >= SellMicro.DONE) return undefined
    if (orderId !== null) {
      return sseOrders.find(o => o.order_id === Number(orderId))
    }
    const candidates = sseOrders
      .filter(o => o.itp_id === itpId && o.side === 1)
      .sort((a, b) => b.timestamp - a.timestamp)
    return candidates[0]
  }, [sseOrders, orderId, micro, itpId])

  useEffect(() => {
    if (!trackedOrder || micro < SellMicro.BATCH || micro >= SellMicro.DONE) return

    if (orderId === null) {
      setOrderId(BigInt(trackedOrder.order_id))
    }

    const status = trackedOrder.status

    if (status >= 2 && micro < SellMicro.DONE) {
      // FILLED
      if (trackedOrder.fill_price) {
        try { setFillPrice(BigInt(trackedOrder.fill_price)) } catch {}
      }
      if (trackedOrder.fill_amount) {
        try { setFillAmount(BigInt(trackedOrder.fill_amount)) } catch {}
      }
      setMicro(SellMicro.DONE)
    } else if (status >= 1 && micro < SellMicro.FILL) {
      // BATCHED
      setMicro(SellMicro.FILL)
    }
  }, [trackedOrder, micro, orderId])

  // Detect L3 USDC balance increase — completion signal (fallback when SSE unavailable)
  useEffect(() => {
    if (micro < SellMicro.BATCH || micro >= SellMicro.DONE) return

    if (initialL3Usdc !== null && l3UsdcBalance > initialL3Usdc) {
      const proceeds = l3UsdcBalance - initialL3Usdc
      setUsdcProceeds(proceeds)
      setMicro(SellMicro.DONE)
    }
  }, [micro, l3UsdcBalance, initialL3Usdc])

  useEffect(() => {
    if (writeError) {
      const msg = writeError.message || 'Transaction failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      setTxError(shortMsg)

      // --- PostHog: sell_failed ---
      capture('sell_failed', {
        itp_id: itpId,
        error_message: shortMsg,
        step_name: micro >= 0 ? SellMicro[micro] : 'INPUT',
        step_index: micro,
        time_since_submit_ms: sellStartTime.current ? Date.now() - sellStartTime.current : 0,
      })

      setMicro(-1)
    }
  }, [writeError])

  // Toast notification on fill
  const toastFired = useRef(false)
  useEffect(() => {
    if (micro === SellMicro.DONE && !toastFired.current) {
      toastFired.current = true
      const proceeds = usdcProceeds
        ? `$${parseFloat(formatUnits(usdcProceeds, COLLATERAL_DECIMALS)).toFixed(2)} USDC`
        : 'USDC'
      showSuccess(t('toast.sell_filled', { proceeds }))

      // --- PostHog: sell_completed ---
      capture('sell_completed', {
        itp_id: itpId,
        shares_amount: amount,
        received_usd: usdcProceeds ? parseFloat(formatUnits(usdcProceeds, COLLATERAL_DECIMALS)) : null,
        fill_price: fillPrice ? formatUnits(fillPrice, 18) : null,
        total_time_ms: sellStartTime.current ? Date.now() - sellStartTime.current : 0,
      })
    }
    if (micro === -1) toastFired.current = false
  }, [micro, usdcProceeds, showSuccess])

  const [stuckWarning, setStuckWarning] = useState(false)

  useEffect(() => {
    if (!isConfirming) {
      setStuckWarning(false)
      return
    }
    const timer = setTimeout(() => setStuckWarning(true), 30_000)
    return () => clearTimeout(timer)
  }, [isConfirming])

  const clearTxHashes = useCallback(() => {
    setSavedSellHash(null)
    setBatchTxHash(null)
    setFillTxHash(null)
  }, [])

  const handleCancel = useCallback(() => {
    reset()
    setMicro(-1)
    setTxError(null)
    setStuckWarning(false)
    clearTxHashes()
  }, [reset, clearTxHashes])

  const handleReset = useCallback(() => {
    setMicro(-1)
    setOrderId(null)
    setAmount('')
    setFillPrice(null)
    setFillAmount(null)
    setUsdcProceeds(null)
    setInitialL3Usdc(null)
    clearTxHashes()
  }, [clearTxHashes])

  // --- PostHog: sell_modal_closed ---
  const handleClose = useCallback(() => {
    capture('sell_modal_closed', {
      itp_id: itpId,
      last_step: micro >= 0 ? SellMicro[micro] : 'INPUT',
      had_entered_amount: Boolean(amount),
      was_completed: micro === SellMicro.DONE,
    })
    onClose()
  }, [capture, itpId, micro, amount, onClose])

  // --- Stepper data ---
  const isDone = micro === SellMicro.DONE

  const microSteps = useMemo((): MicroStep[] => {
    const getLabel = (m: number): string => {
      const desc = MICRO_LABELS[m]
      if (!desc) return ''
      return typeof desc === 'function' ? desc({ isPending }) : desc
    }

    const steps: MicroStep[] = []

    steps.push({
      label: getLabel(SellMicro.SUBMIT),
      txHash: savedSellHash ?? undefined,
      explorerUrl: savedSellHash ? getTxUrl(savedSellHash, 'l3') : undefined,
      chain: 'l3',
    })

    steps.push({
      label: getLabel(SellMicro.BATCH),
      txHash: batchTxHash ?? undefined,
      explorerUrl: batchTxHash ? getTxUrl(batchTxHash, 'l3') : undefined,
      chain: 'l3',
    })

    steps.push({
      label: getLabel(SellMicro.FILL),
      txHash: fillTxHash ?? undefined,
      explorerUrl: fillTxHash ? getTxUrl(fillTxHash, 'l3') : undefined,
      chain: 'l3',
    })

    return steps
  }, [isPending, savedSellHash, batchTxHash, fillTxHash])

  const stepperMicroIndex = useMemo(() => {
    if (isDone) return microSteps.length
    if (micro < 0) return 0
    return Math.max(0, micro)
  }, [micro, isDone, microSteps.length])

  const adjustedRanges = useMemo((): [number, number][] => {
    // 3 items: submit(0), batch(1), fill(2)
    return [
      [0, 1],    // Submit: submit(0)
      [1, 3],    // Process: batch(1), fill(2)
    ]
  }, [])

  const txRefs = useMemo(() => {
    const refs: { label: string; value: string }[] = []
    if (orderId !== null) refs.push({ label: 'L3', value: `#${orderId.toString()}` })
    return refs
  }, [orderId])

  const buttonText = isPending
    ? t('button.pending')
    : isConfirming
    ? t('button.submitting')
    : t('button.sell_shares')

  const renderFillDetails = () => {
    if (!fillPrice || !fillAmount) return null

    const proceeds = usdcProceeds ?? ((fillAmount * fillPrice) / BigInt(1e18))

    return (
      <div className="bg-muted border border-border-light rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-text-primary">{t('fill_details.title')}</p>
        <div className="text-xs font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-text-muted">{t('fill_details.fill_price')}</span>
            <span className="text-text-primary tabular-nums">${parseFloat(formatUnits(fillPrice, 18)).toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">{t('fill_details.shares_sold')}</span>
            <span className="text-text-primary tabular-nums">{parseFloat(formatUnits(fillAmount, 18)).toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">{t('fill_details.usdc_proceeds')}</span>
            <span className="text-text-primary tabular-nums">${parseFloat(formatUnits(proceeds, COLLATERAL_DECIMALS)).toFixed(2)}</span>
          </div>
          {costBasis && costBasis.avgCostPerShare > 0n && fillPrice > 0n && (() => {
            const costOfShares = (fillAmount * costBasis.avgCostPerShare) / BigInt(1e18)
            const pnl = proceeds - costOfShares
            const pnlPct = Number(costOfShares) > 0 ? Number(pnl) * 100 / Number(costOfShares) : 0
            return (
              <div className="flex justify-between pt-1 border-t border-border-light">
                <span className="text-text-muted">{t('fill_details.pnl_vs_cost')}</span>
                <span className={pnl >= 0n ? 'text-color-up' : 'text-color-down'}>
                  {pnl >= 0n ? '+' : ''}${parseFloat(formatUnits(pnl, COLLATERAL_DECIMALS)).toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                </span>
              </div>
            )
          })()}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div className="bg-card border border-border-light rounded-xl shadow-modal max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">{t('title', { name: itpName })}</h2>
            <button onClick={handleClose} className="text-text-muted hover:text-text-primary text-2xl leading-none">&times;</button>
          </div>
          {itpSymbol && <p className="text-text-secondary mb-1 font-mono">${itpSymbol}</p>}
          <p className="text-xs text-text-muted font-mono mb-4 break-all">{t('itp_id_label')} {itpId}</p>

          {videoUrl && (() => {
            const vid = extractYouTubeId(videoUrl)
            if (!vid) return null
            return (
              <div className="rounded-lg overflow-hidden mb-4">
                <YouTubeLite videoId={vid} title={itpName || 'ITP'} />
              </div>
            )
          })()}

          {!isConnected ? (
            <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
              <p className="text-text-secondary">{tc('wallet.connect_to_sell')}</p>
            </div>
          ) : micro >= 0 ? (
            <div className="space-y-4">
              <TransactionStepper
                visibleSteps={VISIBLE_STEPS}
                microSteps={microSteps}
                currentMicroStep={stepperMicroIndex}
                isDone={isDone}
                stepRanges={adjustedRanges}
                txRefs={txRefs}
              />

              {renderFillDetails()}

              {isDone && l3UsdcBalance > 0n && (
                <div className="bg-muted border border-border-light rounded-xl p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1">{t('usdc_balance_label')}</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums font-mono">{formatUnits(l3UsdcBalance, COLLATERAL_DECIMALS)} USDC</p>
                </div>
              )}

              {isDone ? (
                <button
                  onClick={handleReset}
                  className="w-full py-3 bg-color-down text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  {t('sell_more')}
                </button>
              ) : micro <= SellMicro.SUBMIT ? (
                <button
                  onClick={handleCancel}
                  className="w-full text-center text-sm text-text-muted hover:text-text-primary py-2 transition-colors"
                >
                  {tc('actions.cancel')}
                </button>
              ) : null}

              {stuckWarning && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-orange-500 text-sm">
                  <p className="font-medium">{tc('warnings.tx_stuck_title')}</p>
                  <p className="text-xs mt-1">{tc('warnings.tx_stuck_description')}</p>
                </div>
              )}

              {txError && (
                <div className="bg-surface-down border border-color-down/30 rounded-lg p-4 text-color-down">
                  <p className="font-medium">{t('error.title')}</p>
                  <p className="text-sm mt-1 break-all">{txError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted border border-border-light rounded-xl p-4 flex justify-between items-center">
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('your_shares_label')}</span>
                <span className="text-2xl font-bold text-text-primary tabular-nums font-mono">{parseFloat(formatUnits(userShares, 18)).toFixed(4)}</span>
              </div>

              {userShares === 0n ? (
                <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
                  <p className="text-text-secondary">{t('no_shares')}</p>
                </div>
              ) : (
                <>
                  <div className="bg-muted border border-border-light rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('shares_to_sell_label')}</label>
                      <button
                        onClick={() => setAmount(formatUnits(userShares, 18))}
                        className="text-xs text-zinc-700 hover:text-zinc-900"
                      >
                        {tc('actions.max')}
                      </button>
                    </div>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g., 10"
                      min="0"
                      step="0.01"
                      className="w-full bg-card border border-border-medium rounded-lg px-4 py-3 text-text-primary text-lg font-mono tabular-nums focus:border-zinc-600 focus:outline-none"
                    />
                    {insufficientShares && (
                      <p className="text-color-down text-xs mt-1">{t('insufficient_shares')}</p>
                    )}
                  </div>

                  <div className="bg-muted border border-border-light rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('min_price_label')}</label>
                      {navPerShare > 0 && (
                        <span className="text-xs text-text-secondary font-mono">
                          {t('nav_label', { nav: navPerShare.toFixed(6), priced: pricedAssetCount, total: totalAssetCount })}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      placeholder={isNavLoading ? t('computing_price') : navPerShare === 0 ? t('set_min_price') : t('no_limit')}
                      min="0"
                      step="0.01"
                      className="w-full bg-card border border-border-medium rounded-lg px-4 py-2 text-text-primary font-mono tabular-nums focus:border-zinc-600 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setShowSlippage(s => !s)}
                      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
                      title={t('slippage_label')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826-3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-mono">{SLIPPAGE_TIERS[slippageTier].label}</span>
                    </button>
                  </div>
                  {showSlippage && (
                    <div className="bg-muted border border-border-light rounded-xl p-4">
                      <label className="block text-xs font-medium uppercase tracking-wider text-text-muted mb-3">{t('slippage_label')}</label>
                      <div className="flex gap-2">
                        {SLIPPAGE_TIERS.map(tier => (
                          <button
                            key={tier.value}
                            onClick={() => setSlippageTier(tier.value)}
                            className={`flex-1 py-2 rounded-lg border text-sm font-mono transition-colors ${
                              slippageTier === tier.value
                                ? 'border-zinc-900 text-white bg-zinc-900'
                                : 'border-border-medium text-text-muted hover:border-zinc-500'
                            }`}
                          >
                            {tier.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* P&L Preview */}
                  {parsedAmount > 0n && costBasis && costBasis.avgCostPerShare > 0n && (
                    <div className="bg-muted border border-border-light rounded-xl p-4 space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">{t('estimated_pnl.title')}</p>
                      <div className="text-xs font-mono space-y-1">
                        <div className="flex justify-between">
                          <span className="text-text-muted">{t('estimated_pnl.avg_cost_basis')}</span>
                          <span className="text-text-primary tabular-nums">${parseFloat(formatUnits(costBasis.avgCostPerShare, 18)).toFixed(4)}/share</span>
                        </div>
                        {navPerShareBn > 0n && (() => {
                          const estimatedProceeds = (parsedAmount * navPerShareBn) / BigInt(1e18)
                          const costOfShares = (parsedAmount * costBasis.avgCostPerShare) / BigInt(1e18)
                          const estimatedPnL = estimatedProceeds - costOfShares
                          const pnlPct = Number(estimatedPnL) * 100 / Number(costOfShares)
                          return (
                            <>
                              <div className="flex justify-between">
                                <span className="text-text-muted">{t('estimated_pnl.current_nav')}</span>
                                <span className="text-text-primary tabular-nums">${navPerShare.toFixed(6)}/share</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-muted">{t('estimated_pnl.est_proceeds')}</span>
                                <span className="text-text-primary tabular-nums">${parseFloat(formatUnits(estimatedProceeds, 18)).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-border-light">
                                <span className="text-text-muted">{t('estimated_pnl.est_pnl')}</span>
                                <span className={estimatedPnL >= 0n ? 'text-color-up' : 'text-color-down'}>
                                  {estimatedPnL >= 0n ? '+' : ''}${parseFloat(formatUnits(estimatedPnL, 18)).toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                                </span>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  )}

                  <WalletActionButton
                    onClick={handleSell}
                    disabled={!amount || parsedAmount === 0n || insufficientShares || isPending || isConfirming}
                    className="w-full py-4 bg-color-down text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  >
                    {buttonText}
                  </WalletActionButton>

                  {(isPending || isConfirming) && (
                    <button
                      onClick={handleCancel}
                      className="w-full text-center text-sm text-text-muted hover:text-text-primary py-2 transition-colors"
                    >
                      Cancel
                    </button>
                  )}

                  {stuckWarning && (
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-orange-500 text-sm">
                      <p className="font-medium">Transaction may be stuck</p>
                      <p className="text-xs mt-1">Not confirmed after 30s. You can cancel and try again.</p>
                    </div>
                  )}

                  {txError && (
                    <div className="bg-surface-down border border-color-down/30 rounded-lg p-4 text-color-down">
                      <p className="font-medium">{t('error.title')}</p>
                      <p className="text-sm mt-1 break-all">{txError}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
