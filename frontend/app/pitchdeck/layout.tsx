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
    images: [{ url: '/pitchdeck/slides/01.jpg', width: 1920, height: 1080 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'General Market — Pitch',
    description: 'The case for General Market.',
    images: ['/pitchdeck/slides/01.jpg'],
  },
  robots: { index: true, follow: true },
}

export default function PitchdeckLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      {children}
    </div>
  )
}
