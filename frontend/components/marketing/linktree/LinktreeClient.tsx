'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { GeneralLoader } from '@/components/ui/GeneralLoader'
import { FlatLinktree } from './FlatLinktree'

const PhoneLinktree = dynamic(
  () => import('./PhoneLinktree').then((m) => m.PhoneLinktree),
  {
    ssr: false,
    loading: () => <GeneralLoader height="100vh" />,
  },
)

// Mobile viewports and touch devices get the flat linktree — no 3D phone,
// no GLB download, no react-three-fiber. Desktop with a fine pointer keeps
// the spinning phone scene.
const MOBILE_QUERY = '(max-width: 900px), (pointer: coarse), (hover: none)'

export function LinktreeClient() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  // SSR / first paint: ship the flat linktree. Cheaper, indexable, and
  // already correct for the majority of visitors landing from a phone.
  if (isMobile === null || isMobile) return <FlatLinktree />
  return <PhoneLinktree />
}
