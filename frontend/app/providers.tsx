'use client'

import { WagmiProvider } from 'wagmi'
import { useAccount } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getWagmiConfig } from '@/lib/wagmi'
import { ToastProvider } from '@/lib/contexts/ToastContext'
import { SSEProvider } from '@/hooks/useSSE'
import { ChainGuard } from '@/components/ChainGuard'
import { ReactNode, useMemo, useState } from 'react'

/**
 * Wraps children with SSEProvider, subscribing to global topics always
 * and user-specific topics only when a wallet is connected.
 * Must be rendered inside WagmiProvider to access useAccount.
 */
function SSEWrapper({ children }: { children: ReactNode }) {
  const { address } = useAccount()
  const topics = useMemo(() => {
    const t = ['system', 'nav', 'oracle']
    if (address) t.push('balances', 'allowances', 'orders', 'positions', 'cost-basis')
    return t
  }, [address])

  return (
    <SSEProvider topics={topics} address={address}>
      {children}
    </SSEProvider>
  )
}

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
          <SSEWrapper>
            <ChainGuard>
              {children}
            </ChainGuard>
          </SSEWrapper>
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
