'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAccount, useWaitForTransactionReceipt, useWriteContract, usePublicClient, useReadContract } from 'wagmi'
import { parseUnits, formatUnits, decodeEventLog } from 'viem'
import { INDEX_PROTOCOL, COLLATERAL_DECIMALS } from '@/lib/contracts/addresses'
import { ERC20_ABI, INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { PipelineRing, type PipelineRingPhase } from '@/components/ui/PipelineRing'
import { getTxUrl } from '@/lib/utils/explorer'
import { useUserState } from '@/hooks/useUserState'
import { useNonceCheck } from '@/hooks/useNonceCheck'
import { useItpNav } from '@/hooks/useItpNav'
import { useItpInventory } from '@/hooks/useItpInventory'
import { computeFillBreakdown } from '@/lib/itp/fill-breakdown'
import { useSSEOrders, useSSEBalances, type UserOrder } from '@/hooks/useSSE'
import { useToast } from '@/lib/contexts/ToastContext'
import { YouTubeLite, extractYouTubeId } from '@/components/ui/YouTubeLite'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import itpIdNames from '@/lib/itp-id-names.json'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { SpringModal, SpringBackdrop, glass, ModalClose } from '@/components/ui/spring'
import { InlineOhlcChart } from '@/components/ui/InlineOhlcChart'
import { indexL3 } from '@/lib/wagmi'

/** L3 USDC decimals — protocol-wide collateral. */
const L3_USDC_DECIMALS = 18

/**
 * Buy flow micro-steps, L3 direct path (4 steps + Done):
 *
 * Step 1 "Submit on L3":   APPROVE (0), SUBMIT (1)
 * Step 2 "Processing":     BATCH (3), FILL (4)
 * Done:                    DONE (5)
 *
 * RELAY (2) is preserved as an enum member for compatibility with downstream
 * step labels and PostHog event names, but the L3 path skips it — submission
 * lands directly on L3, the oracle relays nothing because there is no bridge.
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
  const locale = useLocale()
  const { address, isConnected } = useAccount()
  const l3PublicClient = usePublicClient({ chainId: indexL3.id })
  const { showSuccess } = useToast()

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
  type Holding = { symbol: string; address: string; weight: number; price: number; name?: string; image?: string }
  const [holdings, setHoldings] = useState<Holding[]>([])

  // Saved tx hashes
  const [savedApproveHash, setSavedApproveHash] = useState<string | null>(null)
  const [savedBuyHash, setSavedBuyHash] = useState<string | null>(null)
  const [submittedLimitPrice, setSubmittedLimitPrice] = useState<string>('')
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null)
  const [fillTxHash, setFillTxHash] = useState<string | null>(null)

  // L3 chain writes via the shared wrapper — auto-switches chain and pins
  // chainId on every call. Same path Vision (BatchEntryPanel) and the
  // vault/morpho/itp-approval hooks already use.
  const {
    writeContractAsync: writeApproveAsync,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useChainWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
    chainId: indexL3.id,
  })

  const {
    writeContractAsync: writeBuyAsync,
    data: buyHash,
    isPending: isBuyPending,
    error: buyError,
    reset: resetBuy,
  } = useChainWriteContract()
  const { isLoading: isBuyConfirming, isSuccess: isBuySuccess, data: buyReceipt } = useWaitForTransactionReceipt({
    hash: buyHash,
    chainId: indexL3.id,
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
  const staticEntry = (itpIdNames as Record<string, { name: string; ticker: string }>)[itpId.toLowerCase()]
  const itpName = staticEntry?.name || userState.bridgedItpName || 'ITP'
  const itpSymbol = staticEntry?.ticker || userState.bridgedItpSymbol || ''

  // L3 USDC balance (18 decimals).
  // Two independent sources: wagmi useReadContract via /api/rpc, and the
  // data-node SSE feed. They read the same on-chain state but through
  // different transports — if one lags or breaks, the other catches it.
  // Display: take the max. Whichever is larger reflects a confirmed mint
  // the other source hasn't seen yet.
  const { data: l3UsdcRaw, refetch: refetchL3Usdc } = useReadContract({
    address: INDEX_PROTOCOL.l3Usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address, refetchInterval: 5_000 },
  })
  const wagmiBalance = (l3UsdcRaw as bigint) ?? 0n
  const sseBalanceRaw = sseBalances?.usdc_l3
  const sseBalance = sseBalanceRaw ? BigInt(sseBalanceRaw) : 0n
  const usdcBalance = wagmiBalance > sseBalance ? wagmiBalance : sseBalance

  // L3 USDC allowance for the Index contract
  const { data: l3AllowanceRaw, refetch: refetchL3Allowance } = useReadContract({
    address: INDEX_PROTOCOL.l3Usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, INDEX_PROTOCOL.index] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address, refetchInterval: 5_000 },
  })
  const usdcAllowance = (l3AllowanceRaw as bigint) ?? 0n

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

  // L3-only path — no BridgedITP to watch. DONE waits on L3 share growth.

  const { navPerShare, navPerShareBn, totalAssetCount, pricedAssetCount, isLoading: isNavLoading } = useItpNav(itpId)
  const { inventory } = useItpInventory(itpId)

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
  const { isSuccess: isMintReceiptSuccess } = useWaitForTransactionReceipt({
    hash: mintHashTx,
    chainId: indexL3.id,
  })

  // Mint test USDC + drip settlement gas for testing.
  // The happy path goes through the API faucet (no wallet popup), which means
  // mintHashTx never gets populated and isMintReceiptSuccess never flips.
  // Track API success separately so the "Minted" badge fires regardless of path.
  const [faucetLoading, setFaucetLoading] = useState(false)
  const [apiMintSuccess, setApiMintSuccess] = useState(false)
  const isMintSuccess = isMintReceiptSuccess || apiMintSuccess
  const handleMintTestUsdc = useCallback(async () => {
    if (!address) return
    setFaucetLoading(true)
    setApiMintSuccess(false)
    try {
      // Vision scope: mints L3 USDC (18 dec) + drips L3 GM gas.
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: '10000', scope: 'vision' }),
      })
      const data = await res.json()
      if (data.success && !data.vision?.usdc?.error) {
        setApiMintSuccess(true)
        // The receipt is confirmed by the time the API returns. The user's
        // RPC view may still be one block behind. Poll every 1s for 30s
        // — give up only after the chain has had ample time to surface
        // the mint. Each refetch is a single eth_call; cost is negligible.
        const start = Date.now()
        const poll = () => {
          refetchL3Usdc()
          if (Date.now() - start < 30_000) {
            setTimeout(poll, 1_000)
          }
        }
        poll()
      }
    } catch {
      // Fallback to direct contract call (mint L3 USDC, 18 decimals).
      // Wrapper handles chain switch + chainId.
      resetMint()
      writeMint({
        address: INDEX_PROTOCOL.l3Usdc,
        abi: MINT_ABI,
        functionName: 'mint',
        args: [address, parseUnits('10000', L3_USDC_DECIMALS)],
      })
    } finally {
      setFaucetLoading(false)
    }
  }, [address, writeMint, resetMint, refetchL3Usdc])

  // Amount in 18 decimals (L3 USDC)
  // Guard against negative, NaN, or excessive-decimal input
  const sanitizedAmount = (() => {
    if (!amount) return ''
    const n = parseFloat(amount)
    if (isNaN(n) || n < 0) return ''
    // Clamp to 6 visible decimal places — viem can parse 18 but UI stays sane
    const parts = amount.split('.')
    if (parts[1] && parts[1].length > 6) {
      return `${parts[0]}.${parts[1].slice(0, 6)}`
    }
    return amount
  })()
  const parsedAmount = sanitizedAmount ? parseUnits(sanitizedAmount, L3_USDC_DECIMALS) : 0n
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

    // Approve L3 USDC → Index. The wrapper switches chain and pins chainId.
    writeApproveAsync({
      address: INDEX_PROTOCOL.l3Usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [INDEX_PROTOCOL.index, parsedAmount],
    }).catch(() => {
      // Error handled by approveError effect
    })
  }, [amount, parsedAmount, insufficientBalance, writeApproveAsync, snapshotBalances, capture, itpId, slippageTier, deadlineHours, limitPrice])

  const handleBuy = useCallback(async () => {
    if (!l3PublicClient || !amount || insufficientBalance) return
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
      const block = await l3PublicClient.getBlock()
      blockTimestamp = block.timestamp
    } catch {
      blockTimestamp = BigInt(Math.floor(Date.now() / 1000))
    }

    const deadline = blockTimestamp + BigInt(deadlineHours * 3600)
    const priceBn = limitPrice ? parseUnits(limitPrice, 18) : 0n
    setSubmittedLimitPrice(limitPrice)

    // L3 direct: Index.submitOrder(itpId, side=0 BUY, amount, limitPrice, slippageTier, deadline)
    // amount is in 18 decimals (L3 USDC). Wrapper handles chain switch + chainId.
    writeBuyAsync({
      address: INDEX_PROTOCOL.index,
      abi: INDEX_ABI,
      functionName: 'submitOrder',
      args: [
        itpId as `0x${string}`,
        0,
        parsedAmount,
        priceBn,
        BigInt(slippageTier),
        deadline,
      ],
    }).catch(() => {
      // Error handled by buyError effect
    })
  }, [l3PublicClient, amount, insufficientBalance, limitPrice, deadlineHours, slippageTier, itpId, parsedAmount, writeBuyAsync, micro, snapshotBalances, capture])

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

    // Extract orderId from OrderSubmitted event on Index (L3)
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

    // L3 tx confirmed → no relay leg; jump straight into the on-chain batch wait.
    setMicro(BuyMicro.BATCH)
    resetBuy()
    try {
      const pending = JSON.parse(localStorage.getItem('index-pending-orders') || '[]')
      pending.push({ itpId, side: 0, amount, timestamp: Date.now(), txHash: buyHash, chain: 'l3' })
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

    if (status >= 2 && micro < BuyMicro.FILL) {
      // FILLED on L3 — capture fill data and hold at FILL until BridgedITP
      // balance grows on Settlement. The bridge-mint watcher below advances
      // to DONE; otherwise we'd lie about completion the way the user caught.
      if (trackedOrder.fill_price) {
        try { setFillPrice(BigInt(trackedOrder.fill_price)) } catch {}
      }
      if (trackedOrder.fill_amount) {
        try { setFillAmount(BigInt(trackedOrder.fill_amount)) } catch {}
      }
      setMicro(BuyMicro.FILL)
    } else if (status >= 1 && micro < BuyMicro.BATCH) {
      // BATCHED on L3
      setMicro(BuyMicro.BATCH)
    }
  }, [trackedOrder, micro, orderId])

  // L3 path: shares are minted directly into _userShares on fill — no bridge
  // mint to wait for. Advance to DONE the moment the on-chain balance grows.
  useEffect(() => {
    if (micro < BuyMicro.FILL || micro >= BuyMicro.DONE) return
    if (initialSharesBn !== null && userShares > initialSharesBn) {
      setMicro(BuyMicro.DONE)
    }
  }, [micro, userShares, initialSharesBn])

  // --- PostHog: buy_step_reached ---
  useEffect(() => {
    if (micro < 0) return
    const stepName = BuyMicro[micro] || `step_${micro}`
    capture('buy_step_reached', {
      itp_id: itpId, step_name: stepName, step_index: micro,
      time_since_submit_ms: buyStartTime.current ? Date.now() - buyStartTime.current : 0,
    })
  }, [micro]) // eslint-disable-line react-hooks/exhaustive-deps

  // L3-side fallback: detect L3 share increase or recent SSE fill, advance
  // to FILL (not DONE — DONE waits for the BridgedITP mint on Settlement).
  useEffect(() => {
    if (micro < BuyMicro.RELAY || micro >= BuyMicro.FILL) return

    if (initialSharesBn !== null && userShares > initialSharesBn) {
      try {
        const pending = JSON.parse(localStorage.getItem('index-pending-orders') || '[]')
        localStorage.setItem('index-pending-orders', JSON.stringify(
          pending.filter((o: any) => o.txHash !== savedBuyHash)
        ))
      } catch {}
      setMicro(BuyMicro.FILL)
      return
    }

    // Secondary fallback: check SSE for any recently-filled BUY on this ITP.
    // Catches cases where the tracked orderId was never set (oracle restart
    // during relay, event missed) but the order was filled on L3.
    if (!trackedOrder) {
      const filled = sseOrders.find(
        o => o.itp_id === itpId && o.side === 0 && o.status >= 2
          && o.timestamp > Date.now() / 1000 - 600 // within last 10 min
      )
      if (filled) {
        if (filled.fill_price) try { setFillPrice(BigInt(filled.fill_price)) } catch {}
        if (filled.fill_amount) try { setFillAmount(BigInt(filled.fill_amount)) } catch {}
        setMicro(BuyMicro.FILL)
      }
    }
  }, [micro, userShares, initialSharesBn, savedBuyHash, trackedOrder, sseOrders, itpId])

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

  // Per-asset breakdown — fetch once on fill so the user sees what they
  // actually bought into. Prices come from /api/itp-enrichment (data-node).
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

  const formattedBalance = usdcBalance > 0n ? formatUnits(usdcBalance, L3_USDC_DECIMALS) : '0'
  const isProcessing = isApprovePending || isApproveConfirming || isBuyPending || isBuyConfirming
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

  // --- Pipeline ring data ---

  const RING_PHASES: PipelineRingPhase[] = [
    { key: 'submit', label: t('phases.submit_short') },
    { key: 'relay', label: t('phases.relay_short') },
    { key: 'batch', label: t('phases.batch_short') },
    { key: 'fill', label: t('phases.fill_short') },
  ]

  const ringState = useMemo(() => {
    if (isDone) {
      return { phase: RING_PHASES.length, progress: 1, keepers: 3, top: t('phases.done') }
    }
    switch (micro) {
      case BuyMicro.APPROVE:
        return {
          phase: 0,
          progress: 0.3,
          keepers: 0,
          top: isApprovePending ? t('micro_steps.approve_pending') : t('micro_steps.approve_confirming'),
        }
      case BuyMicro.SUBMIT:
        return {
          phase: 0,
          progress: 0.75,
          keepers: 0,
          top: isBuyPending ? t('micro_steps.submit_pending') : t('micro_steps.submit_confirming'),
        }
      case BuyMicro.RELAY:
        return { phase: 1, progress: 0.5, keepers: 1, top: t('phases.relay') }
      case BuyMicro.BATCH:
        return { phase: 2, progress: 0.5, keepers: 2, top: t('phases.batch') }
      case BuyMicro.FILL:
        return { phase: 3, progress: 0.5, keepers: 3, top: t('phases.fill') }
      default:
        return { phase: 0, progress: 0, keepers: 0, top: '' }
    }
  }, [micro, isDone, isApprovePending, isBuyPending, t])

  const ringSubLabel = useMemo(() => {
    if (!isDone || !fillPrice || !fillAmount || fillPrice === 0n) return undefined
    const shares = parseFloat(formatUnits((fillAmount * BigInt(1e18)) / fillPrice, 18))
    const symbol = itpSymbol || 'shares'
    return `${shares.toFixed(4)} ${symbol}`
  }, [isDone, fillPrice, fillAmount, itpSymbol])

  const txRefs = useMemo(() => {
    const refs: { label: string; value: string }[] = []
    // L3 direct path has a single order id — no Settlement leg to display.
    if (orderId !== null) refs.push({ label: 'L3', value: `#${orderId.toString()}` })
    return refs
  }, [orderId])

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
        {holdings.length > 0 && fillPrice && fillAmount && (() => {
          const rows = computeFillBreakdown({
            fillAmount,
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
            <div className="pt-3 border-t border-black/5">
              <p className="text-[11px] uppercase tracking-wide text-text-muted mb-2">
                {t('fill_details.underlying_title')}
              </p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {rows.map(r => (
                  <div key={r.symbol} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.image && <img src={r.image} alt="" className="w-4 h-4 rounded-full flex-shrink-0" />}
                      <span className="font-mono text-text-primary truncate">{r.symbol}</span>
                      <span className="text-text-muted tabular-nums">{(r.weight * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span className="text-text-muted">
                        {r.price !== null
                          ? `$${r.price < 1 ? r.price.toFixed(4) : r.price.toFixed(2)}`
                          : '—'}
                      </span>
                      <span className="text-text-primary">
                        {r.qtyAcquired < 1 ? r.qtyAcquired.toFixed(6) : r.qtyAcquired.toFixed(4)}
                      </span>
                      <span className="text-text-muted w-16 text-right">
                        {r.usd !== null ? `$${r.usd.toFixed(2)}` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-text-muted mt-2">
                {t(anyApprox ? 'fill_details.underlying_note_approx' : 'fill_details.underlying_note')}
              </p>
            </div>
          )
        })()}
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
              <p className="text-text-secondary">{tc('wallet.connect_to_buy')}</p>
            </div>
          ) : micro >= 0 ? (
            <div className="space-y-4">
              <div className={`${glass.section} px-4 pt-4 pb-2`}>
                <PipelineRing
                  phases={RING_PHASES}
                  currentPhase={ringState.phase}
                  phaseProgress={ringState.progress}
                  startedAt={buyStartTime.current > 0 ? buyStartTime.current : undefined}
                  typicalMs={60_000}
                  done={isDone}
                  keepersLit={ringState.keepers}
                  topLabel={ringState.top}
                  subLabel={ringSubLabel}
                />
                {(savedApproveHash || savedBuyHash || batchTxHash || fillTxHash || txRefs.length > 0) && (
                  <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[10px] font-mono text-text-muted pt-2 border-t border-black/5">
                    {savedApproveHash && (
                      <a href={getTxUrl(savedApproveHash, 'settlement')} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-text-primary transition-colors">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
                        approve {savedApproveHash.slice(0, 6)}..{savedApproveHash.slice(-4)}
                      </a>
                    )}
                    {savedBuyHash && (
                      <a href={getTxUrl(savedBuyHash, 'settlement')} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-text-primary transition-colors">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
                        submit {savedBuyHash.slice(0, 6)}..{savedBuyHash.slice(-4)}
                      </a>
                    )}
                    {batchTxHash && (
                      <a href={getTxUrl(batchTxHash, 'l3')} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-text-primary transition-colors">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        batch {batchTxHash.slice(0, 6)}..{batchTxHash.slice(-4)}
                      </a>
                    )}
                    {fillTxHash && (
                      <a href={getTxUrl(fillTxHash, 'l3')} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-text-primary transition-colors">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        fill {fillTxHash.slice(0, 6)}..{fillTxHash.slice(-4)}
                      </a>
                    )}
                    {txRefs.map((r, i) => (
                      <span key={i} className="whitespace-nowrap">{r.label} {r.value}</span>
                    ))}
                  </div>
                )}
              </div>
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
                  {/nonce/i.test(txError) && (
                    <div className="mt-3 pt-3 border-t border-color-down/20 text-text-primary text-xs space-y-1">
                      <p className="font-medium">Wallet nonce out of sync with the chain.</p>
                      <p>The L3 was redeployed; your wallet still remembers old transactions. Reset to fix:</p>
                      <ul className="list-disc pl-5 space-y-0.5">
                        <li>MetaMask: Settings → Advanced → Clear activity tab data</li>
                        <li>OKX / Rabby: Settings → Reset account</li>
                        <li>Or remove this network from your wallet and re-add it</li>
                      </ul>
                      <p className="text-text-muted">Refresh the page after resetting.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className={`${glass.section} p-3 space-y-3`}>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">{t('amount_label')}</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted font-mono">{t('balance_label', { amount: parseFloat(formattedBalance).toFixed(2) })}</span>
                      {usdcBalance > 0n && (
                        <button
                          onClick={() => setAmount(formatUnits(usdcBalance, L3_USDC_DECIMALS))}
                          className="text-xs font-mono font-bold text-text-secondary hover:text-text-primary transition-colors"
                        >
                          {tc('actions.max')}
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
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

              <div className={`${glass.section} p-3`}>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">{t('max_price_label')}</label>
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
                  {/nonce/i.test(txError) && (
                    <div className="mt-3 pt-3 border-t border-color-down/20 text-text-primary text-xs space-y-1">
                      <p className="font-medium">Wallet nonce out of sync with the chain.</p>
                      <p>The L3 was redeployed; your wallet still remembers old transactions. Reset to fix:</p>
                      <ul className="list-disc pl-5 space-y-0.5">
                        <li>MetaMask: Settings → Advanced → Clear activity tab data</li>
                        <li>OKX / Rabby: Settings → Reset account</li>
                        <li>Or remove this network from your wallet and re-add it</li>
                      </ul>
                      <p className="text-text-muted">Refresh the page after resetting.</p>
                    </div>
                  )}
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
