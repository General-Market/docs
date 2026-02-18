'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits, decodeEventLog } from 'viem'
import { OrderStatusTracker } from '@/components/domain/OrderStatusTracker'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { ARB_CUSTODY_ABI, ERC20_ABI, INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useUserState } from '@/hooks/useUserState'
import { useNonceCheck } from '@/hooks/useNonceCheck'
import { useItpNav } from '@/hooks/useItpNav'
import { useFillDetails } from '@/hooks/useFillDetails'

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

  const [amount, setAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [slippageTier, setSlippageTier] = useState(2)
  const [deadlineHours, setDeadlineHours] = useState(1)
  const [step, setStep] = useState<'input' | 'approving' | 'buying' | 'tracking'>('input')
  const [orderId, setOrderId] = useState<bigint | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [buyTxBlock, setBuyTxBlock] = useState<bigint | null>(null)

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

  const { fill: fillDetails } = useFillDetails(orderId)
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

  const handleApprove = useCallback(() => {
    if (!amount) return
    approveHandled.current = false
    setTxError(null)
    setStep('approving')
    writeApprove({
      address: INDEX_PROTOCOL.arbUsdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [INDEX_PROTOCOL.arbCustody, parsedAmount],

    })
  }, [amount, parsedAmount, writeApprove])

  const handleBuy = useCallback(async () => {
    if (!publicClient || !amount) return
    buyHandled.current = false
    setTxError(null)
    setStep('buying')

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
  }, [publicClient, amount, limitPrice, deadlineHours, slippageTier, itpId, parsedAmount, writeBuy])

  useEffect(() => {
    if (!isApproveSuccess || approveHandled.current) return
    approveHandled.current = true
    refetchAllowance().then(() => {
      resetApprove()
      handleBuy()
    })
  }, [isApproveSuccess, refetchAllowance, resetApprove, handleBuy])

  useEffect(() => {
    if (!isBuySuccess || !buyReceipt || buyHandled.current) return
    buyHandled.current = true

    // Try to extract orderId from receipt logs (same-chain: Index.OrderSubmitted)
    let foundOrderId: bigint | null = null
    for (const log of buyReceipt.logs) {
      if (log.address.toLowerCase() === INDEX_PROTOCOL.index.toLowerCase()) {
        try {
          const decoded = decodeEventLog({
            abi: INDEX_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'OrderSubmitted') {
            foundOrderId = (decoded.args as any).orderId as bigint
            break
          }
        } catch {}
      }
    }
    // Fallback: try CrossChainOrderCreated on ArbCustody
    if (foundOrderId === null) {
      for (const log of buyReceipt.logs) {
        if (log.address.toLowerCase() === INDEX_PROTOCOL.arbCustody.toLowerCase()) {
          try {
            const decoded = decodeEventLog({
              abi: ARB_CUSTODY_ABI,
              data: log.data,
              topics: log.topics,
            })
            if (decoded.eventName === 'CrossChainOrderCreated') {
              foundOrderId = (decoded.args as any).orderId as bigint
              break
            }
          } catch {}
        }
      }
    }

    if (foundOrderId !== null) {
      setOrderId(foundOrderId)
    } else {
      // Last resort: store block for polling fallback
      setBuyTxBlock(buyReceipt.blockNumber)
    }
    setStep('tracking')
    resetBuy()
  }, [isBuySuccess, buyReceipt, resetBuy])

  // Poll for the relayed OrderSubmitted event on the Index contract (L3)
  // Runs in background during 'tracking' step until orderId is found
  useEffect(() => {
    if (step !== 'tracking' || orderId !== null || !publicClient || !buyTxBlock) return

    let cancelled = false
    const poll = async () => {
      try {
        const logs = await publicClient.getLogs({
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
          fromBlock: buyTxBlock,
          toBlock: 'latest',
        })

        if (cancelled) return
        if (logs.length > 0) {
          const latest = logs[logs.length - 1]
          const realOrderId = (latest.args as any).orderId as bigint
          setOrderId(realOrderId)
          return
        }
      } catch {
        // Retry on next interval
      }
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [step, orderId, publicClient, buyTxBlock, itpId])

  useEffect(() => {
    if (approveError) {
      const msg = approveError.message || 'Approval failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      setTxError(shortMsg)
      setStep('input')
      resetApprove()
    }
  }, [approveError, resetApprove])

  useEffect(() => {
    if (buyError) {
      const msg = buyError.message || 'Buy transaction failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      setTxError(shortMsg)
      setStep('input')
      resetBuy()
    }
  }, [buyError, resetBuy])

  // Detect stuck transactions — warn after 30s of confirming
  useEffect(() => {
    if (!isApproveConfirming && !isBuyConfirming) {
      setStuckWarning(false)
      return
    }
    const timer = setTimeout(() => setStuckWarning(true), 30_000)
    return () => clearTimeout(timer)
  }, [isApproveConfirming, isBuyConfirming])

  const handleCancel = useCallback(() => {
    resetApprove()
    resetBuy()
    setStep('input')
    setTxError(null)
    setStuckWarning(false)
    refreshNonce()
  }, [resetApprove, resetBuy, refreshNonce])

  const formattedBalance = usdcBalance > 0n ? formatUnits(usdcBalance, 6) : '0'
  const isProcessing = isApprovePending || isApproveConfirming || isBuyPending || isBuyConfirming

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
          ) : step === 'tracking' ? (
            <div className="space-y-6">
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-400">
                <p className="font-bold">Order Submitted</p>
                <p className="text-sm mt-1">Your buy order has been submitted on the bridge.</p>
              </div>
              {orderId !== null ? (
                <>
                  <OrderStatusTracker orderId={orderId} onComplete={() => refetchShares()} />
                  {fillDetails && (
                    <div className="bg-terminal-dark border border-white/10 rounded-lg p-4 space-y-2">
                      <p className="text-sm font-bold text-accent">Fill Summary</p>
                      <div className="text-xs font-mono space-y-1">
                        <div className="flex justify-between">
                          <span className="text-white/50">Fill Price</span>
                          <span className="text-white">${parseFloat(formatUnits(fillDetails.fillPrice, 18)).toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Amount Filled</span>
                          <span className="text-white">{parseFloat(formatUnits(fillDetails.fillAmount, 18)).toFixed(4)} USDC</span>
                        </div>
                        {fillDetails.fillPrice > 0n && (
                          <div className="flex justify-between">
                            <span className="text-white/50">Shares Received</span>
                            <span className="text-white">
                              {parseFloat(formatUnits((fillDetails.fillAmount * BigInt(1e18)) / fillDetails.fillPrice, 18)).toFixed(4)}
                            </span>
                          </div>
                        )}
                        {limitPrice && parseFloat(limitPrice) > 0 && fillDetails.fillPrice > 0n && (() => {
                          const limitBn = BigInt(Math.floor(parseFloat(limitPrice) * 1e18))
                          const slippage = Number(fillDetails.fillPrice - limitBn) * 100 / Number(limitBn)
                          return (
                            <div className="flex justify-between">
                              <span className="text-white/50">vs Limit Price</span>
                              <span className={Math.abs(slippage) < 1 ? 'text-green-400' : Math.abs(slippage) < 3 ? 'text-yellow-400' : 'text-red-400'}>
                                {slippage > 0 ? '+' : ''}{slippage.toFixed(2)}%
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-terminal-dark border border-white/10 rounded-lg p-4 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-sm text-white/70">Processing order...</p>
                </div>
              )}
              {userShares > 0n && (
                <div className="bg-terminal-dark border border-white/10 rounded-lg p-4">
                  <p className="text-sm text-white/70">Your ITP Shares</p>
                  <p className="text-2xl font-bold text-accent">{parseFloat(formatUnits(userShares, 18)).toFixed(4)}</p>
                </div>
              )}
              <button
                onClick={() => { setStep('input'); setOrderId(null); setAmount(''); setBuyTxBlock(null) }}
                className="w-full py-3 bg-accent text-terminal font-bold rounded-lg hover:bg-accent/90 transition-colors"
              >
                Buy More
              </button>
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

              <button
                onClick={needsApproval ? handleApprove : handleBuy}
                disabled={!amount || parsedAmount === 0n || isProcessing || parsedAmount > (usdcBalance ?? 0n) || hasNonceGap}
                className="w-full py-4 bg-accent text-terminal font-bold rounded-lg hover:bg-accent/90 disabled:bg-white/20 disabled:text-white/50 disabled:cursor-not-allowed transition-colors"
              >
                {buttonText}
              </button>

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
