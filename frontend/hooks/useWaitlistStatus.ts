'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAccount } from 'wagmi'

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/

type Cached = { whitelisted: boolean; at: number }
const cache = new Map<string, Cached>()
const TTL_MS = 30_000

export function useWaitlistStatus() {
  const { address, isConnected } = useAccount()
  const [whitelisted, setWhitelisted] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!isConnected || !address || !ADDR_RE.test(address)) {
      setWhitelisted(null)
      return
    }
    const key = address.toLowerCase()
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) {
      setWhitelisted(hit.whitelisted)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/waitlist/status?wallet=${address}`)
      const data = await res.json().catch(() => ({}))
      const ok = res.ok && typeof data.whitelisted === 'boolean'
      const value = ok ? Boolean(data.whitelisted) : false
      cache.set(key, { whitelisted: value, at: Date.now() })
      setWhitelisted(value)
    } catch {
      setWhitelisted(false)
    } finally {
      setLoading(false)
    }
  }, [address, isConnected])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const invalidate = useCallback(() => {
    if (address) cache.delete(address.toLowerCase())
    void refresh()
  }, [address, refresh])

  return { whitelisted, loading, refresh, invalidate }
}

export function clearWaitlistCache(address?: string) {
  if (address) cache.delete(address.toLowerCase())
  else cache.clear()
}
