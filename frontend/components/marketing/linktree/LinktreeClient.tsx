'use client'

import dynamic from 'next/dynamic'

const PhoneLinktree = dynamic(
  () => import('./PhoneLinktree').then((m) => m.PhoneLinktree),
  { ssr: false },
)

export function LinktreeClient() {
  return <PhoneLinktree />
}
