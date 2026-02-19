'use client'

import { useState, useEffect, useCallback } from 'react'

const DATA_NODE_URL = process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'

export interface RankedAsset {
  address: string
  symbol: string
  aum: number
  weightPct: number
  qtyPerShare: string
  rank: number
}

export interface RankingSnapshot {
  timestamp: number
  label: string
  eventType: string
  itpId: string
  totalAum: number
  computedNav: number
  perfRatio: number
  ranked: RankedAsset[]
}

interface UseInventoryRankingReturn {
  snapshots: RankingSnapshot[]
  allAssets: Map<string, string>
  maxRank: number
  isLoading: boolean
  error: string | null
}

const TOP_N = 10

export function useInventoryRanking(): UseInventoryRankingReturn {
  const [snapshots, setSnapshots] = useState<RankingSnapshot[]>([])
  const [allAssets, setAllAssets] = useState<Map<string, string>>(new Map())
  const [maxRank, setMaxRank] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${DATA_NODE_URL}/aum-ranking?top_n=${TOP_N}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      const resultSnapshots: RankingSnapshot[] = (data.snapshots || []).map((snap: any) => ({
        timestamp: snap.timestamp,
        label: snap.label,
        eventType: snap.event_type,
        itpId: snap.itp_id,
        totalAum: parseFloat(snap.total_aum) || 0,
        computedNav: parseFloat(snap.computed_nav) || 0,
        perfRatio: parseFloat(snap.perf_ratio) || 0,
        ranked: (snap.ranked || []).map((asset: any) => ({
          address: asset.address,
          symbol: asset.symbol,
          aum: parseFloat(asset.aum) || 0,
          weightPct: parseFloat(asset.weight_pct) || 0,
          qtyPerShare: asset.qty_per_share || '0',
          rank: asset.rank,
        })),
      }))

      // Build symbol map from response
      const symbolMap = new Map<string, string>()
      if (data.all_symbols) {
        for (const [addr, symbol] of Object.entries(data.all_symbols)) {
          symbolMap.set(addr, symbol as string)
        }
      }

      const maxR = Math.max(...resultSnapshots.map(s => s.ranked.length), 0)

      setSnapshots(resultSnapshots)
      setAllAssets(symbolMap)
      setMaxRank(maxR)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch ranking data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  return { snapshots, allAssets, maxRank, isLoading, error }
}
