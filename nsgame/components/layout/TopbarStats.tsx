'use client'

import { useState, useEffect } from 'react'

interface GlobalStats {
  totalMarkets: number | null
  totalSettled: number | null
}

export function TopbarStats() {
  const [stats, setStats] = useState<GlobalStats | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/vision/stats/global')
      .then(r => (r.ok ? r.json() : null))
      .then((d: GlobalStats | null) => {
        if (cancelled || !d) return
        setStats({
          totalMarkets:
            typeof d.totalMarkets === 'number' && d.totalMarkets > 0
              ? d.totalMarkets
              : null,
          totalSettled:
            typeof d.totalSettled === 'number' && d.totalSettled > 0
              ? d.totalSettled
              : null,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!stats || (stats.totalMarkets == null && stats.totalSettled == null)) {
    return <span className="tabular-nums">&mdash;</span>
  }

  const segments: React.ReactNode[] = []
  if (stats.totalMarkets != null) {
    segments.push(
      <span key="markets">
        <span className="font-bold">{stats.totalMarkets.toLocaleString()}</span> markets
      </span>,
    )
  }
  if (stats.totalSettled != null) {
    segments.push(
      <span key="settlements">
        <span className="font-bold">{stats.totalSettled.toLocaleString()}</span> settlements
      </span>,
    )
  }

  return (
    <span className="tabular-nums">
      {segments.map((seg, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-2 text-text-muted/40">·</span>}
          {seg}
        </span>
      ))}
    </span>
  )
}
