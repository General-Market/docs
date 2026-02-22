'use client'

import { useCallback, useState } from 'react'
import { useWaitForTransactionReceipt } from 'wagmi'
import { keccak256, toHex, decodeEventLog } from 'viem'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { VISION_ABI } from '@/lib/contracts/vision-abi'

/**
 * Vision contract address — will be set once deployed.
 * Read from deployment.json once available; placeholder for now.
 */
const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

export interface CreateBatchParams {
  /** Raw market ID strings (will be keccak256-hashed to bytes32) */
  marketIds: string[]
  /** Resolution type per market (maps to IVision.ResolutionType enum) */
  resolutionTypes: number[]
  /** Tick duration in seconds */
  tickDuration: number
  /** Custom threshold values for _X resolution types (in basis points) */
  customThresholds: number[]
}

interface UseCreateBatchReturn {
  /** Submit createBatch transaction */
  createBatch: (params: CreateBatchParams) => void
  /** Transaction hash once submitted */
  txHash: `0x${string}` | undefined
  /** Whether the wallet prompt is pending */
  isPending: boolean
  /** Whether the transaction is confirming on-chain */
  isConfirming: boolean
  /** Whether the transaction succeeded */
  isSuccess: boolean
  /** Extracted batchId from the BatchCreated event */
  batchId: bigint | null
  /** Error if any */
  error: string | null
  /** Reset state for another attempt */
  reset: () => void
}

/**
 * Hook for calling Vision.createBatch().
 * Encodes market IDs as keccak256 bytes32, sends the tx, waits for receipt,
 * and extracts the batchId from the BatchCreated event log.
 */
export function useCreateBatch(): UseCreateBatchReturn {
  const [batchId, setBatchId] = useState<bigint | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useChainWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash: txHash })

  // Extract batchId from receipt logs when tx succeeds
  if (isSuccess && receipt && batchId === null) {
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: VISION_ABI,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'BatchCreated') {
          setBatchId((decoded.args as any).batchId as bigint)
          break
        }
      } catch {
        // Not a BatchCreated event, skip
      }
    }
  }

  // Propagate write errors
  if (writeError && !error) {
    const msg = writeError.message || 'Transaction failed'
    const shortMsg = msg.includes('User rejected')
      ? 'Transaction rejected in wallet'
      : msg.includes('Details:')
        ? msg.split('Details:')[1].trim().slice(0, 200)
        : msg.slice(0, 200)
    setError(shortMsg)
  }

  const createBatch = useCallback((params: CreateBatchParams) => {
    setError(null)
    setBatchId(null)

    // Encode market IDs: keccak256 of the string -> bytes32
    const encodedMarketIds = params.marketIds.map(
      (id) => keccak256(toHex(id)) as `0x${string}`
    )

    writeContract({
      address: VISION_ADDRESS,
      abi: VISION_ABI,
      functionName: 'createBatch',
      args: [
        encodedMarketIds,
        params.resolutionTypes,
        BigInt(params.tickDuration),
        params.customThresholds.map((t) => BigInt(t)),
      ],
    })
  }, [writeContract])

  const reset = useCallback(() => {
    resetWrite()
    setBatchId(null)
    setError(null)
  }, [resetWrite])

  return {
    createBatch,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    batchId,
    error,
    reset,
  }
}
