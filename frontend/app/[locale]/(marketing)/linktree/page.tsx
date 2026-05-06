import dynamic from 'next/dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'General Market — Links',
  description: 'Waitlist, docs, X, Discord. One screen. One phone.',
}

const PhoneLinktree = dynamic(
  () => import('@/components/marketing/linktree/PhoneLinktree').then((m) => m.PhoneLinktree),
  { ssr: false },
)

export default function LinktreePage() {
  return <PhoneLinktree />
}
