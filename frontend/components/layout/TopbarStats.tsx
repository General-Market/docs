'use client'

import { useState, useEffect } from 'react'

export function TopbarStats() {
  const [activeMarkets, setActiveMarkets] = useState(0)

  useEffect(() => {
    fetch('/api/dn/market-count')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.count > 0) { setActiveMarkets(d.count); return }
        return fetch('/api/vision/batches')
          .then(r => r.ok ? r.json() : { batches: [] })
          .then(d => {
            const batches = d.batches ?? []
            let total = 0, missing = 0
            for (const b of batches) {
              const mc = b.market_count ?? 0
              if (mc > 0) total += mc; else missing++
            }
            total += missing * 3000
            if (total > 0) setActiveMarkets(total)
          })
      })
      .catch(() => {})
  }, [])

  if (activeMarkets === 0) return <span className="tabular-nums">&mdash;</span>

  return (
    <span className="tabular-nums">
      <span className="font-bold">{activeMarkets.toLocaleString()}</span> live markets
    </span>
  )
}
