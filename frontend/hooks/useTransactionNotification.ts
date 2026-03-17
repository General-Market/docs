'use client'

import { useEffect, useRef } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'
import { getTxUrl } from '@/lib/utils/basescan'
import type { ExplorerChain } from '@/lib/utils/basescan'

interface TransactionNotificationParams {
  /** Transaction hash from wagmi writeContract / sendTransaction */
  hash: `0x${string}` | undefined
  /** wagmi isPending (wallet prompt open) */
  isPending: boolean
  /** wagmi isConfirming (tx submitted, waiting for block) */
  isConfirming: boolean
  /** wagmi isSuccess (tx included in block) */
  isSuccess: boolean
  /** wagmi error (user rejection or revert) */
  error: Error | null
  /** Human-readable label for this tx type, e.g. "Deposit USDC" or "Supply collateral" */
  label: string
  /** Which chain to link the explorer to (default: 'l3') */
  chain?: ExplorerChain
  /** Set to true to disable all notifications for this instance */
  disabled?: boolean
}

/**
 * Observe wagmi transaction lifecycle and fire toast notifications.
 *
 * Usage:
 * ```ts
 * const { writeContract, data: hash, isPending, error } = useChainWriteContract()
 * const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
 *
 * useTransactionNotification({
 *   hash,
 *   isPending,
 *   isConfirming,
 *   isSuccess,
 *   error,
 *   label: 'Deposit collateral',
 * })
 * ```
 *
 * Fires:
 * - success toast with explorer link when isSuccess flips to true
 * - error toast with truncated message when error appears
 *
 * Does NOT fire a "pending" toast because most flows already show their own
 * in-progress UI (stepper, button state, etc).
 */
export function useTransactionNotification({
  hash,
  isPending,
  isConfirming,
  isSuccess,
  error,
  label,
  chain = 'l3',
  disabled = false,
}: TransactionNotificationParams) {
  const { showSuccess, showError } = useToast()

  // Track which hashes we've already fired toasts for, to avoid duplicates.
  const successFired = useRef<string | null>(null)
  const errorFired = useRef<string | null>(null)

  // Success toast
  useEffect(() => {
    if (disabled || !isSuccess) return
    // Deduplicate by hash (or by label if no hash)
    const key = hash ?? `no-hash-${label}`
    if (successFired.current === key) return
    successFired.current = key

    const explorerUrl = hash ? getTxUrl(hash, chain) : undefined
    showSuccess(
      `${label} confirmed`,
      explorerUrl ? { url: explorerUrl, text: 'View transaction' } : undefined,
    )
  }, [isSuccess, hash, label, chain, disabled, showSuccess])

  // Error toast
  useEffect(() => {
    if (disabled || !error) return
    const key = error.message.slice(0, 50)
    if (errorFired.current === key) return
    errorFired.current = key

    const msg = error.message || 'Transaction failed'
    // Extract the most useful part of the error
    const shortMsg = msg.includes('User rejected') || msg.includes('denied')
      ? `${label} rejected`
      : msg.includes('Details:')
        ? `${label} failed: ${msg.split('Details:')[1].trim().slice(0, 120)}`
        : `${label} failed: ${msg.slice(0, 120)}`

    showError(shortMsg)
  }, [error, label, disabled, showError])

  // Reset fired flags when hash changes (new transaction)
  useEffect(() => {
    successFired.current = null
    errorFired.current = null
  }, [hash])
}
