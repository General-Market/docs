'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { formatUnits, parseAbiItem } from 'viem'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

export interface MorphoTx {
  type: 'deposit' | 'withdraw' | 'borrow' | 'repay'
  amount: string       // human-readable
  token: string        // ITP or USDC
  txHash: string
  blockNumber: bigint
  timestamp: number    // 0 if unknown
}

const EVENT_SIGS = {
  SupplyCollateral: parseAbiItem('event SupplyCollateral(bytes32 indexed id, address caller, address indexed onBehalf, uint256 assets)'),
  WithdrawCollateral: parseAbiItem('event WithdrawCollateral(bytes32 indexed id, address caller, address indexed onBehalf, address receiver, uint256 assets)'),
  Borrow: parseAbiItem('event Borrow(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)'),
  Repay: parseAbiItem('event Repay(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)'),
}

export function useMorphoHistory(market: MorphoMarketEntry | undefined) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [txs, setTxs] = useState<MorphoTx[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const clientRef = useRef(publicClient)
  clientRef.current = publicClient

  const fetchHistory = useCallback(async () => {
    const client = clientRef.current
    if (!client || !address || !market) return

    setIsLoading(true)
    try {
      const morphoAddress = market.morpho
      const marketId = market.marketId

      // Fetch all 4 event types in parallel
      const [deposits, withdrawals, borrows, repays] = await Promise.all([
        client.getLogs({
          address: morphoAddress,
          event: EVENT_SIGS.SupplyCollateral,
          args: { id: marketId, onBehalf: address },
          fromBlock: 0n,
          toBlock: 'latest',
        }),
        client.getLogs({
          address: morphoAddress,
          event: EVENT_SIGS.WithdrawCollateral,
          args: { id: marketId, onBehalf: address },
          fromBlock: 0n,
          toBlock: 'latest',
        }),
        client.getLogs({
          address: morphoAddress,
          event: EVENT_SIGS.Borrow,
          args: { id: marketId, onBehalf: address },
          fromBlock: 0n,
          toBlock: 'latest',
        }),
        client.getLogs({
          address: morphoAddress,
          event: EVENT_SIGS.Repay,
          args: { id: marketId, onBehalf: address },
          fromBlock: 0n,
          toBlock: 'latest',
        }),
      ])

      const all: MorphoTx[] = []

      for (const log of deposits) {
        all.push({
          type: 'deposit',
          amount: formatUnits(log.args.assets ?? 0n, 18),
          token: 'ITP',
          txHash: log.transactionHash ?? '',
          blockNumber: log.blockNumber ?? 0n,
          timestamp: 0,
        })
      }
      for (const log of withdrawals) {
        all.push({
          type: 'withdraw',
          amount: formatUnits(log.args.assets ?? 0n, 18),
          token: 'ITP',
          txHash: log.transactionHash ?? '',
          blockNumber: log.blockNumber ?? 0n,
          timestamp: 0,
        })
      }
      for (const log of borrows) {
        all.push({
          type: 'borrow',
          amount: formatUnits(log.args.assets ?? 0n, 6),
          token: 'USDC',
          txHash: log.transactionHash ?? '',
          blockNumber: log.blockNumber ?? 0n,
          timestamp: 0,
        })
      }
      for (const log of repays) {
        all.push({
          type: 'repay',
          amount: formatUnits(log.args.assets ?? 0n, 6),
          token: 'USDC',
          txHash: log.transactionHash ?? '',
          blockNumber: log.blockNumber ?? 0n,
          timestamp: 0,
        })
      }

      // Sort by block number descending (most recent first)
      all.sort((a, b) => Number(b.blockNumber - a.blockNumber))

      // Fetch timestamps for unique blocks
      const uniqueBlocks = [...new Set(all.map(t => t.blockNumber))]
      const blockTimestamps = new Map<bigint, number>()

      await Promise.all(
        uniqueBlocks.slice(0, 20).map(async (bn) => {
          try {
            const block = await client.getBlock({ blockNumber: bn })
            blockTimestamps.set(bn, Number(block.timestamp))
          } catch {
            // ignore
          }
        })
      )

      for (const tx of all) {
        tx.timestamp = blockTimestamps.get(tx.blockNumber) ?? 0
      }

      setTxs(all)
    } catch {
      // Non-critical — history is nice-to-have
    } finally {
      setIsLoading(false)
    }
  }, [address, market])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return { txs, isLoading, refetch: fetchHistory }
}
