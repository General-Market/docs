/**
 * useNonceCheck - Detects wallet nonce mismatches that could cause stuck transactions
 *
 * This hook compares the wallet's expected nonce with the on-chain nonce.
 * If they don't match, it means there are pending transactions that haven't been mined,
 * which will cause new transactions to get stuck.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAccount, usePublicClient } from 'wagmi'

interface NonceStatus {
  /** On-chain confirmed nonce (next expected) */
  onChainNonce: number | null
  /** Number of pending transactions in mempool */
  pendingCount: number
  /** Whether there's a potential nonce gap issue */
  hasNonceGap: boolean
  /** Loading state */
  isLoading: boolean
  /** Error if any */
  error: string | null
  /** Refresh the nonce check */
  refresh: () => Promise<void>
}

export function useNonceCheck(): NonceStatus {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  const [onChainNonce, setOnChainNonce] = useState<number | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [hasNonceGap, setHasNonceGap] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use refs to keep stable callback reference
  const addressRef = useRef(address)
  const publicClientRef = useRef(publicClient)
  const isConnectedRef = useRef(isConnected)

  useEffect(() => { addressRef.current = address }, [address])
  useEffect(() => { publicClientRef.current = publicClient }, [publicClient])
  useEffect(() => { isConnectedRef.current = isConnected }, [isConnected])

  const checkNonce = useCallback(async () => {
    const addr = addressRef.current
    const client = publicClientRef.current
    const connected = isConnectedRef.current

    if (!addr || !client || !connected) {
      setOnChainNonce(null)
      setPendingCount(0)
      setHasNonceGap(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const confirmedNonce = await client.getTransactionCount({
        address: addr,
        blockTag: 'latest',
      })

      const pendingNonce = await client.getTransactionCount({
        address: addr,
        blockTag: 'pending',
      })

      setOnChainNonce(confirmedNonce)
      setPendingCount(pendingNonce - confirmedNonce)
      setHasNonceGap(pendingNonce > confirmedNonce)
    } catch (e: any) {
      console.error('Error checking nonce:', e)
      setError(e.message || 'Failed to check transaction status')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Check on mount and when address changes
  useEffect(() => {
    checkNonce()
  }, [address, isConnected, publicClient, checkNonce])

  // Re-check periodically if there are pending transactions
  useEffect(() => {
    if (!hasNonceGap) return

    const interval = setInterval(checkNonce, 5000)
    return () => clearInterval(interval)
  }, [hasNonceGap, checkNonce])

  return {
    onChainNonce,
    pendingCount,
    hasNonceGap,
    isLoading,
    error,
    refresh: checkNonce,
  }
}
