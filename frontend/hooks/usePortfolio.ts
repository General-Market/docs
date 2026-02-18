'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, formatUnits } from 'viem'

const DATA_NODE_URL = process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'
const ARB_RPC = process.env.NEXT_PUBLIC_ARB_RPC_URL || 'http://localhost:8546'

// Load BridgedITP address from deployment
let BRIDGED_ITP: `0x${string}` | null = null
let ITP_ID: string | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dep = require('@/lib/contracts/deployment.json')
  BRIDGED_ITP = dep.contracts?.BridgedITP as `0x${string}` ?? null
  ITP_ID = dep.contracts?.itpId ?? null
} catch { /* deployment not available */ }

const ERC20_BALANCE_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const

export interface Position {
  itp_id: string
  shares_bought: string
  shares_sold: string
  avg_cost: string
  current_nav: string
  current_value: string
  pnl: string
  pnl_pct: string
}

export interface PortfolioSummary {
  user: string
  positions: Position[]
  total_value: string
  total_invested: string
  total_pnl: string
  total_pnl_pct: string
}

export interface PortfolioHistoryPoint {
  date: string
  value: number
  pnl: number
  pnl_pct: number
}

export interface PortfolioTrade {
  order_id: number
  itp_id: string
  side: string
  amount: string
  fill_price: string | null
  shares: string | null
  status: string
  timestamp: string
}

interface UsePortfolioReturn {
  summary: PortfolioSummary | null
  history: PortfolioHistoryPoint[]
  trades: PortfolioTrade[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function usePortfolio(userAddress: string | undefined): UsePortfolioReturn {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([])
  const [trades, setTrades] = useState<PortfolioTrade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!userAddress) return

    setIsLoading(true)
    setError(null)

    try {
      // Fetch backend trade-based portfolio + on-chain balance in parallel
      const [summaryRes, historyRes, tradesRes, onChainBalance] = await Promise.all([
        fetch(`${DATA_NODE_URL}/portfolio?user=${userAddress}`),
        fetch(`${DATA_NODE_URL}/portfolio/history?user=${userAddress}&days=30`),
        fetch(`${DATA_NODE_URL}/portfolio/trades?user=${userAddress}`),
        readOnChainBalance(userAddress),
      ])

      let summaryData: PortfolioSummary | null = null
      if (summaryRes.ok) {
        summaryData = await summaryRes.json()
      }

      if (onChainBalance && onChainBalance.balance > 0n) {
        const navData = await fetchNav(onChainBalance.itpId)
        if (navData) {
          const shares = Number(formatUnits(onChainBalance.balance, 18))
          const value = shares * navData.navPerShare
          const position: Position = {
            itp_id: onChainBalance.itpId,
            shares_bought: shares.toFixed(4),
            shares_sold: '0',
            avg_cost: '—',
            current_nav: `${navData.navPerShare.toFixed(6)}`,
            current_value: `${value.toFixed(2)}`,
            pnl: '—',
            pnl_pct: '—',
          }

          if (!summaryData) {
            summaryData = {
              user: userAddress,
              positions: [position],
              total_value: value.toFixed(2),
              total_invested: '—',
              total_pnl: '—',
              total_pnl_pct: '—',
            }
          } else {
            const existingIdx = summaryData.positions.findIndex(p => p.itp_id === onChainBalance.itpId)
            if (existingIdx === -1) {
              summaryData.positions.push(position)
              const newTotal = parseFloat(summaryData.total_value) + value
              summaryData.total_value = newTotal.toFixed(2)
            }
          }
        }
      }

      // Merge on-chain balance into portfolio if the backend doesn't already track it
      if (onChainBalance && onChainBalance.balance > 0n) {
        const navData = await fetchNav(onChainBalance.itpId)
        if (navData) {
          const shares = Number(formatUnits(onChainBalance.balance, 18))
          const value = shares * navData.navPerShare
          const position: Position = {
            itp_id: onChainBalance.itpId,
            shares_bought: shares.toFixed(4),
            shares_sold: '0',
            avg_cost: '—',
            current_nav: `${navData.navPerShare.toFixed(6)}`,
            current_value: `${value.toFixed(2)}`,
            pnl: '—',
            pnl_pct: '—',
          }

          if (!summaryData) {
            summaryData = {
              user: userAddress,
              positions: [position],
              total_value: value.toFixed(2),
              total_invested: '—',
              total_pnl: '—',
              total_pnl_pct: '—',
            }
          } else {
            const existingIdx = summaryData.positions.findIndex(p => p.itp_id === onChainBalance.itpId)
            if (existingIdx === -1) {
              summaryData.positions.push(position)
              const newTotal = parseFloat(summaryData.total_value) + value
              summaryData.total_value = newTotal.toFixed(2)
            }
          }
        }
      }

      setSummary(summaryData)

      if (historyRes.ok) {
        const data = await historyRes.json()
        setHistory(data.points || [])
      }
      if (tradesRes.ok) {
        const data = await tradesRes.json()
        setTrades(data.trades || [])
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch portfolio data')
    } finally {
      setIsLoading(false)
    }
  }, [userAddress])

  useEffect(() => {
    if (!userAddress) {
      setSummary(null)
      setHistory([])
      setTrades([])
      setIsLoading(false)
      return
    }

    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [userAddress, fetchAll])

  return { summary, history, trades, isLoading, error, refetch: fetchAll }
}

async function readOnChainBalance(
  userAddress: string,
): Promise<{ balance: bigint; itpId: string } | null> {
  if (!BRIDGED_ITP || !ITP_ID) return null

  try {
    const client = createPublicClient({ transport: http(ARB_RPC) })
    const balance = await client.readContract({
      address: BRIDGED_ITP,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [userAddress as `0x${string}`],
    })
    return { balance, itpId: ITP_ID }
  } catch {
    return null
  }
}

async function fetchNav(itpId: string): Promise<{ navPerShare: number } | null> {
  try {
    const res = await fetch(
      `${DATA_NODE_URL}/itp-price?itp_id=${itpId}`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const data = await res.json()
    return { navPerShare: parseFloat(data.nav_display) }
  } catch {
    return null
  }
}
