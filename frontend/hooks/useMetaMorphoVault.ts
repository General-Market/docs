'use client'

import { useAccount, useReadContract } from 'wagmi'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { METAMORPHO_VAULT_ABI, MORPHO_ABI } from '@/lib/contracts/morpho-abi'
import { VaultInfo, VaultPosition, calculateUtilization } from '@/lib/types/morpho'

interface UseMetaMorphoVaultReturn {
  /** Vault information */
  vaultInfo: VaultInfo | undefined
  /** User's vault position */
  userPosition: VaultPosition | undefined
  /** Whether data is loading */
  isLoading: boolean
  /** Error if any */
  error: Error | null
  /** Refetch function */
  refetch: () => void
}

/**
 * Hook to fetch MetaMorpho vault info and user position
 *
 * Returns vault APY, total deposits, utilization, and user's shares/value.
 */
export function useMetaMorphoVault(): UseMetaMorphoVaultReturn {
  const { address } = useAccount()

  // Fetch vault total assets
  const {
    data: totalAssets,
    isLoading: isTotalAssetsLoading,
    error: totalAssetsError,
    refetch: refetchTotalAssets,
  } = useReadContract({
    address: MORPHO_ADDRESSES.metaMorphoVault,
    abi: METAMORPHO_VAULT_ABI,
    functionName: 'totalAssets',
    query: {
      refetchInterval: 15000,
    },
  })

  // Fetch vault total supply
  const {
    data: totalSupply,
    isLoading: isTotalSupplyLoading,
    refetch: refetchTotalSupply,
  } = useReadContract({
    address: MORPHO_ADDRESSES.metaMorphoVault,
    abi: METAMORPHO_VAULT_ABI,
    functionName: 'totalSupply',
    query: {
      refetchInterval: 15000,
    },
  })

  // Fetch vault name
  const {
    data: name,
    isLoading: isNameLoading,
  } = useReadContract({
    address: MORPHO_ADDRESSES.metaMorphoVault,
    abi: METAMORPHO_VAULT_ABI,
    functionName: 'name',
  })

  // Fetch vault symbol
  const {
    data: symbol,
    isLoading: isSymbolLoading,
  } = useReadContract({
    address: MORPHO_ADDRESSES.metaMorphoVault,
    abi: METAMORPHO_VAULT_ABI,
    functionName: 'symbol',
  })

  // Fetch vault decimals (ERC4626 vaults may use different decimals)
  const {
    data: decimals,
    isLoading: isDecimalsLoading,
  } = useReadContract({
    address: MORPHO_ADDRESSES.metaMorphoVault,
    abi: METAMORPHO_VAULT_ABI,
    functionName: 'decimals',
  })

  // Fetch user's vault shares
  const {
    data: userShares,
    isLoading: isUserSharesLoading,
    refetch: refetchUserShares,
  } = useReadContract({
    address: MORPHO_ADDRESSES.metaMorphoVault,
    abi: METAMORPHO_VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 15000,
    },
  })

  // Fetch market data for utilization calculation
  const {
    data: marketData,
    isLoading: isMarketLoading,
    refetch: refetchMarket,
  } = useReadContract({
    address: MORPHO_ADDRESSES.morpho,
    abi: MORPHO_ABI,
    functionName: 'market',
    args: [MORPHO_ADDRESSES.marketId],
    query: {
      refetchInterval: 15000,
    },
  })

  // Calculate vault info
  // Vault shares decimals default to 18 for ERC4626 if not fetched
  const vaultDecimals = decimals !== undefined ? Number(decimals) : 18

  let vaultInfo: VaultInfo | undefined
  if (totalAssets !== undefined && name !== undefined && symbol !== undefined && marketData) {
    const totalBorrowAssets = BigInt(marketData[2])
    const totalSupplyAssets = BigInt(marketData[0])

    const utilization = calculateUtilization(totalBorrowAssets, totalSupplyAssets)

    // Estimate APY based on utilization (simplified)
    // In production, this would be calculated from actual interest accrual
    const borrowApy = utilization * 0.15 // 15% at 100% utilization
    const supplyApy = borrowApy * (utilization / 100) // Supply APY = borrow APY * utilization

    vaultInfo = {
      address: MORPHO_ADDRESSES.metaMorphoVault,
      name: name as string,
      symbol: symbol as string,
      totalAssets: totalAssets as bigint,
      apy: supplyApy,
      utilization,
      decimals: vaultDecimals,
    }
  }

  // Calculate user position
  let userPosition: VaultPosition | undefined
  if (userShares !== undefined && totalAssets !== undefined && totalSupply !== undefined) {
    const shares = userShares as bigint
    const total = totalSupply as bigint
    const assets = totalAssets as bigint

    // Calculate user's value: shares * totalAssets / totalSupply
    const value = total > 0n ? (shares * assets) / total : 0n

    userPosition = {
      shares,
      value,
    }
  }

  const refetch = () => {
    refetchTotalAssets()
    refetchTotalSupply()
    refetchUserShares()
    refetchMarket()
  }

  return {
    vaultInfo,
    userPosition,
    isLoading: isTotalAssetsLoading || isTotalSupplyLoading || isNameLoading || isSymbolLoading || isDecimalsLoading || isUserSharesLoading || isMarketLoading,
    error: totalAssetsError as Error | null,
    refetch,
  }
}
