'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'

function PostHogPageTrackerInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname || !posthog.__loaded) return

    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname

    posthog.capture('$pageview', {
      $current_url: window.location.origin + url,
      path: pathname,
      referrer: document.referrer || undefined,
    })
  }, [pathname, searchParams])

  return null
}

function PostHogPageTracker() {
  return (
    <Suspense fallback={null}>
      <PostHogPageTrackerInner />
    </Suspense>
  )
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
