'use client'

import { useEffect, useRef } from 'react'
import { formatUnits } from 'viem'
import { useToast } from '@/lib/contexts/ToastContext'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'

/**
 * Watches a player's position balance and fires a toast when it changes
 * (indicating a tick was resolved). Shows green for gains, red for losses.
 */
export function useBalanceChangeNotification(
  balance: bigint | undefined,
  isJoined: boolean,
) {
  const { showSuccess, showError } = useToast()
  const prevBalance = useRef<bigint | undefined>(undefined)
  const initialized = useRef(false)

  useEffect(() => {
    if (!isJoined || balance === undefined) {
      prevBalance.current = undefined
      initialized.current = false
      return
    }

    // First render with a balance — store it but don't fire toast
    if (!initialized.current) {
      prevBalance.current = balance
      initialized.current = true
      return
    }

    // Balance hasn't changed
    if (prevBalance.current === balance) return

    const prev = prevBalance.current
    prevBalance.current = balance

    if (prev === undefined) return

    const delta = balance - prev
    if (delta === 0n) return

    const absDelta = delta > 0n ? delta : -delta
    const formatted = parseFloat(formatUnits(absDelta, VISION_USDC_DECIMALS)).toFixed(2)

    if (delta > 0n) {
      showSuccess(`Tick resolved: +$${formatted}`)
    } else {
      showError(`Tick resolved: -$${formatted}`)
    }
  }, [balance, isJoined, showSuccess, showError])
}
