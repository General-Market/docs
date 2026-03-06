'use client'

import { useAccount, useReadContract } from 'wagmi'
import { indexL3 } from '@/lib/wagmi'
import { MORPHO_ADDRESSES } from '@/lib/contracts/morpho-addresses'
import { METAMORPHO_VAULT_ABI, MORPHO_ABI } from '@/lib/contracts/morpho-abi'
import { CURATOR_RATE_IRM_ABI } from '@/lib/contracts/curator-rate-irm-abi'
import { VaultInfo, VaultPosition, calculateUtilization } from '@/lib/types/morpho'
import { useSSEOracle } from './useSSE'

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
 * Hook to fetch MetaMorpho vault info and user position.
 *
 * Returns vault APY, total deposits, utilization, and user's shares/value.
 *
 * TODO: Vault-level data (totalAssets, totalSupply, name, symbol, decimals)
 * is not in the SSE stream or REST endpoints yet. These wagmi useReadContract
 * calls remain until a `vault-info` SSE topic or REST endpoint is added to
 * the data-node. The polling reads are lightweight (single view calls) so
 * they are lower priority than the heavy getLogs scans that were eliminated.
 *
 * TODO: User's vault share balance (balanceOf) should move to the per-user
 * SSE poller once vault positions are tracked in ChainCache.
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
    chainId: indexL3.id,
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
    chainId: indexL3.id,
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
    chainId: indexL3.id,
  })

  // Fetch vault symbol
  const {
    data: symbol,
    isLoading: isSymbolLoading,
  } = useReadContract({
    address: MORPHO_ADDRESSES.metaMorphoVault,
    abi: METAMORPHO_VAULT_ABI,
    functionName: 'symbol',
    chainId: indexL3.id,
  })

  // Fetch vault decimals (ERC4626 vaults may use different decimals)
  const {
    data: decimals,
    isLoading: isDecimalsLoading,
  } = useReadContract({
    address: MORPHO_ADDRESSES.metaMorphoVault,
    abi: METAMORPHO_VAULT_ABI,
    functionName: 'decimals',
    chainId: indexL3.id,
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
    chainId: indexL3.id,
    query: {
      enabled: !!address,
      refetchInterval: 15000,
    },
  })

  // SSE oracle for borrow rate
  const sseOracle = useSSEOracle()

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
    chainId: indexL3.id,
    query: {
      refetchInterval: 15000,
    },
  })

  // Read stored borrow rate from IRM contract as fallback
  const {
    data: irmStoredRate,
  } = useReadContract({
    address: MORPHO_ADDRESSES.curatorRateIrm,
    abi: CURATOR_RATE_IRM_ABI,
    functionName: 'rates',
    args: [MORPHO_ADDRESSES.marketId],
    chainId: indexL3.id,
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

    // Compute borrow APY from CuratorRateIRM rate (WAD per second, 1e18 scale)
    // Priority: SSE borrow_rate → on-chain IRM rates() → linear fallback
    let borrowApy: number
    const sseBorrowRate = sseOracle?.borrow_rate_ray
    if (sseBorrowRate && sseBorrowRate !== '0') {
      const ratePerSec = Number(BigInt(sseBorrowRate)) / 1e18
      borrowApy = ratePerSec * 365.25 * 86400 * 100
    } else if (irmStoredRate && irmStoredRate > 0n) {
      const ratePerSec = Number(irmStoredRate) / 1e18
      borrowApy = ratePerSec * 365.25 * 86400 * 100
    } else {
      borrowApy = utilization * 0.15
    }
    const supplyApy = borrowApy * (utilization / 100)

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
