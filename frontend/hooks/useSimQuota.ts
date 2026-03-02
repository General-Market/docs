'use client'

import { useCallback, useState } from 'react'

const COOLDOWN_MS = 20_000 // 20 seconds

export function useSimQuota() {
  const [lastRunAt, setLastRunAt] = useState(0)

  const cooldownRemaining = Math.max(0, COOLDOWN_MS - (Date.now() - lastRunAt))
  const canRun = cooldownRemaining === 0

  const consume = useCallback(() => {
    setLastRunAt(Date.now())
  }, [])

  return {
    canRun,
    cooldownRemaining,
    consume,
  }
}
