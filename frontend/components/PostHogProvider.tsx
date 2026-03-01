'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'

function PostHogPageTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    posthog.capture('page_viewed', {
      path: pathname,
      url: window.location.href,
      referrer: document.referrer || undefined,
    })
  }, [pathname])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog()
  }, [])

  return (
    <>
      <PostHogPageTracker />
      {children}
    </>
  )
}
