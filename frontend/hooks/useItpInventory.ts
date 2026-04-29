'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { encodeFunctionData, decodeFunctionResult } from 'viem'
import { INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { L3_RPC_URL } from '@/lib/config'

export type ItpInventoryEntry = { address: string; qtyPerShare: bigint }

export type UseItpInventoryResult = {
  inventory: ItpInventoryEntry[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useItpInventory(itpId: string | undefined): UseItpInventoryResult {
  const [inventory, setInventory] = useState<ItpInventoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const fetchInventory = useCallback(async () => {
    if (!itpId || inFlight.current) return
    inFlight.current = true
    setIsLoading(true)
    setError(null)
    try {
      const calldata = encodeFunctionData({
        abi: INDEX_ABI,
        functionName: 'getITPState',
        args: [itpId as `0x${string}`],
      })
      const res = await fetch(L3_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_call',
          params: [{ to: INDEX_PROTOCOL.index, data: calldata }, 'latest'],
        }),
        signal: AbortSignal.timeout(10_000),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error.message ?? 'eth_call failed')
      if (!json.result) throw new Error('empty result')
      const decoded = decodeFunctionResult({
        abi: INDEX_ABI,
        functionName: 'getITPState',
        data: json.result as `0x${string}`,
      }) as [string, bigint, bigint, string[], bigint[], bigint[]]
      const assets = decoded[3]
      const inv = decoded[5]
      if (!assets || !inv || assets.length !== inv.length) {
        setInventory([])
      } else {
        setInventory(assets.map((addr, i) => ({ address: addr.toLowerCase(), qtyPerShare: inv[i] })))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch inventory')
    } finally {
      setIsLoading(false)
      inFlight.current = false
    }
  }, [itpId])

  useEffect(() => {
    if (!itpId) {
      setInventory([])
      setError(null)
      return
    }
    void fetchInventory()
  }, [itpId, fetchInventory])

  return { inventory, isLoading, error, refresh: () => { void fetchInventory() } }
}
