'use client'

import { useReadContract } from 'wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { useDeployment } from '@/hooks/useDeployment'

/** Read deployer display name from Vision.getDeployerName(address) */
export function useVisionDeployerName(address: `0x${string}` | undefined) {
  const { getAddress } = useDeployment()
  const visionAddress = getAddress('Vision')

  const { data, isLoading, refetch } = useReadContract({
    address: visionAddress,
    abi: VISION_ABI,
    functionName: 'getDeployerName',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address },
  })

  return {
    name: (data as string) || '',
    isLoading,
    refetch,
  }
}
