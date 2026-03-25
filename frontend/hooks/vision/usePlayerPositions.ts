'use client'

import { useMemo } from 'react'
import { useReadContracts, useAccount } from 'wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'

export interface PositionEntry {
  batchId: number
  deposit: bigint
  totalDeposited: bigint
  joinTimestamp: bigint
  bitmapHash: string
}

/**
 * Multicall getPosition for multiple batch IDs.
 * Returns only batches where the user has a non-zero deposit.
 */
export function usePlayerPositions(batchIds: number[]) {
  const { address } = useAccount()
  const { getAddress } = useDeployment()
  const visionAddress = getAddress('Vision')

  const contracts = useMemo(
    () =>
      batchIds.map((id) => ({
        address: visionAddress,
        abi: VISION_ABI,
        functionName: 'getPosition' as const,
        args: [BigInt(id), address!] as const,
        chainId: indexL3.id,
      })),
    [batchIds, address, visionAddress],
  )

  const { data, isLoading } = useReadContracts({
    contracts,
    query: {
      enabled: batchIds.length > 0 && !!address && visionAddress !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10_000,
    },
  })

  const positions = useMemo(() => {
    if (!data) return []
    const result: PositionEntry[] = []
    for (let i = 0; i < data.length; i++) {
      const res = data[i]
      if (res.status !== 'success') continue
      const pos = res.result as any
      if (!pos || pos.deposit === 0n) continue
      result.push({
        batchId: batchIds[i],
        deposit: pos.deposit,
        totalDeposited: pos.totalDeposited,
        joinTimestamp: pos.joinTimestamp,
        bitmapHash: pos.bitmapHash,
      })
    }
    return result
  }, [data, batchIds])

  return { positions, isLoading }
}
