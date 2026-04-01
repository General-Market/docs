'use client'

import { useState, useEffect } from 'react'

const COUNTER_EPOCH = 1774600000
const COUNTER_BASE = 500_000
const MARKETS_PER_HOUR = 72_000

function computeSettled(): number {
  const hours = Math.max(0, (Date.now() / 1000 - COUNTER_EPOCH) / 3600)
  return Math.floor(COUNTER_BASE + hours * MARKETS_PER_HOUR)
}

export function TopbarStats() {
  const [settled, setSettled] = useState(0)
  const [activeMarkets, setActiveMarkets] = useState(0)

  useEffect(() => {
    setSettled(computeSettled())
    const iv = setInterval(() => setSettled(computeSettled()), 10_000)

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

    return () => clearInterval(iv)
  }, [])

  if (settled === 0) return <span className="tabular-nums">&nbsp;</span>

  return (
    <span className="tabular-nums">
      {activeMarkets > 0 && (
        <><span className="font-bold">{activeMarkets.toLocaleString()}</span> live markets &middot; </>
      )}
      <span className="font-bold">{settled.toLocaleString()}</span> settlements
    </span>
  )
}
