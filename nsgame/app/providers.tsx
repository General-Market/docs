'use client'

import { PostHogProvider } from '@/components/PostHogProvider'
import { ReactNode } from 'react'

/**
 * Root providers — only PostHog (lightweight, needed on all pages).
 * Web3 stack (wagmi, QueryClient, SSE, ChainGuard, Toast) lives in
 * [locale]/(app)/web3-providers.tsx and only loads on app pages.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <PostHogProvider>
      {children}
    </PostHogProvider>
  )
}
