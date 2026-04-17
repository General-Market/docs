'use client'

import { useCallback, useMemo } from 'react'
import { usePhantom, useSolana, AddressType } from '@phantom/react-sdk'
import type { VersionedTransaction, Transaction } from '@solana/web3.js'
import { activeCluster } from '@/lib/solana/cluster'

// Unified wallet hook — every component in the app should read from here.
// Backed by Phantom Embedded + injected extension. Address is a base58 pubkey,
// not a 0x-prefixed EVM hex. Components that currently assume EVM format will
// need a Solana-aware `truncateAddress` pass in Phase 1b.
export function useWallet() {
  const { isConnected, isConnecting, isLoading, addresses, user } = usePhantom()
  const { solana, isAvailable } = useSolana()

  // Filter out non-Solana address types. Embedded wallet can expose several;
  // we surface Solana only.
  const publicKey = useMemo<string | null>(() => {
    if (!isConnected) return null
    const sol = addresses.find(a => String(a.addressType) === String(AddressType.solana))
    return sol?.address ?? null
  }, [isConnected, addresses])

  // Phantom returns a raw Uint8Array signature. Consumers generally want a
  // base58 string, but signMessage use cases vary — return the raw buffer and
  // let callers encode as needed.
  const signMessage = useCallback(
    async (message: string | Uint8Array): Promise<Uint8Array> => {
      if (!solana) throw new Error('Solana provider not available')
      const result = await solana.signMessage(message)
      return result.signature
    },
    [solana]
  )

  // Returns the transaction signature (base58). Callers that need the full
  // result (publicKey, etc) should use the underlying `solana` handle directly.
  const signAndSendTransaction = useCallback(
    async (tx: Transaction | VersionedTransaction): Promise<string> => {
      if (!solana) throw new Error('Solana provider not available')
      const result = await solana.signAndSendTransaction(tx)
      return result.signature
    },
    [solana]
  )

  // Phantom's embedded signer only switches between mainnet and devnet.
  // testnet/localnet require reconnecting with a different RPC override.
  const switchCluster = useCallback(
    async (cluster: 'mainnet' | 'devnet') => {
      if (!solana) throw new Error('Solana provider not available')
      await solana.switchNetwork(cluster)
    },
    [solana]
  )

  return {
    // Identity
    publicKey,
    address: publicKey, // alias for migration ergonomics
    connected: isConnected,
    connecting: isConnecting || isLoading,
    user,
    // Cluster
    cluster: activeCluster,
    isSolanaAvailable: isAvailable,
    // Actions
    signMessage,
    signAndSendTransaction,
    switchCluster,
  }
}

export type UseWalletReturn = ReturnType<typeof useWallet>
