'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAccount, useWaitForTransactionReceipt, usePublicClient, useReadContract } from 'wagmi'
import { parseUnits, formatUnits, decodeEventLog } from 'viem'
import { INDEX_PROTOCOL, COLLATERAL_DECIMALS } from '@/lib/contracts/addresses'
import { ERC20_ABI, INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { TransactionStepper } from '@/components/ui/TransactionStepper'
import type { MicroStep, VisibleStep } from '@/components/ui/TransactionStepper'
import { getTxUrl } from '@/lib/utils/explorer'
import { useUserState } from '@/hooks/useUserState'
import { useItpCostBasis } from '@/hooks/useItpCostBasis'
import { useItpNav } from '@/hooks/useItpNav'
import { useItpInventory } from '@/hooks/useItpInventory'
import { computeFillBreakdown } from '@/lib/itp/fill-breakdown'
import { useSSEOrders, type UserOrder } from '@/hooks/useSSE'
import { useNonceCheck } from '@/hooks/useNonceCheck'
import { useToast } from '@/lib/contexts/ToastContext'
import { YouTubeLite, extractYouTubeId } from '@/components/ui/YouTubeLite'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import itpIdNames from '@/lib/itp-id-names.json'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { SpringModal, SpringBackdrop } from '@/components/ui/spring'
import { InlineOhlcChart } from '@/components/ui/InlineOhlcChart'
import { indexL3 } from '@/lib/wagmi'

/**
 * Sell flow micro-steps — L3 direct path (3 steps + Done):
 *
 * Step 1 "Submit on L3":  SUBMIT (1) — Index.submitOrder side=1 escrows shares
 * Step 2 "Processing":    BATCH (3), FILL (4) — oracle consensus, USDC released
 * Done:                   DONE (5)
 *
 * APPROVE (0) and RELAY (2) are vestigial enum members — selling on L3 burns
 * shares from _userShares directly, no allowance, no bridge.
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

// ── Apple style primitives (local to this modal) ────────────────────────────
// Inline objects so changes here don't leak into other surfaces still using
// the dark-glass tokens. Aesthetic mirrors SourceSidebarApple + apple-tokens.

const apple = {
  backdrop: {
    background: 'rgba(0, 0, 0, 0.48)',
    backdropFilter: 'saturate(180%) blur(20px)',
    WebkitBackdropFilter: 'saturate(180%) blur(20px)',
  } as const,
  modal: {
    background: 'var(--apple-panel)',
    color: 'var(--apple-text)',
    borderRadius: 20,
    boxShadow: 'var(--apple-shadow-card)',
    border: '1px solid var(--apple-line)',
    fontFamily: 'var(--apple-font-text)',
  } as const,
  section: {
    background: 'var(--apple-panel-2)',
    border: '1px solid var(--apple-line)',
    borderRadius: 12,
  } as const,
  title: {
    fontFamily: 'var(--apple-font-display)',
    fontSize: 19,
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tighter)',
    color: 'var(--apple-text)',
    margin: 0,
  } as const,
  symbol: {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 13,
    color: 'var(--apple-text-secondary)',
    letterSpacing: 'var(--apple-track-tight)',
  } as const,
  link: {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 12,
    color: 'var(--apple-accent)',
    letterSpacing: 'var(--apple-track-tight)',
    textDecoration: 'none',
  } as const,
  caption: {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-loose)',
    color: 'var(--apple-text-tertiary)',
    textTransform: 'uppercase' as const,
  },
  body: {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 14,
    letterSpacing: 'var(--apple-track-tight)',
    color: 'var(--apple-text-secondary)',
  } as const,
  bodyPrimary: {
    fontFamily: 'var(--apple-font-text)',
    fontSize: 14,
    letterSpacing: 'var(--apple-track-tight)',
    color: 'var(--apple-text)',
  } as const,
  input: {
    width: '100%',
    background: '#ffffff',
    border: '1px solid var(--apple-line)',
    borderRadius: 12,
    padding: '12px 14px',
    fontFamily: 'var(--apple-font-text)',
    fontSize: 17,
    color: 'var(--apple-text)',
    letterSpacing: 'var(--apple-track-tight)',
    fontVariantNumeric: 'tabular-nums' as const,
    outline: 'none',
    transition: 'border-color 200ms var(--apple-ease-default), box-shadow 200ms var(--apple-ease-default)',
  } as const,
  inputSm: {
    width: '100%',
    background: '#ffffff',
    border: '1px solid var(--apple-line)',
    borderRadius: 12,
    padding: '9px 14px',
    fontFamily: 'var(--apple-font-text)',
    fontSize: 14,
    color: 'var(--apple-text)',
    letterSpacing: 'var(--apple-track-tight)',
    fontVariantNumeric: 'tabular-nums' as const,
    outline: 'none',
    transition: 'border-color 200ms var(--apple-ease-default), box-shadow 200ms var(--apple-ease-default)',
  } as const,
  primaryCta: {
    width: '100%',
    padding: '14px 20px',
    background: '#0071e3',
    color: '#ffffff',
    fontFamily: 'var(--apple-font-text)',
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tight)',
    border: 'none',
    borderRadius: 980,
    cursor: 'pointer',
    transition: 'background 200ms var(--apple-ease-default), opacity 200ms var(--apple-ease-default)',
  } as const,
  cancel: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    padding: '8px 0',
    fontFamily: 'var(--apple-font-text)',
    fontSize: 13,
    color: 'var(--apple-text-secondary)',
    letterSpacing: 'var(--apple-track-tight)',
    cursor: 'pointer',
    transition: 'color 200ms var(--apple-ease-default)',
  } as const,
  closeBtn: {
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 980,
    background: 'rgba(0, 0, 0, 0.05)',
    color: 'var(--apple-text-secondary)',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 200ms var(--apple-ease-default), color 200ms var(--apple-ease-default)',
  } as const,
  error: {
    background: '#fff5f5',
    border: '1px solid rgba(220, 38, 38, 0.2)',
    borderRadius: 12,
    color: '#b42318',
  } as const,
  warning: {
    background: '#fffaf0',
    border: '1px solid rgba(217, 119, 6, 0.2)',
    borderRadius: 12,
    color: '#92400e',
  } as const,
} as const

const APPLE_GREEN = '#16a34a'
const APPLE_RED = '#dc2626'

export function SellItpModal({ itpId, videoUrl, onClose }: SellItpModalProps) {
  const t = useTranslations('sell-modal')
  const tc = useTranslations('common')
  const locale = useLocale()
  const { address, isConnected } = useAccount()
  const l3PublicClient = usePublicClient({ chainId: indexL3.id })
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
  const [limitPrice, setLimitPrice] = useState('')
  const [slippageTier, setSlippageTier] = useState(2)
  const [showSlippage, setShowSlippage] = useState(false)
  const [deadlineHours, setDeadlineHours] = useState(1)
  const [micro, setMicro] = useState<number>(-1) // -1 = INPUT mode
  const [orderId, setOrderId] = useState<bigint | null>(null)
  // L3-only path — no Settlement-side order id.
  const [txError, setTxError] = useState<string | null>(null)
  const [fillPrice, setFillPrice] = useState<bigint | null>(null)
  const [fillAmount, setFillAmount] = useState<bigint | null>(null)
  // Captured at SUBMIT time so we can detect the on-chain burn directly,
  // independent of SSE. Mirrors the buy modal's initialSharesBn pattern —
  // SSE drops FILLED orders quickly and can hide the fill from the modal.
  const [initialSharesBn, setInitialSharesBn] = useState<bigint | null>(null)
  type Holding = { symbol: string; address: string; weight: number; price: number; name?: string; image?: string }
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [skippedApproval, setSkippedApproval] = useState(false)
  const [processStalled, setProcessStalled] = useState(false)

  // Saved tx hashes
  const [savedApproveHash, setSavedApproveHash] = useState<string | null>(null)
  const [savedSellHash, setSavedSellHash] = useState<string | null>(null)
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null)
  const [fillTxHash, setFillTxHash] = useState<string | null>(null)

  const { hasNonceGap, pendingCount, refresh: refreshNonce } = useNonceCheck()

  // L3 direct path needs no approval — Index burns shares from _userShares.
  // Wagmi hooks kept as no-op stubs so unchanged stepper code keeps working.
  const writeApproveAsync = (async () => undefined as any) as any
  const approveHash: `0x${string}` | undefined = undefined
  const isApprovePending = false as boolean
  const approveError = null as Error | null
  const resetApprove = () => {}
  const isApproveConfirming = false as boolean
  const isApproveSuccess = false as boolean

  // Sell on L3 — useChainWriteContract auto-switches and pins chainId. Same
  // wrapper the Buy modal uses, so the path stops dropping signatures when
  // the wallet is on Sonic instead of L3.
  const {
    writeContractAsync: writeSellAsync,
    data: sellHash,
    isPending: isSellPending,
    error: sellError,
    reset: resetSell,
  } = useChainWriteContract()
  const { isLoading: isSellConfirming, isSuccess: isSellSuccess, data: sellReceipt } = useWaitForTransactionReceipt({
    hash: sellHash,
    chainId: indexL3.id,
  })

  const approveHandled = useRef(false)
  const sellHandled = useRef(false)
  const toastFired = useRef(false)

  // Keep useUserState for name/symbol only (backend convenience)
  const userState = useUserState(itpId)
  const staticEntry = (itpIdNames as Record<string, { name: string; ticker: string }>)[itpId.toLowerCase()]
  const itpName = staticEntry?.name || userState.bridgedItpName || 'DTF'
  const itpSymbol = staticEntry?.ticker || userState.bridgedItpSymbol || ''

  // L3 direct path: read shares straight from _userShares on Index. The
  // BridgedITP and SettlementBridgeCustody are not in this story.
  const { data: l3SharesRaw } = useReadContract({
    address: INDEX_PROTOCOL.index,
    abi: INDEX_ABI,
    functionName: 'getUserShares',
    args: address ? [itpId as `0x${string}`, address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && !!itpId, refetchInterval: 5_000 },
  })
  const l3Shares = (l3SharesRaw as bigint) ?? 0n
  // Backwards-compat aliases for the unchanged render code below.
  const bridgedItpBalance = l3Shares
  const bridgedItpAllowance = (1n << 255n) // L3 sell needs no allowance.
  const bridgedItpAddress = INDEX_PROTOCOL.index // sentinel non-empty value

  const { costBasis } = useItpCostBasis(itpId, address ?? null)
  const { navPerShare, navPerShareBn, totalAssetCount, pricedAssetCount, isLoading: isNavLoading } = useItpNav(itpId)
  const { inventory } = useItpInventory(itpId)

  // Fetch underlying holdings on fill so the modal can show what was released.
  useEffect(() => {
    if (!fillAmount || holdings.length > 0) return
    let cancelled = false
    fetch(`/api/itp-enrichment?itp_id=${itpId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d?.holdings) return
        setHoldings(d.holdings as Holding[])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [fillAmount, holdings.length, itpId])


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

  // Diagnose why YOUR SHARES might be zero on the L3 direct path.
  const sharesDiagnosis: string | null = (() => {
    if (!address) return null
    if (l3Shares > 0n) return null
    return 'You don\'t own shares of this DTF. Creating a DTF does not seed the creator — buy first.'
  })()

  // L3 direct path needs no approval. handleApprove is preserved as an alias
  // for handleSell so any caller that still routes through it just submits.
  const handleApprove = useCallback(async () => {
    setSkippedApproval(true)
    // handleSell is defined just below; capture via closure to avoid TDZ.
    setTimeout(() => handleSellRef.current?.(), 0)
  }, [])
  const handleSellRef = useRef<(() => void) | null>(null)

  const handleSell = useCallback(async () => {
    if (!l3PublicClient || !amount || insufficientShares) return
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
      // Snapshot pre-submit shares so the chain-burn fallback effect can
      // detect a fill without depending on SSE.
      setInitialSharesBn(l3Shares)
    }
    setMicro(SellMicro.SUBMIT)

    let blockTimestamp: bigint
    try {
      const block = await l3PublicClient.getBlock()
      blockTimestamp = block.timestamp
    } catch {
      blockTimestamp = BigInt(Math.floor(Date.now() / 1000))
    }

    const deadline = blockTimestamp + BigInt(deadlineHours * 3600)
    const priceBn = parseUnits(limitPrice || '0', 18)

    // L3 direct: Index.submitOrder(itpId, side=1 SELL, shares, limitPrice, slippageTier, deadline)
    // amount is in 18 decimals (ITP shares)
    writeSellAsync({
      address: INDEX_PROTOCOL.index,
      abi: INDEX_ABI,
      functionName: 'submitOrder',
      args: [
        itpId as `0x${string}`,
        1,
        parsedAmount,
        priceBn,
        BigInt(slippageTier),
        deadline,
      ],
      chainId: indexL3.id,
    }).catch(() => {
      // Error handled by sellError effect
    })
  }, [l3PublicClient, amount, limitPrice, deadlineHours, slippageTier, itpId, parsedAmount, writeSellAsync, micro, insufficientShares, capture])

  // Wire ref for handleApprove → handleSell trampoline above.
  useEffect(() => { handleSellRef.current = handleSell }, [handleSell])

  // Approve success -> auto-trigger sell
  useEffect(() => {
    if (!isApproveSuccess || approveHandled.current) return
    approveHandled.current = true
    if (approveHash) setSavedApproveHash(approveHash)
    resetApprove()
    handleSell()
  }, [isApproveSuccess, approveHash, resetApprove, handleSell])

  // Sell success -> extract orderId from OrderSubmitted on L3, jump to BATCH
  useEffect(() => {
    if (!isSellSuccess || !sellReceipt || sellHandled.current) return
    sellHandled.current = true
    if (sellHash) setSavedSellHash(sellHash)

    for (const log of sellReceipt.logs) {
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

    // L3 tx confirmed → straight into the batch wait, no relay leg.
    setMicro(SellMicro.BATCH)
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

  // Chain-poll fallback: when the on-chain shares decrease past our pre-submit
  // snapshot, the burn happened — advance to DONE regardless of SSE state.
  // SSE drops FILLED orders fast (24h window now, but historically 5min) and
  // can lose the fill before this modal sees it. Mirrors the buy modal's
  // userShares > initialSharesBn pattern, inverted for sells.
  useEffect(() => {
    if (micro < SellMicro.RELAY || micro >= SellMicro.DONE) return
    if (initialSharesBn === null) return
    if (l3Shares < initialSharesBn) {
      setMicro(SellMicro.DONE)
    }
  }, [micro, l3Shares, initialSharesBn])

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

  // Per-asset breakdown — fetch once on fill so the user sees what they
  // sold out of. Same source the buy modal uses.
  useEffect(() => {
    if (!fillAmount || holdings.length > 0) return
    let cancelled = false
    fetch(`/api/itp-enrichment?itp_id=${itpId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d?.holdings) return
        setHoldings(d.holdings as Holding[])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [fillAmount, holdings.length, itpId])

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
    if (orderId !== null) refs.push({ label: 'L3', value: `#${orderId.toString()}` })
    return refs
  }, [orderId])

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
      <div className="p-4 space-y-2" style={apple.section}>
        <p style={{ ...apple.bodyPrimary, fontSize: 14, fontWeight: 600 }}>{t('fill_details.title')}</p>
        <div className="text-xs font-mono space-y-1">
          <div className="flex justify-between">
            <span style={{ color: 'var(--apple-text-secondary)' }}>{t('fill_details.fill_price')}</span>
            <span className="tabular-nums" style={{ color: 'var(--apple-text)' }}>${parseFloat(formatUnits(fillPrice, 18)).toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--apple-text-secondary)' }}>{t('fill_details.shares_sold')}</span>
            <span className="tabular-nums" style={{ color: 'var(--apple-text)' }}>{parseFloat(formatUnits(fillAmount, 18)).toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--apple-text-secondary)' }}>{t('fill_details.usdc_proceeds')}</span>
            <span className="tabular-nums" style={{ color: 'var(--apple-text)' }}>${parseFloat(formatUnits(proceeds, COLLATERAL_DECIMALS)).toFixed(2)}</span>
          </div>
          {costBasis && costBasis.avgCostPerShare > 0n && fillPrice > 0n && (() => {
            const costOfShares = (fillAmount * costBasis.avgCostPerShare) / BigInt(1e18)
            const pnl = proceeds - costOfShares
            const pnlPct = Number(costOfShares) > 0 ? Number(pnl) * 100 / Number(costOfShares) : 0
            return (
              <div className="flex justify-between pt-1" style={{ borderTop: '1px solid var(--apple-line)' }}>
                <span style={{ color: 'var(--apple-text-secondary)' }}>{t('fill_details.pnl_vs_cost')}</span>
                <span style={{ color: pnl >= 0n ? APPLE_GREEN : APPLE_RED }}>
                  {pnl >= 0n ? '+' : ''}${parseFloat(formatUnits(pnl, COLLATERAL_DECIMALS)).toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                </span>
              </div>
            )
          })()}
        </div>
        {holdings.length > 0 && fillPrice && fillAmount && (() => {
          // Sell-side fillAmount is shares burned (18-dec). The breakdown helper
          // expects fillAmount in USDC, so synthesize proceeds: shares × price.
          // This makes the helper reconstruct the original shares burned and
          // compute exact qty released per asset (or fall back to weight math).
          const proceedsAsFillAmount = (fillAmount * fillPrice) / BigInt(1e18)
          const rows = computeFillBreakdown({
            fillAmount: proceedsAsFillAmount,
            fillPrice,
            holdings: holdings.map(h => ({
              symbol: h.symbol,
              address: h.address,
              price: h.price,
              weight: h.weight,
              image: h.image,
            })),
            inventory,
          })
          if (rows.length === 0) return null
          const anyApprox = rows.some(r => r.isApprox)
          return (
            <div className="pt-3" style={{ borderTop: '1px solid var(--apple-line)' }}>
              <p className="mb-2" style={{ ...apple.caption, fontSize: 11 }}>
                {t('fill_details.underlying_title')}
              </p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {rows.map(r => (
                  <div key={r.symbol} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.image && <img src={r.image} alt="" className="w-4 h-4 rounded-full flex-shrink-0" />}
                      <span className="font-mono truncate" style={{ color: 'var(--apple-text)' }}>{r.symbol}</span>
                      <span className="tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>{(r.weight * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span style={{ color: 'var(--apple-text-secondary)' }}>
                        {r.price !== null
                          ? `$${r.price < 1 ? r.price.toFixed(4) : r.price.toFixed(2)}`
                          : '—'}
                      </span>
                      <span style={{ color: 'var(--apple-text)' }}>
                        {r.qtyAcquired < 1 ? r.qtyAcquired.toFixed(6) : r.qtyAcquired.toFixed(4)}
                      </span>
                      <span className="w-16 text-right" style={{ color: 'var(--apple-text-tertiary)' }}>
                        {r.usd !== null ? `$${r.usd.toFixed(2)}` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2" style={{ fontSize: 10, color: 'var(--apple-text-tertiary)' }}>
                {t(anyApprox ? 'fill_details.underlying_note_approx' : 'fill_details.underlying_note')}
              </p>
            </div>
          )
        })()}
      </div>
    )
  }

  return createPortal(
    <SpringBackdrop
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={apple.backdrop}
      onClick={handleClose}
    >
      <SpringModal
        className="max-w-lg w-full max-h-[85dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        style={apple.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex justify-between items-start mb-1">
            <h2 style={apple.title}>{t('title', { name: itpName })}</h2>
            <button
              onClick={handleClose}
              style={apple.closeBtn}
              aria-label={tc('aria.close')}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = 'var(--apple-text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = 'var(--apple-text-secondary)' }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {itpSymbol && <p className="font-mono mb-1" style={apple.symbol}>${itpSymbol}</p>}
          <Link
            href={`/${locale}/itp/${itpId}`}
            style={apple.link}
            className="inline-block mb-3 hover:underline"
            onClick={handleClose}
          >
            More details &rarr;
          </Link>

          <InlineOhlcChart itpId={itpId} height={180} />

          {videoUrl && (() => {
            const vid = extractYouTubeId(videoUrl)
            if (!vid) return null
            return (
              <div className="overflow-hidden mb-4" style={{ borderRadius: 12 }}>
                <YouTubeLite videoId={vid} title={itpName || 'DTF'} />
              </div>
            )
          })()}

          {!isConnected ? (
            <div className="p-8 text-center" style={apple.section}>
              <p style={apple.body}>{tc('wallet.connect_to_sell')}</p>
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
                <div className="p-4" style={apple.section}>
                  <p className="mb-1" style={apple.caption}>Proceeds on Settlement chain</p>
                  <p style={apple.body}>USDC will arrive on your Settlement wallet shortly.</p>
                </div>
              )}

              {processStalled && micro >= SellMicro.RELAY && micro < SellMicro.DONE && (
                <div className="p-3" style={apple.warning}>
                  <p className="font-medium text-sm">Processing taking longer than expected</p>
                  <p className="text-xs mt-1">Your sell order is submitted. Safe to close — it will complete in the background.</p>
                </div>
              )}

              {isDone ? (
                <button
                  onClick={handleReset}
                  style={apple.primaryCta}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0066cc' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#0071e3' }}
                >
                  {t('sell_more')}
                </button>
              ) : micro <= SellMicro.SUBMIT ? (
                <button
                  onClick={handleCancel}
                  style={apple.cancel}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--apple-text)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--apple-text-secondary)' }}
                >
                  {tc('actions.cancel')}
                </button>
              ) : null}

              {stuckWarning && (
                <div className="p-3" style={apple.warning}>
                  <p className="font-medium text-sm">{tc('warnings.tx_stuck_title')}</p>
                  <p className="text-xs mt-1">{tc('warnings.tx_stuck_description')}</p>
                </div>
              )}

              {txError && (
                <div className="p-4" style={apple.error}>
                  <p className="font-medium text-sm">{t('error.title')}</p>
                  <p className="text-sm mt-1 break-all">{txError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3" style={apple.section}>
                <div className="flex justify-between items-center">
                  <span style={apple.caption}>{t('your_shares_label')}</span>
                  <span
                    className="tabular-nums font-mono"
                    style={{
                      fontFamily: 'var(--apple-font-display)',
                      fontSize: 24,
                      fontWeight: 600,
                      letterSpacing: 'var(--apple-track-tighter)',
                      color: 'var(--apple-text)',
                    }}
                  >
                    {parseFloat(formatUnits(bridgedItpBalance, 18)).toFixed(4)}
                  </span>
                </div>
                {sharesDiagnosis && (
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: APPLE_RED }}>{sharesDiagnosis}</p>
                )}
              </div>

              <>
                  <div className="p-3" style={apple.section}>
                    <div className="flex justify-between items-center mb-2">
                      <label style={apple.caption}>{t('shares_to_sell_label')}</label>
                      {bridgedItpBalance > 0n && (
                        <button
                          onClick={() => setAmount(formatUnits(bridgedItpBalance, 18))}
                          className="font-mono"
                          style={{
                            fontFamily: 'var(--apple-font-text)',
                            fontSize: 12,
                            fontWeight: 600,
                            letterSpacing: 'var(--apple-track-tight)',
                            color: 'var(--apple-accent)',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                          }}
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
                      style={apple.input}
                      onFocus={e => { e.currentTarget.style.borderColor = '#0071e3'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.15)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--apple-line)'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                    {insufficientShares && (
                      <p className="text-xs mt-2" style={{ color: APPLE_RED }}>{t('insufficient_shares')}</p>
                    )}
                  </div>

                  <div className="p-3" style={apple.section}>
                    <div className="flex justify-between items-center mb-2">
                      <label style={apple.caption}>{t('min_price_label')}</label>
                      {navPerShare > 0 && (
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--apple-text-secondary)', letterSpacing: 'var(--apple-track-loose)' }}>
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
                      style={apple.inputSm}
                      onFocus={e => { e.currentTarget.style.borderColor = '#0071e3'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.15)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--apple-line)'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setShowSlippage(s => !s)}
                      className="flex items-center gap-1.5 transition-colors"
                      style={{
                        fontFamily: 'var(--apple-font-text)',
                        fontSize: 12,
                        color: 'var(--apple-text-secondary)',
                        letterSpacing: 'var(--apple-track-tight)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      title={t('slippage_label')}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--apple-text)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--apple-text-secondary)' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826-3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-mono">{SLIPPAGE_TIERS[slippageTier].label}</span>
                    </button>
                  </div>
                  {showSlippage && (
                    <div className="p-4" style={apple.section}>
                      <label className="block mb-3" style={apple.caption}>{t('slippage_label')}</label>
                      <div className="flex gap-2 fluid-btn-group">
                        {SLIPPAGE_TIERS.map(tier => (
                          <button
                            key={tier.value}
                            onClick={() => setSlippageTier(tier.value)}
                            className="flex-1 font-mono transition-colors"
                            style={{
                              padding: '8px 0',
                              borderRadius: 12,
                              border: '1px solid',
                              fontSize: 13,
                              letterSpacing: 'var(--apple-track-tight)',
                              borderColor: slippageTier === tier.value ? '#0071e3' : 'var(--apple-line)',
                              color: slippageTier === tier.value ? '#ffffff' : 'var(--apple-text-secondary)',
                              background: slippageTier === tier.value ? '#0071e3' : '#ffffff',
                              cursor: 'pointer',
                            }}
                          >
                            {tier.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* P&L Preview */}
                  {parsedAmount > 0n && costBasis && costBasis.avgCostPerShare > 0n && (
                    <div className="p-4 space-y-1" style={apple.section}>
                      <p className="mb-2" style={apple.caption}>{t('estimated_pnl.title')}</p>
                      <div className="text-xs font-mono space-y-1">
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--apple-text-secondary)' }}>{t('estimated_pnl.avg_cost_basis')}</span>
                          <span className="tabular-nums" style={{ color: 'var(--apple-text)' }}>${parseFloat(formatUnits(costBasis.avgCostPerShare, 18)).toFixed(4)}/share</span>
                        </div>
                        {navPerShareBn > 0n && (() => {
                          const estimatedProceeds = (parsedAmount * navPerShareBn) / BigInt(1e18)
                          const costOfShares = (parsedAmount * costBasis.avgCostPerShare) / BigInt(1e18)
                          const estimatedPnL = estimatedProceeds - costOfShares
                          const pnlPct = Number(estimatedPnL) * 100 / Number(costOfShares)
                          return (
                            <>
                              <div className="flex justify-between">
                                <span style={{ color: 'var(--apple-text-secondary)' }}>{t('estimated_pnl.current_nav')}</span>
                                <span className="tabular-nums" style={{ color: 'var(--apple-text)' }}>${navPerShare.toFixed(6)}/share</span>
                              </div>
                              <div className="flex justify-between">
                                <span style={{ color: 'var(--apple-text-secondary)' }}>{t('estimated_pnl.est_proceeds')}</span>
                                <span className="tabular-nums" style={{ color: 'var(--apple-text)' }}>${parseFloat(formatUnits(estimatedProceeds, 18)).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between pt-1" style={{ borderTop: '1px solid var(--apple-line)' }}>
                                <span style={{ color: 'var(--apple-text-secondary)' }}>{t('estimated_pnl.est_pnl')}</span>
                                <span style={{ color: estimatedPnL >= 0n ? APPLE_GREEN : APPLE_RED }}>
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
                    <div className="p-3" style={apple.warning}>
                      <p className="font-medium text-sm">{tc('warnings.pending_tx_title')}</p>
                      <p className="text-xs mt-1">{tc('warnings.pending_tx_description', { count: pendingCount })}</p>
                    </div>
                  )}

                  <WalletActionButton
                    onClick={needsApproval ? handleApprove : handleSell}
                    disabled={!amount || parsedAmount === 0n || insufficientShares || isPending || isConfirming || !bridgedItpAddress || hasNonceGap}
                    style={{
                      ...apple.primaryCta,
                      cursor: (!amount || parsedAmount === 0n || insufficientShares || isPending || isConfirming || hasNonceGap) ? 'not-allowed' : 'pointer',
                      opacity: (!amount || parsedAmount === 0n || insufficientShares || isPending || isConfirming || hasNonceGap) ? 0.4 : 1,
                    }}
                  >
                    {buttonText}
                  </WalletActionButton>

                  {(isPending || isConfirming) && (
                    <button
                      onClick={handleCancel}
                      style={apple.cancel}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--apple-text)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--apple-text-secondary)' }}
                    >
                      {tc('actions.cancel')}
                    </button>
                  )}

                  {stuckWarning && (
                    <div className="p-3" style={apple.warning}>
                      <p className="font-medium text-sm">Transaction may be stuck</p>
                      <p className="text-xs mt-1">Not confirmed after 30s. You can cancel and try again.</p>
                    </div>
                  )}

                  {txError && (
                    <div className="p-4" style={apple.error}>
                      <p className="font-medium text-sm">{t('error.title')}</p>
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
