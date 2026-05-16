import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'General Market — Pitch',
  description: 'The case for General Market: prediction markets without front-running, without KYC, without intermediaries.',
  alternates: { canonical: 'https://www.generalmarket.io/pitchdeck' },
  openGraph: {
    title: 'General Market — Pitch',
    description: 'The case for General Market.',
    url: 'https://www.generalmarket.io/pitchdeck',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'General Market — Pitch',
    description: 'The case for General Market.',
  },
  robots: { index: true, follow: true },
}

export default function PitchdeckLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-black antialiased">
      {children}
    </div>
  )
}
