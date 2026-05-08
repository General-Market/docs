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
import { SpringModal, SpringBackdrop } from '@/components/ui/spring'
import { useWaitlistGate } from '@/components/waitlist/WaitlistGateProvider'
import { InlineOhlcChart } from '@/components/ui/InlineOhlcChart'
import { indexL3 } from '@/lib/wagmi'

/** L3 USDC decimals — protocol-wide collateral. */
const L3_USDC_DECIMALS = 18

// ── Apple style atoms ────────────────────────────────────────
// Inline-style fragments. Tailwind handles layout (flex/gap),
// these carry the colors, fonts, and tracking that Tailwind
// can't express as one-liners against CSS variables.

const applePrimary: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  color: 'var(--apple-text)',
  letterSpacing: 'var(--apple-track-tight)',
}

const appleSecondary: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  color: 'var(--apple-text-secondary)',
  letterSpacing: 'var(--apple-track-tight)',
}

const appleTertiary: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  color: 'var(--apple-text-tertiary)',
  letterSpacing: 'var(--apple-track-tight)',
}

const appleBody: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 14,
  letterSpacing: 'var(--apple-track-tight)',
  color: 'var(--apple-text)',
}

const appleCaption: React.CSSProperties = {
  fontFamily: 'var(--apple-font-text)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-loose)',
  color: 'var(--apple-text-tertiary)',
  textTransform: 'uppercase',
}

const appleSection: React.CSSProperties = {
  background: 'var(--apple-panel-2)',
  border: '1px solid var(--apple-line)',
  borderRadius: 12,
  padding: 16,
}

const appleInput: React.CSSProperties = {
  width: '100%',
  background: 'var(--apple-bg)',
  border: '1px solid var(--apple-line)',
  borderRadius: 12,
  padding: '12px 14px',
  fontFamily: 'var(--apple-font-text)',
  fontSize: 17,
  color: 'var(--apple-text)',
  letterSpacing: 'var(--apple-track-tight)',
  outline: 'none',
  transition: 'border-color 200ms var(--apple-ease-default), box-shadow 200ms var(--apple-ease-default)',
}

const appleInputSm: React.CSSProperties = {
  ...appleInput,
  padding: '10px 14px',
  fontSize: 14,
}

const appleCtaPrimary: React.CSSProperties = {
  width: '100%',
  padding: '14px 22px',
  background: '#0071e3',
  color: '#ffffff',
  fontFamily: 'var(--apple-font-text)',
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: 'var(--apple-track-tight)',
  borderRadius: 980,
  border: 'none',
  cursor: 'pointer',
  transition: 'background 200ms var(--apple-ease-default), opacity 200ms var(--apple-ease-default)',
}

const appleCtaSecondary: React.CSSProperties = {
  width: '100%',
  padding: '12px 18px',
  background: 'var(--apple-bg)',
  color: 'var(--apple-text)',
  fontFamily: 'var(--apple-font-text)',
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: 'var(--apple-track-tight)',
  borderRadius: 12,
  border: '1px solid var(--apple-line)',
  cursor: 'pointer',
  transition: 'background 200ms var(--apple-ease-default)',
}

const appleCancel: React.CSSProperties = {
  width: '100%',
  padding: '10px 0',
  background: 'transparent',
  color: 'var(--apple-text-secondary)',
  fontFamily: 'var(--apple-font-text)',
  fontSize: 14,
  letterSpacing: 'var(--apple-track-tight)',
  border: 'none',
  cursor: 'pointer',
  transition: 'color 200ms var(--apple-ease-default)',
}

const appleAlertWarning: React.CSSProperties = {
  background: '#fff8e6',
  border: '1px solid #f5d68b',
  borderRadius: 12,
  padding: 12,
  color: '#7a4f00',
  fontFamily: 'var(--apple-font-text)',
  fontSize: 14,
  letterSpacing: 'var(--apple-track-tight)',
}

const appleAlertError: React.CSSProperties = {
  background: '#fdecec',
  border: '1px solid #f5b8b8',
  borderRadius: 12,
  padding: 16,
  color: '#a8071a',
  fontFamily: 'var(--apple-font-text)',
  fontSize: 14,
  letterSpacing: 'var(--apple-track-tight)',
}

function AppleCloseButton({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 32,
        height: 32,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 980,
        background: 'rgba(0,0,0,0.04)',
        color: 'var(--apple-text-secondary)',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 200ms var(--apple-ease-default), color 200ms var(--apple-ease-default)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = 'var(--apple-text)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = 'var(--apple-text-secondary)' }}
    >
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}

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
  const { requireWhitelist } = useWaitlistGate()

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
  const itpName = staticEntry?.name || userState.bridgedItpName || 'DTF'
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
  const handleMintTestUsdc = useCallback(() => {
    if (!address) return
    requireWhitelist(async () => {
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
    })
  }, [address, writeMint, resetMint, refetchL3Usdc, requireWhitelist])

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

  // Per-asset breakdown — fetch once on modal open so the user sees the
  // projected backing before submitting, and the realized backing after fill.
  // Prices come from /api/itp-enrichment (data-node).
  useEffect(() => {
    if (holdings.length > 0) return
    let cancelled = false
    fetch(`/api/itp-enrichment?itp_id=${itpId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d?.holdings) return
        setHoldings(d.holdings as Holding[])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [holdings.length, itpId])

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
      <div style={appleSection} className="space-y-2">
        <p style={{ ...appleBody, fontWeight: 600 }}>{t('fill_details.title')}</p>
        <div className="font-mono space-y-1" style={{ fontSize: 12 }}>
          <div className="flex justify-between">
            <span style={appleSecondary}>{t('fill_details.fill_price')}</span>
            <span style={applePrimary} className="tabular-nums">${parseFloat(formatUnits(fillPrice, 18)).toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span style={appleSecondary}>{t('fill_details.amount_filled')}</span>
            <span style={applePrimary} className="tabular-nums">{parseFloat(formatUnits(fillAmount, COLLATERAL_DECIMALS)).toFixed(4)} USDC</span>
          </div>
          {fillPrice > 0n && (
            <div className="flex justify-between">
              <span style={appleSecondary}>{t('fill_details.shares')}</span>
              <span style={applePrimary} className="tabular-nums">
                {parseFloat(formatUnits((fillAmount * BigInt(1e18)) / fillPrice, 18)).toFixed(4)}
              </span>
            </div>
          )}
          {submittedLimitPrice && parseFloat(submittedLimitPrice) > 0 && fillPrice > 0n && (() => {
            const limitBn = BigInt(Math.floor(parseFloat(submittedLimitPrice) * 1e18))
            const slippage = Number(fillPrice - limitBn) * 100 / Number(limitBn)
            const slipColor = slippage <= 0 ? '#34a853' : slippage < 1 ? '#34a853' : slippage < 3 ? '#b25e09' : '#d93025'
            return (
              <div className="flex justify-between">
                <span style={appleSecondary}>{t('fill_details.vs_limit')}</span>
                <span style={{ color: slipColor }} className="tabular-nums">
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
            <div className="pt-3" style={{ borderTop: '1px solid var(--apple-line)' }}>
              <p style={appleCaption} className="mb-2">
                {t('fill_details.underlying_title')}
              </p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {rows.map(r => (
                  <div key={r.symbol} className="flex items-center justify-between" style={{ fontSize: 12 }}>
                    <div className="flex items-center gap-2 min-w-0">
                      {r.image && <img src={r.image} alt="" className="w-4 h-4 rounded-full flex-shrink-0" />}
                      <span className="font-mono truncate" style={applePrimary}>{r.symbol}</span>
                      <span className="tabular-nums" style={appleSecondary}>{(r.weight * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span style={appleSecondary}>
                        {r.price !== null
                          ? `$${r.price < 1 ? r.price.toFixed(4) : r.price.toFixed(2)}`
                          : '—'}
                      </span>
                      <span style={applePrimary}>
                        {r.qtyAcquired < 1 ? r.qtyAcquired.toFixed(6) : r.qtyAcquired.toFixed(4)}
                      </span>
                      <span className="w-16 text-right" style={appleSecondary}>
                        {r.usd !== null ? `$${r.usd.toFixed(2)}` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ ...appleCaption, fontSize: 10, marginTop: 8 }}>
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
      style={{ background: 'rgba(0,0,0,0.48)' }}
      onClick={handleClose}
    >
      <SpringModal
        className="max-w-lg w-full overflow-y-auto"
        style={{
          background: 'var(--apple-panel)',
          borderRadius: 20,
          maxHeight: '85dvh',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: 20 }}>
          <div className="flex justify-between items-start mb-1" style={{ gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 21,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tighter)',
                  color: 'var(--apple-text)',
                  margin: 0,
                  lineHeight: 1.1428,
                }}
              >
                {t('title', { name: itpName })}
              </h2>
              {itpSymbol && (
                <p
                  className="font-mono"
                  style={{
                    ...appleSecondary,
                    fontSize: 13,
                    margin: '2px 0 0',
                  }}
                >
                  ${itpSymbol}
                </p>
              )}
            </div>
            <AppleCloseButton onClick={handleClose} ariaLabel={tc('aria.close')} />
          </div>
          <Link
            href={`/${locale}/itp/${itpId}`}
            onClick={handleClose}
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              letterSpacing: 'var(--apple-track-tight)',
              color: '#0071e3',
              display: 'inline-block',
              marginBottom: 12,
              textDecoration: 'none',
            }}
            className="hover:underline"
          >
            More details &rarr;
          </Link>

          <div style={{ marginBottom: 12 }}>
            <InlineOhlcChart itpId={itpId} height={180} />
          </div>

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
            <div style={{ ...appleSection, padding: 32, textAlign: 'center' }}>
              <p style={appleSecondary}>{tc('wallet.connect_to_buy')}</p>
            </div>
          ) : micro >= 0 ? (
            <div className="space-y-4">
              <div style={{ ...appleSection, paddingTop: 16, paddingBottom: 8 }}>
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
                  <div
                    className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 font-mono pt-2"
                    style={{
                      fontSize: 10,
                      color: 'var(--apple-text-tertiary)',
                      borderTop: '1px solid var(--apple-line)',
                    }}
                  >
                    {savedApproveHash && (
                      <a
                        href={getTxUrl(savedApproveHash, 'settlement')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                        style={{ color: 'var(--apple-text-secondary)', transition: 'color 200ms var(--apple-ease-default)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#0071e3' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--apple-text-secondary)' }}
                      >
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 980, background: '#0071e3' }} />
                        approve {savedApproveHash.slice(0, 6)}..{savedApproveHash.slice(-4)}
                      </a>
                    )}
                    {savedBuyHash && (
                      <a
                        href={getTxUrl(savedBuyHash, 'settlement')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                        style={{ color: 'var(--apple-text-secondary)', transition: 'color 200ms var(--apple-ease-default)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#0071e3' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--apple-text-secondary)' }}
                      >
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 980, background: '#0071e3' }} />
                        submit {savedBuyHash.slice(0, 6)}..{savedBuyHash.slice(-4)}
                      </a>
                    )}
                    {batchTxHash && (
                      <a
                        href={getTxUrl(batchTxHash, 'l3')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                        style={{ color: 'var(--apple-text-secondary)', transition: 'color 200ms var(--apple-ease-default)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#0071e3' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--apple-text-secondary)' }}
                      >
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 980, background: '#34a853' }} />
                        batch {batchTxHash.slice(0, 6)}..{batchTxHash.slice(-4)}
                      </a>
                    )}
                    {fillTxHash && (
                      <a
                        href={getTxUrl(fillTxHash, 'l3')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                        style={{ color: 'var(--apple-text-secondary)', transition: 'color 200ms var(--apple-ease-default)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#0071e3' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--apple-text-secondary)' }}
                      >
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 980, background: '#34a853' }} />
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
                <div style={appleSection}>
                  <p style={{ ...appleBody, fontWeight: 600, marginBottom: 4 }}>{t('stall.title')}</p>
                  <p style={appleSecondary}>{t('stall.description')}</p>
                </div>
              )}
              {renderFillDetails()}

              {userShares > 0n && (
                <div style={appleSection}>
                  <p style={{ ...appleCaption, marginBottom: 4 }}>{t('your_itp_shares')}</p>
                  <p
                    className="tabular-nums font-mono"
                    style={{
                      fontFamily: 'var(--apple-font-display)',
                      fontSize: 28,
                      fontWeight: 600,
                      letterSpacing: 'var(--apple-track-tighter)',
                      color: 'var(--apple-text)',
                      margin: 0,
                      lineHeight: 1.1,
                    }}
                  >
                    {parseFloat(formatUnits(userShares, 18)).toFixed(4)}
                  </p>
                </div>
              )}

              {isDone ? (
                <button onClick={handleReset} style={appleCtaPrimary}>
                  {t('buy_more')}
                </button>
              ) : (micro <= BuyMicro.SUBMIT) ? (
                <button onClick={handleCancel} style={appleCancel}>
                  {tc('actions.cancel')}
                </button>
              ) : (
                <button onClick={handleClose} style={appleCancel}>
                  {tc('actions.close')}
                </button>
              )}

              {stuckWarning && (
                <div style={appleAlertWarning}>
                  <p style={{ fontWeight: 600 }}>{tc('warnings.tx_stuck_title')}</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>{tc('warnings.tx_stuck_description')}</p>
                </div>
              )}

              {txError && (
                <div style={appleAlertError}>
                  <p style={{ fontWeight: 600 }}>{t('error.title')}</p>
                  <p style={{ fontSize: 14, marginTop: 4, wordBreak: 'break-all' }}>{txError}</p>
                  {/nonce/i.test(txError) && (
                    <div
                      className="space-y-1"
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: '1px solid rgba(168, 7, 26, 0.2)',
                        color: 'var(--apple-text)',
                        fontSize: 12,
                      }}
                    >
                      <p style={{ fontWeight: 600 }}>Wallet nonce out of sync with the chain.</p>
                      <p>The L3 was redeployed; your wallet still remembers old transactions. Reset to fix:</p>
                      <ul className="list-disc pl-5 space-y-0.5">
                        <li>MetaMask: Settings → Advanced → Clear activity tab data</li>
                        <li>OKX / Rabby: Settings → Reset account</li>
                        <li>Or remove this network from your wallet and re-add it</li>
                      </ul>
                      <p style={appleTertiary}>Refresh the page after resetting.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div style={{ ...appleSection, padding: 14 }} className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label style={appleCaption}>{t('amount_label')}</label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono" style={{ ...appleTertiary, fontSize: 12 }}>
                        {t('balance_label', { amount: parseFloat(formattedBalance).toFixed(2) })}
                      </span>
                      {usdcBalance > 0n && (
                        <button
                          onClick={() => setAmount(formatUnits(usdcBalance, L3_USDC_DECIMALS))}
                          className="font-mono"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#0071e3',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            letterSpacing: 'var(--apple-track-tight)',
                          }}
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
                    style={{ ...appleInput, fontFamily: 'var(--apple-font-text)', fontVariantNumeric: 'tabular-nums' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#0071e3'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(0,113,227,0.16)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--apple-line)'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  {insufficientBalance && (
                    <p style={{ color: '#d93025', fontSize: 12, marginTop: 4, fontFamily: 'var(--apple-font-text)' }}>{t('insufficient_usdc')}</p>
                  )}
                </div>
                {usdcBalance === 0n && (
                  <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid var(--apple-line)' }}>
                    <button
                      onClick={handleMintTestUsdc}
                      disabled={isMintPending || faucetLoading}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontFamily: 'var(--apple-font-text)',
                        letterSpacing: 'var(--apple-track-tight)',
                        background: 'rgba(0,0,0,0.04)',
                        color: 'var(--apple-text-secondary)',
                        border: '1px solid var(--apple-line)',
                        borderRadius: 8,
                        cursor: isMintPending || faucetLoading ? 'not-allowed' : 'pointer',
                        opacity: isMintPending || faucetLoading ? 0.5 : 1,
                        transition: 'background 200ms var(--apple-ease-default)',
                      }}
                    >
                      {isMintPending || faucetLoading ? t('minting') : t('mint_test_usdc')}
                    </button>
                    {isMintSuccess && <span style={{ fontSize: 12, color: '#34a853', fontFamily: 'var(--apple-font-text)' }}>{t('minted')}</span>}
                    {mintError && <span style={{ fontSize: 12, color: '#d93025', fontFamily: 'var(--apple-font-text)' }}>{t('mint_failed')}</span>}
                  </div>
                )}
              </div>

              <div style={{ ...appleSection, padding: 14 }}>
                <div className="flex justify-between items-center mb-2">
                  <label style={appleCaption}>{t('max_price_label')}</label>
                  {navPerShare > 0 && (
                    <span className="font-mono" style={{ ...appleTertiary, fontSize: 12 }}>
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
                  style={{ ...appleInputSm, fontVariantNumeric: 'tabular-nums' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#0071e3'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(0,113,227,0.16)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--apple-line)'; e.currentTarget.style.boxShadow = 'none' }}
                />
                {!isNavLoading && navPerShare === 0 && (
                  <p style={{ color: '#b25e09', fontSize: 12, marginTop: 8, fontFamily: 'var(--apple-font-text)' }}>
                    {t('no_prices_warning')}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowSlippage(s => !s)}
                  className="flex items-center gap-1.5"
                  style={{
                    fontSize: 12,
                    color: 'var(--apple-text-secondary)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    fontFamily: 'var(--apple-font-text)',
                    letterSpacing: 'var(--apple-track-tight)',
                    transition: 'color 200ms var(--apple-ease-default)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--apple-text)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--apple-text-secondary)' }}
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
                <div style={appleSection}>
                  <label style={{ ...appleCaption, display: 'block', marginBottom: 12 }}>{t('slippage_label')}</label>
                  <div
                    className="flex"
                    style={{
                      background: 'var(--apple-surface)',
                      borderRadius: 980,
                      padding: 3,
                      gap: 0,
                    }}
                  >
                    {SLIPPAGE_TIERS.map(tier => {
                      const active = slippageTier === tier.value
                      return (
                        <button
                          key={tier.value}
                          onClick={() => { setSlippageTier(tier.value); capture('buy_slippage_changed', { itp_id: itpId, slippage_tier: tier.label }) }}
                          className="flex-1 font-mono"
                          style={{
                            padding: '8px 0',
                            borderRadius: 980,
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: active ? 600 : 500,
                            letterSpacing: 'var(--apple-track-tight)',
                            background: active ? 'var(--apple-bg)' : 'transparent',
                            color: active ? 'var(--apple-text)' : 'var(--apple-text-secondary)',
                            boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' : 'none',
                            transition: 'background 200ms var(--apple-ease-default), color 200ms var(--apple-ease-default)',
                          }}
                        >
                          {tier.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {parsedAmount > 0n && navPerShareBn > 0n && holdings.length > 0 && (() => {
                const previewRows = computeFillBreakdown({
                  fillAmount: parsedAmount,
                  fillPrice: navPerShareBn,
                  holdings: holdings.map(h => ({
                    symbol: h.symbol,
                    address: h.address,
                    price: h.price,
                    weight: h.weight,
                    image: h.image,
                  })),
                  inventory,
                })
                if (previewRows.length === 0) return null
                return (
                  <div style={{ ...appleSection, padding: 14 }}>
                    <p style={{ ...appleCaption, marginBottom: 8 }}>
                      {t('fill_details.preview_backing_title')}
                    </p>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {previewRows.map(r => (
                        <div key={r.symbol} className="flex items-center justify-between" style={{ fontSize: 12 }}>
                          <div className="flex items-center gap-2 min-w-0">
                            {r.image && <img src={r.image} alt="" className="w-4 h-4 rounded-full flex-shrink-0" />}
                            <span className="font-mono truncate" style={applePrimary}>{r.symbol}</span>
                            <span className="tabular-nums" style={appleSecondary}>{(r.weight * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center gap-3 font-mono tabular-nums">
                            <span style={appleSecondary}>
                              {r.price !== null
                                ? `$${r.price < 1 ? r.price.toFixed(4) : r.price.toFixed(2)}`
                                : '—'}
                            </span>
                            <span style={applePrimary}>
                              {r.qtyAcquired < 1 ? r.qtyAcquired.toFixed(6) : r.qtyAcquired.toFixed(4)}
                            </span>
                            <span className="w-16 text-right" style={appleSecondary}>
                              {r.usd !== null ? `$${r.usd.toFixed(2)}` : '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p style={{ ...appleCaption, fontSize: 10, marginTop: 8 }}>
                      {t('fill_details.preview_backing_note')}
                    </p>
                  </div>
                )
              })()}

              {hasNonceGap && (
                <div style={appleAlertWarning}>
                  <p style={{ fontWeight: 600 }}>{tc('warnings.pending_tx_title')}</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>{tc('warnings.pending_tx_description', { count: pendingCount })}</p>
                </div>
              )}

              <WalletActionButton
                onClick={needsApproval ? handleApprove : handleBuy}
                disabled={!amount || parsedAmount === 0n || isProcessing || insufficientBalance || hasNonceGap}
                style={appleCtaPrimary}
              >
                {buttonText}
              </WalletActionButton>

              {isProcessing && (
                <button onClick={handleCancel} style={appleCancel}>
                  {tc('actions.cancel')}
                </button>
              )}

              {stuckWarning && (
                <div style={appleAlertWarning}>
                  <p style={{ fontWeight: 600 }}>{tc('warnings.tx_stuck_title')}</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>{tc('warnings.tx_stuck_description')}</p>
                </div>
              )}

              {txError && (
                <div style={appleAlertError}>
                  <p style={{ fontWeight: 600 }}>{t('error.title')}</p>
                  <p style={{ fontSize: 14, marginTop: 4, wordBreak: 'break-all' }}>{txError}</p>
                  {/nonce/i.test(txError) && (
                    <div
                      className="space-y-1"
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: '1px solid rgba(168, 7, 26, 0.2)',
                        color: 'var(--apple-text)',
                        fontSize: 12,
                      }}
                    >
                      <p style={{ fontWeight: 600 }}>Wallet nonce out of sync with the chain.</p>
                      <p>The L3 was redeployed; your wallet still remembers old transactions. Reset to fix:</p>
                      <ul className="list-disc pl-5 space-y-0.5">
                        <li>MetaMask: Settings → Advanced → Clear activity tab data</li>
                        <li>OKX / Rabby: Settings → Reset account</li>
                        <li>Or remove this network from your wallet and re-add it</li>
                      </ul>
                      <p style={appleTertiary}>Refresh the page after resetting.</p>
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
