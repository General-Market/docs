import { useQuery } from '@tanstack/react-query'

export interface SnapshotPrice {
  source: string
  assetId: string
  symbol: string
  name: string
  category: string | null
  value: string
  prevClose: string | null
  changePct: string | null
  volume24h: string | null
  marketCap: string | null
  fetchedAt: string
  imageUrl: string | null
}

export interface SourceSchedule {
  sourceId: string
  displayName: string
  enabled: boolean
  syncIntervalSecs: number
  lastSync: string | null
  nextSync: string | null
  estimatedNextUpdate: string | null
  status: string // healthy | stale | pending | disabled
}

export interface SnapshotResponse {
  generatedAt: string
  maxAgeSecs: number | null
  totalAssets: number
  sources: SourceSchedule[]
  prices: SnapshotPrice[]
}

export interface SnapshotMetaResponse {
  generatedAt: string
  totalAssets: number
  sources: SourceSchedule[]
  assetCounts: Record<string, number>
}

// Use local API proxy routes that transform data-node responses
const VISION_API_URL = ''
const CACHE_KEY_SNAPSHOT = 'gm-vision-snapshot-cache'
const CACHE_KEY_META = 'gm-vision-meta-cache'
const CACHE_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

function loadCache<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(key)
      return undefined
    }
    return data as T
  } catch { return undefined }
}

function saveCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* quota exceeded — ignore */ }
}

async function fetchWithTimeout(url: string, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

/** Lightweight meta: source schedules + per-source counts (instant, ~1KB) */
export function useMarketSnapshotMeta() {
  return useQuery<SnapshotMetaResponse>({
    queryKey: ['market-snapshot-meta'],
    queryFn: async () => {
      try {
        const res = await fetchWithTimeout(`${VISION_API_URL}/api/vision/snapshot/meta`, 10_000)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        saveCache(CACHE_KEY_META, data)
        return data
      } catch (err) {
        // Fall back to localStorage cache
        const cached = loadCache<SnapshotMetaResponse>(CACHE_KEY_META)
        if (cached) return cached
        throw err
      }
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  })
}

/** Full snapshot with all prices (~3MB gzipped) */
export function useMarketSnapshot() {
  return useQuery<SnapshotResponse>({
    queryKey: ['market-snapshot'],
    queryFn: async () => {
      try {
        const res = await fetchWithTimeout(`${VISION_API_URL}/api/vision/snapshot`, 45_000)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        saveCache(CACHE_KEY_SNAPSHOT, data)
        return data
      } catch (err) {
        // Fall back to localStorage cache
        const cached = loadCache<SnapshotResponse>(CACHE_KEY_SNAPSHOT)
        if (cached) return cached
        throw err
      }
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
    retryDelay: 5_000,
  })
}
