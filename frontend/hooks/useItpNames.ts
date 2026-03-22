'use client'

import { useEffect, useState } from 'react'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'

// getItpNameSymbol(bytes32) selector
const SELECTOR = '0x693dd6b6'

function decodeStringPair(hex: string): [string, string] {
  const bytes = hex.startsWith('0x') ? hex.slice(2) : hex
  if (bytes.length < 128) return ['', '']

  // ABI: offset1(32) + offset2(32) + len1(32) + data1... + len2(32) + data2...
  const offset1 = parseInt(bytes.slice(0, 64), 16) * 2
  const offset2 = parseInt(bytes.slice(64, 128), 16) * 2
  const len1 = parseInt(bytes.slice(offset1, offset1 + 64), 16)
  const data1 = bytes.slice(offset1 + 64, offset1 + 64 + len1 * 2)
  const len2 = parseInt(bytes.slice(offset2, offset2 + 64), 16)
  const data2 = bytes.slice(offset2 + 64, offset2 + 64 + len2 * 2)

  const decode = (h: string) => {
    const arr = []
    for (let i = 0; i < h.length; i += 2) arr.push(parseInt(h.slice(i, i + 2), 16))
    return String.fromCharCode(...arr)
  }

  return [decode(data1), decode(data2)]
}

/**
 * Batch-fetch ITP names from on-chain for ITP IDs not in the static mapping.
 */
export function useItpNames(itpIds: string[]): Map<string, { name: string; symbol: string }> {
  const [names, setNames] = useState<Map<string, { name: string; symbol: string }>>(new Map())

  useEffect(() => {
    if (itpIds.length === 0) return
    let cancelled = false

    async function fetchNames() {
      const results = new Map<string, { name: string; symbol: string }>()

      for (let i = 0; i < itpIds.length; i += 20) {
        const batch = itpIds.slice(i, i + 20)
        const promises = batch.map(async (itpId) => {
          try {
            const paddedId = itpId.startsWith('0x') ? itpId.slice(2) : itpId
            const calldata = SELECTOR + paddedId.padStart(64, '0')
            const res = await fetch('/api/rpc', {
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
            if (json.result && json.result !== '0x' && json.result.length > 130) {
              const [name, symbol] = decodeStringPair(json.result)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itpIds.join(',')])

  return names
}
