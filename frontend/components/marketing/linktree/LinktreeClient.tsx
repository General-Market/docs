'use client'

import dynamic from 'next/dynamic'
import { GeneralLoader } from '@/components/ui/GeneralLoader'

const PhoneLinktree = dynamic(
  () => import('./PhoneLinktree').then((m) => m.PhoneLinktree),
  {
    ssr: false,
    loading: () => <GeneralLoader height="100vh" />,
  },
)

export function LinktreeClient() {
  return <PhoneLinktree />
}
