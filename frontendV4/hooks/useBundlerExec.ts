'use client'

import { useState, useCallback } from 'react'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { useChainSendTransaction } from '@/hooks/useChainWrite'
import type { QuoteResponse } from '@/lib/types/lending-quote'

interface UseBundlerExecReturn {
  /** Execute the bundler calldata from a quote */
  execute: (quote: QuoteResponse) => void
  /** Transaction hash */
  txHash: `0x${string}` | undefined
  /** Whether the wallet prompt is pending */
  isPending: boolean
  /** Whether the transaction is confirming on-chain */
  isConfirming: boolean
  /** Whether the transaction succeeded */
  isSuccess: boolean
  /** Error if any */
  error: Error | null
  /** Reset state */
  reset: () => void
}

/**
 * Hook for executing bundler calldata from a curator quote
 *
 * Takes the bundler.to and bundler.data from a QuoteResponse and
 * sends a raw transaction. The calldata is a Morpho Bundler multicall
 * that atomically performs: oracle update + approve + supply collateral + borrow.
 */
export function useBundlerExec(): UseBundlerExecReturn {
  const { address } = useAccount()

  const {
    sendTransaction,
    data: txHash,
    isPending,
    error: sendError,
    reset: resetSend,
  } = useChainSendTransaction()

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash: txHash })

  const execute = useCallback((quote: QuoteResponse) => {
    if (!address) return

    sendTransaction({
      to: quote.bundler.to as `0x${string}`,
      data: quote.bundler.data as `0x${string}`,
    })
  }, [address, sendTransaction])

  const error = sendError || confirmError || null

  const reset = useCallback(() => {
    resetSend()
  }, [resetSend])

  return {
    execute,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: error as Error | null,
    reset,
  }
}
