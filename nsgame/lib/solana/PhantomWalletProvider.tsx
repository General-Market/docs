'use client'

import { PhantomProvider, darkTheme, AddressType } from '@phantom/react-sdk'
import { ReactNode } from 'react'

// appId is required by Phantom's embedded flow. Without it, Google/Apple/email
// sign-in will refuse to initialize. Populate via env; a missing value falls
// back to injected-only (Phantom extension) mode.
const appId = process.env.NEXT_PUBLIC_PHANTOM_APP_ID

// Cluster is selected at runtime via useSolana().switchNetwork — not via
// provider config. The activeCluster env (cluster.ts) governs the initial
// switch which happens once the SDK mounts.

export function PhantomWalletProvider({ children }: { children: ReactNode }) {
  return (
    <PhantomProvider
      config={{
        providers: appId ? ['google', 'apple', 'phantom', 'injected', 'deeplink'] : ['injected'],
        appId: appId ?? '',
        addressTypes: [AddressType.solana],
      }}
      theme={darkTheme}
      appName="General Market"
    >
      {children}
    </PhantomProvider>
  )
}
