'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits, decodeEventLog } from 'viem'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { ERC20_ABI } from '@/lib/contracts/index-protocol-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { useUserState } from '@/hooks/useUserState'
import { useItpCostBasis } from '@/hooks/useItpCostBasis'
import { useItpNav } from '@/hooks/useItpNav'

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
] as const

interface SellItpModalProps {
  itpId: string
  onClose: () => void
}

export function SellItpModal({ itpId, onClose }: SellItpModalProps) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  const [amount, setAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('0')
  const [slippageTier, setSlippageTier] = useState(2)
  const [deadlineHours, setDeadlineHours] = useState(1)
  const [step, setStep] = useState<'input' | 'approving' | 'selling' | 'tracking'>('input')
  const [orderId, setOrderId] = useState<bigint | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [bridgedItpAddress, setBridgedItpAddress] = useState<`0x${string}` | null>(null)

  const { writeContract, data: hash, isPending, error: writeError, reset } = useChainWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  // Get balances, allowances, and ITP metadata from backend
  const userState = useUserState(itpId)
  const itpName = userState.bridgedItpName || 'ITP'
  const itpSymbol = userState.bridgedItpSymbol || ''

  // Set bridgedItpAddress from backend
  useEffect(() => {
    const addr = userState.bridgedItpAddress
    if (addr && addr !== '0x0000000000000000000000000000000000000000') {
      setBridgedItpAddress(addr as `0x${string}`)
    }
  }, [userState.bridgedItpAddress])

  const userShares = userState.bridgedItpBalance
  const refetchShares = userState.refetch
  const allowance = userState.bridgedItpAllowanceCustody
  const refetchAllowance = userState.refetch

  const { costBasis } = useItpCostBasis(itpId, address ?? null)
  const { navPerShare, navPerShareBn, totalAssetCount, pricedAssetCount, isLoading: isNavLoading } = useItpNav(itpId)

  // Auto-set min price from NAV (with 5% discount buffer for sells)
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

  const handleSell = useCallback(async () => {
    if (!publicClient || !amount || insufficientShares || !bridgedItpAddress) return
    setTxError(null)

    if (needsApproval) {
      // Step 1: Approve BridgedITP to ArbBridgeCustody
      setStep('approving')
      writeContract({
        address: bridgedItpAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [INDEX_PROTOCOL.arbCustody, parsedAmount],

      })
    } else {
      // Step 2: Sell
      await submitSell()
    }
  }, [publicClient, amount, insufficientShares, bridgedItpAddress, needsApproval, parsedAmount, writeContract])

  const submitSell = useCallback(async () => {
    if (!publicClient) return
    setStep('selling')

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

    if (step === 'approving') {
      // Approval done, now sell
      reset()
      refetchAllowance()
      // Small delay to let allowance update
      setTimeout(() => submitSell(), 500)
      return
    }

    if (step === 'selling') {
      // Extract orderId from CrossChainSellOrderCreated event
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
      setStep('tracking')
      reset()
    }
  }, [isSuccess, receipt, step, reset, refetchAllowance, submitSell])

  useEffect(() => {
    if (writeError) {
      const msg = writeError.message || 'Transaction failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      setTxError(shortMsg)
      setStep('input')
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

  const handleCancel = useCallback(() => {
    reset()
    setStep('input')
    setTxError(null)
    setStuckWarning(false)
  }, [reset])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-terminal border border-white/20 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-accent">Sell {itpName}</h2>
            <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">&times;</button>
          </div>
          {itpSymbol && <p className="text-white/70 mb-1 font-mono">${itpSymbol}</p>}
          <p className="text-xs text-white/40 font-mono mb-6 break-all">ITP ID: {itpId}</p>

          {!isConnected ? (
            <div className="bg-terminal-dark border border-white/10 rounded-lg p-8 text-center">
              <p className="text-white/70">Connect your wallet to sell ITP shares</p>
            </div>
          ) : !bridgedItpAddress ? (
            <div className="bg-terminal-dark border border-white/10 rounded-lg p-8 text-center">
              <p className="text-white/70">No BridgedITP found for this ITP. It may not have been created via BridgeProxy yet.</p>
            </div>
          ) : step === 'tracking' ? (
            <div className="space-y-6">
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-400">
                <p className="font-bold">Cross-Chain Sell Order Submitted</p>
                <p className="text-sm mt-1">Order ID: {orderId?.toString() ?? 'pending'}</p>
                <p className="text-xs mt-1 text-green-400/70">
                  Issuers will sell your shares on L3 and bridge USDC back to Arbitrum.
                  This may take a few minutes.
                </p>
              </div>
              {arbUsdcBalance > 0n && (
                <div className="bg-terminal-dark border border-white/10 rounded-lg p-4">
                  <p className="text-sm text-white/70">Your USDC Balance (Arbitrum)</p>
                  <p className="text-2xl font-bold text-accent">{formatUnits(arbUsdcBalance, 6)} USDC</p>
                </div>
              )}
              <button
                onClick={() => { setStep('input'); setOrderId(null); setAmount('') }}
                className="w-full py-3 bg-accent text-terminal font-bold rounded-lg hover:bg-accent/90 transition-colors"
              >
                Sell More
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-terminal-dark border border-accent/30 rounded-lg p-4 flex justify-between items-center">
                <span className="text-sm text-white/70">Your BridgedITP Shares</span>
                <span className="text-2xl font-bold text-accent">{parseFloat(formatUnits(userShares, 18)).toFixed(4)}</span>
              </div>

              {userShares === 0n ? (
                <div className="bg-terminal-dark border border-white/10 rounded-lg p-8 text-center">
                  <p className="text-white/70">You don&apos;t have any BridgedITP shares to sell</p>
                </div>
              ) : (
                <>
                  <div className="bg-terminal-dark border border-white/10 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm text-white/70">Shares to Sell</label>
                      <button
                        onClick={() => setAmount(formatUnits(userShares, 18))}
                        className="text-xs text-accent hover:text-accent/80"
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
                      className="w-full bg-terminal border border-white/20 rounded px-4 py-3 text-white text-lg focus:border-accent focus:outline-none"
                    />
                    {insufficientShares && (
                      <p className="text-red-400 text-xs mt-1">Insufficient BridgedITP shares</p>
                    )}
                  </div>

                  <div className="bg-terminal-dark border border-white/10 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm text-white/70">Min Price (USDC/share)</label>
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
                      placeholder={isNavLoading ? 'Computing price...' : navPerShare === 0 ? 'Set min price' : '0 (no limit)'}
                      min="0"
                      step="0.01"
                      className="w-full bg-terminal border border-white/20 rounded px-4 py-2 text-white focus:border-accent focus:outline-none"
                    />
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

                  {/* P&L Preview */}
                  {parsedAmount > 0n && costBasis && costBasis.avgCostPerShare > 0n && (
                    <div className="bg-terminal-dark border border-accent/20 rounded-lg p-4 space-y-1">
                      <p className="text-xs font-bold text-white/70 mb-2">Estimated P&L</p>
                      <div className="text-xs font-mono space-y-1">
                        <div className="flex justify-between">
                          <span className="text-white/50">Avg Cost Basis</span>
                          <span className="text-white">${parseFloat(formatUnits(costBasis.avgCostPerShare, 18)).toFixed(4)}/share</span>
                        </div>
                        {navPerShareBn > 0n && (() => {
                          const estimatedProceeds = (parsedAmount * navPerShareBn) / BigInt(1e18)
                          const costOfShares = (parsedAmount * costBasis.avgCostPerShare) / BigInt(1e18)
                          const estimatedPnL = estimatedProceeds - costOfShares
                          const pnlPct = Number(estimatedPnL) * 100 / Number(costOfShares)
                          return (
                            <>
                              <div className="flex justify-between">
                                <span className="text-white/50">Current NAV</span>
                                <span className="text-white">${navPerShare.toFixed(6)}/share</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/50">Est. Proceeds</span>
                                <span className="text-white">${parseFloat(formatUnits(estimatedProceeds, 18)).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-white/10">
                                <span className="text-white/50">Est. P&L</span>
                                <span className={estimatedPnL >= 0n ? 'text-green-400' : 'text-red-400'}>
                                  {estimatedPnL >= 0n ? '+' : ''}${parseFloat(formatUnits(estimatedPnL, 18)).toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                                </span>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSell}
                    disabled={!amount || parsedAmount === 0n || insufficientShares || isPending || isConfirming}
                    className="w-full py-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:bg-white/20 disabled:text-white/50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPending ? 'Waiting for wallet...' : isConfirming ? (step === 'approving' ? 'Approving...' : 'Submitting...') : needsApproval ? 'Approve & Sell' : 'Sell Shares'}
                  </button>

                  {(isPending || isConfirming) && (
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
