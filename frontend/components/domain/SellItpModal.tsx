'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAccount, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits, decodeEventLog } from 'viem'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { TransactionStepper } from '@/components/ui/TransactionStepper'
import type { MicroStep, VisibleStep } from '@/components/ui/TransactionStepper'
import { getTxUrl } from '@/lib/utils/basescan'
import { useUserState } from '@/hooks/useUserState'
import { useItpCostBasis } from '@/hooks/useItpCostBasis'
import { useItpNav } from '@/hooks/useItpNav'
import { useSSEOrders, useSSEBalances, type UserOrder } from '@/hooks/useSSE'

const SLIPPAGE_TIERS = [
  { value: 0, label: '0.3%', description: 'Tight' },
  { value: 1, label: '1%', description: 'Normal' },
  { value: 2, label: '3%', description: 'Relaxed' },
]

const ARB_CUSTODY_SELL_ABI = [
  {
    inputs: [
      { name: 'itpId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
      { name: 'limitPrice', type: 'uint256' },
      { name: 'slippageTier', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'sellITPFromArbitrum',
    outputs: [{ name: 'orderId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: true, name: 'itpId', type: 'bytes32' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'bridgedItpAddress', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'CrossChainSellOrderCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: false, name: 'usdcProceeds', type: 'uint256' },
    ],
    name: 'SellOrderCompleted',
    type: 'event',
  },
] as const

/**
 * Sell flow micro-steps — 8 steps mapped to 3 visible steps + Done:
 *
 * Step 1 "Submit":   APPROVE (0), SUBMIT (1)
 * Step 2 "Process":  RELAY (2), BATCH (3), FILL (4)
 * Step 3 "Deliver":  RECORD_COLLATERAL (5), BRIDGE_TO_ARB (6), COMPLETE_SELL (7)
 * Done:              DONE (8)
 */
enum SellMicro {
  APPROVE = 0,
  SUBMIT = 1,
  RELAY = 2,
  BATCH = 3,
  FILL = 4,
  RECORD_COLLATERAL = 5,
  BRIDGE_TO_ARB = 6,
  COMPLETE_SELL = 7,
  DONE = 8,
}

const VISIBLE_STEPS: VisibleStep[] = [
  { label: 'Submit' },
  { label: 'Process' },
  { label: 'Deliver' },
]

const STEP_RANGES: [number, number][] = [
  [SellMicro.APPROVE, SellMicro.RELAY],           // Submit: 0-1
  [SellMicro.RELAY, SellMicro.RECORD_COLLATERAL], // Process: 2-4
  [SellMicro.RECORD_COLLATERAL, SellMicro.DONE],  // Deliver: 5-7
]

const MICRO_LABELS: Record<number, string | ((ctx: { isPending: boolean }) => string)> = {
  [SellMicro.APPROVE]: (ctx) => ctx.isPending ? 'Confirm BridgedITP approval in wallet...' : 'Approving shares...',
  [SellMicro.SUBMIT]: (ctx) => ctx.isPending ? 'Confirm sell order in wallet...' : 'Submitting sell order...',
  [SellMicro.RELAY]: () => 'Relaying sell to L3...',
  [SellMicro.BATCH]: () => 'Batching order...',
  [SellMicro.FILL]: () => 'Executing trades...',
  [SellMicro.RECORD_COLLATERAL]: () => 'Recording collateral...',
  [SellMicro.BRIDGE_TO_ARB]: () => 'Bridging USDC to Arbitrum...',
  [SellMicro.COMPLETE_SELL]: () => 'Completing sell order...',
  [SellMicro.DONE]: () => 'USDC received!',
}

interface SellItpModalProps {
  itpId: string
  videoUrl?: string
  onClose: () => void
}

export function SellItpModal({ itpId, videoUrl, onClose }: SellItpModalProps) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  // SSE-driven order & balance tracking (replaces L3 polling)
  const sseOrders = useSSEOrders()
  const sseBalances = useSSEBalances()

  const [amount, setAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('0')
  const [slippageTier, setSlippageTier] = useState(2)
  const [deadlineHours, setDeadlineHours] = useState(1)
  const [micro, setMicro] = useState<number>(-1) // -1 = INPUT mode
  const [orderId, setOrderId] = useState<bigint | null>(null)
  const [l3OrderId, setL3OrderId] = useState<bigint | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [bridgedItpAddress, setBridgedItpAddress] = useState<`0x${string}` | null>(null)
  const [skippedApproval, setSkippedApproval] = useState(false)
  const [fillPrice, setFillPrice] = useState<bigint | null>(null)
  const [fillAmount, setFillAmount] = useState<bigint | null>(null)
  const [usdcProceeds, setUsdcProceeds] = useState<bigint | null>(null)
  const [initialUsdcArb, setInitialUsdcArb] = useState<string | null>(null)

  // Saved tx hashes
  const [savedApproveHash, setSavedApproveHash] = useState<string | null>(null)
  const [savedSellHash, setSavedSellHash] = useState<string | null>(null)
  const [relayTxHash, setRelayTxHash] = useState<string | null>(null)
  const [batchTxHash, setBatchTxHash] = useState<string | null>(null)
  const [fillTxHash, setFillTxHash] = useState<string | null>(null)
  const [completeSellTxHash, setCompleteSellTxHash] = useState<string | null>(null)

  const { writeContract, data: hash, isPending, error: writeError, reset } = useChainWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  const approveHandled = useRef(false)
  const sellHandled = useRef(false)

  const userState = useUserState(itpId)
  const itpName = userState.bridgedItpName || 'ITP'
  const itpSymbol = userState.bridgedItpSymbol || ''

  useEffect(() => {
    const addr = userState.bridgedItpAddress
    if (addr && addr !== '0x0000000000000000000000000000000000000000') {
      setBridgedItpAddress(addr as `0x${string}`)
    }
  }, [userState.bridgedItpAddress])

  const userShares = userState.bridgedItpBalance
  const allowance = userState.bridgedItpAllowanceCustody
  const refetchAllowance = userState.refetch

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

  const arbUsdcBalance = userState.usdcBalance

  const parsedAmount = amount ? parseUnits(amount, 18) : 0n
  const insufficientShares = parsedAmount > 0n && parsedAmount > userShares
  const needsApproval = parsedAmount > 0n && allowance < parsedAmount

  const snapshotBalances = useCallback(() => {
    setInitialUsdcArb(sseBalances?.usdc_arb ?? null)
  }, [sseBalances])

  const handleSell = useCallback(async () => {
    if (!publicClient || !amount || insufficientShares || !bridgedItpAddress) return
    setTxError(null)
    approveHandled.current = false
    sellHandled.current = false
    snapshotBalances()

    if (needsApproval) {
      setSkippedApproval(false)
      setMicro(SellMicro.APPROVE)
      writeContract({
        address: bridgedItpAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [INDEX_PROTOCOL.arbCustody, parsedAmount],
      })
    } else {
      setSkippedApproval(true)
      await submitSell()
    }
  }, [publicClient, amount, insufficientShares, bridgedItpAddress, needsApproval, parsedAmount, writeContract, snapshotBalances])

  const submitSell = useCallback(async () => {
    if (!publicClient) return
    sellHandled.current = false
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

    writeContract({
      address: INDEX_PROTOCOL.arbCustody,
      abi: ARB_CUSTODY_SELL_ABI,
      functionName: 'sellITPFromArbitrum',
      args: [
        itpId as `0x${string}`,
        parsedAmount,
        priceBn,
        BigInt(slippageTier),
        deadline,
      ],
    })
  }, [publicClient, deadlineHours, limitPrice, slippageTier, itpId, parsedAmount, writeContract])

  // Handle tx success
  useEffect(() => {
    if (!isSuccess || !receipt) return

    if (micro === SellMicro.APPROVE && !approveHandled.current) {
      approveHandled.current = true
      if (hash) setSavedApproveHash(hash)
      reset()
      refetchAllowance()
      setTimeout(() => submitSell(), 500)
      return
    }

    if (micro === SellMicro.SUBMIT && !sellHandled.current) {
      sellHandled.current = true
      if (hash) setSavedSellHash(hash)

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== INDEX_PROTOCOL.arbCustody.toLowerCase()) continue
        try {
          const decoded = decodeEventLog({
            abi: ARB_CUSTODY_SELL_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'CrossChainSellOrderCreated') {
            setOrderId((decoded.args as any).orderId)
            break
          }
        } catch {}
      }
      setMicro(SellMicro.RELAY)
      reset()
    }
  }, [isSuccess, receipt, micro, hash, reset, refetchAllowance, submitSell])

  // SSE-driven order tracking: RELAY -> BATCH -> FILL -> RECORD_COLLATERAL
  // Finds the matching order in sseOrders by l3OrderId (if known) or by itpId + side=1 (sell)
  const trackedOrder = useMemo((): UserOrder | undefined => {
    if (micro < SellMicro.RELAY || micro >= SellMicro.RECORD_COLLATERAL) return undefined
    if (l3OrderId !== null) {
      return sseOrders.find(o => o.order_id === Number(l3OrderId))
    }
    // Before we know the L3 orderId, match by itpId and side=1 (sell), pick most recent
    const candidates = sseOrders
      .filter(o => o.itp_id === itpId && o.side === 1)
      .sort((a, b) => b.timestamp - a.timestamp)
    return candidates[0]
  }, [sseOrders, l3OrderId, micro, itpId])

  useEffect(() => {
    if (!trackedOrder || micro < SellMicro.RELAY || micro >= SellMicro.RECORD_COLLATERAL) return

    // Capture l3OrderId when first seen
    if (l3OrderId === null) {
      setL3OrderId(BigInt(trackedOrder.order_id))
    }

    // Advance through RELAY -> BATCH based on order status
    if (micro === SellMicro.RELAY) {
      setMicro(SellMicro.BATCH)
    }

    const status = trackedOrder.status

    if (status >= 2 && micro < SellMicro.RECORD_COLLATERAL) {
      // FILLED — capture fill details from SSE
      if (trackedOrder.fill_price) {
        try { setFillPrice(BigInt(trackedOrder.fill_price)) } catch {}
      }
      if (trackedOrder.fill_amount) {
        try { setFillAmount(BigInt(trackedOrder.fill_amount)) } catch {}
      }
      setMicro(SellMicro.RECORD_COLLATERAL)
    } else if (status >= 1 && micro < SellMicro.FILL) {
      // BATCHED
      setMicro(SellMicro.FILL)
    }
  }, [trackedOrder, micro, l3OrderId])

  // RECORD_COLLATERAL: timer-based advance (~2s after fill)
  useEffect(() => {
    if (micro !== SellMicro.RECORD_COLLATERAL) return
    const timer = setTimeout(() => setMicro(SellMicro.BRIDGE_TO_ARB), 2000)
    return () => clearTimeout(timer)
  }, [micro])

  // BRIDGE_TO_ARB: timer-based advance
  useEffect(() => {
    if (micro !== SellMicro.BRIDGE_TO_ARB) return
    const timer = setTimeout(() => setMicro(SellMicro.COMPLETE_SELL), 3000)
    return () => clearTimeout(timer)
  }, [micro])

  // COMPLETE_SELL: detect USDC balance increase via SSE
  useEffect(() => {
    if (micro < SellMicro.COMPLETE_SELL || micro >= SellMicro.DONE) return
    if (!sseBalances || initialUsdcArb === null) return

    const currentUsdcArb = sseBalances.usdc_arb
    try {
      if (BigInt(currentUsdcArb) > BigInt(initialUsdcArb)) {
        // Calculate proceeds from balance difference
        const proceeds = BigInt(currentUsdcArb) - BigInt(initialUsdcArb)
        setUsdcProceeds(proceeds)
        setMicro(SellMicro.DONE)
      }
    } catch {}
  }, [micro, sseBalances, initialUsdcArb])

  useEffect(() => {
    if (writeError) {
      const msg = writeError.message || 'Transaction failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      setTxError(shortMsg)
      setMicro(-1)
    }
  }, [writeError])

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
    setSavedApproveHash(null)
    setSavedSellHash(null)
    setRelayTxHash(null)
    setBatchTxHash(null)
    setFillTxHash(null)
    setCompleteSellTxHash(null)
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
    setL3OrderId(null)
    setAmount('')
    setSkippedApproval(false)
    setFillPrice(null)
    setFillAmount(null)
    setUsdcProceeds(null)
    setInitialUsdcArb(null)
    clearTxHashes()
  }, [clearTxHashes])

  // --- Stepper data ---
  const isDone = micro === SellMicro.DONE

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
        explorerUrl: savedApproveHash ? getTxUrl(savedApproveHash, 'arb') : undefined,
        chain: 'arb',
      })
    }

    steps.push({
      label: getLabel(SellMicro.SUBMIT),
      txHash: savedSellHash ?? undefined,
      explorerUrl: savedSellHash ? getTxUrl(savedSellHash, 'arb') : undefined,
      chain: 'arb',
    })

    steps.push({
      label: getLabel(SellMicro.RELAY),
      txHash: relayTxHash ?? undefined,
      explorerUrl: relayTxHash ? getTxUrl(relayTxHash, 'l3') : undefined,
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

    steps.push({ label: getLabel(SellMicro.RECORD_COLLATERAL), chain: 'l3' })

    steps.push({ label: getLabel(SellMicro.BRIDGE_TO_ARB), chain: 'l3' })

    steps.push({
      label: getLabel(SellMicro.COMPLETE_SELL),
      txHash: completeSellTxHash ?? undefined,
      explorerUrl: completeSellTxHash ? getTxUrl(completeSellTxHash, 'arb') : undefined,
      chain: 'arb',
    })

    return steps
  }, [isPending, skippedApproval, savedApproveHash, savedSellHash, relayTxHash, batchTxHash, fillTxHash, completeSellTxHash])

  const stepperMicroIndex = useMemo(() => {
    if (isDone) return microSteps.length
    if (micro < 0) return 0
    const offset = skippedApproval ? -1 : 0
    return Math.max(0, micro + offset)
  }, [micro, skippedApproval, isDone, microSteps.length])

  const adjustedRanges = useMemo((): [number, number][] => {
    if (skippedApproval) {
      // 7 items: submit(0), relay(1), batch(2), fill(3), collateral(4), bridge(5), complete(6)
      return [
        [0, 1],    // Submit: submit(0)
        [1, 4],    // Process: relay(1), batch(2), fill(3)
        [4, 7],    // Deliver: collateral(4), bridge(5), complete(6)
      ]
    }
    return [
      [0, 2],    // Submit: approve(0), submit(1)
      [2, 5],    // Process: relay(2), batch(3), fill(4)
      [5, 8],    // Deliver: collateral(5), bridge(6), complete(7)
    ]
  }, [skippedApproval])

  const txRefs = useMemo(() => {
    const refs: { label: string; value: string }[] = []
    if (orderId !== null) refs.push({ label: 'Arb', value: `#${orderId.toString()}` })
    if (l3OrderId !== null) refs.push({ label: 'L3', value: `#${l3OrderId.toString()}` })
    return refs
  }, [orderId, l3OrderId])

  const buttonText = isPending
    ? 'Waiting for wallet...'
    : isConfirming
    ? (micro === SellMicro.APPROVE ? 'Approving...' : 'Submitting...')
    : needsApproval
    ? 'Approve & Sell'
    : 'Sell Shares'

  const renderFillDetails = () => {
    if (!fillPrice || !fillAmount) return null

    const proceeds = usdcProceeds ?? ((fillAmount * fillPrice) / BigInt(1e18))

    return (
      <div className="bg-muted border border-border-light rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-text-primary">Fill Details</p>
        <div className="text-xs font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-text-muted">Fill Price</span>
            <span className="text-text-primary tabular-nums">${parseFloat(formatUnits(fillPrice, 18)).toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Shares Sold</span>
            <span className="text-text-primary tabular-nums">{parseFloat(formatUnits(fillAmount, 18)).toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">USDC Proceeds</span>
            <span className="text-text-primary tabular-nums">${parseFloat(formatUnits(proceeds, 6)).toFixed(2)}</span>
          </div>
          {/* P&L vs cost basis */}
          {costBasis && costBasis.avgCostPerShare > 0n && fillPrice > 0n && (() => {
            const costOfShares = (fillAmount * costBasis.avgCostPerShare) / BigInt(1e18)
            const pnl = proceeds - costOfShares
            const pnlPct = Number(costOfShares) > 0 ? Number(pnl) * 100 / Number(costOfShares) : 0
            return (
              <div className="flex justify-between pt-1 border-t border-border-light">
                <span className="text-text-muted">P&amp;L vs Cost</span>
                <span className={pnl >= 0n ? 'text-color-up' : 'text-color-down'}>
                  {pnl >= 0n ? '+' : ''}${parseFloat(formatUnits(pnl, 6)).toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
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
            <h2 className="text-lg font-semibold text-text-primary">Sell {itpName}</h2>
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
              <p className="text-text-secondary">Connect your wallet to sell ITP shares</p>
            </div>
          ) : !bridgedItpAddress ? (
            <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
              <p className="text-text-secondary">No BridgedITP found for this ITP. It may not have been created via BridgeProxy yet.</p>
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

              {isDone && arbUsdcBalance > 0n && (
                <div className="bg-muted border border-border-light rounded-xl p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1">Your USDC Balance (Arbitrum)</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums font-mono">{formatUnits(arbUsdcBalance, 6)} USDC</p>
                </div>
              )}

              {isDone ? (
                <button
                  onClick={handleReset}
                  className="w-full py-3 bg-color-down text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  Sell More
                </button>
              ) : micro <= SellMicro.SUBMIT ? (
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
              <div className="bg-muted border border-border-light rounded-xl p-4 flex justify-between items-center">
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Your BridgedITP Shares</span>
                <span className="text-2xl font-bold text-text-primary tabular-nums font-mono">{parseFloat(formatUnits(userShares, 18)).toFixed(4)}</span>
              </div>

              {userShares === 0n ? (
                <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
                  <p className="text-text-secondary">You don&apos;t have any BridgedITP shares to sell</p>
                </div>
              ) : (
                <>
                  <div className="bg-muted border border-border-light rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-text-muted">Shares to Sell</label>
                      <button
                        onClick={() => setAmount(formatUnits(userShares, 18))}
                        className="text-xs text-zinc-700 hover:text-zinc-900"
                      >
                        Max
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
                      <p className="text-color-down text-xs mt-1">Insufficient BridgedITP shares</p>
                    )}
                  </div>

                  <div className="bg-muted border border-border-light rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-text-muted">Min Price (USDC/share)</label>
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
                      placeholder={isNavLoading ? 'Computing price...' : navPerShare === 0 ? 'Set min price' : '0 (no limit)'}
                      min="0"
                      step="0.01"
                      className="w-full bg-card border border-border-medium rounded-lg px-4 py-2 text-text-primary font-mono tabular-nums focus:border-zinc-600 focus:outline-none"
                    />
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

                  {/* P&L Preview */}
                  {parsedAmount > 0n && costBasis && costBasis.avgCostPerShare > 0n && (
                    <div className="bg-muted border border-border-light rounded-xl p-4 space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">Estimated P&amp;L</p>
                      <div className="text-xs font-mono space-y-1">
                        <div className="flex justify-between">
                          <span className="text-text-muted">Avg Cost Basis</span>
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
                                <span className="text-text-muted">Current NAV</span>
                                <span className="text-text-primary tabular-nums">${navPerShare.toFixed(6)}/share</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-muted">Est. Proceeds</span>
                                <span className="text-text-primary tabular-nums">${parseFloat(formatUnits(estimatedProceeds, 18)).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-border-light">
                                <span className="text-text-muted">Est. P&amp;L</span>
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
                      <p className="font-medium">Error</p>
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
