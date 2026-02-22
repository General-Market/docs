'use client'

import { useReadContract } from 'wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { activeChainId } from '@/lib/wagmi'

const VISION_ADDRESS = (
  process.env.NEXT_PUBLIC_VISION_ADDRESS || '0x0000000000000000000000000000000000000000'
) as `0x${string}`

/** Read deployer display name from Vision.getDeployerName(address) */
export function useVisionDeployerName(address: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'getDeployerName',
    args: address ? [address] : undefined,
    chainId: activeChainId,
    query: { enabled: !!address },
  })

  return {
    name: (data as string) || '',
    isLoading,
    refetch,
  }
}
