'use client'

import { useCallback, useMemo } from 'react'
import { useWallet as useSolanaWalletAdapter, useConnection } from '@solana/wallet-adapter-react'
import type { VersionedTransaction, Transaction } from '@solana/web3.js'
import { activeCluster } from '@/lib/solana/cluster'

// Unified wallet hook — every component in the app reads from here. Backed
// by @solana/wallet-adapter-react (Phantom, Solflare, Backpack, Ledger,
// Trust, Torus…) via the Unified Wallet Kit modal. Address is a base58
// pubkey, not a 0x-prefixed EVM hex. Mobile works via the Mobile Wallet
// Adapter protocol that ships with wallet-adapter-react.

export function useWallet() {
  const {
    publicKey,
    connected,
    connecting,
    disconnecting,
    signMessage: adapterSignMessage,
    sendTransaction: adapterSendTransaction,
    signTransaction: adapterSignTransaction,
    wallet,
    disconnect,
  } = useSolanaWalletAdapter()
  const { connection } = useConnection()

  const address = useMemo<string | null>(() => {
    return publicKey ? publicKey.toBase58() : null
  }, [publicKey])

  // Returns the raw Uint8Array signature. Consumers encode as base58 where
  // needed (sign-in-with-Solana, off-chain proofs, etc).
  const signMessage = useCallback(
    async (message: string | Uint8Array): Promise<Uint8Array> => {
      if (!adapterSignMessage) throw new Error('Wallet does not support signMessage')
      const bytes = typeof message === 'string' ? new TextEncoder().encode(message) : message
      return adapterSignMessage(bytes)
    },
    [adapterSignMessage]
  )

  // Signs + broadcasts in one call using the connection's RPC. Returns the
  // base58 signature, which is also the tx id for explorer links.
  const signAndSendTransaction = useCallback(
    async (tx: Transaction | VersionedTransaction): Promise<string> => {
      return adapterSendTransaction(tx, connection)
    },
    [adapterSendTransaction, connection]
  )

  return {
    // Identity
    publicKey,
    address, // base58 string alias for migration ergonomics
    connected,
    connecting: connecting || disconnecting,
    walletName: wallet?.adapter.name ?? null,
    // Cluster
    cluster: activeCluster,
    connection,
    // Actions
    signMessage,
    signAndSendTransaction,
    signTransaction: adapterSignTransaction,
    disconnect,
  }
}

export type UseWalletReturn = ReturnType<typeof useWallet>
