'use client'

import { useReadContract } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { BRIDGE_PROXY_ABI } from '@/lib/contracts/index-protocol-abi'
import { arbChainId } from '@/lib/wagmi'

/** Read deployer display name from BridgeProxy.getDeployerName(address) on Arb */
export function useDeployerName(address: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: INDEX_PROTOCOL.bridgeProxy,
    abi: BRIDGE_PROXY_ABI,
    functionName: 'getDeployerName',
    args: address ? [address] : undefined,
    chainId: arbChainId,
    query: { enabled: !!address },
  })

  return {
    name: (data as string) || '',
    isLoading,
    refetch,
  }
}
