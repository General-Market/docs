'use client'

import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { MORPHO_ADDRESSES, getDefaultMarketParams, marketParamsToTuple } from '@/lib/contracts/morpho-addresses'
import { MORPHO_ABI } from '@/lib/contracts/morpho-abi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import type { MorphoMarketEntry } from '@/lib/contracts/morpho-markets-registry'

interface UseMorphoActionsReturn {
  /** Supply collateral to Morpho */
  supplyCollateral: (amount: bigint) => void
  /** Withdraw collateral from Morpho */
  withdrawCollateral: (amount: bigint) => void
  /** Borrow USDC against collateral */
  borrow: (amount: bigint) => void
  /** Repay USDC debt */
  repay: (amount: bigint) => void
  /** Repay all debt using exact borrowShares (dust-free) */
  repayAll: (shares: bigint) => void
  /** Current transaction hash */
  txHash: `0x${string}` | undefined
  /** Whether transaction is pending */
  isPending: boolean
  /** Whether transaction is confirming */
  isConfirming: boolean
  /** Whether transaction succeeded */
  isSuccess: boolean
  /** Transaction error */
  error: Error | null
  /** Reset transaction state */
  reset: () => void
}

/**
 * Hook for Morpho write operations
 *
 * Provides functions to supply/withdraw collateral and borrow/repay USDC.
 *
 * @param market - Optional MorphoMarketEntry. Falls back to default singleton.
 */
export function useMorphoActions(market?: MorphoMarketEntry): UseMorphoActionsReturn {
  const { address } = useAccount()

  const morphoAddress = market?.morpho ?? MORPHO_ADDRESSES.morpho
  const marketParamsTuple = market
    ? [market.loanToken, market.collateralToken, market.oracle, market.irm, market.lltv] as const
    : marketParamsToTuple(getDefaultMarketParams())

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset,
  } = useChainWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({ hash: txHash })

  const supplyCollateral = (amount: bigint) => {
    if (!address) return

    writeContract({
      address: morphoAddress,
      abi: MORPHO_ABI,
      functionName: 'supplyCollateral',
      args: [
        {
          loanToken: marketParamsTuple[0],
          collateralToken: marketParamsTuple[1],
          oracle: marketParamsTuple[2],
          irm: marketParamsTuple[3],
          lltv: marketParamsTuple[4],
        },
        amount,
        address,
        '0x', // empty callback data
      ],

    })
  }

  const withdrawCollateral = (amount: bigint) => {
    if (!address) return

    writeContract({
      address: morphoAddress,
      abi: MORPHO_ABI,
      functionName: 'withdrawCollateral',
      args: [
        {
          loanToken: marketParamsTuple[0],
          collateralToken: marketParamsTuple[1],
          oracle: marketParamsTuple[2],
          irm: marketParamsTuple[3],
          lltv: marketParamsTuple[4],
        },
        amount,
        address,
        address, // receiver
      ],

    })
  }

  const borrow = (amount: bigint) => {
    if (!address) return

    writeContract({
      address: morphoAddress,
      abi: MORPHO_ABI,
      functionName: 'borrow',
      args: [
        {
          loanToken: marketParamsTuple[0],
          collateralToken: marketParamsTuple[1],
          oracle: marketParamsTuple[2],
          irm: marketParamsTuple[3],
          lltv: marketParamsTuple[4],
        },
        amount,
        0n, // shares (0 = use assets)
        address,
        address, // receiver
      ],

    })
  }

  const repay = (amount: bigint) => {
    if (!address) return

    writeContract({
      address: morphoAddress,
      abi: MORPHO_ABI,
      functionName: 'repay',
      args: [
        {
          loanToken: marketParamsTuple[0],
          collateralToken: marketParamsTuple[1],
          oracle: marketParamsTuple[2],
          irm: marketParamsTuple[3],
          lltv: marketParamsTuple[4],
        },
        amount,
        0n, // shares (0 = use assets)
        address,
        '0x', // empty callback data
      ],

    })
  }

  const repayAll = (shares: bigint) => {
    if (!address) return

    writeContract({
      address: morphoAddress,
      abi: MORPHO_ABI,
      functionName: 'repay',
      args: [
        {
          loanToken: marketParamsTuple[0],
          collateralToken: marketParamsTuple[1],
          oracle: marketParamsTuple[2],
          irm: marketParamsTuple[3],
          lltv: marketParamsTuple[4],
        },
        0n, // assets (0 = use shares)
        shares,
        address,
        '0x', // empty callback data
      ],

    })
  }

  return {
    supplyCollateral,
    withdrawCollateral,
    borrow,
    repay,
    repayAll,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError as Error | null,
    reset,
  }
}
