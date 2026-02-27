'use client'

import { WagmiProvider } from 'wagmi'
import { useAccount } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from '@/lib/wagmi'
import { ToastProvider } from '@/lib/contexts/ToastContext'
import { SSEProvider } from '@/hooks/useSSE'
import { ChainGuard } from '@/components/ChainGuard'
import { PostHogProvider } from '@/components/PostHogProvider'
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
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <PostHogProvider>
      <WagmiProvider config={wagmiConfig}>
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
    </PostHogProvider>
  )
}
