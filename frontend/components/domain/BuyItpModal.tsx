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
import { useNonceCheck } from '@/hooks/useNonceCheck'
import { useItpNav } from '@/hooks/useItpNav'
import { useSSEOrders, useSSEBalances, type UserOrder } from '@/hooks/useSSE'
import { useToast } from '@/lib/contexts/ToastContext'
import { YouTubeLite, extractYouTubeId } from '@/components/ui/YouTubeLite'
import { useTranslations } from 'next-intl'
import { usePostHogTracker } from '@/hooks/usePostHog'

/**
 * Buy flow micro-steps — Direct L3 path (4 steps + Done):
 *
 * Step 1 "Submit":   APPROVE (0), SUBMIT (1)
 * Step 2 "Process":  BATCH (2), FILL (3)
 * Done:              DONE (4)
 */
enum BuyMicro {
  APPROVE = 0,
  SUBMIT = 1,
  BATCH = 2,
  FILL = 3,
  DONE = 4,
}

const MINT_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

interface BuyItpModalProps {
  itpId: string
  videoUrl?: string
  onClose: () => void
}

export function BuyItpModal({ itpId, videoUrl, onClose }: BuyItpModalProps) {
  const t = useTranslations('buy-modal')
  const tc = useTranslations('common')
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { showSuccess } = useToast()

  const VISIBLE_STEPS: VisibleStep[] = [
    { label: t('steps.submit') },
    { label: t('steps.process') },
  ]

  const MICRO_LABELS: Record<number, string | ((ctx: { isPending: boolean }) => string)> = {
    [BuyMicro.APPROVE]: (ctx) => ctx.isPending ? t('micro_steps.approve_pending') : t('micro_steps.approve_confirming'),
    [BuyMicro.SUBMIT]: (ctx) => ctx.isPending ? t('micro_steps.submit_pending') : t('micro_steps.submit_confirming'),
    [BuyMicro.BATCH]: () => t('micro_steps.batch'),
    [BuyMicro.FILL]: () => t('micro_steps.fill'),
    [BuyMicro.DONE]: () => t('micro_steps.shares_received'),
  }

  const SLIPPAGE_TIERS = [
    { value: 0, label: '0.3%', description: t('slippage_tight') },
    { value: 1, label: '1%', description: t('slippage_normal') },
    { value: 2, label: '3%', description: t('slippage_relaxed') },
  ]

  // SSE-driven order & balance tracking
  const sseOrders = useSSEOrders()
  const sseBalances = useSSEBalances()

  const [amount, setAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [slippageTier, setSlippageTier] = useState(2)
  const [showSlippage, setShowSlippage] = useState(false)
  const [deadlineHours, setDeadlineHours] = useState(1)
  const [micro, setMicro] = useState<number>(-1) // -1 = INPUT mode
  const [orderId, setOrderId] = useState<bigint | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [fillPrice, setFillPrice] = useState<bigint | null>(null)
  const [fillAmount, setFillAmount] = useState<bigint | null>(null)
  const [initialSharesBn, setInitialSharesBn] = useState<bigint | null>(null)
  const [skippedApproval, setSkippedApproval] = useState(false)
  const [processStalled, setProcessStalled] = useState(false)

  // Saved tx hashes
  const [savedApproveHash, setSavedApproveHash] = useState<string | null>(null)
  const [savedBuyHash, setSavedBuyHash] = useState<string | null>(null)
  const [submittedLimitPrice, setSubmittedLimitPrice] = useState<string>('')
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null)
  const [fillTxHash, setFillTxHash] = useState<string | null>(null)

  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useChainWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  const {
    writeContract: writeBuy,
    data: buyHash,
    isPending: isBuyPending,
    error: buyError,
    reset: resetBuy,
  } = useChainWriteContract()
  const { isLoading: isBuyConfirming, isSuccess: isBuySuccess, data: buyReceipt } = useWaitForTransactionReceipt({ hash: buyHash })

  const { hasNonceGap, pendingCount, refresh: refreshNonce } = useNonceCheck()
  const [stuckWarning, setStuckWarning] = useState(false)

  const approveHandled = useRef(false)
  const buyHandled = useRef(false)
  const toastFired = useRef(false)
  const buyStartTime = useRef<number>(0)
  const amountTracked = useRef(false)

  const { capture } = usePostHogTracker()

  // Keep useUserState for ITP name/symbol (fetches from backend)
  const userState = useUserState(itpId)
  const itpName = userState.bridgedItpName || 'ITP'
  const itpSymbol = userState.bridgedItpSymbol || ''

  // L3 USDC balance (18 decimals) — read directly from chain
  const { data: l3UsdcRaw, refetch: refetchL3Usdc } = useReadContract({
    address: INDEX_PROTOCOL.l3Usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected, refetchInterval: 5_000 },
  })
  const usdcBalance = (l3UsdcRaw as bigint) ?? 0n

  // L3 USDC allowance for Index contract
  const { data: l3AllowanceRaw, refetch: refetchL3Allowance } = useReadContract({
    address: INDEX_PROTOCOL.l3Usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, INDEX_PROTOCOL.index] : undefined,
    query: { enabled: !!address && isConnected, refetchInterval: 5_000 },
  })
  const usdcAllowance = (l3AllowanceRaw as bigint) ?? 0n

  // L3 user shares for this ITP
  const { data: l3SharesRaw } = useReadContract({
    address: INDEX_PROTOCOL.index,
    abi: INDEX_ABI,
    functionName: 'getUserShares',
    args: address ? [itpId as `0x${string}`, address] : undefined,
    query: { enabled: !!address && isConnected && !!itpId, refetchInterval: 5_000 },
  })
  const userShares = (l3SharesRaw as bigint) ?? 0n

  const { navPerShare, navPerShareBn, totalAssetCount, pricedAssetCount, isLoading: isNavLoading } = useItpNav(itpId)

  const navPriceSet = useRef(false)
  useEffect(() => {
    if (navPriceSet.current || isNavLoading) return
    if (navPerShareBn > 0n) {
      const priceWithBuffer = (navPerShareBn * 105n) / 100n
      setLimitPrice(formatUnits(priceWithBuffer, 18))
      navPriceSet.current = true
    }
  }, [navPerShareBn, isNavLoading])

  // --- PostHog: buy_modal_opened ---
  useEffect(() => {
    capture('buy_modal_opened', { itp_id: itpId, itp_name: itpName, current_nav: navPerShare })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- PostHog: buy_amount_entered (fire once) ---
  useEffect(() => {
    if (amount && !amountTracked.current) {
      amountTracked.current = true
      capture('buy_amount_entered', { itp_id: itpId, amount_usd: amount, user_balance: formattedBalance })
    }
  }, [amount]) // eslint-disable-line react-hooks/exhaustive-deps

  const refetchAllowance = useCallback(async () => {
    await refetchL3Allowance()
    await refetchL3Usdc()
  }, [refetchL3Allowance, refetchL3Usdc])

  const {
    writeContract: writeMint,
    data: mintHashTx,
    isPending: isMintPending,
    error: mintError,
    reset: resetMint,
  } = useChainWriteContract()
  const { isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash: mintHashTx })

  // Mint L3_WUSDC (18 decimals) for testing
  const handleMintTestUsdc = useCallback(() => {
    if (!address) return
    resetMint()
    writeMint({
      address: INDEX_PROTOCOL.l3Usdc,
      abi: MINT_ABI,
      functionName: 'mint',
      args: [address, parseUnits('10000', COLLATERAL_DECIMALS)],
    })
  }, [address, writeMint, resetMint])

  // Amount in 18 decimals (L3_WUSDC)
  const parsedAmount = amount ? parseUnits(amount, COLLATERAL_DECIMALS) : 0n
  const needsApproval = parsedAmount > 0n && usdcAllowance < parsedAmount

  const snapshotBalances = useCallback(() => {
    setInitialSharesBn(userShares)
  }, [userShares])

  const handleApprove = useCallback(() => {
    if (!amount) return
    buyStartTime.current = Date.now()
    capture('buy_submitted', {
      itp_id: itpId, amount_usd: amount, slippage: SLIPPAGE_TIERS[slippageTier].label,
      deadline_hours: deadlineHours, is_limit_order: Boolean(limitPrice && parseFloat(limitPrice) > 0),
    })
    approveHandled.current = false
    setTxError(null)
    setSkippedApproval(false)
    snapshotBalances()
    setMicro(BuyMicro.APPROVE)
    // Approve L3_WUSDC → Index contract
    writeApprove({
      address: INDEX_PROTOCOL.l3Usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [INDEX_PROTOCOL.index, parsedAmount],
    })
  }, [amount, parsedAmount, writeApprove, snapshotBalances])

  const handleBuy = useCallback(async () => {
    if (!publicClient || !amount) return
    buyHandled.current = false
    setTxError(null)

    if (micro < 0) {
      buyStartTime.current = Date.now()
      capture('buy_submitted', {
        itp_id: itpId, amount_usd: amount, slippage: SLIPPAGE_TIERS[slippageTier].label,
        deadline_hours: deadlineHours, is_limit_order: Boolean(limitPrice && parseFloat(limitPrice) > 0),
      })
      setSkippedApproval(true)
      snapshotBalances()
    }
    setMicro(BuyMicro.SUBMIT)

    let blockTimestamp: bigint
    try {
      const block = await publicClient.getBlock()
      blockTimestamp = block.timestamp
    } catch {
      blockTimestamp = BigInt(Math.floor(Date.now() / 1000))
    }

    const deadline = blockTimestamp + BigInt(deadlineHours * 3600)
    const priceBn = limitPrice ? parseUnits(limitPrice, 18) : 0n
    setSubmittedLimitPrice(limitPrice)

    // Direct L3: Index.submitOrder(itpId, BUY=0, amount, limitPrice, slippageTier, deadline)
    writeBuy({
      address: INDEX_PROTOCOL.index,
      abi: INDEX_ABI,
      functionName: 'submitOrder',
      args: [
        itpId as `0x${string}`,
        0, // side = BUY
        parsedAmount,
        priceBn,
        BigInt(slippageTier),
        deadline,
      ],
    })
  }, [publicClient, amount, limitPrice, deadlineHours, slippageTier, itpId, parsedAmount, writeBuy, micro, snapshotBalances])

  // Approve success -> save hash, auto-trigger buy
  useEffect(() => {
    if (!isApproveSuccess || approveHandled.current) return
    approveHandled.current = true
    if (approveHash) setSavedApproveHash(approveHash)
    refetchAllowance().then(() => {
      resetApprove()
      handleBuy()
    })
  }, [isApproveSuccess, approveHash, refetchAllowance, resetApprove, handleBuy])

  // Buy success -> save hash, extract orderId from OrderSubmitted, advance to BATCH
  useEffect(() => {
    if (!isBuySuccess || !buyReceipt || buyHandled.current) return
    buyHandled.current = true
    if (buyHash) setSavedBuyHash(buyHash)

    // Extract orderId from OrderSubmitted event on Index contract
    for (const log of buyReceipt.logs) {
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

    // Direct L3 → skip straight to BATCH (order is already on L3, no bridging)
    setMicro(BuyMicro.BATCH)
    resetBuy()
    // Persist pending order
    try {
      const pending = JSON.parse(localStorage.getItem('index-pending-orders') || '[]')
      pending.push({ itpId, side: 0, amount, timestamp: Date.now(), txHash: buyHash })
      localStorage.setItem('index-pending-orders', JSON.stringify(pending))
    } catch {}
    window.dispatchEvent(new Event('portfolio-refresh'))
  }, [isBuySuccess, buyReceipt, resetBuy, itpId, amount, buyHash])

  // Stall detection: show "safe to close" message after 60s at BATCH/FILL
  useEffect(() => {
    if (micro < BuyMicro.BATCH || micro >= BuyMicro.DONE) {
      setProcessStalled(false)
      return
    }
    const timer = setTimeout(() => setProcessStalled(true), 60_000)
    return () => clearTimeout(timer)
  }, [micro])

  // SSE-driven order tracking: BATCH -> FILL -> DONE
  const trackedOrder = useMemo((): UserOrder | undefined => {
    if (micro < BuyMicro.BATCH || micro >= BuyMicro.DONE) return undefined
    if (orderId !== null) {
      return sseOrders.find(o => o.order_id === Number(orderId))
    }
    const candidates = sseOrders
      .filter(o => o.itp_id === itpId && o.side === 0)
      .sort((a, b) => b.timestamp - a.timestamp)
    return candidates[0]
  }, [sseOrders, orderId, micro, itpId])

  useEffect(() => {
    if (!trackedOrder || micro < BuyMicro.BATCH || micro >= BuyMicro.DONE) return

    if (orderId === null) {
      setOrderId(BigInt(trackedOrder.order_id))
    }

    const status = trackedOrder.status

    if (status >= 2 && micro < BuyMicro.DONE) {
      // FILLED
      if (trackedOrder.fill_price) {
        try { setFillPrice(BigInt(trackedOrder.fill_price)) } catch {}
      }
      if (trackedOrder.fill_amount) {
        try { setFillAmount(BigInt(trackedOrder.fill_amount)) } catch {}
      }
      setMicro(BuyMicro.DONE)
    } else if (status >= 1 && micro < BuyMicro.FILL) {
      // BATCHED
      setMicro(BuyMicro.FILL)
    }
  }, [trackedOrder, micro, orderId])

  // --- PostHog: buy_step_reached ---
  useEffect(() => {
    if (micro < 0) return
    const stepName = BuyMicro[micro] || `step_${micro}`
    capture('buy_step_reached', {
      itp_id: itpId, step_name: stepName, step_index: micro,
      time_since_submit_ms: buyStartTime.current ? Date.now() - buyStartTime.current : 0,
    })
  }, [micro]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect L3 shares increase — completion signal (fallback when SSE unavailable)
  useEffect(() => {
    if (micro < BuyMicro.BATCH || micro >= BuyMicro.DONE) return

    if (initialSharesBn !== null && userShares > initialSharesBn) {
      // Clean up pending order
      try {
        const pending = JSON.parse(localStorage.getItem('index-pending-orders') || '[]')
        localStorage.setItem('index-pending-orders', JSON.stringify(
          pending.filter((o: any) => o.txHash !== savedBuyHash)
        ))
      } catch {}
      setMicro(BuyMicro.DONE)
    }
  }, [micro, userShares, initialSharesBn, savedBuyHash])

  // Toast notification on fill
  useEffect(() => {
    if (micro === BuyMicro.DONE && !toastFired.current) {
      toastFired.current = true
      capture('buy_completed', {
        itp_id: itpId, amount_usd: amount,
        fill_price: fillPrice ? formatUnits(fillPrice, 18) : null,
        total_time_ms: buyStartTime.current ? Date.now() - buyStartTime.current : 0,
      })
      const shares = fillAmount && fillPrice && fillPrice > 0n
        ? parseFloat(formatUnits((fillAmount * BigInt(1e18)) / fillPrice, 18)).toFixed(2)
        : null
      const msg = shares
        ? t('toast.buy_filled_shares', { shares, name: itpName })
        : t('toast.buy_filled', { name: itpName })
      showSuccess(msg)
    }
    if (micro === -1) toastFired.current = false
  }, [micro, fillAmount, fillPrice, itpName, showSuccess])

  // Error handlers
  useEffect(() => {
    if (approveError) {
      const msg = approveError.message || 'Approval failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      capture('buy_failed', {
        itp_id: itpId, step_name: micro >= 0 ? BuyMicro[micro] : 'INPUT', step_index: micro,
        error_message: shortMsg, time_since_submit_ms: buyStartTime.current ? Date.now() - buyStartTime.current : 0,
      })
      setTxError(shortMsg)
      setMicro(-1)
      resetApprove()
    }
  }, [approveError, resetApprove]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (buyError) {
      const msg = buyError.message || 'Buy transaction failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      capture('buy_failed', {
        itp_id: itpId, step_name: micro >= 0 ? BuyMicro[micro] : 'INPUT', step_index: micro,
        error_message: shortMsg, time_since_submit_ms: buyStartTime.current ? Date.now() - buyStartTime.current : 0,
      })
      setTxError(shortMsg)
      setMicro(-1)
      resetBuy()
    }
  }, [buyError, resetBuy]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stuck tx warning
  useEffect(() => {
    if (!isApproveConfirming && !isBuyConfirming) { setStuckWarning(false); return }
    const timer = setTimeout(() => setStuckWarning(true), 30_000)
    return () => clearTimeout(timer)
  }, [isApproveConfirming, isBuyConfirming])

  const clearTxHashes = useCallback(() => {
    setSavedApproveHash(null)
    setSavedBuyHash(null)
    setBatchTxHash(null)
    setFillTxHash(null)
  }, [])

  const handleCancel = useCallback(() => {
    resetApprove()
    resetBuy()
    setMicro(-1)
    setTxError(null)
    setStuckWarning(false)
    clearTxHashes()
    refreshNonce()
  }, [resetApprove, resetBuy, clearTxHashes, refreshNonce])

  const handleReset = useCallback(() => {
    setMicro(-1)
    setOrderId(null)
    setAmount('')
    setFillPrice(null)
    setFillAmount(null)
    setInitialSharesBn(null)
    setSkippedApproval(false)
    clearTxHashes()
  }, [clearTxHashes])

  // --- PostHog: buy_modal_closed ---
  const handleClose = useCallback(() => {
    capture('buy_modal_closed', {
      itp_id: itpId, last_step: micro >= 0 ? BuyMicro[micro] : 'INPUT', had_entered_amount: Boolean(amount),
    })
    onClose()
  }, [capture, itpId, micro, amount, onClose])

  const formattedBalance = usdcBalance > 0n ? formatUnits(usdcBalance, COLLATERAL_DECIMALS) : '0'
  const isProcessing = isApprovePending || isApproveConfirming || isBuyPending || isBuyConfirming
  const isPending = isApprovePending || isBuyPending
  const isDone = micro === BuyMicro.DONE

  const buttonText = isApprovePending
    ? t('button.approve_pending')
    : isApproveConfirming
    ? t('button.approve_confirming')
    : isBuyPending
    ? t('button.buy_pending')
    : isBuyConfirming
    ? t('button.buy_confirming')
    : needsApproval
    ? t('button.approve_and_buy')
    : t('button.buy_itp')

  // --- Stepper data ---

  const microSteps = useMemo((): MicroStep[] => {
    const getLabel = (m: number): string => {
      const desc = MICRO_LABELS[m]
      if (!desc) return ''
      return typeof desc === 'function' ? desc({ isPending }) : desc
    }

    const steps: MicroStep[] = []

    if (!skippedApproval) {
      steps.push({
        label: getLabel(BuyMicro.APPROVE),
        txHash: savedApproveHash ?? undefined,
        explorerUrl: savedApproveHash ? getTxUrl(savedApproveHash, 'l3') : undefined,
        chain: 'l3',
      })
    }

    steps.push({
      label: getLabel(BuyMicro.SUBMIT),
      txHash: savedBuyHash ?? undefined,
      explorerUrl: savedBuyHash ? getTxUrl(savedBuyHash, 'l3') : undefined,
      chain: 'l3',
    })

    steps.push({
      label: getLabel(BuyMicro.BATCH),
      txHash: batchTxHash ?? undefined,
      explorerUrl: batchTxHash ? getTxUrl(batchTxHash, 'l3') : undefined,
      chain: 'l3',
    })

    steps.push({
      label: getLabel(BuyMicro.FILL),
      txHash: fillTxHash ?? undefined,
      explorerUrl: fillTxHash ? getTxUrl(fillTxHash, 'l3') : undefined,
      chain: 'l3',
    })

    return steps
  }, [isPending, skippedApproval, savedApproveHash, savedBuyHash, batchTxHash, fillTxHash])

  const stepperMicroIndex = useMemo(() => {
    if (isDone) return microSteps.length
    if (micro < 0) return 0
    const offset = skippedApproval ? -1 : 0
    return Math.max(0, micro + offset)
  }, [micro, skippedApproval, isDone, microSteps.length])

  const adjustedRanges = useMemo((): [number, number][] => {
    if (skippedApproval) {
      // 3 items: submit(0), batch(1), fill(2)
      return [
        [0, 1],    // Submit: submit(0)
        [1, 3],    // Process: batch(1), fill(2)
      ]
    }
    return [
      [0, 2],    // Submit: approve(0), submit(1)
      [2, 4],    // Process: batch(2), fill(3)
    ]
  }, [skippedApproval])

  const txRefs = useMemo(() => {
    const refs: { label: string; value: string }[] = []
    if (orderId !== null) refs.push({ label: 'L3', value: `#${orderId.toString()}` })
    return refs
  }, [orderId])

  const renderFillDetails = () => {
    if (!fillPrice || !fillAmount) return null
    return (
      <div className="bg-muted border border-border-light rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-text-primary">{t('fill_details.title')}</p>
        <div className="text-xs font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-text-muted">{t('fill_details.fill_price')}</span>
            <span className="text-text-primary tabular-nums">${parseFloat(formatUnits(fillPrice, 18)).toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">{t('fill_details.amount_filled')}</span>
            <span className="text-text-primary tabular-nums">{parseFloat(formatUnits(fillAmount, COLLATERAL_DECIMALS)).toFixed(4)} USDC</span>
          </div>
          {fillPrice > 0n && (
            <div className="flex justify-between">
              <span className="text-text-muted">{t('fill_details.shares')}</span>
              <span className="text-text-primary tabular-nums">
                {parseFloat(formatUnits((fillAmount * BigInt(1e18)) / fillPrice, 18)).toFixed(4)}
              </span>
            </div>
          )}
          {submittedLimitPrice && parseFloat(submittedLimitPrice) > 0 && fillPrice > 0n && (() => {
            const limitBn = BigInt(Math.floor(parseFloat(submittedLimitPrice) * 1e18))
            const slippage = Number(fillPrice - limitBn) * 100 / Number(limitBn)
            return (
              <div className="flex justify-between">
                <span className="text-text-muted">{t('fill_details.vs_limit')}</span>
                <span className={slippage <= 0 ? 'text-color-up' : slippage < 1 ? 'text-color-up' : slippage < 3 ? 'text-color-warning' : 'text-color-down'}>
                  {slippage > 0 ? '+' : ''}{slippage.toFixed(2)}%
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
              <p className="text-text-secondary">{tc('wallet.connect_to_buy')}</p>
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
              {processStalled && (
                <div className="bg-muted border border-border-light rounded-lg p-4 text-sm">
                  <p className="font-medium text-text-primary mb-1">{t('stall.title')}</p>
                  <p className="text-text-secondary">{t('stall.description')}</p>
                </div>
              )}
              {renderFillDetails()}

              {userShares > 0n && (
                <div className="bg-muted border border-border-light rounded-xl p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1">{t('your_itp_shares')}</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums font-mono">{parseFloat(formatUnits(userShares, 18)).toFixed(4)}</p>
                </div>
              )}

              {isDone ? (
                <button
                  onClick={handleReset}
                  className="w-full py-3 bg-color-up text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  {t('buy_more')}
                </button>
              ) : (micro <= BuyMicro.SUBMIT) ? (
                <button
                  onClick={handleCancel}
                  className="w-full text-center text-sm text-text-muted hover:text-text-primary py-2 transition-colors"
                >
                  {tc('actions.cancel')}
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="w-full text-center text-sm text-text-muted hover:text-text-primary py-2 transition-colors"
                >
                  {tc('actions.close')}
                </button>
              )}

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
              <div className="bg-muted border border-border-light rounded-xl p-4 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('amount_label')}</label>
                    <span className="text-xs text-text-muted font-mono">{t('balance_label', { amount: parseFloat(formattedBalance).toFixed(2) })}</span>
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g., 100"
                    min="0"
                    step="1"
                    className="w-full bg-card border border-border-medium rounded-lg px-4 py-3 text-text-primary text-lg font-mono tabular-nums focus:border-zinc-600 focus:outline-none"
                  />
                  {amount && parsedAmount > usdcBalance && (
                    <p className="text-color-down text-xs mt-1">{t('insufficient_usdc')}</p>
                  )}
                </div>
                {usdcBalance === 0n && (
                  <div className="flex items-center gap-3 pt-2 border-t border-border-light">
                    <button
                      onClick={handleMintTestUsdc}
                      disabled={isMintPending}
                      className="px-3 py-1.5 text-xs bg-muted text-text-secondary border border-border-medium rounded hover:border-zinc-500 disabled:opacity-50 transition-colors"
                    >
                      {isMintPending ? t('minting') : t('mint_test_usdc')}
                    </button>
                    {isMintSuccess && <span className="text-xs text-color-up">{t('minted')}</span>}
                    {mintError && <span className="text-xs text-color-down">{t('mint_failed')}</span>}
                  </div>
                )}
              </div>

              <div className="bg-muted border border-border-light rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('max_price_label')}</label>
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
                  placeholder={isNavLoading ? t('computing_price') : navPerShare === 0 ? t('set_limit_price') : t('no_limit')}
                  min="0"
                  step="0.01"
                  className="w-full bg-card border border-border-medium rounded-lg px-4 py-2 text-text-primary font-mono tabular-nums focus:border-zinc-600 focus:outline-none"
                />
                {!isNavLoading && navPerShare === 0 && (
                  <p className="text-color-warning text-xs mt-2">
                    {t('no_prices_warning')}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowSlippage(s => !s)}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
                  title={t('slippage_label')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
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
                        onClick={() => { setSlippageTier(tier.value); capture('buy_slippage_changed', { itp_id: itpId, slippage_tier: tier.label }) }}
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

              {hasNonceGap && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-orange-500 text-sm">
                  <p className="font-medium">{tc('warnings.pending_tx_title')}</p>
                  <p className="text-xs mt-1">{tc('warnings.pending_tx_description', { count: pendingCount })}</p>
                </div>
              )}

              <WalletActionButton
                onClick={needsApproval ? handleApprove : handleBuy}
                disabled={!amount || parsedAmount === 0n || isProcessing || parsedAmount > usdcBalance || hasNonceGap}
                className="w-full py-4 bg-color-up text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {buttonText}
              </WalletActionButton>

              {isProcessing && (
                <button
                  onClick={handleCancel}
                  className="w-full text-center text-sm text-text-muted hover:text-text-primary py-2 transition-colors"
                >
                  {tc('actions.cancel')}
                </button>
              )}

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
          )}
        </div>
      </div>
    </div>
  )
}
