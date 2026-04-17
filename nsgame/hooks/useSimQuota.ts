'use client'

import { useCallback, useEffect, useState } from 'react'

const COOLDOWN_MS = 20_000

export function useSimQuota() {
  const [lastRunAt, setLastRunAt] = useState(0)
  const [now, setNow] = useState(Date.now)

  const cooldownRemaining = Math.max(0, COOLDOWN_MS - (now - lastRunAt))
  const canRun = cooldownRemaining === 0

  useEffect(() => {
    if (canRun) return
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [canRun])

  const consume = useCallback(() => {
    const t = Date.now()
    setLastRunAt(t)
    setNow(t)
  }, [])

  return {
    canRun,
    cooldownRemaining,
    consume,
  }
}
