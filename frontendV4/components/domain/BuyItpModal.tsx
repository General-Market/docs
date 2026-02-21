'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAccount, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits, decodeEventLog } from 'viem'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { ARB_CUSTODY_ABI, ERC20_ABI, INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { TransactionStepper } from '@/components/ui/TransactionStepper'
import type { MicroStep, VisibleStep } from '@/components/ui/TransactionStepper'
import { getTxUrl } from '@/lib/utils/basescan'
import { useUserState } from '@/hooks/useUserState'
import { useNonceCheck } from '@/hooks/useNonceCheck'
import { useItpNav } from '@/hooks/useItpNav'
import { useSSEOrders, useSSEBalances, type UserOrder } from '@/hooks/useSSE'

/**
 * Buy flow micro-steps — 10 steps mapped to 3 visible steps + Done:
 *
 * Step 1 "Submit":   APPROVE (0), SUBMIT (1)
 * Step 2 "Process":  BRIDGE_TO_L3 (2), RELAY (3), BATCH (4), FILL (5)
 * Step 3 "Deliver":  RECORD_COLLATERAL (6), BRIDGE_TO_ARB (7), COMPLETE_BRIDGE (8), MINT_SHARES (9)
 * Done:              DONE (10)
 */
enum BuyMicro {
  APPROVE = 0,
  SUBMIT = 1,
  BRIDGE_TO_L3 = 2,
  RELAY = 3,
  BATCH = 4,
  FILL = 5,
  RECORD_COLLATERAL = 6,
  BRIDGE_TO_ARB = 7,
  COMPLETE_BRIDGE = 8,
  MINT_SHARES = 9,
  DONE = 10,
}

const VISIBLE_STEPS: VisibleStep[] = [
  { label: 'Submit' },
  { label: 'Process' },
  { label: 'Deliver' },
]

// Maps visible step index → [startMicro, endMicro) range
const STEP_RANGES: [number, number][] = [
  [BuyMicro.APPROVE, BuyMicro.BRIDGE_TO_L3],       // Submit: 0-1
  [BuyMicro.BRIDGE_TO_L3, BuyMicro.RECORD_COLLATERAL], // Process: 2-5
  [BuyMicro.RECORD_COLLATERAL, BuyMicro.DONE],      // Deliver: 6-9
]

const MICRO_LABELS: Record<number, string | ((ctx: { isPending: boolean }) => string)> = {
  [BuyMicro.APPROVE]: (ctx) => ctx.isPending ? 'Confirm USDC approval in wallet...' : 'Approving USDC spend...',
  [BuyMicro.SUBMIT]: (ctx) => ctx.isPending ? 'Confirm buy order in wallet...' : 'Submitting buy order...',
  [BuyMicro.BRIDGE_TO_L3]: () => 'Bridging USDC to L3...',
  [BuyMicro.RELAY]: () => 'Relaying order to L3...',
  [BuyMicro.BATCH]: () => 'Batching order...',
  [BuyMicro.FILL]: () => 'Executing trades...',
  [BuyMicro.RECORD_COLLATERAL]: () => 'Recording collateral...',
  [BuyMicro.BRIDGE_TO_ARB]: () => 'Bridging USDC to Arbitrum...',
  [BuyMicro.COMPLETE_BRIDGE]: () => 'Completing bridge...',
  [BuyMicro.MINT_SHARES]: () => 'Minting BridgedITP...',
  [BuyMicro.DONE]: () => 'Shares received!',
}

const SLIPPAGE_TIERS = [
  { value: 0, label: '0.3%', description: 'Tight' },
  { value: 1, label: '1%', description: 'Normal' },
  { value: 2, label: '3%', description: 'Relaxed' },
]

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
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  // SSE-driven order & balance tracking (replaces L3 polling)
  const sseOrders = useSSEOrders()
  const sseBalances = useSSEBalances()

  const [amount, setAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [slippageTier, setSlippageTier] = useState(2)
  const [deadlineHours, setDeadlineHours] = useState(1)
  const [micro, setMicro] = useState<number>(-1) // -1 = INPUT mode
  const [orderId, setOrderId] = useState<bigint | null>(null)
  const [arbOrderId, setArbOrderId] = useState<bigint | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [fillPrice, setFillPrice] = useState<bigint | null>(null)
  const [fillAmount, setFillAmount] = useState<bigint | null>(null)
  const [initialBridgedItp, setInitialBridgedItp] = useState<string | null>(null)
  const [skippedApproval, setSkippedApproval] = useState(false)

  // Saved tx hashes
  const [savedApproveHash, setSavedApproveHash] = useState<string | null>(null)
  const [savedBuyHash, setSavedBuyHash] = useState<string | null>(null)
  const [submittedLimitPrice, setSubmittedLimitPrice] = useState<string>('')
  // Keeper tx hashes
  const [relayTxHash, setRelayTxHash] = useState<string | null>(null)
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null)
  const [fillTxHash, setFillTxHash] = useState<string | null>(null)
  const [collateralTxHash, setCollateralTxHash] = useState<string | null>(null)
  const [bridgeBackTxHash, setBridgeBackTxHash] = useState<string | null>(null)
  const [completeBridgeTxHash, setCompleteBridgeTxHash] = useState<string | null>(null)
  const [mintTxHash, setMintTxHash] = useState<string | null>(null)

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

  const userState = useUserState(itpId)
  const itpName = userState.bridgedItpName || 'ITP'
  const itpSymbol = userState.bridgedItpSymbol || ''

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

  const usdcBalance = userState.usdcBalance
  const usdcAllowance = userState.usdcAllowanceCustody
  const refetchAllowance = userState.refetch
  const userShares = userState.bridgedItpBalance

  const {
    writeContract: writeMint,
    data: mintHashTx,
    isPending: isMintPending,
    error: mintError,
    reset: resetMint,
  } = useChainWriteContract()
  const { isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash: mintHashTx })

  const handleMintTestUsdc = useCallback(() => {
    if (!address) return
    resetMint()
    writeMint({
      address: INDEX_PROTOCOL.arbUsdc,
      abi: MINT_ABI,
      functionName: 'mint',
      args: [address, parseUnits('10000', 6)],
    })
  }, [address, writeMint, resetMint])

  const parsedAmount = amount ? parseUnits(amount, 6) : 0n
  const needsApproval = usdcAllowance !== undefined && parsedAmount > 0n && (usdcAllowance) < parsedAmount

  const snapshotBalances = useCallback(() => {
    setInitialBridgedItp(sseBalances?.bridged_itp ?? null)
  }, [sseBalances])

  const handleApprove = useCallback(() => {
    if (!amount) return
    approveHandled.current = false
    setTxError(null)
    setSkippedApproval(false)
    snapshotBalances()
    setMicro(BuyMicro.APPROVE)
    writeApprove({
      address: INDEX_PROTOCOL.arbUsdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [INDEX_PROTOCOL.arbCustody, parsedAmount],
    })
  }, [amount, parsedAmount, writeApprove, snapshotBalances])

  const handleBuy = useCallback(async () => {
    if (!publicClient || !amount) return
    buyHandled.current = false
    setTxError(null)

    if (micro < 0) {
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

    writeBuy({
      address: INDEX_PROTOCOL.arbCustody,
      abi: ARB_CUSTODY_ABI,
      functionName: 'buyITPFromArbitrum',
      args: [
        itpId as `0x${string}`,
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

  // Buy success -> save hash, extract Arb orderId, advance to BRIDGE_TO_L3
  useEffect(() => {
    if (!isBuySuccess || !buyReceipt || buyHandled.current) return
    buyHandled.current = true
    if (buyHash) setSavedBuyHash(buyHash)

    let foundL3OrderId: bigint | null = null
    for (const log of buyReceipt.logs) {
      if (log.address.toLowerCase() === INDEX_PROTOCOL.index.toLowerCase()) {
        try {
          const decoded = decodeEventLog({ abi: INDEX_ABI, data: log.data, topics: log.topics })
          if (decoded.eventName === 'OrderSubmitted') {
            foundL3OrderId = (decoded.args as any).orderId as bigint
            break
          }
        } catch {}
      }
    }

    if (foundL3OrderId === null) {
      for (const log of buyReceipt.logs) {
        if (log.address.toLowerCase() === INDEX_PROTOCOL.arbCustody.toLowerCase()) {
          try {
            const decoded = decodeEventLog({ abi: ARB_CUSTODY_ABI, data: log.data, topics: log.topics })
            if (decoded.eventName === 'CrossChainOrderCreated') {
              setArbOrderId((decoded.args as any).orderId as bigint)
              break
            }
          } catch {}
        }
      }
    }

    if (foundL3OrderId !== null) {
      setOrderId(foundL3OrderId)
      setMicro(BuyMicro.BATCH) // Already on L3, skip bridge+relay
    } else {
      setMicro(BuyMicro.BRIDGE_TO_L3) // Cross-chain: start bridging
    }
    resetBuy()
  }, [isBuySuccess, buyReceipt, resetBuy])

  // BRIDGE_TO_L3: timer-based advance (bridge takes ~3s after submit)
  useEffect(() => {
    if (micro !== BuyMicro.BRIDGE_TO_L3) return
    const timer = setTimeout(() => setMicro(BuyMicro.RELAY), 3000)
    return () => clearTimeout(timer)
  }, [micro])

  // SSE-driven order tracking: RELAY -> BATCH -> FILL -> RECORD_COLLATERAL
  // Finds the matching order in sseOrders by order_id (if known) or by itpId + side=0 (buy)
  const trackedOrder = useMemo((): UserOrder | undefined => {
    if (micro < BuyMicro.RELAY || micro >= BuyMicro.RECORD_COLLATERAL) return undefined
    if (orderId !== null) {
      return sseOrders.find(o => o.order_id === Number(orderId))
    }
    // Before we know the L3 orderId, match by itpId and side=0 (buy), pick most recent
    const candidates = sseOrders
      .filter(o => o.itp_id === itpId && o.side === 0)
      .sort((a, b) => b.timestamp - a.timestamp)
    return candidates[0]
  }, [sseOrders, orderId, micro, itpId])

  useEffect(() => {
    if (!trackedOrder || micro < BuyMicro.RELAY || micro >= BuyMicro.RECORD_COLLATERAL) return

    // Capture orderId when first seen
    if (orderId === null) {
      setOrderId(BigInt(trackedOrder.order_id))
    }

    // Advance through RELAY -> BATCH based on order status
    if (micro === BuyMicro.RELAY) {
      setMicro(BuyMicro.BATCH)
    }

    const status = trackedOrder.status

    if (status >= 2 && micro < BuyMicro.RECORD_COLLATERAL) {
      // FILLED — capture fill details from SSE
      if (trackedOrder.fill_price) {
        try { setFillPrice(BigInt(trackedOrder.fill_price)) } catch {}
      }
      if (trackedOrder.fill_amount) {
        try { setFillAmount(BigInt(trackedOrder.fill_amount)) } catch {}
      }
      setMicro(BuyMicro.RECORD_COLLATERAL)
    } else if (status >= 1 && micro < BuyMicro.FILL) {
      // BATCHED
      setMicro(BuyMicro.FILL)
    }
  }, [trackedOrder, micro, orderId])

  // RECORD_COLLATERAL: timer-based advance (~2s after fill)
  useEffect(() => {
    if (micro !== BuyMicro.RECORD_COLLATERAL) return
    const timer = setTimeout(() => setMicro(BuyMicro.BRIDGE_TO_ARB), 2000)
    return () => clearTimeout(timer)
  }, [micro])

  // BRIDGE_TO_ARB: timer-based advance
  useEffect(() => {
    if (micro !== BuyMicro.BRIDGE_TO_ARB) return
    const timer = setTimeout(() => setMicro(BuyMicro.COMPLETE_BRIDGE), 3000)
    return () => clearTimeout(timer)
  }, [micro])

  // COMPLETE_BRIDGE + MINT_SHARES: detect bridged_itp balance increase via SSE
  useEffect(() => {
    if (micro < BuyMicro.COMPLETE_BRIDGE || micro >= BuyMicro.DONE) return
    if (!sseBalances || initialBridgedItp === null) return

    const currentBridgedItp = sseBalances.bridged_itp
    try {
      if (BigInt(currentBridgedItp) > BigInt(initialBridgedItp)) {
        if (micro === BuyMicro.COMPLETE_BRIDGE) {
          setMicro(BuyMicro.MINT_SHARES)
          // Brief delay then mark done
          setTimeout(() => setMicro(BuyMicro.DONE), 1000)
        } else {
          setMicro(BuyMicro.DONE)
        }
      }
    } catch {}
  }, [micro, sseBalances, initialBridgedItp])

  // Error handlers
  useEffect(() => {
    if (approveError) {
      const msg = approveError.message || 'Approval failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      setTxError(shortMsg)
      setMicro(-1)
      resetApprove()
    }
  }, [approveError, resetApprove])

  useEffect(() => {
    if (buyError) {
      const msg = buyError.message || 'Buy transaction failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      setTxError(shortMsg)
      setMicro(-1)
      resetBuy()
    }
  }, [buyError, resetBuy])

  // Stuck tx warning
  useEffect(() => {
    if (!isApproveConfirming && !isBuyConfirming) { setStuckWarning(false); return }
    const timer = setTimeout(() => setStuckWarning(true), 30_000)
    return () => clearTimeout(timer)
  }, [isApproveConfirming, isBuyConfirming])

  const clearTxHashes = useCallback(() => {
    setSavedApproveHash(null)
    setSavedBuyHash(null)
    setRelayTxHash(null)
    setBatchTxHash(null)
    setFillTxHash(null)
    setCollateralTxHash(null)
    setBridgeBackTxHash(null)
    setCompleteBridgeTxHash(null)
    setMintTxHash(null)
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
    setArbOrderId(null)
    setAmount('')
    setFillPrice(null)
    setFillAmount(null)
    setInitialBridgedItp(null)
    setSkippedApproval(false)
    clearTxHashes()
  }, [clearTxHashes])

  const formattedBalance = usdcBalance > 0n ? formatUnits(usdcBalance, 6) : '0'
  const isProcessing = isApprovePending || isApproveConfirming || isBuyPending || isBuyConfirming
  const isPending = isApprovePending || isBuyPending
  const isDone = micro === BuyMicro.DONE

  const buttonText = isApprovePending
    ? 'Confirm approval in wallet...'
    : isApproveConfirming
    ? 'Approving USDC...'
    : isBuyPending
    ? 'Confirm buy in wallet...'
    : isBuyConfirming
    ? 'Submitting order...'
    : needsApproval
    ? 'Approve & Buy'
    : 'Buy ITP'

  // --- Stepper data ---

  const effectiveMicro = useMemo(() => {
    if (micro < 0) return 0
    // If approval was skipped, shift micro-step 0 out
    if (skippedApproval && micro === BuyMicro.SUBMIT) return BuyMicro.SUBMIT
    return micro
  }, [micro, skippedApproval])

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
        explorerUrl: savedApproveHash ? getTxUrl(savedApproveHash, 'arb') : undefined,
        chain: 'arb',
      })
    }

    steps.push({
      label: getLabel(BuyMicro.SUBMIT),
      txHash: savedBuyHash ?? undefined,
      explorerUrl: savedBuyHash ? getTxUrl(savedBuyHash, 'arb') : undefined,
      chain: 'arb',
    })

    steps.push({ label: getLabel(BuyMicro.BRIDGE_TO_L3), chain: 'l3' })

    steps.push({
      label: getLabel(BuyMicro.RELAY),
      txHash: relayTxHash ?? undefined,
      explorerUrl: relayTxHash ? getTxUrl(relayTxHash, 'l3') : undefined,
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

    steps.push({
      label: getLabel(BuyMicro.RECORD_COLLATERAL),
      txHash: collateralTxHash ?? undefined,
      explorerUrl: collateralTxHash ? getTxUrl(collateralTxHash, 'l3') : undefined,
      chain: 'l3',
    })

    steps.push({ label: getLabel(BuyMicro.BRIDGE_TO_ARB), chain: 'l3' })

    steps.push({
      label: getLabel(BuyMicro.COMPLETE_BRIDGE),
      txHash: completeBridgeTxHash ?? undefined,
      explorerUrl: completeBridgeTxHash ? getTxUrl(completeBridgeTxHash, 'arb') : undefined,
      chain: 'arb',
    })

    steps.push({
      label: getLabel(BuyMicro.MINT_SHARES),
      txHash: mintTxHash ?? undefined,
      explorerUrl: mintTxHash ? getTxUrl(mintTxHash, 'arb') : undefined,
      chain: 'arb',
    })

    return steps
  }, [isPending, skippedApproval, savedApproveHash, savedBuyHash, relayTxHash, batchTxHash, fillTxHash, collateralTxHash, completeBridgeTxHash, mintTxHash])

  // Map internal micro enum to stepper array index (accounts for skipped approval)
  const stepperMicroIndex = useMemo(() => {
    if (isDone) return microSteps.length
    if (micro < 0) return 0
    // If approval was skipped, subtract 1 from all indices
    const offset = skippedApproval ? -1 : 0
    return Math.max(0, micro + offset)
  }, [micro, skippedApproval, isDone, microSteps.length])

  // Adjust step ranges for skipped approval
  const adjustedRanges = useMemo((): [number, number][] => {
    if (skippedApproval) {
      // Approval was skipped: micro array is 9 items (no approve), shift ranges down by 1
      return [
        [0, 1],    // Submit: just index 0 (submit)
        [1, 5],    // Process: bridge(1), relay(2), batch(3), fill(4)
        [5, 9],    // Deliver: collateral(5), bridgeArb(6), complete(7), mint(8)
      ]
    }
    return [
      [0, 2],    // Submit: approve(0), submit(1)
      [2, 6],    // Process: bridge(2), relay(3), batch(4), fill(5)
      [6, 10],   // Deliver: collateral(6), bridgeArb(7), complete(8), mint(9)
    ]
  }, [skippedApproval])

  const txRefs = useMemo(() => {
    const refs: { label: string; value: string }[] = []
    if (arbOrderId !== null) refs.push({ label: 'Arb', value: `#${arbOrderId.toString()}` })
    if (orderId !== null) refs.push({ label: 'L3', value: `#${orderId.toString()}` })
    return refs
  }, [arbOrderId, orderId])

  const renderFillDetails = () => {
    if (!fillPrice || !fillAmount) return null
    return (
      <div className="bg-muted border border-border-light rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-text-primary">Fill Details</p>
        <div className="text-xs font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-text-muted">Fill Price</span>
            <span className="text-text-primary tabular-nums">${parseFloat(formatUnits(fillPrice, 18)).toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Amount Filled</span>
            <span className="text-text-primary tabular-nums">{parseFloat(formatUnits(fillAmount, 18)).toFixed(4)} USDC</span>
          </div>
          {fillPrice > 0n && (
            <div className="flex justify-between">
              <span className="text-text-muted">Shares</span>
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
                <span className="text-text-muted">vs Limit</span>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border-light rounded-xl shadow-modal max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Buy {itpName}</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl leading-none">&times;</button>
          </div>
          {itpSymbol && <p className="text-text-secondary mb-1 font-mono">${itpSymbol}</p>}
          <p className="text-xs text-text-muted font-mono mb-4 break-all">ITP ID: {itpId}</p>

          {videoUrl && (
            <div className="aspect-video bg-zinc-950 rounded-lg overflow-hidden mb-4">
              <iframe
                src={videoUrl}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                title="ITP video"
              />
            </div>
          )}

          {!isConnected ? (
            <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
              <p className="text-text-secondary">Connect your wallet to buy ITP shares</p>
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

              {userShares > 0n && (
                <div className="bg-muted border border-border-light rounded-xl p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1">Your ITP Shares</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums font-mono">{parseFloat(formatUnits(userShares, 18)).toFixed(4)}</p>
                </div>
              )}

              {isDone ? (
                <button
                  onClick={handleReset}
                  className="w-full py-3 bg-color-up text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  Buy More
                </button>
              ) : (micro <= BuyMicro.SUBMIT) ? (
                <button
                  onClick={handleCancel}
                  className="w-full text-center text-sm text-text-muted hover:text-text-primary py-2 transition-colors"
                >
                  Cancel
                </button>
              ) : null}

              {stuckWarning && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-orange-500 text-sm">
                  <p className="font-medium">Transaction may be stuck</p>
                  <p className="text-xs mt-1">Not confirmed after 30s. You can cancel and try again.</p>
                </div>
              )}

              {txError && (
                <div className="bg-surface-down border border-color-down/30 rounded-lg p-4 text-color-down">
                  <p className="font-medium">Error</p>
                  <p className="text-sm mt-1 break-all">{txError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted border border-border-light rounded-xl p-4 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-text-muted">Amount (USDC)</label>
                    <span className="text-xs text-text-muted font-mono">Balance: {parseFloat(formattedBalance).toFixed(2)} USDC</span>
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
                  {amount && parsedAmount > (usdcBalance ?? 0n) && (
                    <p className="text-color-down text-xs mt-1">Insufficient USDC balance</p>
                  )}
                </div>
                {(usdcBalance ?? 0n) === 0n && (
                  <div className="flex items-center gap-3 pt-2 border-t border-border-light">
                    <button
                      onClick={handleMintTestUsdc}
                      disabled={isMintPending}
                      className="px-3 py-1.5 text-xs bg-muted text-text-secondary border border-border-medium rounded hover:border-zinc-500 disabled:opacity-50 transition-colors"
                    >
                      {isMintPending ? 'Minting...' : 'Mint 10,000 Test USDC'}
                    </button>
                    {isMintSuccess && <span className="text-xs text-color-up">Minted!</span>}
                    {mintError && <span className="text-xs text-color-down">Mint failed</span>}
                  </div>
                )}
              </div>

              <div className="bg-muted border border-border-light rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-text-muted">Max Price (USDC/share)</label>
                  {navPerShare > 0 && (
                    <span className="text-xs text-text-secondary font-mono">
                      NAV: ${navPerShare.toFixed(6)} ({pricedAssetCount}/{totalAssetCount} priced)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={isNavLoading ? 'Computing price...' : navPerShare === 0 ? 'Set limit price' : '0 (no limit)'}
                  min="0"
                  step="0.01"
                  className="w-full bg-card border border-border-medium rounded-lg px-4 py-2 text-text-primary font-mono tabular-nums focus:border-zinc-600 focus:outline-none"
                />
                {!isNavLoading && navPerShare === 0 && (
                  <p className="text-color-warning text-xs mt-2">
                    No asset prices available. Set a limit price manually or use 0 for no limit.
                  </p>
                )}
              </div>

              <div className="bg-muted border border-border-light rounded-xl p-4">
                <label className="block text-xs font-medium uppercase tracking-wider text-text-muted mb-3">Slippage</label>
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

              {hasNonceGap && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-orange-500 text-sm">
                  <p className="font-medium">Pending Transactions Detected</p>
                  <p className="text-xs mt-1">You have {pendingCount} pending transaction(s). New transactions may get stuck.</p>
                </div>
              )}

              <WalletActionButton
                onClick={needsApproval ? handleApprove : handleBuy}
                disabled={!amount || parsedAmount === 0n || isProcessing || parsedAmount > (usdcBalance ?? 0n) || hasNonceGap}
                className="w-full py-4 bg-color-up text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {buttonText}
              </WalletActionButton>

              {isProcessing && (
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
                  <p className="font-medium">Error</p>
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
