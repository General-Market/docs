'use client'

import { useCallback } from 'react'
import { posthog } from '@/lib/posthog'

type Properties = Record<string, unknown>

export function usePostHogTracker() {
  const capture = useCallback((event: string, properties?: Properties) => {
    posthog.capture(event, properties)
  }, [])

  const identify = useCallback((distinctId: string, properties?: Properties) => {
    posthog.identify(distinctId, properties)
  }, [])

  const reset = useCallback(() => {
    posthog.reset()
  }, [])

  return { capture, identify, reset }
}
