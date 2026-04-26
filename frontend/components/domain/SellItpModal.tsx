'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAccount, useWaitForTransactionReceipt, useWriteContract, useSwitchChain, usePublicClient, useReadContract } from 'wagmi'
import { parseUnits, formatUnits, decodeEventLog } from 'viem'
import { INDEX_PROTOCOL, COLLATERAL_DECIMALS } from '@/lib/contracts/addresses'
import { ERC20_ABI, INDEX_ABI, SETTLEMENT_CUSTODY_ABI, BRIDGED_ITP_ABI } from '@/lib/contracts/index-protocol-abi'
import { BridgedItpFactoryABI } from '@/lib/contracts/generated/bridged_itp_factory-abi'
import { ensureCorrectChain } from '@/hooks/useChainWrite'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { TransactionStepper } from '@/components/ui/TransactionStepper'
import type { MicroStep, VisibleStep } from '@/components/ui/TransactionStepper'
import { getTxUrl } from '@/lib/utils/explorer'
import { useUserState } from '@/hooks/useUserState'
import { useItpCostBasis } from '@/hooks/useItpCostBasis'
import { useItpNav } from '@/hooks/useItpNav'
import { useSSEOrders, type UserOrder } from '@/hooks/useSSE'
import { useNonceCheck } from '@/hooks/useNonceCheck'
import { useToast } from '@/lib/contexts/ToastContext'
import { YouTubeLite, extractYouTubeId } from '@/components/ui/YouTubeLite'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import itpIdNames from '@/lib/itp-id-names.json'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { SpringModal, SpringBackdrop, glass, ModalClose } from '@/components/ui/spring'
import { InlineOhlcChart } from '@/components/ui/InlineOhlcChart'
import { indexL3, settlementChain, settlementChainId } from '@/lib/wagmi'

/**
 * Sell flow micro-steps — Settlement bridge path (5 steps + Done):
 *
 * Step 1 "Submit on Settlement":  APPROVE (0), SUBMIT (1)
 * Step 2 "Oracle Relay":          RELAY (2) — oracle detects CrossChainSellOrderCreated, burns shares on L3, submits sell order
 * Step 3 "Processing":            BATCH (3), FILL (4)
 * Done:                           DONE (5)
 *
 * User must approve BridgedITP → SettlementBridgeCustody before selling.
 * Custody escrows the BridgedITP, oracle burns them on L3 and submits the sell order.
 * USDC proceeds are delivered to user on Settlement chain via completeSellOrder.
 */
enum SellMicro {
  APPROVE = 0,
  SUBMIT = 1,
  RELAY = 2,
  BATCH = 3,
  FILL = 4,
  DONE = 5,
}

interface SellItpModalProps {
  itpId: string
  videoUrl?: string
  onClose: () => void
}

export function SellItpModal({ itpId, videoUrl, onClose }: SellItpModalProps) {
  const t = useTranslations('sell-modal')
  const tc = useTranslations('common')
  const locale = useLocale()
  const { address, isConnected, chainId: currentChainId } = useAccount()
  const settlementPublicClient = usePublicClient({ chainId: settlementChainId })
  const { showSuccess } = useToast()
  const { capture } = usePostHogTracker()
  const sellStartTime = useRef<number>(0)

  const VISIBLE_STEPS: VisibleStep[] = [
    { label: t('steps.submit') },
    { label: t('steps.process') },
  ]

  const MICRO_LABELS: Record<number, string | ((ctx: { isPending: boolean }) => string)> = {
    [SellMicro.APPROVE]: (ctx) => ctx.isPending ? t('micro_steps.approve_pending') : t('micro_steps.approve_confirming'),
    [SellMicro.SUBMIT]: (ctx) => ctx.isPending ? t('micro_steps.submit_pending') : t('micro_steps.submit_confirming'),
    [SellMicro.RELAY]: () => 'Oracle relaying to L3...',
    [SellMicro.BATCH]: () => t('micro_steps.batch'),
    [SellMicro.FILL]: () => t('micro_steps.fill'),
    [SellMicro.DONE]: () => t('micro_steps.usdc_received'),
  }

  const SLIPPAGE_TIERS = [
    { value: 0, label: '0.3%', description: t('slippage_label') },
    { value: 1, label: '1%', description: t('slippage_label') },
    { value: 2, label: '3%', description: t('slippage_label') },
  ]

  // SSE-driven order tracking
  const sseOrders = useSSEOrders()

  const [amount, setAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('0')
  const [slippageTier, setSlippageTier] = useState(2)
  const [showSlippage, setShowSlippage] = useState(false)
  const [deadlineHours, setDeadlineHours] = useState(1)
  const [micro, setMicro] = useState<number>(-1) // -1 = INPUT mode
  const [orderId, setOrderId] = useState<bigint | null>(null)
  const [settlementOrderId, setSettlementOrderId] = useState<bigint | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [fillPrice, setFillPrice] = useState<bigint | null>(null)
  const [fillAmount, setFillAmount] = useState<bigint | null>(null)
  const [skippedApproval, setSkippedApproval] = useState(false)
  const [processStalled, setProcessStalled] = useState(false)

  // Saved tx hashes
  const [savedApproveHash, setSavedApproveHash] = useState<string | null>(null)
  const [savedSellHash, setSavedSellHash] = useState<string | null>(null)
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null)
  const [fillTxHash, setFillTxHash] = useState<string | null>(null)

  const { switchChainAsync } = useSwitchChain()
  const { hasNonceGap, pendingCount, refresh: refreshNonce } = useNonceCheck()

  // Approve BridgedITP → SettlementBridgeCustody
  const {
    writeContractAsync: writeApproveAsync,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
    chainId: settlementChainId,
  })

  // Sell on Settlement
  const {
    writeContractAsync: writeSellAsync,
    data: sellHash,
    isPending: isSellPending,
    error: sellError,
    reset: resetSell,
  } = useWriteContract()
  const { isLoading: isSellConfirming, isSuccess: isSellSuccess, data: sellReceipt } = useWaitForTransactionReceipt({
    hash: sellHash,
    chainId: settlementChainId,
  })

  const approveHandled = useRef(false)
  const sellHandled = useRef(false)
  const toastFired = useRef(false)

  // Keep useUserState for name/symbol only (backend convenience)
  const userState = useUserState(itpId)
  const staticEntry = (itpIdNames as Record<string, { name: string; ticker: string }>)[itpId.toLowerCase()]
  const itpName = staticEntry?.name || userState.bridgedItpName || 'ITP'
  const itpSymbol = staticEntry?.ticker || userState.bridgedItpSymbol || ''

  // Read BridgedITP address directly from BridgedItpFactory on Settlement chain
  const { data: bridgedItpAddrRaw } = useReadContract({
    address: INDEX_PROTOCOL.settlementBridgedItpFactory,
    abi: BridgedItpFactoryABI,
    functionName: 'deployedItps',
    args: [itpId as `0x${string}`],
    chainId: settlementChainId,
    query: { enabled: !!itpId },
  })
  const bridgedItpAddress = (bridgedItpAddrRaw as `0x${string}` | undefined) &&
    bridgedItpAddrRaw !== '0x0000000000000000000000000000000000000000'
    ? (bridgedItpAddrRaw as `0x${string}`)
    : ''

  // Read BridgedITP balance on Settlement chain
  const { data: bridgedBalanceRaw } = useReadContract({
    address: bridgedItpAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: settlementChainId,
    query: { enabled: !!address && !!bridgedItpAddress, refetchInterval: 5_000 },
  })
  const bridgedItpBalance = (bridgedBalanceRaw as bigint) ?? 0n  // 18 decimals

  // Read BridgedITP allowance for SettlementBridgeCustody on Settlement chain
  const { data: bridgedAllowanceRaw } = useReadContract({
    address: bridgedItpAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, INDEX_PROTOCOL.settlementCustody] : undefined,
    chainId: settlementChainId,
    query: { enabled: !!address && !!bridgedItpAddress, refetchInterval: 5_000 },
  })
  const bridgedItpAllowance = (bridgedAllowanceRaw as bigint) ?? 0n

  // Read L3 shares for diagnostics — if the user has L3 shares but no bridged
  // shares, the bridging pipeline never finished and Sell would silently fail.
  // Surface that mismatch instead of showing a bare zero.
  const { data: l3SharesRaw } = useReadContract({
    address: INDEX_PROTOCOL.index,
    abi: INDEX_ABI,
    functionName: 'getUserShares',
    args: address ? [itpId as `0x${string}`, address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && !!itpId, refetchInterval: 5_000 },
  })
  const l3Shares = (l3SharesRaw as bigint) ?? 0n

  const { costBasis } = useItpCostBasis(itpId, address ?? null)
  const { navPerShare, navPerShareBn, totalAssetCount, pricedAssetCount, isLoading: isNavLoading } = useItpNav(itpId)

  const navPriceSet = useRef(false)
  useEffect(() => {
    if (navPriceSet.current || isNavLoading) return
    if (navPerShareBn > 0n) {
      setLimitPrice(formatUnits(navPerShareBn, 18))
      navPriceSet.current = true
    }
  }, [navPerShareBn, isNavLoading])

  // --- PostHog: sell_modal_opened ---
  useEffect(() => {
    capture('sell_modal_opened', {
      itp_id: itpId,
      user_shares: formatUnits(bridgedItpBalance, 18),
      itp_name: itpName,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const parsedAmount = amount ? parseUnits(amount, 18) : 0n
  const insufficientShares = parsedAmount > 0n && parsedAmount > bridgedItpBalance
  const needsApproval = parsedAmount > 0n && bridgedItpAllowance < parsedAmount

  // Diagnose why YOUR SHARES might be zero. The Sell modal can only burn
  // BridgedITP on Settlement; L3-only shares can't be sold from here.
  const sharesDiagnosis: string | null = (() => {
    if (!address) return null
    if (bridgedItpBalance > 0n) return null
    if (!bridgedItpAddress) return 'No bridged token deployed for this ITP yet — buy through the buy flow once and the bridge will deploy it.'
    if (l3Shares > 0n) {
      return `You hold ${parseFloat(formatUnits(l3Shares, 18)).toFixed(4)} shares on L3 but none mirrored to Settlement. The bridge mint never landed — refresh, or buy a single share to nudge the pipeline.`
    }
    return 'You don\'t own shares of this ITP. Creating an ITP does not seed the creator — buy first.'
  })()

  const handleApprove = useCallback(async () => {
    if (!amount || insufficientShares || !bridgedItpAddress) return
    sellStartTime.current = Date.now()
    capture('sell_submitted', {
      itp_id: itpId,
      shares_amount: amount,
      limit_price: limitPrice,
      slippage_tier: SLIPPAGE_TIERS[slippageTier].label,
      needs_approval: true,
    })
    approveHandled.current = false
    setTxError(null)
    setSkippedApproval(false)
    setMicro(SellMicro.APPROVE)

    try {
      await ensureCorrectChain(currentChainId, switchChainAsync, settlementChainId, settlementChain)
    } catch {
      setTxError('Please switch to the Settlement chain to sell')
      setMicro(-1)
      return
    }

    writeApproveAsync({
      address: bridgedItpAddress,
      abi: BRIDGED_ITP_ABI,
      functionName: 'approve',
      args: [INDEX_PROTOCOL.settlementCustody, parsedAmount],
      chainId: settlementChainId,
    }).catch(() => {
      // Error handled by approveError effect
    })
  }, [amount, parsedAmount, insufficientShares, bridgedItpAddress, writeApproveAsync, currentChainId, switchChainAsync, capture, itpId, limitPrice, slippageTier])

  const handleSell = useCallback(async () => {
    if (!settlementPublicClient || !amount || insufficientShares) return
    sellHandled.current = false
    setTxError(null)

    if (micro < 0) {
      sellStartTime.current = Date.now()
      capture('sell_submitted', {
        itp_id: itpId,
        shares_amount: amount,
        limit_price: limitPrice,
        slippage_tier: SLIPPAGE_TIERS[slippageTier].label,
        needs_approval: false,
      })
      setSkippedApproval(true)
    }
    setMicro(SellMicro.SUBMIT)

    try {
      await ensureCorrectChain(currentChainId, switchChainAsync, settlementChainId, settlementChain)
    } catch {
      setTxError('Please switch to the Settlement chain to sell')
      setMicro(-1)
      return
    }

    let blockTimestamp: bigint
    try {
      const block = await settlementPublicClient.getBlock()
      blockTimestamp = block.timestamp
    } catch {
      blockTimestamp = BigInt(Math.floor(Date.now() / 1000))
    }

    const deadline = blockTimestamp + BigInt(deadlineHours * 3600)
    const priceBn = parseUnits(limitPrice || '0', 18)

    // Settlement: SettlementBridgeCustody.sellITPFromSettlement(itpId, amount, limitPrice, slippageTier, deadline)
    // amount is in 18 decimals (BridgedITP shares)
    writeSellAsync({
      address: INDEX_PROTOCOL.settlementCustody,
      abi: SETTLEMENT_CUSTODY_ABI,
      functionName: 'sellITPFromSettlement',
      args: [
        itpId as `0x${string}`,
        parsedAmount,
        priceBn,
        BigInt(slippageTier),
        deadline,
      ],
      chainId: settlementChainId,
    }).catch(() => {
      // Error handled by sellError effect
    })
  }, [settlementPublicClient, amount, limitPrice, deadlineHours, slippageTier, itpId, parsedAmount, writeSellAsync, micro, insufficientShares, currentChainId, switchChainAsync, capture])

  // Approve success -> auto-trigger sell
  useEffect(() => {
    if (!isApproveSuccess || approveHandled.current) return
    approveHandled.current = true
    if (approveHash) setSavedApproveHash(approveHash)
    resetApprove()
    handleSell()
  }, [isApproveSuccess, approveHash, resetApprove, handleSell])

  // Sell success -> extract orderId from CrossChainSellOrderCreated, advance to RELAY
  useEffect(() => {
    if (!isSellSuccess || !sellReceipt || sellHandled.current) return
    sellHandled.current = true
    if (sellHash) setSavedSellHash(sellHash)

    // Extract orderId from CrossChainSellOrderCreated event on SettlementBridgeCustody
    for (const log of sellReceipt.logs) {
      if (log.address.toLowerCase() === INDEX_PROTOCOL.settlementCustody.toLowerCase()) {
        try {
          const decoded = decodeEventLog({ abi: SETTLEMENT_CUSTODY_ABI, data: log.data, topics: log.topics })
          if (decoded.eventName === 'CrossChainSellOrderCreated') {
            setSettlementOrderId((decoded.args as any).orderId as bigint)
            break
          }
        } catch {}
      }
    }

    // Settlement tx confirmed → advance to RELAY (oracle will burn L3 shares + submit sell order)
    setMicro(SellMicro.RELAY)
    resetSell()
    window.dispatchEvent(new Event('portfolio-refresh'))
  }, [isSellSuccess, sellReceipt, resetSell, itpId, amount, sellHash])

  // Stall detection: show "safe to close" after 60s at RELAY/BATCH/FILL
  useEffect(() => {
    if (micro < SellMicro.RELAY || micro >= SellMicro.DONE) {
      setProcessStalled(false)
      return
    }
    const timer = setTimeout(() => setProcessStalled(true), 60_000)
    return () => clearTimeout(timer)
  }, [micro])

  // SSE-driven order tracking: RELAY -> BATCH -> FILL -> DONE
  const trackedOrder = useMemo((): UserOrder | undefined => {
    if (micro < SellMicro.RELAY || micro >= SellMicro.DONE) return undefined
    if (orderId !== null) {
      return sseOrders.find(o => o.order_id === Number(orderId))
    }
    const candidates = sseOrders
      .filter(o => o.itp_id === itpId && o.side === 1)
      .sort((a, b) => b.timestamp - a.timestamp)
    return candidates[0]
  }, [sseOrders, orderId, micro, itpId])

  useEffect(() => {
    if (!trackedOrder || micro < SellMicro.RELAY || micro >= SellMicro.DONE) return

    if (orderId === null) {
      setOrderId(BigInt(trackedOrder.order_id))
    }

    // Oracle has relayed — L3 order is now visible
    if (micro === SellMicro.RELAY) {
      setMicro(SellMicro.BATCH)
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

  useEffect(() => {
    if (approveError) {
      const msg = approveError.message || 'Approval failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      capture('sell_failed', {
        itp_id: itpId,
        error_message: shortMsg,
        step_name: 'APPROVE',
        step_index: SellMicro.APPROVE,
        time_since_submit_ms: sellStartTime.current ? Date.now() - sellStartTime.current : 0,
      })
      setTxError(shortMsg)
      setMicro(-1)
      resetApprove()
    }
  }, [approveError, resetApprove]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sellError) {
      const msg = sellError.message || 'Transaction failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      capture('sell_failed', {
        itp_id: itpId,
        error_message: shortMsg,
        step_name: micro >= 0 ? SellMicro[micro] : 'INPUT',
        step_index: micro,
        time_since_submit_ms: sellStartTime.current ? Date.now() - sellStartTime.current : 0,
      })
      setTxError(shortMsg)
      setMicro(-1)
      resetSell()
    }
  }, [sellError, resetSell]) // eslint-disable-line react-hooks/exhaustive-deps

  // Toast notification on fill
  useEffect(() => {
    if (micro === SellMicro.DONE && !toastFired.current) {
      toastFired.current = true
      capture('sell_completed', {
        itp_id: itpId,
        shares_amount: amount,
        fill_price: fillPrice ? formatUnits(fillPrice, 18) : null,
        total_time_ms: sellStartTime.current ? Date.now() - sellStartTime.current : 0,
      })
      showSuccess(t('toast.sell_filled', { proceeds: 'USDC' }))
    }
    if (micro === -1) toastFired.current = false
  }, [micro, showSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const [stuckWarning, setStuckWarning] = useState(false)

  useEffect(() => {
    const isConfirming = isApproveConfirming || isSellConfirming
    if (!isConfirming) {
      setStuckWarning(false)
      return
    }
    const timer = setTimeout(() => setStuckWarning(true), 30_000)
    return () => clearTimeout(timer)
  }, [isApproveConfirming, isSellConfirming])

  const clearTxHashes = useCallback(() => {
    setSavedApproveHash(null)
    setSavedSellHash(null)
    setBatchTxHash(null)
    setFillTxHash(null)
  }, [])

  const handleCancel = useCallback(() => {
    resetApprove()
    resetSell()
    setMicro(-1)
    setTxError(null)
    setStuckWarning(false)
    clearTxHashes()
    refreshNonce()
  }, [resetApprove, resetSell, clearTxHashes, refreshNonce])

  const handleReset = useCallback(() => {
    setMicro(-1)
    setOrderId(null)
    setSettlementOrderId(null)
    setAmount('')
    setFillPrice(null)
    setFillAmount(null)
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
  const isPending = isApprovePending || isSellPending
  const isConfirming = isApproveConfirming || isSellConfirming

  const microSteps = useMemo((): MicroStep[] => {
    const getLabel = (m: number): string => {
      const desc = MICRO_LABELS[m]
      if (!desc) return ''
      return typeof desc === 'function' ? desc({ isPending }) : desc
    }

    const steps: MicroStep[] = []

    if (!skippedApproval) {
      steps.push({
        label: getLabel(SellMicro.APPROVE),
        txHash: savedApproveHash ?? undefined,
        explorerUrl: savedApproveHash ? getTxUrl(savedApproveHash, 'settlement') : undefined,
        chain: 'settlement',
      })
    }

    steps.push({
      label: getLabel(SellMicro.SUBMIT),
      txHash: savedSellHash ?? undefined,
      explorerUrl: savedSellHash ? getTxUrl(savedSellHash, 'settlement') : undefined,
      chain: 'settlement',
    })

    steps.push({
      label: getLabel(SellMicro.RELAY),
      chain: 'settlement',
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
  }, [isPending, skippedApproval, savedApproveHash, savedSellHash, batchTxHash, fillTxHash])

  const stepperMicroIndex = useMemo(() => {
    if (isDone) return microSteps.length
    if (micro < 0) return 0
    // Map SellMicro enum values to microSteps array indices
    if (skippedApproval) {
      // No APPROVE step: SUBMIT=0, RELAY=1, BATCH=2, FILL=3
      return Math.max(0, micro - 1)
    }
    return Math.max(0, micro)
  }, [micro, isDone, microSteps.length, skippedApproval])

  const adjustedRanges = useMemo((): [number, number][] => {
    if (skippedApproval) {
      // 4 items: submit(0), relay(1), batch(2), fill(3)
      return [
        [0, 1],    // Submit: submit(0)
        [1, 4],    // Process: relay(1), batch(2), fill(3)
      ]
    }
    // 5 items: approve(0), submit(1), relay(2), batch(3), fill(4)
    return [
      [0, 2],    // Submit: approve(0), submit(1)
      [2, 5],    // Process: relay(2), batch(3), fill(4)
    ]
  }, [skippedApproval])

  const txRefs = useMemo(() => {
    const refs: { label: string; value: string }[] = []
    if (settlementOrderId !== null) refs.push({ label: 'Settlement', value: `#${settlementOrderId.toString()}` })
    if (orderId !== null) refs.push({ label: 'L3', value: `#${orderId.toString()}` })
    return refs
  }, [settlementOrderId, orderId])

  const buttonText = isApprovePending
    ? t('button.pending')
    : isApproveConfirming
    ? t('button.submitting')
    : isSellPending
    ? t('button.pending')
    : isSellConfirming
    ? t('button.submitting')
    : needsApproval
    ? tc('actions.approve')
    : t('button.sell_shares')

  const renderFillDetails = () => {
    if (!fillPrice || !fillAmount) return null

    // Proceeds arrive on Settlement chain as 6-decimal USDC
    const proceeds = (fillAmount * fillPrice) / BigInt(1e18)

    return (
      <div className={`${glass.section} p-4 space-y-2`}>
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

  return createPortal(
    <SpringBackdrop className={glass.backdrop} onClick={handleClose}>
      <SpringModal className={`${glass.modal} max-w-lg w-full`} onClick={e => e.stopPropagation()}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-lg font-semibold text-text-primary">{t('title', { name: itpName })}</h2>
            <ModalClose onClick={handleClose} />
          </div>
          {itpSymbol && <p className="text-text-secondary mb-0.5 font-mono text-sm">${itpSymbol}</p>}
          <Link href={`/${locale}/itp/${itpId}`} className="text-xs text-accent hover:underline inline-block mb-2" onClick={handleClose}>More details &rarr;</Link>

          <InlineOhlcChart itpId={itpId} height={180} />

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
            <div className={`${glass.section} p-8 text-center`}>
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

              {isDone && (
                <div className={`${glass.section} p-4`}>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-1">Proceeds on Settlement chain</p>
                  <p className="text-sm text-text-secondary">USDC will arrive on your Settlement wallet shortly.</p>
                </div>
              )}

              {processStalled && micro >= SellMicro.RELAY && micro < SellMicro.DONE && (
                <div className={`${glass.warning} p-3 text-amber-600 text-sm`}>
                  <p className="font-medium">Processing taking longer than expected</p>
                  <p className="text-xs mt-1">Your sell order is submitted. Safe to close — it will complete in the background.</p>
                </div>
              )}

              {isDone ? (
                <button
                  onClick={handleReset}
                  className={glass.ctaDown}
                >
                  {t('sell_more')}
                </button>
              ) : micro <= SellMicro.SUBMIT ? (
                <button
                  onClick={handleCancel}
                  className={glass.cancel}
                >
                  {tc('actions.cancel')}
                </button>
              ) : null}

              {stuckWarning && (
                <div className={`${glass.warning} p-3 text-amber-600 text-sm`}>
                  <p className="font-medium">{tc('warnings.tx_stuck_title')}</p>
                  <p className="text-xs mt-1">{tc('warnings.tx_stuck_description')}</p>
                </div>
              )}

              {txError && (
                <div className={`${glass.error} p-4 text-color-down`}>
                  <p className="font-medium">{t('error.title')}</p>
                  <p className="text-sm mt-1 break-all">{txError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className={`${glass.section} p-3`}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">{t('your_shares_label')}</span>
                  <span className="text-2xl font-bold text-text-primary tabular-nums font-mono">{parseFloat(formatUnits(bridgedItpBalance, 18)).toFixed(4)}</span>
                </div>
                {sharesDiagnosis && (
                  <p className="text-xs text-color-down mt-2 leading-relaxed">{sharesDiagnosis}</p>
                )}
              </div>

              <>
                  <div className={`${glass.section} p-3`}>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">{t('shares_to_sell_label')}</label>
                      {bridgedItpBalance > 0n && (
                        <button
                          onClick={() => setAmount(formatUnits(bridgedItpBalance, 18))}
                          className="text-xs font-mono font-bold text-text-secondary hover:text-text-primary transition-colors"
                        >
                          {tc('actions.max')}
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g., 10"
                      min="0"
                      step="0.01"
                      disabled={bridgedItpBalance === 0n}
                      className={glass.input}
                    />
                    {insufficientShares && (
                      <p className="text-color-down text-xs mt-1">{t('insufficient_shares')}</p>
                    )}
                  </div>

                  <div className={`${glass.section} p-3`}>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">{t('min_price_label')}</label>
                      {navPerShare > 0 && (
                        <span className="text-xs text-text-secondary font-mono">
                          {t('nav_label', { nav: navPerShare.toFixed(6), priced: pricedAssetCount, total: totalAssetCount })}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      placeholder={isNavLoading ? t('computing_price') : navPerShare === 0 ? t('set_min_price') : t('no_limit')}
                      min="0"
                      step="0.01"
                      className={glass.inputSm}
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
                    <div className={`${glass.section} p-4`}>
                      <label className="block text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-3">{t('slippage_label')}</label>
                      <div className="flex gap-2 fluid-btn-group">
                        {SLIPPAGE_TIERS.map(tier => (
                          <button
                            key={tier.value}
                            onClick={() => setSlippageTier(tier.value)}
                            className={`flex-1 py-2 rounded-lg border text-sm font-mono transition-colors ${
                              slippageTier === tier.value
                                ? 'border-black/80 text-white bg-black/80'
                                : 'border-black/10 text-text-muted bg-white/60 hover:border-black/20'
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
                    <div className={`${glass.section} p-4 space-y-1`}>
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-2">{t('estimated_pnl.title')}</p>
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

                  {hasNonceGap && (
                    <div className={`${glass.warning} p-3 text-amber-600 text-sm`}>
                      <p className="font-medium">{tc('warnings.pending_tx_title')}</p>
                      <p className="text-xs mt-1">{tc('warnings.pending_tx_description', { count: pendingCount })}</p>
                    </div>
                  )}

                  <WalletActionButton
                    onClick={needsApproval ? handleApprove : handleSell}
                    disabled={!amount || parsedAmount === 0n || insufficientShares || isPending || isConfirming || !bridgedItpAddress || hasNonceGap}
                    className={glass.ctaDown}
                  >
                    {buttonText}
                  </WalletActionButton>

                  {(isPending || isConfirming) && (
                    <button
                      onClick={handleCancel}
                      className={glass.cancel}
                    >
                      {tc('actions.cancel')}
                    </button>
                  )}

                  {stuckWarning && (
                    <div className={`${glass.warning} p-3 text-amber-600 text-sm`}>
                      <p className="font-medium">Transaction may be stuck</p>
                      <p className="text-xs mt-1">Not confirmed after 30s. You can cancel and try again.</p>
                    </div>
                  )}

                  {txError && (
                    <div className={`${glass.error} p-4 text-color-down`}>
                      <p className="font-medium">{t('error.title')}</p>
                      <p className="text-sm mt-1 break-all">{txError}</p>
                    </div>
                  )}
                </>
            </div>
          )}
        </div>
      </SpringModal>
    </SpringBackdrop>,
    document.body
  )
}
