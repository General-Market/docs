'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAccount, useWaitForTransactionReceipt, useWriteContract, useSwitchChain, usePublicClient, useReadContract } from 'wagmi'
import { parseUnits, formatUnits, decodeEventLog } from 'viem'
import { INDEX_PROTOCOL, COLLATERAL_DECIMALS } from '@/lib/contracts/addresses'
import { ERC20_ABI, INDEX_ABI, SETTLEMENT_CUSTODY_ABI } from '@/lib/contracts/index-protocol-abi'
import { ensureCorrectChain } from '@/hooks/useChainWrite'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { TransactionStepper } from '@/components/ui/TransactionStepper'
import type { MicroStep, VisibleStep } from '@/components/ui/TransactionStepper'
import { getTxUrl } from '@/lib/utils/explorer'
import { useUserState } from '@/hooks/useUserState'
import { useNonceCheck } from '@/hooks/useNonceCheck'
import { useItpNav } from '@/hooks/useItpNav'
import { useSSEOrders, useSSEBalances, type UserOrder } from '@/hooks/useSSE'
import { useToast } from '@/lib/contexts/ToastContext'
import { YouTubeLite, extractYouTubeId } from '@/components/ui/YouTubeLite'
import { useTranslations } from 'next-intl'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { SpringModal, SpringBackdrop, glass, ModalClose } from '@/components/ui/spring'
import { indexL3, settlementChain, settlementChainId } from '@/lib/wagmi'

/** Settlement USDC decimals — real USDC on Settlement is 6 decimals */
const SETTLEMENT_USDC_DECIMALS = 6

/**
 * Buy flow micro-steps — Settlement bridge path (5 steps + Done):
 *
 * Step 1 "Submit on Settlement":  APPROVE (0), SUBMIT (1)
 * Step 2 "Oracle Relay":          RELAY (2) — oracle detects CrossChainOrderCreated, submits on L3
 * Step 3 "Processing":            BATCH (3), FILL (4)
 * Done:                           DONE (5)
 */
enum BuyMicro {
  APPROVE = 0,
  SUBMIT = 1,
  RELAY = 2,
  BATCH = 3,
  FILL = 4,
  DONE = 5,
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
  const { address, isConnected, chainId: currentChainId } = useAccount()
  const settlementPublicClient = usePublicClient({ chainId: settlementChainId })
  const { showSuccess } = useToast()

  const VISIBLE_STEPS: VisibleStep[] = [
    { label: t('steps.submit') },
    { label: t('steps.process') },
  ]

  const MICRO_LABELS: Record<number, string | ((ctx: { isPending: boolean }) => string)> = {
    [BuyMicro.APPROVE]: (ctx) => ctx.isPending ? t('micro_steps.approve_pending') : t('micro_steps.approve_confirming'),
    [BuyMicro.SUBMIT]: (ctx) => ctx.isPending ? t('micro_steps.submit_pending') : t('micro_steps.submit_confirming'),
    [BuyMicro.RELAY]: () => 'Oracle relaying to L3...',
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
  const [settlementOrderId, setSettlementOrderId] = useState<bigint | null>(null)
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

  // Settlement chain writes — raw useWriteContract (not the L3-defaulting hook)
  const { switchChainAsync } = useSwitchChain()

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

  const {
    writeContractAsync: writeBuyAsync,
    data: buyHash,
    isPending: isBuyPending,
    error: buyError,
    reset: resetBuy,
  } = useWriteContract()
  const { isLoading: isBuyConfirming, isSuccess: isBuySuccess, data: buyReceipt } = useWaitForTransactionReceipt({
    hash: buyHash,
    chainId: settlementChainId,
  })

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

  // Settlement USDC balance (6 decimals) — read from Settlement chain
  const { data: settlementUsdcRaw, refetch: refetchSettlementUsdc } = useReadContract({
    address: INDEX_PROTOCOL.settlementUsdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: settlementChainId,
    query: { enabled: !!address, refetchInterval: 5_000 },
  })
  const usdcBalance = (settlementUsdcRaw as bigint) ?? 0n

  // Settlement USDC allowance for SettlementBridgeCustody
  const { data: settlementAllowanceRaw, refetch: refetchSettlementAllowance } = useReadContract({
    address: INDEX_PROTOCOL.settlementUsdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, INDEX_PROTOCOL.settlementCustody] : undefined,
    chainId: settlementChainId,
    query: { enabled: !!address, refetchInterval: 5_000 },
  })
  const usdcAllowance = (settlementAllowanceRaw as bigint) ?? 0n

  // L3 user shares for this ITP
  const { data: l3SharesRaw } = useReadContract({
    address: INDEX_PROTOCOL.index,
    abi: INDEX_ABI,
    functionName: 'getUserShares',
    args: address ? [itpId as `0x${string}`, address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && !!itpId, refetchInterval: 5_000 },
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
    await refetchSettlementAllowance()
    await refetchSettlementUsdc()
  }, [refetchSettlementAllowance, refetchSettlementUsdc])

  const {
    writeContract: writeMint,
    data: mintHashTx,
    isPending: isMintPending,
    error: mintError,
    reset: resetMint,
  } = useWriteContract()
  const { isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash: mintHashTx })

  // Mint test USDC + drip settlement gas for testing
  const [faucetLoading, setFaucetLoading] = useState(false)
  const handleMintTestUsdc = useCallback(async () => {
    if (!address) return
    setFaucetLoading(true)
    try {
      // Use the faucet API which also drips settlement gas
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: '10000', gas: true }),
      })
      const data = await res.json()
      if (data.success) {
        refetchSettlementUsdc()
      }
    } catch {
      // Fallback to direct contract call (mint Settlement USDC, 6 decimals)
      resetMint()
      writeMint({
        address: INDEX_PROTOCOL.settlementUsdc,
        abi: MINT_ABI,
        functionName: 'mint',
        args: [address, parseUnits('10000', SETTLEMENT_USDC_DECIMALS)],
        chainId: settlementChainId,
      })
    } finally {
      setFaucetLoading(false)
    }
  }, [address, writeMint, resetMint, refetchSettlementUsdc])

  // Amount in 6 decimals (Settlement USDC)
  // Guard against negative, NaN, or excessive-decimal input
  const sanitizedAmount = (() => {
    if (!amount) return ''
    const n = parseFloat(amount)
    if (isNaN(n) || n < 0) return ''
    // Clamp to 6 decimal places (Settlement USDC precision)
    const parts = amount.split('.')
    if (parts[1] && parts[1].length > SETTLEMENT_USDC_DECIMALS) {
      return `${parts[0]}.${parts[1].slice(0, SETTLEMENT_USDC_DECIMALS)}`
    }
    return amount
  })()
  const parsedAmount = sanitizedAmount ? parseUnits(sanitizedAmount, SETTLEMENT_USDC_DECIMALS) : 0n
  const insufficientBalance = parsedAmount > 0n && parsedAmount > usdcBalance
  const needsApproval = parsedAmount > 0n && usdcAllowance < parsedAmount

  const snapshotBalances = useCallback(() => {
    setInitialSharesBn(userShares)
  }, [userShares])

  const handleApprove = useCallback(async () => {
    if (!amount || insufficientBalance) return
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

    try {
      // Switch to Settlement chain before approving
      await ensureCorrectChain(currentChainId, switchChainAsync, settlementChainId, settlementChain)
    } catch {
      setTxError('Please switch to the Settlement chain to buy')
      setMicro(-1)
      return
    }

    // Approve Settlement USDC → SettlementBridgeCustody
    writeApproveAsync({
      address: INDEX_PROTOCOL.settlementUsdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [INDEX_PROTOCOL.settlementCustody, parsedAmount],
      chainId: settlementChainId,
    }).catch(() => {
      // Error handled by approveError effect
    })
  }, [amount, parsedAmount, insufficientBalance, writeApproveAsync, snapshotBalances, currentChainId, switchChainAsync, capture, itpId, slippageTier, deadlineHours, limitPrice])

  const handleBuy = useCallback(async () => {
    if (!settlementPublicClient || !amount || insufficientBalance) return
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

    try {
      // Ensure we're on Settlement chain
      await ensureCorrectChain(currentChainId, switchChainAsync, settlementChainId, settlementChain)
    } catch {
      setTxError('Please switch to the Settlement chain to buy')
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
    const priceBn = limitPrice ? parseUnits(limitPrice, 18) : 0n
    setSubmittedLimitPrice(limitPrice)

    // Settlement: SettlementBridgeCustody.buyITPFromSettlement(itpId, usdcAmount, limitPrice, slippageTier, deadline)
    // usdcAmount is in 6 decimals (Settlement USDC)
    writeBuyAsync({
      address: INDEX_PROTOCOL.settlementCustody,
      abi: SETTLEMENT_CUSTODY_ABI,
      functionName: 'buyITPFromSettlement',
      args: [
        itpId as `0x${string}`,
        parsedAmount,
        priceBn,
        BigInt(slippageTier),
        deadline,
      ],
      chainId: settlementChainId,
    }).catch(() => {
      // Error handled by buyError effect
    })
  }, [settlementPublicClient, amount, insufficientBalance, limitPrice, deadlineHours, slippageTier, itpId, parsedAmount, writeBuyAsync, micro, snapshotBalances, currentChainId, switchChainAsync, capture])

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

  // Buy success -> save hash, extract orderId from CrossChainOrderCreated, advance to RELAY
  useEffect(() => {
    if (!isBuySuccess || !buyReceipt || buyHandled.current) return
    buyHandled.current = true
    if (buyHash) setSavedBuyHash(buyHash)

    // Extract orderId from CrossChainOrderCreated event on SettlementBridgeCustody
    for (const log of buyReceipt.logs) {
      if (log.address.toLowerCase() === INDEX_PROTOCOL.settlementCustody.toLowerCase()) {
        try {
          const decoded = decodeEventLog({ abi: SETTLEMENT_CUSTODY_ABI, data: log.data, topics: log.topics })
          if (decoded.eventName === 'CrossChainOrderCreated') {
            setSettlementOrderId((decoded.args as any).orderId as bigint)
            break
          }
        } catch {}
      }
    }

    // Settlement tx confirmed → advance to RELAY (waiting for oracle to pick it up)
    setMicro(BuyMicro.RELAY)
    resetBuy()
    // Persist pending order
    try {
      const pending = JSON.parse(localStorage.getItem('index-pending-orders') || '[]')
      pending.push({ itpId, side: 0, amount, timestamp: Date.now(), txHash: buyHash, chain: 'settlement' })
      localStorage.setItem('index-pending-orders', JSON.stringify(pending))
    } catch {}
    window.dispatchEvent(new Event('portfolio-refresh'))
  }, [isBuySuccess, buyReceipt, resetBuy, itpId, amount, buyHash])

  // Stall detection: show "safe to close" message after 60s at RELAY/BATCH/FILL
  useEffect(() => {
    if (micro < BuyMicro.RELAY || micro >= BuyMicro.DONE) {
      setProcessStalled(false)
      return
    }
    const timer = setTimeout(() => setProcessStalled(true), 60_000)
    return () => clearTimeout(timer)
  }, [micro])

  // SSE-driven order tracking: once the oracle relays to L3, the order appears in SSE.
  // RELAY -> BATCH -> FILL -> DONE
  const trackedOrder = useMemo((): UserOrder | undefined => {
    if (micro < BuyMicro.RELAY || micro >= BuyMicro.DONE) return undefined
    if (orderId !== null) {
      return sseOrders.find(o => o.order_id === Number(orderId))
    }
    // Match by itpId + side (BUY=0), most recent first
    const candidates = sseOrders
      .filter(o => o.itp_id === itpId && o.side === 0)
      .sort((a, b) => b.timestamp - a.timestamp)
    return candidates[0]
  }, [sseOrders, orderId, micro, itpId])

  useEffect(() => {
    if (!trackedOrder || micro < BuyMicro.RELAY || micro >= BuyMicro.DONE) return

    // Once we see the order in SSE, it means the oracle has relayed it to L3
    if (orderId === null) {
      setOrderId(BigInt(trackedOrder.order_id))
    }

    // Advance from RELAY to BATCH when the order appears on L3
    if (micro === BuyMicro.RELAY) {
      setMicro(BuyMicro.BATCH)
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
    if (micro < BuyMicro.RELAY || micro >= BuyMicro.DONE) return

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
    setSettlementOrderId(null)
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

  const formattedBalance = usdcBalance > 0n ? formatUnits(usdcBalance, SETTLEMENT_USDC_DECIMALS) : '0'
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
        explorerUrl: savedApproveHash ? getTxUrl(savedApproveHash, 'settlement') : undefined,
        chain: 'settlement',
      })
    }

    steps.push({
      label: getLabel(BuyMicro.SUBMIT),
      txHash: savedBuyHash ?? undefined,
      explorerUrl: savedBuyHash ? getTxUrl(savedBuyHash, 'settlement') : undefined,
      chain: 'settlement',
    })

    steps.push({
      label: getLabel(BuyMicro.RELAY),
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
      // 4 items: submit(0), relay(1), batch(2), fill(3)
      return [
        [0, 1],    // Submit on Settlement: submit(0)
        [1, 4],    // Processing: relay(1), batch(2), fill(3)
      ]
    }
    return [
      [0, 2],    // Submit on Settlement: approve(0), submit(1)
      [2, 5],    // Processing: relay(2), batch(3), fill(4)
    ]
  }, [skippedApproval])

  const txRefs = useMemo(() => {
    const refs: { label: string; value: string }[] = []
    if (settlementOrderId !== null) refs.push({ label: 'Settlement', value: `#${settlementOrderId.toString()}` })
    if (orderId !== null) refs.push({ label: 'L3', value: `#${orderId.toString()}` })
    return refs
  }, [orderId, settlementOrderId])

  const renderFillDetails = () => {
    if (!fillPrice || !fillAmount) return null
    return (
      <div className={`${glass.section} p-4 space-y-2`}>
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

  return createPortal(
    <SpringBackdrop className={glass.backdrop} onClick={handleClose}>
      <SpringModal className={`${glass.modal} max-w-lg w-full`} onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">{t('title', { name: itpName })}</h2>
            <ModalClose onClick={handleClose} />
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
            <div className={`${glass.section} p-8 text-center`}>
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
              {processStalled && micro >= BuyMicro.RELAY && micro < BuyMicro.DONE && (
                <div className={`${glass.section} p-4 text-sm`}>
                  <p className="font-medium text-text-primary mb-1">{t('stall.title')}</p>
                  <p className="text-text-secondary">{t('stall.description')}</p>
                </div>
              )}
              {renderFillDetails()}

              {userShares > 0n && (
                <div className={`${glass.section} p-4`}>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-1">{t('your_itp_shares')}</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums font-mono">{parseFloat(formatUnits(userShares, 18)).toFixed(4)}</p>
                </div>
              )}

              {isDone ? (
                <button
                  onClick={handleReset}
                  className={glass.ctaUp}
                >
                  {t('buy_more')}
                </button>
              ) : (micro <= BuyMicro.SUBMIT) ? (
                <button
                  onClick={handleCancel}
                  className={glass.cancel}
                >
                  {tc('actions.cancel')}
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className={glass.cancel}
                >
                  {tc('actions.close')}
                </button>
              )}

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
            <div className="space-y-4">
              <div className={`${glass.section} p-4 space-y-4`}>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">{t('amount_label')}</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted font-mono">{t('balance_label', { amount: parseFloat(formattedBalance).toFixed(2) })}</span>
                      {usdcBalance > 0n && (
                        <button
                          onClick={() => setAmount(formatUnits(usdcBalance, SETTLEMENT_USDC_DECIMALS))}
                          className="text-xs font-mono font-bold text-text-secondary hover:text-text-primary transition-colors"
                        >
                          {tc('actions.max')}
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g., 100"
                    min="0"
                    step="1"
                    className={glass.input}
                  />
                  {insufficientBalance && (
                    <p className="text-color-down text-xs mt-1">{t('insufficient_usdc')}</p>
                  )}
                </div>
                {usdcBalance === 0n && (
                  <div className="flex items-center gap-3 pt-2 border-t border-border-light">
                    <button
                      onClick={handleMintTestUsdc}
                      disabled={isMintPending || faucetLoading}
                      className="px-3 py-1.5 text-xs bg-black/[0.03] text-text-secondary border border-black/[0.06] rounded-lg hover:bg-black/[0.06] disabled:opacity-50 transition-colors"
                    >
                      {isMintPending || faucetLoading ? t('minting') : t('mint_test_usdc')}
                    </button>
                    {isMintSuccess && <span className="text-xs text-color-up">{t('minted')}</span>}
                    {mintError && <span className="text-xs text-color-down">{t('mint_failed')}</span>}
                  </div>
                )}
              </div>

              <div className={`${glass.section} p-4`}>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">{t('max_price_label')}</label>
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
                  className={glass.inputSm}
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
                <div className={`${glass.section} p-4`}>
                  <label className="block text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-3">{t('slippage_label')}</label>
                  <div className="flex gap-2 fluid-btn-group">
                    {SLIPPAGE_TIERS.map(tier => (
                      <button
                        key={tier.value}
                        onClick={() => { setSlippageTier(tier.value); capture('buy_slippage_changed', { itp_id: itpId, slippage_tier: tier.label }) }}
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

              {hasNonceGap && (
                <div className={`${glass.warning} p-3 text-amber-600 text-sm`}>
                  <p className="font-medium">{tc('warnings.pending_tx_title')}</p>
                  <p className="text-xs mt-1">{tc('warnings.pending_tx_description', { count: pendingCount })}</p>
                </div>
              )}

              <WalletActionButton
                onClick={needsApproval ? handleApprove : handleBuy}
                disabled={!amount || parsedAmount === 0n || isProcessing || insufficientBalance || hasNonceGap}
                className={glass.ctaUp}
              >
                {buttonText}
              </WalletActionButton>

              {isProcessing && (
                <button
                  onClick={handleCancel}
                  className={glass.cancel}
                >
                  {tc('actions.cancel')}
                </button>
              )}

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
          )}
        </div>
      </SpringModal>
    </SpringBackdrop>,
    document.body
  )
}
