import type { Metadata } from 'next'
import { LinktreeClient } from '@/components/marketing/linktree/LinktreeClient'

export const metadata: Metadata = {
  title: 'General Market — Links',
  description: 'Waitlist, docs, X, Discord. One screen. One phone.',
}

export default function LinktreePage() {
  return <LinktreeClient />
}
