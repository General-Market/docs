'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'

interface QuotaState {
  tier: number
  used: number
  signatures: string[]
  lastUnlock: string | null
}

const TIER_LIMITS: Record<number, number> = {
  0: 3,
  1: 8,   // 3 + 5
  2: 18,  // 8 + 10
  3: Infinity,
}

const STORAGE_PREFIX = 'vision-sim-quota:'
const ANON_KEY = 'vision-sim-anonymous'

function getStorageKey(address: string): string {
  return `${STORAGE_PREFIX}${address.toLowerCase()}`
}

function loadQuota(key: string): QuotaState {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { tier: 0, used: 0, signatures: [], lastUnlock: null }
}

function saveQuota(key: string, state: QuotaState) {
  localStorage.setItem(key, JSON.stringify(state))
}

export function useSimQuota() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const storageKey = isConnected && address ? getStorageKey(address) : ANON_KEY
  const [quota, setQuota] = useState<QuotaState>(() => loadQuota(storageKey))

  // Reload when wallet changes
  useEffect(() => {
    setQuota(loadQuota(storageKey))
  }, [storageKey])

  const remaining = Math.max(0, (TIER_LIMITS[quota.tier] ?? 3) - quota.used)
  const limit = TIER_LIMITS[quota.tier] ?? 3
  const isUnlimited = quota.tier >= 3
  const canRun = isUnlimited || remaining > 0
  const needsWallet = !isConnected && remaining <= 0

  const consume = useCallback(() => {
    if (isUnlimited) return
    const next = { ...quota, used: quota.used + 1 }
    saveQuota(storageKey, next)
    setQuota(next)
  }, [quota, storageKey, isUnlimited])

  const unlock = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !address) return false
    const nextTier = quota.tier + 1
    if (nextTier > 3) return false

    try {
      const message = `Vision Simulation Unlock | Tier ${nextTier} | ${new Date().toISOString()}`
      const signature = await signMessageAsync({ message })

      const next: QuotaState = {
        tier: nextTier,
        used: quota.used,
        signatures: [...quota.signatures, signature],
        lastUnlock: new Date().toISOString(),
      }
      saveQuota(storageKey, next)
      setQuota(next)
      return true
    } catch {
      return false
    }
  }, [isConnected, address, quota, storageKey, signMessageAsync])

  return {
    tier: quota.tier,
    used: quota.used,
    remaining,
    limit,
    isUnlimited,
    canRun,
    needsWallet,
    consume,
    unlock,
  }
}
