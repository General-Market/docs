'use client'

import { useWriteContract, useAccount, useSwitchChain } from '@/lib/wallet-shim'
import { useCallback, useState, useEffect } from 'react'
import { BRIDGE_PROXY_ABI } from '@/lib/contracts/index-protocol-abi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { settlementChainId } from '@/lib/wagmi'

export type RebalanceStatus = 'idle' | 'switching-chain' | 'requesting' | 'confirming' | 'success' | 'error'

interface UseRebalanceReturn {
  status: RebalanceStatus
  txHash: string | undefined
  error: string | null
  requestRebalance: (
    itpId: string,
    removeIndices: bigint[],
    addAssets: `0x${string}`[],
    newWeights: bigint[],
    note: string,
  ) => Promise<void>
  reset: () => void
}

export function useRebalance(): UseRebalanceReturn {
  const { chain: currentChain } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const {
    writeContract,
    data: txHash,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract()

  const [status, setStatus] = useState<RebalanceStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Hash arriving means the tx was mined — for requestRebalance (event-only, no L3 step), that's success
  useEffect(() => {
    if (txHash && status === 'requesting') {
      setStatus('success')
    }
  }, [txHash, status])

  // Handle wagmi write errors
  useEffect(() => {
    if (writeError) {
      const msg = writeError.message || 'Transaction failed'
      const short = msg.includes('User rejected')
        ? 'Transaction rejected in wallet'
        : msg.includes('Details:')
          ? msg.split('Details:')[1].trim().slice(0, 200)
          : msg.slice(0, 200)
      setError(short)
      setStatus('error')
    }
  }, [writeError])

  const requestRebalance = useCallback(async (
    itpId: string,
    removeIndices: bigint[],
    addAssets: `0x${string}`[],
    newWeights: bigint[],
    note: string,
  ) => {
    resetWrite()
    setError(null)

    // Ensure wallet is on Settlement chain
    if (currentChain?.id !== settlementChainId) {
      setStatus('switching-chain')
      try {
        await switchChainAsync({ chainId: settlementChainId })
      } catch {
        setError('Switch to the Settlement chain to rebalance')
        setStatus('error')
        return
      }
      await new Promise(r => setTimeout(r, 500))
    }

    setStatus('requesting')

    writeContract({
      address: INDEX_PROTOCOL.settlementBridgeProxy,
      abi: BRIDGE_PROXY_ABI,
      functionName: 'requestRebalance',
      args: [
        itpId as `0x${string}`,
        removeIndices,
        addAssets,
        newWeights,
        note,
      ],
      chainId: settlementChainId,
    })
  }, [currentChain?.id, switchChainAsync, resetWrite, writeContract])

  const reset = useCallback(() => {
    resetWrite()
    setStatus('idle')
    setError(null)
  }, [resetWrite])

  return {
    status,
    txHash,
    error,
    requestRebalance,
    reset,
  }
}
