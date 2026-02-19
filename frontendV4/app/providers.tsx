'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getWagmiConfig } from '@/lib/wagmi'
import { ToastProvider } from '@/lib/contexts/ToastContext'
import { ChainGuard } from '@/components/ChainGuard'
import { ReactNode, useState } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  // Create QueryClient inside component to prevent state leaking between requests
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000, // 5 seconds
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <WagmiProvider config={getWagmiConfig()}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ChainGuard>
            {children}
          </ChainGuard>
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
