'use client'

import { ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { activeRpcUrl, activeCluster, adapterNetwork } from './cluster'

// The Unified Wallet Kit handles the modal UI + Mobile Wallet Adapter
// (iOS/Android deeplinks) in one import. It sits on top of
// @solana/wallet-adapter-react, which is what the rest of the app's hooks
// speak. We still mount ConnectionProvider + WalletProvider so the useWallet
// and useConnection hooks resolve — UnifiedWalletProvider is the presentational
// layer, not the state layer.
//
// env is the adapter network enum. It's largely cosmetic (the actual RPC comes
// from activeRpcUrl) but UWK uses it to flavor the wallet list and telemetry.

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: adapterNetwork }),
      new TrustWalletAdapter(),
      new LedgerWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  )

  const uwkEnv = activeCluster === 'mainnet-beta' ? 'mainnet-beta' : activeCluster === 'testnet' ? 'testnet' : 'devnet'

  return (
    <ConnectionProvider endpoint={activeRpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        <UnifiedWalletProvider
          wallets={[]}
          config={{
            autoConnect: true,
            env: uwkEnv,
            metadata: {
              name: 'General Market',
              description: 'Onchain prediction markets and index tokens',
              url: typeof window !== 'undefined' ? window.location.origin : 'https://generalmarket.io',
              iconUrls: ['https://generalmarket.io/icon.png'],
            },
            theme: 'dark',
            lang: 'en',
          }}
        >
          {children}
        </UnifiedWalletProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
