'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { usePublicClient } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { MOCK_BITGET_VAULT_ABI } from '@/lib/contracts/mockbitget-vault-abi'

const POLL_MS = 5_000
const BATCH_SIZE = 50

// ── Types ──

export interface VaultTrade {
  tradeId: bigint
  sellToken: string       // address
  buyToken: string        // address
  sellAmount: bigint
  buyAmount: bigint
  trader: string          // address
  timestamp: number       // unix seconds
  // Derived
  sellSymbol: string
  buySymbol: string
  side: 'buy' | 'sell'    // from user perspective: 'buy' = spending USDC to get token
  tokenSymbol: string     // the non-USDC side
  tokenAmount: bigint     // amount of the non-USDC side
  usdcAmount: bigint      // amount of USDC side
  feeAmount: bigint       // computed fee in buyToken terms
  price: number           // price per token in USDC
}

export interface UseVaultTradesReturn {
  trades: VaultTrade[]
  totalCount: number
  feeBps: number
  isLoading: boolean
  error: string | null
}

// ── Symbol map (address -> symbol) from deployed-assets.json ──

type AssetEntry = { address: string; symbol: string }
let symbolMapCache: Map<string, string> | null = null
let symbolMapPromise: Promise<Map<string, string>> | null = null

function loadSymbolMap(): Promise<Map<string, string>> {
  if (symbolMapCache) return Promise.resolve(symbolMapCache)
  if (symbolMapPromise) return symbolMapPromise

  symbolMapPromise = fetch('/deployed-assets.json')
    .then(r => r.ok ? r.json() as Promise<AssetEntry[]> : [])
    .then(entries => {
      const map = new Map<string, string>()
      for (const entry of entries) {
        map.set(entry.address.toLowerCase(), entry.symbol)
      }
      symbolMapCache = map
      return map
    })
    .catch(() => {
      symbolMapPromise = null
      return new Map<string, string>()
    })

  return symbolMapPromise
}

function resolveSymbol(address: string, symbolMap: Map<string, string>): string {
  const lower = address.toLowerCase()
  // Check WUSDC first
  if (lower === INDEX_PROTOCOL.l3Usdc.toLowerCase()) return 'USDC'
  return symbolMap.get(lower) || `${address.slice(0, 6)}...${address.slice(-4)}`
}

function isUsdc(address: string): boolean {
  return address.toLowerCase() === INDEX_PROTOCOL.l3Usdc.toLowerCase()
}

// ── Hook ──

export function useVaultTrades(): UseVaultTradesReturn {
  const publicClient = usePublicClient()
  const [rawTrades, setRawTrades] = useState<VaultTrade[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [feeBps, setFeeBps] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const symbolMapRef = useRef<Map<string, string>>(new Map())
  const mountedRef = useRef(true)

  const fetchTrades = useCallback(async () => {
    if (!publicClient || !INDEX_PROTOCOL.mockBitgetVault) return

    try {
      // Load symbol map if not loaded yet
      if (symbolMapRef.current.size === 0) {
        symbolMapRef.current = await loadSymbolMap()
      }

      const vaultAddr = INDEX_PROTOCOL.mockBitgetVault

      // Fetch tradeCount and feeBps in parallel
      const [countResult, feeBpsResult] = await Promise.all([
        publicClient.readContract({
          address: vaultAddr,
          abi: MOCK_BITGET_VAULT_ABI,
          functionName: 'tradeCount',
        }),
        publicClient.readContract({
          address: vaultAddr,
          abi: MOCK_BITGET_VAULT_ABI,
          functionName: 'feeBps',
        }),
      ])

      const count = Number(countResult)
      const fee = Number(feeBpsResult)

      if (!mountedRef.current) return

      setTotalCount(count)
      setFeeBps(fee)

      if (count === 0) {
        setRawTrades([])
        setIsLoading(false)
        return
      }

      // Fetch the most recent trades (up to BATCH_SIZE)
      const fetchCount = Math.min(count, BATCH_SIZE)
      const startIndex = count - fetchCount

      const tradeList = await publicClient.readContract({
        address: vaultAddr,
        abi: MOCK_BITGET_VAULT_ABI,
        functionName: 'getTradeHistory',
        args: [BigInt(startIndex), BigInt(fetchCount)],
      })

      if (!mountedRef.current) return

      const symbolMap = symbolMapRef.current
      const trades: VaultTrade[] = (tradeList as any[]).map((t: any) => {
        const sellToken = t.sellToken as string
        const buyToken = t.buyToken as string
        const sellAmount = BigInt(t.sellAmount)
        const buyAmount = BigInt(t.buyAmount)

        const sellSymbol = resolveSymbol(sellToken, symbolMap)
        const buySymbol = resolveSymbol(buyToken, symbolMap)

        // Determine side from user perspective:
        // sellToken is USDC -> user is buying (spending USDC to get buyToken)
        // buyToken is USDC -> user is selling (selling sellToken to get USDC)
        const userIsBuying = isUsdc(sellToken)
        const side: 'buy' | 'sell' = userIsBuying ? 'buy' : 'sell'

        const tokenSymbol = userIsBuying ? buySymbol : sellSymbol
        const tokenAmount = userIsBuying ? buyAmount : sellAmount
        const usdcAmount = userIsBuying ? sellAmount : buyAmount

        // Fee: fee was deducted from buyAmount during executeTrade
        // Reverse-engineer: original = actual / (1 - feeBps/10000)
        // feeAmount = original - actual = actual * feeBps / (10000 - feeBps)
        let feeAmount = 0n
        if (fee > 0) {
          feeAmount = buyAmount * BigInt(fee) / (10000n - BigInt(fee))
        }

        // Price: USDC per token (both 18 decimals on L3)
        let price = 0
        if (tokenAmount > 0n) {
          price = Number(usdcAmount) / Number(tokenAmount)
        }

        return {
          tradeId: BigInt(t.tradeId),
          sellToken,
          buyToken,
          sellAmount,
          buyAmount,
          trader: t.trader as string,
          timestamp: Number(t.timestamp),
          sellSymbol,
          buySymbol,
          side,
          tokenSymbol,
          tokenAmount,
          usdcAmount,
          feeAmount,
          price,
        }
      })

      // Sort by tradeId descending (most recent first)
      trades.sort((a, b) => (b.tradeId > a.tradeId ? 1 : b.tradeId < a.tradeId ? -1 : 0))

      setRawTrades(trades)
      setError(null)
    } catch (e: any) {
      if (mountedRef.current) {
        setError(e.shortMessage || e.message || 'Failed to fetch vault trades')
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [publicClient])

  useEffect(() => {
    mountedRef.current = true
    fetchTrades()
    const interval = setInterval(fetchTrades, POLL_MS)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [fetchTrades])

  return { trades: rawTrades, totalCount, feeBps, isLoading, error }
}
