'use client'

import { WagmiProvider } from '@/lib/wallet-shim'
import { useAccount } from '@/lib/wallet-shim'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from '@/lib/wagmi'
import { ToastProvider } from '@/lib/contexts/ToastContext'
import { SSEProvider } from '@/hooks/useSSE'
import { ChainGuard } from '@/components/ChainGuard'
import { Web3Provider } from '@/lib/contexts/Web3Context'
import { PhantomWalletProvider } from '@/lib/solana/PhantomWalletProvider'
import { ReactNode, useMemo, useState } from 'react'

function SSEWrapper({ children }: { children: ReactNode }) {
  const { address } = useAccount()
  const topics = useMemo(() => {
    const t = ['system', 'nav', 'oracle', 'morpho-markets', 'morpho-vault', 'vision-vaults']
    if (address) t.push('balances', 'allowances', 'orders', 'positions', 'cost-basis', 'vault-positions')
    return t
  }, [address])

  return (
    <SSEProvider topics={topics} address={address}>
      {children}
    </SSEProvider>
  )
}

export function Web3Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <Web3Provider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <PhantomWalletProvider>
            <ToastProvider>
              <SSEWrapper>
                <ChainGuard>
                  {children}
                </ChainGuard>
              </SSEWrapper>
            </ToastProvider>
          </PhantomWalletProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </Web3Provider>
  )
}
