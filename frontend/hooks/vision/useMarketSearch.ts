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

/**
 * SSE-powered market search hook.
 * Streams results from /api/vision/search as they arrive.
 */
export function useMarketSearch(query: string, debounceMs = 250) {
  const [state, setState] = useState<SearchState>({ results: [], loading: false, total: 0 })
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const search = useCallback((q: string) => {
    // Cancel previous
    abortRef.current?.abort()

    if (!q.trim()) {
      setState({ results: [], loading: false, total: 0 })
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setState(prev => ({ ...prev, loading: true, results: [] }))

    const url = `/api/vision/search?q=${encodeURIComponent(q)}&limit=12`

    fetch(url, { signal: controller.signal })
      .then(res => {
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const markets: SearchMarket[] = []

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) {
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
