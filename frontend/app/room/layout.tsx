import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Data Room — General Market',
  description: 'Private investor data room.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export default function RoomLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-black antialiased">
      {children}
    </div>
  )
}
