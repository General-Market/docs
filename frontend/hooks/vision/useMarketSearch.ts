import { useState, useEffect, useRef, useCallback } from 'react'

export interface SearchMarket {
  assetId: string
  symbol: string
  name: string
  source: string
  category: string | null
  value: string
  changePct: string | null
  volume24h: string | null
  marketCap: string | null
  imageUrl: string | null
}

interface SearchState {
  results: SearchMarket[]
  loading: boolean
  total: number
}

// Client-side result cache — avoids re-fetching for repeated/backspaced queries.
const resultCache = new Map<string, { results: SearchMarket[]; total: number; ts: number }>()
const CACHE_TTL = 60_000
const CACHE_MAX = 50

function getCached(q: string): { results: SearchMarket[]; total: number } | null {
  const entry = resultCache.get(q)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) {
    resultCache.delete(q)
    return null
  }
  return entry
}

function setCache(q: string, results: SearchMarket[], total: number) {
  if (resultCache.size >= CACHE_MAX) {
    const oldest = resultCache.keys().next().value
    if (oldest) resultCache.delete(oldest)
  }
  resultCache.set(q, { results, total, ts: Date.now() })
}

/**
 * Market search hook — JSON-first with SSE fallback.
 * JSON eliminates SSE framing overhead. Debounce: 80ms.
 */
export function useMarketSearch(query: string, debounceMs = 80) {
  const [state, setState] = useState<SearchState>({ results: [], loading: false, total: 0 })
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const search = useCallback((q: string) => {
    abortRef.current?.abort()

    if (!q.trim()) {
      setState({ results: [], loading: false, total: 0 })
      return
    }

    // Check client cache first
    const cached = getCached(q)
    if (cached) {
      setState({ results: cached.results, loading: false, total: cached.total })
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    // Show filtered prefix results while loading
    const prefixHint = q.length > 1 ? getCached(q.slice(0, -1)) : null
    if (prefixHint) {
      const ql = q.toLowerCase()
      const filtered = prefixHint.results.filter(m =>
        m.symbol.toLowerCase().includes(ql) ||
        m.name.toLowerCase().includes(ql) ||
        m.assetId.toLowerCase().includes(ql)
      )
      setState({ results: filtered.length > 0 ? filtered : [], loading: true, total: 0 })
    } else {
      setState(prev => ({ ...prev, loading: true, results: [] }))
    }

    const url = `/api/vision/search?q=${encodeURIComponent(q)}&limit=12`

    fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        // JSON response (fast path)
        if (res.headers.get('Content-Type')?.includes('application/json')) {
          const data = await res.json()
          const results = data.results ?? []
          setCache(q, results, data.total ?? results.length)
          setState({ results, loading: false, total: data.total ?? results.length })
          return
        }

        // SSE fallback (legacy)
        if (!res.body) throw new Error('No body')
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const markets: SearchMarket[] = []

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) {
              setCache(q, markets, markets.length)
              setState(prev => ({ ...prev, loading: false }))
              return
            }
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              try {
                const event = JSON.parse(line.slice(6))
                if (event.type === 'result') {
                  markets.push(event.market)
                  setState({ results: [...markets], loading: true, total: 0 })
                } else if (event.type === 'done') {
                  setCache(q, markets, event.total)
                  setState({ results: [...markets], loading: false, total: event.total })
                }
              } catch {}
            }
            return pump()
          })
        }
        return pump()
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setState(prev => ({ ...prev, loading: false }))
        }
      })
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!query.trim()) {
      setState({ results: [], loading: false, total: 0 })
      return
    }
    timerRef.current = setTimeout(() => search(query), debounceMs)
    return () => clearTimeout(timerRef.current)
  }, [query, debounceMs, search])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  return state
}
