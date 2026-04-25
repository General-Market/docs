'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/lib/contexts/ToastContext'
import { SolanaWalletProvider } from '@/lib/solana/SolanaWalletProvider'
import { ReactNode, useState } from 'react'

// Solana-only provider chain. The EVM SSE feed (morpho/vision/orders…)
// pointed at a data-node that no longer exists in this project.

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
    <QueryClientProvider client={queryClient}>
      <SolanaWalletProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </SolanaWalletProvider>
    </QueryClientProvider>
  )
}
