'use client'

// Wagmi-shaped facade over the Solana wallet layer. Every file that used to
// import from 'wagmi' now imports from '@/lib/wallet-shim'. Shapes are
// preserved so component code keeps compiling; behavior is degraded to the
// state of the Solana migration:
//
//   - Reads (useReadContract, useBalance, …) return `data: undefined`. Once
//     Solana programs exist, swap these for typed program queries.
//   - Writes (useWriteContract, useSendTransaction) throw a clear error so
//     no one thinks a silent no-op is "working."
//   - Identity hooks (useAccount, useChainId) are backed by Phantom via
//     hooks/useWallet.ts, so the header and address pills stay correct.

import type {
  UseAccountReturnType,
  UseConnectReturnType,
  UseDisconnectReturnType,
  UseSwitchChainReturnType,
  UseWriteContractReturnType,
  UseSendTransactionReturnType,
} from 'wagmi'

export type {
  UseWriteContractParameters,
  UseWriteContractReturnType,
  UseSendTransactionParameters,
  UseSendTransactionReturnType,
  UseReadContractParameters,
  UseReadContractReturnType,
  UseBalanceParameters,
  UseBalanceReturnType,
  UsePublicClientParameters,
  UseAccountReturnType,
  UseConnectReturnType,
  UseDisconnectReturnType,
  UseChainIdParameters,
  UseSwitchChainParameters,
  UseSwitchChainReturnType,
  UseReadContractsParameters,
  UseReadContractsReturnType,
  UseWaitForTransactionReceiptParameters,
  UseWaitForTransactionReceiptReturnType,
  Config,
} from 'wagmi'

export { WagmiProvider } from 'wagmi'

import { useCallback } from 'react'
import { useWallet } from '@/hooks/useWallet'

const WRITE_NOT_READY = new Error(
  'Solana program calls are not yet wired. Contracts are in development — the wallet connects, but reads return empty and writes throw until the programs ship.'
)

// Chain id is an EVM concept. 101 is the conventional "Solana mainnet" magic
// number in the ecosystem — picked so existing chain-equality checks don't
// collide with any deployed EVM chain.
const SOLANA_MAINNET_CHAIN_ID = 101

// Every hook below returns a wagmi-shaped payload cast through `unknown`.
// The double cast sidesteps the strict discriminated unions that wagmi
// uses internally; the runtime value is valid enough for consumers that
// only read a handful of fields (address, data, isPending, etc).

export function useAccount(): UseAccountReturnType {
  const { address, connected, connecting } = useWallet()
  return {
    address: address ?? undefined,
    addresses: address ? [address] : undefined,
    chain: undefined,
    chainId: connected ? SOLANA_MAINNET_CHAIN_ID : undefined,
    connector: undefined,
    isConnected: connected,
    isConnecting: connecting,
    isDisconnected: !connected && !connecting,
    isReconnecting: false,
    status: connected ? 'connected' : 'disconnected',
  } as unknown as UseAccountReturnType
}

export function useConnect(): UseConnectReturnType {
  return {
    connect: () => {},
    connectAsync: async () => { throw WRITE_NOT_READY },
    connectors: [],
    data: undefined,
    error: null,
    failureReason: null,
    isError: false,
    isIdle: true,
    isPending: false,
    isSuccess: false,
    reset: () => {},
    status: 'idle',
    variables: undefined,
  } as unknown as UseConnectReturnType
}

export function useDisconnect(): UseDisconnectReturnType {
  return {
    disconnect: () => {},
    disconnectAsync: async () => {},
    connectors: [],
    data: undefined,
    error: null,
    failureReason: null,
    isError: false,
    isIdle: true,
    isPending: false,
    isSuccess: false,
    reset: () => {},
    status: 'idle',
    variables: undefined,
  } as unknown as UseDisconnectReturnType
}

export function useChainId(): number {
  const { connected } = useWallet()
  return connected ? SOLANA_MAINNET_CHAIN_ID : 0
}

export function useSwitchChain(): UseSwitchChainReturnType {
  return {
    chains: [],
    switchChain: () => {},
    switchChainAsync: async () => { throw WRITE_NOT_READY },
    data: undefined,
    error: null,
    failureReason: null,
    isError: false,
    isIdle: true,
    isPending: false,
    isSuccess: false,
    reset: () => {},
    status: 'idle',
    variables: undefined,
  } as unknown as UseSwitchChainReturnType
}

// Read hooks: typed as `any` so downstream destructuring + ABI-inferred usages
// (bigint, hex, struct tuples) keep compiling. Data is always undefined /
// empty; callers see the loading-free success branch with nothing to render.
// Replace these with typed Solana program queries in Phase 2.

export function useBalance(_params?: unknown): any {
  return {
    data: undefined,
    error: null,
    failureReason: null,
    isError: false,
    isLoading: false,
    isPending: false,
    isFetching: false,
    isSuccess: true,
    refetch: async () => ({ data: undefined }),
    status: 'success',
    queryKey: [],
  }
}

export function useReadContract(_params?: unknown): any {
  return {
    data: undefined,
    error: null,
    failureReason: null,
    isError: false,
    isLoading: false,
    isPending: false,
    isFetching: false,
    isSuccess: true,
    refetch: async () => ({ data: undefined }),
    status: 'success',
    queryKey: [],
  }
}

export function useReadContracts(_params?: unknown): any {
  return {
    data: [],
    error: null,
    failureReason: null,
    isError: false,
    isLoading: false,
    isPending: false,
    isFetching: false,
    isSuccess: true,
    refetch: async () => ({ data: [] }),
    status: 'success',
    queryKey: [],
  }
}

// Public client is EVM-specific. Return a proxy that throws on every method
// so misuse surfaces loudly instead of silently returning undefined. Type is
// `any` to satisfy the .readContract / .getBlock / .waitForTransactionReceipt
// call sites sprinkled through the codebase.
export function usePublicClient(_params?: unknown): any {
  return new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return undefined // not a promise
      return () => {
        throw new Error(
          `publicClient.${String(prop)}() called, but the EVM provider is gone. Port this call to the Solana RPC (see lib/solana/cluster.ts).`
        )
      }
    },
  })
}

export function useSignMessage(_params?: unknown): any {
  return {
    signMessage: () => { throw WRITE_NOT_READY },
    signMessageAsync: async () => { throw WRITE_NOT_READY },
    data: undefined,
    error: null,
    isError: false,
    isIdle: true,
    isPending: false,
    isSuccess: false,
    reset: () => {},
    status: 'idle',
    variables: undefined,
  }
}

export function useWriteContract(_params?: unknown): UseWriteContractReturnType {
  const writeContract = useCallback((_vars?: unknown) => { throw WRITE_NOT_READY }, [])
  const writeContractAsync = useCallback(async (_vars?: unknown) => {
    throw WRITE_NOT_READY
  }, [])
  return {
    writeContract,
    writeContractAsync,
    data: undefined,
    error: null,
    failureReason: null,
    isError: false,
    isIdle: true,
    isPending: false,
    isPaused: false,
    isSuccess: false,
    reset: () => {},
    status: 'idle',
    variables: undefined,
    context: undefined,
    submittedAt: 0,
  } as unknown as UseWriteContractReturnType
}

export function useSendTransaction(_params?: unknown): UseSendTransactionReturnType {
  const sendTransaction = useCallback((_vars?: unknown) => { throw WRITE_NOT_READY }, [])
  const sendTransactionAsync = useCallback(async (_vars?: unknown) => {
    throw WRITE_NOT_READY
  }, [])
  return {
    sendTransaction,
    sendTransactionAsync,
    data: undefined,
    error: null,
    failureReason: null,
    isError: false,
    isIdle: true,
    isPending: false,
    isPaused: false,
    isSuccess: false,
    reset: () => {},
    status: 'idle',
    variables: undefined,
    context: undefined,
    submittedAt: 0,
  } as unknown as UseSendTransactionReturnType
}

export function useWaitForTransactionReceipt(_params?: unknown): any {
  return {
    data: undefined,
    error: null,
    failureReason: null,
    fetchStatus: 'idle',
    isError: false,
    isLoading: false,
    isPending: false,
    isFetching: false,
    isSuccess: false,
    refetch: async () => ({ data: undefined }),
    status: 'pending',
    queryKey: [],
  }
}
