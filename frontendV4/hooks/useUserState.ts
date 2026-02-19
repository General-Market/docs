'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount } from 'wagmi'
import { fetchUserState, type UserState } from '@/lib/api/backend'

interface UseUserStateReturn {
  /** USDC balance (6 decimals, string) */
  usdcBalance: bigint
  /** USDC allowance for ArbBridgeCustody */
  usdcAllowanceCustody: bigint
  /** USDC allowance for Morpho */
  usdcAllowanceMorpho: bigint
  /** BridgedITP contract address */
  bridgedItpAddress: string
  /** BridgedITP balance (18 decimals) */
  bridgedItpBalance: bigint
  /** BridgedITP allowance for ArbBridgeCustody */
  bridgedItpAllowanceCustody: bigint
  /** BridgedITP allowance for Morpho */
  bridgedItpAllowanceMorpho: bigint
  /** BridgedITP name */
  bridgedItpName: string
  /** BridgedITP symbol */
  bridgedItpSymbol: string
  /** BridgedITP total supply */
  bridgedItpTotalSupply: bigint
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

function safeBigInt(s: string | undefined): bigint {
  if (!s || s === '') return 0n
  try { return BigInt(s) } catch { return 0n }
}

/**
 * Fetches user balances and allowances from the backend /user-state endpoint.
 * Polls every 5 seconds.
 * Replaces useUserItpShares and per-component balance/allowance reads.
 */
export function useUserState(itpId: string | undefined): UseUserStateReturn {
  const { address } = useAccount()
  const [data, setData] = useState<UserState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const addressRef = useRef(address)
  const itpIdRef = useRef(itpId)

  useEffect(() => { addressRef.current = address }, [address])
  useEffect(() => { itpIdRef.current = itpId }, [itpId])

  const refetch = useCallback(async () => {
    const user = addressRef.current
    const id = itpIdRef.current
    if (!user || !id) {
      setIsLoading(false)
      return
    }

    try {
      const result = await fetchUserState(user, id)
      if (result) {
        setData(result)
        setError(null)
      }
    } catch (e: any) {
      if (!data) setError(e.message || 'Failed to fetch user state')
    } finally {
      setIsLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset on address/itpId change
  useEffect(() => {
    setIsLoading(true)
    setData(null)
    setError(null)
    refetch()
  }, [address, itpId, refetch])

  // Poll every 5s
  useEffect(() => {
    if (!address || !itpId) return
    const interval = setInterval(refetch, 5000)
    return () => clearInterval(interval)
  }, [address, itpId, refetch])

  return {
    usdcBalance: safeBigInt(data?.usdc_balance),
    usdcAllowanceCustody: safeBigInt(data?.usdc_allowance_custody),
    usdcAllowanceMorpho: safeBigInt(data?.usdc_allowance_morpho),
    bridgedItpAddress: data?.bridged_itp_address ?? '',
    bridgedItpBalance: safeBigInt(data?.bridged_itp_balance),
    bridgedItpAllowanceCustody: safeBigInt(data?.bridged_itp_allowance_custody),
    bridgedItpAllowanceMorpho: safeBigInt(data?.bridged_itp_allowance_morpho),
    bridgedItpName: data?.bridged_itp_name ?? '',
    bridgedItpSymbol: data?.bridged_itp_symbol ?? '',
    bridgedItpTotalSupply: safeBigInt(data?.bridged_itp_total_supply),
    isLoading,
    error,
    refetch,
  }
}
