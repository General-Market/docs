'use client'

import { useEffect, useState } from 'react'
import { encodeFunctionData, decodeFunctionResult } from 'viem'
import { INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { L3_RPC_URL } from '@/lib/config'

/**
 * Batch-fetch ITP names from on-chain for ITP IDs not in the static mapping.
 * Calls getItpNameSymbol(bytes32) on the Index contract.
 */
export function useItpNames(itpIds: string[]): Map<string, { name: string; symbol: string }> {
  const [names, setNames] = useState<Map<string, { name: string; symbol: string }>>(new Map())

  useEffect(() => {
    if (itpIds.length === 0) return
    let cancelled = false

    async function fetchNames() {
      const results = new Map<string, { name: string; symbol: string }>()

      // Batch in groups of 20 to avoid overwhelming the RPC
      for (let i = 0; i < itpIds.length; i += 20) {
        const batch = itpIds.slice(i, i + 20)
        const promises = batch.map(async (itpId) => {
          try {
            const calldata = encodeFunctionData({
              abi: INDEX_ABI,
              functionName: 'getItpNameSymbol',
              args: [itpId as `0x${string}`],
            })
            const res = await fetch(L3_RPC_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0', id: Date.now(),
                method: 'eth_call',
                params: [{ to: INDEX_PROTOCOL.index, data: calldata }, 'latest'],
              }),
              signal: AbortSignal.timeout(5000),
            })
            const json = await res.json()
            if (json.result && json.result !== '0x') {
              const [name, symbol] = decodeFunctionResult({
                abi: INDEX_ABI,
                functionName: 'getItpNameSymbol',
                data: json.result,
              }) as [string, string]
              if (name || symbol) {
                results.set(itpId.toLowerCase(), { name, symbol })
              }
            }
          } catch { /* non-critical */ }
        })
        await Promise.all(promises)
      }

      if (!cancelled) {
        setNames(prev => {
          const merged = new Map(prev)
          for (const [k, v] of results) merged.set(k, v)
          return merged
        })
      }
    }

    fetchNames()
    return () => { cancelled = true }
  }, [itpIds.join(',')])

  return names
}
