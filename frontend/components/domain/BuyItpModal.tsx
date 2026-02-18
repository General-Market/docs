'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAccount, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits, decodeEventLog, createPublicClient, http } from 'viem'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { ARB_CUSTODY_ABI, ERC20_ABI, INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { useUserState } from '@/hooks/useUserState'
import { useNonceCheck } from '@/hooks/useNonceCheck'
import { useItpNav } from '@/hooks/useItpNav'

// L3 client for direct contract reads (Index contract lives on L3, not Arb)
const L3_RPC = process.env.NEXT_PUBLIC_L3_RPC_URL || 'http://localhost:8545'
const ARB_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546'

/**
 * Buy flow phases — matches the real cross-chain flow:
 *
 * 1. APPROVE   — User approves USDC spend on Arb (if needed)
 * 2. SUBMIT    — User calls buyITPFromArbitrum on Arb → CrossChainOrderCreated
 * 3. RELAY     — Issuer nodes detect event → BLS consensus → bridge to L3 → submitOrderFor
 * 4. BATCH     — Issuers batch the order → confirmBatch (BLS) → AP nodes trade on CEX
 * 5. FILL      — Issuers confirm fill → confirmFills (BLS) → shares minted on L3
 * 6. RECEIVE   — Issuers bridge shares back to Arb → mintBridgedShares → user gets BridgedITP
 */
enum BuyPhase {
  INPUT = 0,
  APPROVE = 1,
  SUBMIT = 2,
  RELAY = 3,
  BATCH = 4,
  FILL = 5,
  RECEIVE = 6,
  DONE = 7,
}

const PROGRESS_STEPS = [
  { phase: BuyPhase.APPROVE, label: 'Approve', desc: 'USDC approval' },
  { phase: BuyPhase.SUBMIT, label: 'Submit', desc: 'Arb order tx' },
  { phase: BuyPhase.RELAY, label: 'Relay', desc: 'Consensus + bridge to L3' },
  { phase: BuyPhase.BATCH, label: 'Batch', desc: 'Batch + CEX trade' },
  { phase: BuyPhase.FILL, label: 'Fill', desc: 'Fill confirmation' },
  { phase: BuyPhase.RECEIVE, label: 'Receive', desc: 'Bridge shares to Arb' },
]

const PHASE_DESCRIPTIONS: Record<number, string | ((ctx: { isPending: boolean }) => string)> = {
  [BuyPhase.APPROVE]: (ctx) => ctx.isPending ? 'Confirm USDC approval in wallet...' : 'Waiting for approval confirmation...',
  [BuyPhase.SUBMIT]: (ctx) => ctx.isPending ? 'Confirm buy order in wallet...' : 'Waiting for Arb tx confirmation...',
  [BuyPhase.RELAY]: () => 'Issuer nodes: consensus + bridge relay to L3...',
  [BuyPhase.BATCH]: () => 'Order on L3, waiting for batch + CEX execution...',
  [BuyPhase.FILL]: () => 'Trades executed, waiting for fill confirmation...',
  [BuyPhase.RECEIVE]: () => 'Shares minted on L3, bridging to Arb...',
  [BuyPhase.DONE]: () => 'Complete! Shares received.',
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
  onClose: () => void
}

export function BuyItpModal({ itpId, onClose }: BuyItpModalProps) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  // Direct L3 client for polling (Index contract is on L3, not Arb)
  const l3Client = useMemo(() => createPublicClient({
    transport: http(L3_RPC, { timeout: 5_000, retryCount: 2 }),
  }), [])

  const [amount, setAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [slippageTier, setSlippageTier] = useState(2)
  const [deadlineHours, setDeadlineHours] = useState(1)
  const [phase, setPhase] = useState<BuyPhase>(BuyPhase.INPUT)
  const [orderId, setOrderId] = useState<bigint | null>(null)
  const [arbOrderId, setArbOrderId] = useState<bigint | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [l3BaseBlock, setL3BaseBlock] = useState<bigint>(0n)
  const [fillPrice, setFillPrice] = useState<bigint | null>(null)
  const [fillAmount, setFillAmount] = useState<bigint | null>(null)
  const [initialShares, setInitialShares] = useState<bigint | null>(null)
  const [skippedApproval, setSkippedApproval] = useState(false)

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

  // Get balances, allowances, and ITP metadata from backend
  const userState = useUserState(itpId)
  const itpName = userState.bridgedItpName || 'ITP'
  const itpSymbol = userState.bridgedItpSymbol || ''

  // Compute NAV from asset composition + real-time AP prices
  const { navPerShare, navPerShareBn, totalAssetCount, pricedAssetCount, isLoading: isNavLoading } = useItpNav(itpId)

  // Set limit price from computed NAV (with 5% buffer)
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
  const refetchShares = userState.refetch

  const {
    writeContract: writeMint,
    data: mintHash,
    isPending: isMintPending,
    error: mintError,
    reset: resetMint,
  } = useChainWriteContract()
  const { isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash: mintHash })

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

  // Snapshot L3 block + user shares before starting the flow
  const snapshotL3 = useCallback(async () => {
    try {
      const block = await l3Client.getBlockNumber()
      setL3BaseBlock(block > 10n ? block - 10n : 0n) // small buffer
    } catch {
      setL3BaseBlock(0n)
    }
    setInitialShares(userShares)
  }, [l3Client, userShares])

  const handleApprove = useCallback(async () => {
    if (!amount) return
    approveHandled.current = false
    setTxError(null)
    setSkippedApproval(false)
    await snapshotL3()
    setPhase(BuyPhase.APPROVE)
    writeApprove({
      address: INDEX_PROTOCOL.arbUsdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [INDEX_PROTOCOL.arbCustody, parsedAmount],
    })
  }, [amount, parsedAmount, writeApprove, snapshotL3])

  const handleBuy = useCallback(async () => {
    if (!publicClient || !amount) return
    buyHandled.current = false
    setTxError(null)

    // If going straight to buy (no approval needed), snapshot L3 now
    if (phase === BuyPhase.INPUT) {
      setSkippedApproval(true)
      await snapshotL3()
    }
    setPhase(BuyPhase.SUBMIT)

    let blockTimestamp: bigint
    try {
      const block = await publicClient.getBlock()
      blockTimestamp = block.timestamp
    } catch {
      blockTimestamp = BigInt(Math.floor(Date.now() / 1000))
    }

    const deadline = blockTimestamp + BigInt(deadlineHours * 3600)
    const priceBn = limitPrice ? parseUnits(limitPrice, 18) : 0n

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
  }, [publicClient, amount, limitPrice, deadlineHours, slippageTier, itpId, parsedAmount, writeBuy, phase, snapshotL3])

  // Approve success → auto-trigger buy
  useEffect(() => {
    if (!isApproveSuccess || approveHandled.current) return
    approveHandled.current = true
    refetchAllowance().then(() => {
      resetApprove()
      handleBuy()
    })
  }, [isApproveSuccess, refetchAllowance, resetApprove, handleBuy])

  // Buy success → extract Arb orderId, move to RELAY phase
  useEffect(() => {
    if (!isBuySuccess || !buyReceipt || buyHandled.current) return
    buyHandled.current = true

    // Try same-chain OrderSubmitted (direct L3 tx, unlikely for cross-chain)
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

    // Cross-chain: extract Arb orderId from CrossChainOrderCreated
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
      setPhase(BuyPhase.BATCH) // Already on L3, skip relay
    } else {
      setPhase(BuyPhase.RELAY) // Cross-chain: wait for relay
    }
    resetBuy()
  }, [isBuySuccess, buyReceipt, resetBuy])

  // RELAY phase: poll L3 for OrderSubmitted event using L3 block numbers
  useEffect(() => {
    if (phase !== BuyPhase.RELAY || orderId !== null || !l3Client) return

    let cancelled = false
    const poll = async () => {
      try {
        const logs = await l3Client.getLogs({
          address: INDEX_PROTOCOL.index,
          event: {
            type: 'event',
            name: 'OrderSubmitted',
            inputs: [
              { indexed: true, name: 'orderId', type: 'uint256' },
              { indexed: true, name: 'user', type: 'address' },
              { indexed: true, name: 'itpId', type: 'bytes32' },
              { indexed: false, name: 'pairId', type: 'bytes32' },
              { indexed: false, name: 'side', type: 'uint8' },
              { indexed: false, name: 'amount', type: 'uint256' },
              { indexed: false, name: 'limitPrice', type: 'uint256' },
              { indexed: false, name: 'slippageTier', type: 'uint256' },
              { indexed: false, name: 'deadline', type: 'uint256' },
            ],
          },
          args: {
            itpId: itpId as `0x${string}`,
          },
          fromBlock: l3BaseBlock,
          toBlock: 'latest',
        })

        if (cancelled) return
        if (logs.length > 0) {
          const latest = logs[logs.length - 1]
          const realOrderId = (latest.args as any).orderId as bigint
          setOrderId(realOrderId)
          setPhase(BuyPhase.BATCH)
        }
      } catch {
        // Retry on next interval
      }
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [phase, orderId, l3Client, l3BaseBlock, itpId])

  // BATCH/FILL phases: poll L3 getOrder directly for status changes + FillConfirmed
  useEffect(() => {
    if ((phase !== BuyPhase.BATCH && phase !== BuyPhase.FILL) || orderId === null || !l3Client) return

    let cancelled = false
    const poll = async () => {
      try {
        // Read order status directly from L3 Index contract
        const order = await l3Client.readContract({
          address: INDEX_PROTOCOL.index,
          abi: INDEX_ABI,
          functionName: 'getOrder',
          args: [orderId],
        }) as any

        if (cancelled) return

        const status = Number(order.status ?? order[10] ?? 0)
        if (status >= 2 && phase < BuyPhase.FILL) {
          // FILLED — also fetch fill details from FillConfirmed event
          setPhase(BuyPhase.FILL)
          try {
            const fillLogs = await l3Client.getLogs({
              address: INDEX_PROTOCOL.index,
              event: {
                type: 'event',
                name: 'FillConfirmed',
                inputs: [
                  { indexed: true, name: 'orderId', type: 'uint256' },
                  { indexed: true, name: 'cycleNumber', type: 'uint256' },
                  { indexed: false, name: 'fillPrice', type: 'uint256' },
                  { indexed: false, name: 'fillAmount', type: 'uint256' },
                ],
              },
              args: { orderId },
              fromBlock: l3BaseBlock,
              toBlock: 'latest',
            })
            if (fillLogs.length > 0) {
              const f = fillLogs[fillLogs.length - 1]
              setFillPrice((f.args as any).fillPrice as bigint)
              setFillAmount((f.args as any).fillAmount as bigint)
            }
          } catch {}
        } else if (status >= 1 && phase < BuyPhase.BATCH) {
          setPhase(BuyPhase.BATCH)
        }
      } catch {
        // Retry on next interval
      }
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [phase, orderId, l3Client, l3BaseBlock])

  // FILL → RECEIVE: once filled on L3, poll Arb for BridgedITP balance increase
  useEffect(() => {
    if (phase !== BuyPhase.FILL) return

    // After fill, wait a bit then start checking for share arrival
    const timer = setTimeout(() => setPhase(BuyPhase.RECEIVE), 2000)
    return () => clearTimeout(timer)
  }, [phase])

  // RECEIVE: poll user's BridgedITP balance on Arb until it increases
  useEffect(() => {
    if (phase !== BuyPhase.RECEIVE) return

    let cancelled = false
    const poll = async () => {
      await refetchShares()
      if (cancelled) return
      // Compare with initial shares — if increased, shares have arrived
      if (initialShares !== null && userShares > initialShares) {
        setPhase(BuyPhase.DONE)
      }
    }

    const interval = setInterval(poll, 3000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [phase, refetchShares, userShares, initialShares])

  // Error handlers
  useEffect(() => {
    if (approveError) {
      const msg = approveError.message || 'Approval failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      setTxError(shortMsg)
      setPhase(BuyPhase.INPUT)
      resetApprove()
    }
  }, [approveError, resetApprove])

  useEffect(() => {
    if (buyError) {
      const msg = buyError.message || 'Buy transaction failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      setTxError(shortMsg)
      setPhase(BuyPhase.INPUT)
      resetBuy()
    }
  }, [buyError, resetBuy])

  // Stuck tx warning
  useEffect(() => {
    if (!isApproveConfirming && !isBuyConfirming) { setStuckWarning(false); return }
    const timer = setTimeout(() => setStuckWarning(true), 30_000)
    return () => clearTimeout(timer)
  }, [isApproveConfirming, isBuyConfirming])

  const handleCancel = useCallback(() => {
    resetApprove()
    resetBuy()
    setPhase(BuyPhase.INPUT)
    setTxError(null)
    setStuckWarning(false)
    refreshNonce()
  }, [resetApprove, resetBuy, refreshNonce])

  const handleReset = useCallback(() => {
    setPhase(BuyPhase.INPUT)
    setOrderId(null)
    setArbOrderId(null)
    setAmount('')
    setFillPrice(null)
    setFillAmount(null)
    setInitialShares(null)
    setL3BaseBlock(0n)
    setSkippedApproval(false)
  }, [])

  const formattedBalance = usdcBalance > 0n ? formatUnits(usdcBalance, 6) : '0'
  const isProcessing = isApprovePending || isApproveConfirming || isBuyPending || isBuyConfirming
  const isPending = isApprovePending || isBuyPending

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

  // --- Render ---

  const renderProgressDiagram = () => {
    const steps = PROGRESS_STEPS.filter(s => {
      // Hide APPROVE step if it wasn't needed
      if (s.phase === BuyPhase.APPROVE && skippedApproval) return false
      return true
    })

    return (
      <div className="bg-terminal-dark border border-white/10 rounded-lg p-5">
        {/* Step circles + connectors */}
        <div className="flex items-start">
          {steps.map((s, i) => {
            const isDone = phase > s.phase
            const isCurrent = phase === s.phase
            return (
              <div key={s.phase} className="flex items-start flex-1">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    isDone ? 'bg-green-500 text-white' :
                    isCurrent ? 'bg-accent text-terminal ring-2 ring-accent/40 shadow-[0_0_12px_rgba(var(--accent-rgb,0,255,136),0.3)]' :
                    'bg-white/5 text-white/20 border border-white/10'
                  }`}>
                    {isDone ? '\u2713' : isCurrent ? (
                      <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1.5 text-center leading-tight font-medium ${
                    isDone ? 'text-green-400' : isCurrent ? 'text-accent' : 'text-white/20'
                  }`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 flex-shrink-0 w-full mt-4 mx-0.5 transition-all duration-300 ${
                    isDone ? 'bg-green-500/60' : 'bg-white/5'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Current phase description */}
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-center text-sm text-white/50">
            {(() => {
              const desc = PHASE_DESCRIPTIONS[phase]
              if (!desc) return ''
              return typeof desc === 'function' ? desc({ isPending }) : desc
            })()}
          </p>
        </div>

        {/* Order IDs */}
        {(arbOrderId !== null || orderId !== null) && (
          <div className="mt-2 flex justify-center gap-4 text-[10px] font-mono text-white/25">
            {arbOrderId !== null && <span>Arb #{arbOrderId.toString()}</span>}
            {orderId !== null && <span>L3 #{orderId.toString()}</span>}
          </div>
        )}
      </div>
    )
  }

  const renderFillDetails = () => {
    if (!fillPrice || !fillAmount) return null
    return (
      <div className="bg-terminal-dark border border-white/10 rounded-lg p-4 space-y-2">
        <p className="text-sm font-bold text-accent">Fill Details</p>
        <div className="text-xs font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-white/50">Fill Price</span>
            <span className="text-white">${parseFloat(formatUnits(fillPrice, 18)).toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Amount Filled</span>
            <span className="text-white">{parseFloat(formatUnits(fillAmount, 18)).toFixed(4)} USDC</span>
          </div>
          {fillPrice > 0n && (
            <div className="flex justify-between">
              <span className="text-white/50">Shares</span>
              <span className="text-white">
                {parseFloat(formatUnits((fillAmount * BigInt(1e18)) / fillPrice, 18)).toFixed(4)}
              </span>
            </div>
          )}
          {limitPrice && parseFloat(limitPrice) > 0 && fillPrice > 0n && (() => {
            const limitBn = BigInt(Math.floor(parseFloat(limitPrice) * 1e18))
            const slippage = Number(fillPrice - limitBn) * 100 / Number(limitBn)
            return (
              <div className="flex justify-between">
                <span className="text-white/50">vs Limit</span>
                <span className={Math.abs(slippage) < 1 ? 'text-green-400' : Math.abs(slippage) < 3 ? 'text-yellow-400' : 'text-red-400'}>
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-terminal border border-white/20 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-accent">Buy {itpName}</h2>
            <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">&times;</button>
          </div>
          {itpSymbol && <p className="text-white/70 mb-1 font-mono">${itpSymbol}</p>}
          <p className="text-xs text-white/40 font-mono mb-6 break-all">ITP ID: {itpId}</p>

          {!isConnected ? (
            <div className="bg-terminal-dark border border-white/10 rounded-lg p-8 text-center">
              <p className="text-white/70">Connect your wallet to buy ITP shares</p>
            </div>
          ) : phase >= BuyPhase.APPROVE ? (
            <div className="space-y-4">
              {renderProgressDiagram()}
              {renderFillDetails()}

              {userShares > 0n && (
                <div className="bg-terminal-dark border border-white/10 rounded-lg p-4">
                  <p className="text-sm text-white/70">Your ITP Shares</p>
                  <p className="text-2xl font-bold text-accent">{parseFloat(formatUnits(userShares, 18)).toFixed(4)}</p>
                </div>
              )}

              {phase === BuyPhase.DONE ? (
                <button
                  onClick={handleReset}
                  className="w-full py-3 bg-accent text-terminal font-bold rounded-lg hover:bg-accent/90 transition-colors"
                >
                  Buy More
                </button>
              ) : (phase <= BuyPhase.SUBMIT) ? (
                <button
                  onClick={handleCancel}
                  className="w-full text-center text-sm text-white/50 hover:text-white/80 py-2 transition-colors"
                >
                  Cancel
                </button>
              ) : null}

              {stuckWarning && (
                <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
                  <p className="font-bold">Transaction may be stuck</p>
                  <p className="text-xs mt-1">Not confirmed after 30s. You can cancel and try again.</p>
                </div>
              )}

              {txError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400">
                  <p className="font-bold">Error</p>
                  <p className="text-sm mt-1 break-all">{txError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-terminal-dark border border-white/10 rounded-lg p-4 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-white/70">Amount (USDC)</label>
                    <span className="text-xs text-white/40">Balance: {parseFloat(formattedBalance).toFixed(2)} USDC</span>
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g., 100"
                    min="0"
                    step="1"
                    className="w-full bg-terminal border border-white/20 rounded px-4 py-3 text-white text-lg focus:border-accent focus:outline-none"
                  />
                  {amount && parsedAmount > (usdcBalance ?? 0n) && (
                    <p className="text-red-400 text-xs mt-1">Insufficient USDC balance</p>
                  )}
                </div>
                {(usdcBalance ?? 0n) === 0n && (
                  <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                    <button
                      onClick={handleMintTestUsdc}
                      disabled={isMintPending}
                      className="px-3 py-1.5 text-xs bg-accent/20 text-accent border border-accent/30 rounded hover:bg-accent/30 disabled:opacity-50 transition-colors"
                    >
                      {isMintPending ? 'Minting...' : 'Mint 10,000 Test USDC'}
                    </button>
                    {isMintSuccess && <span className="text-xs text-green-400">Minted!</span>}
                    {mintError && <span className="text-xs text-red-400">Mint failed</span>}
                  </div>
                )}
              </div>

              <div className="bg-terminal-dark border border-white/10 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-white/70">Max Price (USDC/share)</label>
                  {navPerShare > 0 && (
                    <span className="text-xs text-accent font-mono">
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
                  className="w-full bg-terminal border border-white/20 rounded px-4 py-2 text-white focus:border-accent focus:outline-none"
                />
                {!isNavLoading && navPerShare === 0 && (
                  <p className="text-orange-400 text-xs mt-2">
                    No asset prices available. Set a limit price manually or use 0 for no limit.
                  </p>
                )}
              </div>

              <div className="bg-terminal-dark border border-white/10 rounded-lg p-4">
                <label className="block text-sm text-white/70 mb-3">Slippage</label>
                <div className="flex gap-2">
                  {SLIPPAGE_TIERS.map(tier => (
                    <button
                      key={tier.value}
                      onClick={() => setSlippageTier(tier.value)}
                      className={`flex-1 py-2 rounded border text-sm font-mono transition-colors ${
                        slippageTier === tier.value
                          ? 'border-accent text-accent bg-accent/10'
                          : 'border-white/20 text-white/50 hover:border-white/40'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              {hasNonceGap && (
                <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
                  <p className="font-bold">Pending Transactions Detected</p>
                  <p className="text-xs mt-1">You have {pendingCount} pending transaction(s). New transactions may get stuck.</p>
                </div>
              )}

              <WalletActionButton
                onClick={needsApproval ? handleApprove : handleBuy}
                disabled={!amount || parsedAmount === 0n || isProcessing || parsedAmount > (usdcBalance ?? 0n) || hasNonceGap}
                className="w-full py-4 bg-accent text-terminal font-bold rounded-lg hover:bg-accent/90 disabled:bg-white/20 disabled:text-white/50 disabled:cursor-not-allowed transition-colors"
              >
                {buttonText}
              </WalletActionButton>

              {isProcessing && (
                <button
                  onClick={handleCancel}
                  className="w-full text-center text-sm text-white/50 hover:text-white/80 py-2 transition-colors"
                >
                  Cancel
                </button>
              )}

              {stuckWarning && (
                <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
                  <p className="font-bold">Transaction may be stuck</p>
                  <p className="text-xs mt-1">Not confirmed after 30s. You can cancel and try again.</p>
                </div>
              )}

              {txError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-400">
                  <p className="font-bold">Error</p>
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
