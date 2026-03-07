'use client'

import { useAccount, useReadContract } from 'wagmi'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { VISION_ADDRESS } from '@/lib/vision/constants'
import { indexL3 } from '@/lib/wagmi'

export interface UseVisionBalanceReturn {
  /** Real balance — backed by actual L3 USDC in Vision.sol */
  realBalance: bigint
  /** Virtual balance — backed by USDC locked in SettlementBridgeCustody on Settlement*/
  virtualBalance: bigint
  /** Total balance = realBalance + virtualBalance */
  total: bigint
  /** Whether data is loading */
  isLoading: boolean
  /** Refetch both balances */
  refetch: () => void
}

/**
 * Read the dual-balance for the connected wallet from Vision.sol on L3.
 *
 * realBalance = backed by L3 USDC held in contract
 * virtualBalance = backed by SettlementUSDC locked in SettlementBridgeCustody
 * total = realBalance + virtualBalance (also available as balanceOf)
 */
export function useVisionBalance(): UseVisionBalanceReturn {
  const { address } = useAccount()
  const enabled = !!address && VISION_ADDRESS !== '0x0000000000000000000000000000000000000000'

  const {
    data: realData,
    isLoading: isRealLoading,
    refetch: refetchReal,
  } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'realBalance',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled },
  })

  const {
    data: virtualData,
    isLoading: isVirtualLoading,
    refetch: refetchVirtual,
  } = useReadContract({
    address: VISION_ADDRESS,
    abi: VISION_ABI,
    functionName: 'virtualBalance',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled },
  })

  const realBalance = (realData as bigint | undefined) ?? 0n
  const virtualBalance = (virtualData as bigint | undefined) ?? 0n

  return {
    realBalance,
    virtualBalance,
    total: realBalance + virtualBalance,
    isLoading: isRealLoading || isVirtualLoading,
    refetch: () => {
      refetchReal()
      refetchVirtual()
    },
  }
}
