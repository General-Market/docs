'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import type { LeaderboardEntryDTO } from '@/app/api/leaderboard/route'

// Bottom-of-page leaderboard preview. Pulls the 7d window, top 10, and
// hands them to the same table the dedicated /leaderboard page uses —
// one source of formatting, one set of column rules.

const POLL_MS = 60_000
const LIMIT = 10

interface ApiResponse {
  entries?: LeaderboardEntryDTO[]
}

export interface HomepageLeaderboardProps {
  className?: string
}

export function HomepageLeaderboard({ className = '' }: HomepageLeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntryDTO[]>([])
  const [nowSecs, setNowSecs] = useState<number>(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    let cancelled = false

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/leaderboard?window=7d&limit=${LIMIT}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const body = (await res.json()) as ApiResponse
        if (cancelled) return
        setEntries(body.entries ?? [])
        setNowSecs(Math.floor(Date.now() / 1000))
      } catch {
        // Indexer offline — keep last snapshot.
      }
    }

    void fetchOnce()
    const id = window.setInterval(fetchOnce, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <section className={className} aria-label="Leaderboard">
      <header className="mb-3 flex items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            leaderboard · 7d
          </p>
          <h2 className="text-[18px] font-semibold tracking-tight text-zinc-100">
            Profit, by wallet<span className="text-rose-500">.</span>
          </h2>
        </div>
        <Link
          href="/leaderboard"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-200"
        >
          full board →
        </Link>
      </header>

      <LeaderboardTable entries={entries} nowSecs={nowSecs} />
    </section>
  )
}
