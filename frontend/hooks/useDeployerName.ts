'use client'

import { useReadContract } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { BRIDGE_PROXY_ABI } from '@/lib/contracts/index-protocol-abi'
import { settlementChainId } from '@/lib/wagmi'

/** Read deployer display name from BridgeProxy.getDeployerName(address) on Settlement */
export function useDeployerName(address: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: INDEX_PROTOCOL.bridgeProxy,
    abi: BRIDGE_PROXY_ABI,
    functionName: 'getDeployerName',
    args: address ? [address] : undefined,
    chainId: settlementChainId,
    query: { enabled: !!address },
  })

  return {
    name: (data as string) || '',
    isLoading,
    refetch,
  }
}
