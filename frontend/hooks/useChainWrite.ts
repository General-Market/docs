'use client'

import { useCallback } from 'react'
import {
  useWriteContract,
  useSendTransaction,
  useSwitchChain,
  useAccount,
  type UseWriteContractParameters,
  type UseWriteContractReturnType,
  type UseSendTransactionParameters,
  type UseSendTransactionReturnType,
} from 'wagmi'
import { activeChainId, indexL3 } from '@/lib/wagmi'

/**
 * Ensure the wallet is on the correct chain before sending a transaction.
 * If already on the right chain, returns immediately.
 * Otherwise, attempts wagmi switchChainAsync, with raw RPC fallback.
 */
export async function ensureCorrectChain(
  currentChainId: number | undefined,
  switchChainAsync: (args: { chainId: number }) => Promise<unknown>,
  targetChainId: number = activeChainId,
  targetChain?: { name: string; nativeCurrency: { name: string; symbol: string; decimals: number }; rpcUrls: { default: { http: readonly string[] } } },
) {
  if (currentChainId === targetChainId) return

  const chain = targetChain ?? indexL3

  try {
    await switchChainAsync({ chainId: targetChainId })
  } catch {
    // Fallback: raw wallet RPC
    const provider = (window as any).ethereum
    if (!provider) throw new Error('No wallet provider found')

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      })
    } catch (switchError: any) {
      // 4902 = chain not added
      if (switchError?.code === 4902) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${targetChainId.toString(16)}`,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: [chain.rpcUrls.default.http[0]],
          }],
        })
      } else {
        throw switchError
      }
    }
  }

  // Wait for the provider to confirm the chain switch.
  // wagmi's writeContract checks connector.getChainId() which calls eth_chainId;
  // if the switch hasn't propagated, it throws ConnectorChainMismatchError.
  const provider = typeof window !== 'undefined' ? (window as any).ethereum : null
  if (provider) {
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      const hex = await provider.request({ method: 'eth_chainId' })
      if (parseInt(hex, 16) === targetChainId) return
      await new Promise(r => setTimeout(r, 100))
    }
  }
}

/**
 * Drop-in replacement for wagmi's useWriteContract.
 * Auto-switches chain and injects chainId before every write.
 */
export function useChainWriteContract(
  parameters?: UseWriteContractParameters,
): UseWriteContractReturnType {
  const result = useWriteContract(parameters)
  const { chainId: currentChainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()

  const wrappedWriteContract = useCallback(
    async (...args: Parameters<typeof result.writeContract>) => {
      try {
        await ensureCorrectChain(currentChainId, switchChainAsync)
      } catch {
        return // User rejected chain switch
      }
      const [variables, ...rest] = args
      result.writeContract({ ...variables, chainId: activeChainId } as any, ...rest)
    },
    [currentChainId, switchChainAsync, result.writeContract],
  ) as unknown as typeof result.writeContract

  const wrappedWriteContractAsync = useCallback(
    async (...args: Parameters<typeof result.writeContractAsync>) => {
      await ensureCorrectChain(currentChainId, switchChainAsync)
      const [variables, ...rest] = args
      return result.writeContractAsync({ ...variables, chainId: activeChainId } as any, ...rest)
    },
    [currentChainId, switchChainAsync, result.writeContractAsync],
  ) as unknown as typeof result.writeContractAsync

  return {
    ...result,
    writeContract: wrappedWriteContract,
    writeContractAsync: wrappedWriteContractAsync,
  }
}

/**
 * Drop-in replacement for wagmi's useSendTransaction.
 * Auto-switches chain and injects chainId before every send.
 */
export function useChainSendTransaction(
  parameters?: UseSendTransactionParameters,
): UseSendTransactionReturnType {
  const result = useSendTransaction(parameters)
  const { chainId: currentChainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()

  const wrappedSendTransaction = useCallback(
    async (...args: Parameters<typeof result.sendTransaction>) => {
      try {
        await ensureCorrectChain(currentChainId, switchChainAsync)
      } catch {
        return // User rejected chain switch
      }
      const [variables, ...rest] = args
      result.sendTransaction({ ...variables, chainId: activeChainId } as any, ...rest)
    },
    [currentChainId, switchChainAsync, result.sendTransaction],
  ) as unknown as typeof result.sendTransaction

  const wrappedSendTransactionAsync = useCallback(
    async (...args: Parameters<typeof result.sendTransactionAsync>) => {
      await ensureCorrectChain(currentChainId, switchChainAsync)
      const [variables, ...rest] = args
      return result.sendTransactionAsync({ ...variables, chainId: activeChainId } as any, ...rest)
    },
    [currentChainId, switchChainAsync, result.sendTransactionAsync],
  ) as unknown as typeof result.sendTransactionAsync

  return {
    ...result,
    sendTransaction: wrappedSendTransaction,
    sendTransactionAsync: wrappedSendTransactionAsync,
  }
}
