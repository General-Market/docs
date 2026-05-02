import { NextRequest, NextResponse } from 'next/server'

// JSON-RPC proxy for L3 chain. POST-only.
const L3_RPC_URL = process.env.NEXT_PUBLIC_L3_RPC_URL || process.env.L3_RPC_URL || 'http://localhost:8545'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_ATTEMPTS = 5
const BACKOFF_MS = [0, 120, 320, 700, 1400]

// In-memory per-call cache with stale-on-error. The orbit-proxy upstream is
// hammered by other services on the L3 — at peak, ~40% of POSTs come back
// 502 with no body. Fresh entries (< FRESH_TTL_MS) skip upstream entirely.
// Stale entries (older but still resident) are kept indefinitely as a
// fallback: when upstream fails for a call we have any cached value for, we
// serve the stale one rather than failing the whole batch. View methods
// only; writes bypass.
const FRESH_TTL_MS = 30_000
const CACHE_MAX_ENTRIES = 4096
const CACHEABLE_METHODS = new Set([
  'eth_call',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_chainId',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getLogs',
])

type CacheEntry = { result: unknown; freshUntil: number }
const cache = new Map<string, CacheEntry>()

function cacheKey(method: string, params: unknown): string {
  return `${method}:${JSON.stringify(params)}`
}

function readFresh(key: string, now: number): unknown | undefined {
  const entry = cache.get(key)
  if (!entry || entry.freshUntil <= now) return undefined
  return entry.result
}

function readStale(key: string): unknown | undefined {
  return cache.get(key)?.result
}

function writeCache(key: string, result: unknown, now: number) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Trim half the oldest entries (Map preserves insertion order).
    const drop = Math.floor(CACHE_MAX_ENTRIES / 2)
    let i = 0
    for (const k of cache.keys()) {
      cache.delete(k)
      if (++i >= drop) break
    }
  }
  cache.set(key, { result, freshUntil: now + FRESH_TTL_MS })
}

interface RpcCall {
  jsonrpc?: string
  id: number | string
  method: string
  params?: unknown
}

interface RpcResponse {
  jsonrpc: string
  id: number | string
  result?: unknown
  error?: { code: number; message: string }
}

async function forward(body: string): Promise<Response | null> {
  const buf = new TextEncoder().encode(body)
  let lastResponse: Response | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (BACKOFF_MS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]))
    }
    try {
      const response = await fetch(L3_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buf,
        signal: AbortSignal.timeout(30_000),
      })
      if (response.status >= 500 && response.status < 600 && attempt + 1 < MAX_ATTEMPTS) {
        lastResponse = response
        continue
      }
      return response
    } catch {
      // network blip — retry
    }
  }
  return lastResponse
}

export async function POST(req: NextRequest) {
  const text = await req.text()
  const now = Date.now()

  // Parse. If unparseable, just forward unchanged.
  let parsed: RpcCall | RpcCall[] | null = null
  try {
    parsed = JSON.parse(text)
  } catch {
    const response = await forward(text)
    if (!response) return NextResponse.json({ error: 'RPC unreachable' }, { status: 502 })
    return new NextResponse(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const isBatch = Array.isArray(parsed)
  const calls: RpcCall[] = isBatch ? (parsed as RpcCall[]) : [parsed as RpcCall]

  // First pass: serve fresh cache hits locally; collect misses for upstream.
  const freshById = new Map<string | number, unknown>()
  const misses: RpcCall[] = []
  const missKey = new Map<string | number, string>()

  for (const call of calls) {
    if (!CACHEABLE_METHODS.has(call.method)) {
      misses.push(call)
      continue
    }
    const key = cacheKey(call.method, call.params ?? [])
    const hit = readFresh(key, now)
    if (hit !== undefined) {
      freshById.set(call.id, hit)
    } else {
      misses.push(call)
      missKey.set(call.id, key)
    }
  }

  // Second pass: ask upstream for the misses, with retry. If upstream fails
  // entirely, we'll fall back to stale cache below; nothing to do here yet.
  const upstreamById = new Map<string | number, RpcResponse>()
  let upstreamUsable = true
  let upstreamPassThrough: NextResponse | null = null

  if (misses.length > 0) {
    const body = isBatch ? JSON.stringify(misses) : JSON.stringify(misses[0])
    const response = await forward(body)

    if (!response) {
      upstreamUsable = false
    } else if (response.status !== 200) {
      // Non-200 from upstream (auth, payload, etc). If we can fall back to
      // stale for every miss, prefer that over surfacing the error. Else
      // pass it through.
      const allStale = misses.every((c) => readStale(missKey.get(c.id) ?? '') !== undefined)
      if (allStale) {
        upstreamUsable = false
      } else {
        upstreamPassThrough = new NextResponse(response.body, {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } else {
      const upstreamText = await response.text()
      let upstreamJson: unknown
      try {
        upstreamJson = JSON.parse(upstreamText)
      } catch {
        return new NextResponse(upstreamText, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const upstreamArr: RpcResponse[] = Array.isArray(upstreamJson)
        ? (upstreamJson as RpcResponse[])
        : [upstreamJson as RpcResponse]
      for (const r of upstreamArr) {
        upstreamById.set(r.id, r)
        const key = missKey.get(r.id)
        if (key && !r.error && r.result !== undefined) {
          writeCache(key, r.result, now)
        }
      }
    }
  }

  if (upstreamPassThrough) return upstreamPassThrough

  // Stitch the final response. For each call: prefer fresh cache, then
  // upstream's answer, then stale cache, then a synthesized error.
  const out: RpcResponse[] = calls.map((call) => {
    if (freshById.has(call.id)) {
      return { jsonrpc: '2.0', id: call.id, result: freshById.get(call.id) }
    }
    if (upstreamUsable) {
      const r = upstreamById.get(call.id)
      if (r) return r
    }
    const key = missKey.get(call.id)
    if (key) {
      const stale = readStale(key)
      if (stale !== undefined) {
        return { jsonrpc: '2.0', id: call.id, result: stale }
      }
    }
    return {
      jsonrpc: '2.0',
      id: call.id,
      error: { code: -32603, message: 'upstream unreachable, no cache' },
    }
  })

  return NextResponse.json(isBatch ? out : out[0], { status: 200 })
}
