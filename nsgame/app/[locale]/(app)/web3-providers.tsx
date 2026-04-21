'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/lib/contexts/ToastContext'
import { SSEProvider } from '@/hooks/useSSE'
import { SolanaWalletProvider } from '@/lib/solana/SolanaWalletProvider'
import { Web3Provider } from '@/lib/contexts/Web3Context'
import { useWallet } from '@/hooks/useWallet'
import { ReactNode, useMemo, useState } from 'react'

// Name is historical. What was once a wagmi tree is now a Solana tree —
// connection + wallet adapters + session + react-query + SSE + toasts.
// The EVM scaffolding was burned; the exports stay so the layout import
// keeps pointing at a real thing.

function SSEWrapper({ children }: { children: ReactNode }) {
  const { address } = useWallet()
  const topics = useMemo(() => {
    const t = ['system', 'nav', 'oracle', 'morpho-markets', 'morpho-vault', 'vision-vaults']
    if (address) t.push('balances', 'allowances', 'orders', 'positions', 'cost-basis', 'vault-positions')
    return t
  }, [address])

  return (
    <SSEProvider topics={topics} address={address ?? undefined}>
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
      <QueryClientProvider client={queryClient}>
        <SolanaWalletProvider>
          <ToastProvider>
            <SSEWrapper>
              {children}
            </SSEWrapper>
          </ToastProvider>
        </SolanaWalletProvider>
      </QueryClientProvider>
    </Web3Provider>
  )
}
