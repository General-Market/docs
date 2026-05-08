import { Redis } from '@upstash/redis'

type Counter = {
  count: number
  expiresAt: number
}

const memStore = new Map<string, Counter>()

let _redis: Redis | null | undefined
function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    _redis = null
    return null
  }
  _redis = new Redis({ url, token })
  return _redis
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetSeconds: number
}

/**
 * Sliding-fixed counter. Increments on every call, ALWAYS — caller decides
 * whether to count successes too (we count everything by default; success
 * paths can call clear() afterwards if a clean slate is desired).
 *
 * In production: Upstash Redis with TTL-bound INCR.
 * In dev or when Upstash is missing: in-memory Map, per-process.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis()
  const now = Date.now()

  if (redis) {
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, windowSeconds)
    }
    const ttl = await redis.ttl(key)
    const reset = ttl > 0 ? ttl : windowSeconds
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: reset,
    }
  }

  const cur = memStore.get(key)
  if (!cur || cur.expiresAt <= now) {
    memStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 })
    return { allowed: true, remaining: limit - 1, resetSeconds: windowSeconds }
  }
  cur.count += 1
  const remainingMs = cur.expiresAt - now
  return {
    allowed: cur.count <= limit,
    remaining: Math.max(0, limit - cur.count),
    resetSeconds: Math.ceil(remainingMs / 1000),
  }
}

export async function clearRateLimit(key: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.del(key)
    return
  }
  memStore.delete(key)
}
