'use client'

import dynamic from 'next/dynamic'
import { ReactNode } from 'react'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

// Dynamic import with SSR disabled to prevent indexedDB errors during static generation
// WalletConnect uses indexedDB which is not available in Node.js
const Providers = dynamic(() => import('./providers').then((mod) => mod.Providers), {
  ssr: false,
})

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Providers>{children}</Providers>
    </ErrorBoundary>
  )
}
