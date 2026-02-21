'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchVaultBalances } from '@/lib/api/backend'
import { DATA_NODE_URL } from '@/lib/config'
const PRICE_POLL_MS = 3000
const FULL_REFRESH_MS = 30000

export interface VaultAssetBalance {
  address: string
  symbol: string
  balance: bigint
  price: bigint
  usdValue: number
}

interface UseApBalancesReturn {
  assets: VaultAssetBalance[]
  totalUsdValue: number
  totalTokenCount: number
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

async function fetchPricesByAddress(addresses?: string[]): Promise<Record<string, bigint>> {
  try {
    if (!addresses || addresses.length === 0) return {}
    const query = `?addresses=${addresses.join(',')}`
    const res = await fetch(`${DATA_NODE_URL}/prices-by-address${query}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return {}
    const data = await res.json()
    const result: Record<string, bigint> = {}
    for (const [addr, entry] of Object.entries(data.prices || {}))
      result[addr.toLowerCase()] = BigInt((entry as any).price)
    return result
  } catch { return {} }
}

/**
 * Fetches vault asset balances from the backend /vault-balances endpoint.
 * Prices are refreshed separately via /prices-by-address for faster updates.
 */
export function useApBalances(): UseApBalancesReturn {
  const [assets, setAssets] = useState<VaultAssetBalance[]>([])
  const [totalTokenCount, setTotalTokenCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const discoveredAddrs = useRef<string[]>([])

  const refresh = useCallback(async () => {
    try {
      const result = await fetchVaultBalances()
      if (!result) return

      const mapped: VaultAssetBalance[] = result.assets.map(a => ({
        address: a.address.toLowerCase(),
        symbol: a.symbol,
        balance: BigInt(a.balance),
        price: BigInt(a.price),
        usdValue: a.usd_value,
      }))

      setAssets(mapped)
      setTotalTokenCount(result.token_count)
      discoveredAddrs.current = mapped.map(a => a.address)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch vault balances')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fast price-only update
  const refreshPrices = useCallback(async () => {
    if (discoveredAddrs.current.length === 0) return

    const apPrices = await fetchPricesByAddress(discoveredAddrs.current)
    if (Object.keys(apPrices).length === 0) return

    setAssets(prev => {
      let changed = false
      const updated = prev.map(asset => {
        const newPrice = apPrices[asset.address]
        if (newPrice !== undefined && newPrice !== asset.price) {
          changed = true
          const balanceF64 = Number(asset.balance)
          const priceF64 = Number(newPrice) / 1e18
          const usdValue = asset.symbol === 'USDC'
            ? balanceF64 / 1e6
            : balanceF64 * priceF64 / 1e18
          return { ...asset, price: newPrice, usdValue }
        }
        return asset
      })
      return changed ? updated : prev
    })
  }, [])

  useEffect(() => {
    refresh()
    const fullInterval = setInterval(refresh, FULL_REFRESH_MS)
    const priceInterval = setInterval(refreshPrices, PRICE_POLL_MS)
    return () => {
      clearInterval(fullInterval)
      clearInterval(priceInterval)
    }
  }, [refresh, refreshPrices])

  const totalUsdValue = assets.reduce((sum, a) => sum + a.usdValue, 0)

  return { assets, totalUsdValue, totalTokenCount, isLoading, error, refresh }
}
