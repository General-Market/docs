'use client'

import { ReactNode } from 'react'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Providers } from './providers'

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Providers>{children}</Providers>
    </ErrorBoundary>
  )
}
