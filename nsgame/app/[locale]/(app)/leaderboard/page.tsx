import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { NavBar } from '@/components/markets/NavBar'
import { BottomNav } from '@/components/markets/BottomNav'
import { WindowToggle, type LeaderboardWindow } from '@/components/leaderboard/WindowToggle'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import type { LeaderboardEntryDTO, LeaderboardSort } from '@/app/api/leaderboard/route'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'nsgame · leaderboard',
  description: 'Who profited. Who didn\'t. The market keeps the receipts.',
}

interface PageSearchParams {
  window?: string
  sort?: string
}

interface PageProps {
  searchParams: Promise<PageSearchParams>
}

const WINDOWS: ReadonlyArray<LeaderboardWindow> = ['24h', '7d', '30d', 'all']
const SORTS: ReadonlyArray<LeaderboardSort> = ['volume', 'pnl', 'wins', 'bets', 'recent']

function parseWindow(raw: string | undefined): LeaderboardWindow {
  if (raw && (WINDOWS as readonly string[]).includes(raw)) return raw as LeaderboardWindow
  return '7d'
}

function parseSort(raw: string | undefined): LeaderboardSort {
  if (raw && (SORTS as readonly string[]).includes(raw)) return raw as LeaderboardSort
  return 'volume'
}

// Phrasing follows the lead "Realized PnL across {COPY}." — choose
// fragments that read as a single sentence with a period at the end.
const WINDOW_COPY: Record<LeaderboardWindow, string> = {
  '24h': 'the last 24 hours',
  '7d': 'the last seven days',
  '30d': 'the last thirty days',
  all: 'every block since genesis',
}

async function fetchLeaderboard(
  window: LeaderboardWindow,
  sort: LeaderboardSort,
): Promise<{ entries: LeaderboardEntryDTO[] }> {
  // Build an absolute URL from the request — works inside Next's server
  // component boundary without leaking process.env to the client.
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3001'
  const url = `${proto}://${host}/api/leaderboard?window=${window}&sort=${sort}&limit=100`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return { entries: [] }
    return (await res.json()) as { entries: LeaderboardEntryDTO[] }
  } catch {
    return { entries: [] }
  }
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const window = parseWindow(sp.window)
  const sort = parseSort(sp.sort)
  const { entries } = await fetchLeaderboard(window, sort)
  const nowSecs = Math.floor(Date.now() / 1000)

  return (
    <main className="min-h-screen bg-terminal-surface-deep text-terminal-fg pb-[calc(env(safe-area-inset-bottom,0)+64px)] lg:pb-0">
      <NavBar />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="flex flex-col gap-3 py-6 sm:flex-row sm:items-end sm:justify-between sm:py-8">
          <div className="space-y-1">
            <p className="font-mono text-label uppercase tracking-[0.18em] text-terminal-fg-faint">
              leaderboard
            </p>
            <h1 className="text-[26px] font-semibold tracking-tight text-terminal-fg">
              Profit, by wallet<span className="text-rose-500">.</span>
            </h1>
            <p className="text-body text-terminal-fg-muted">
              Realized PnL across {WINDOW_COPY[window]}. Stake at risk
              isn't profit yet — it isn't anything yet.
            </p>
          </div>
          <WindowToggle active={window} />
        </header>

        <LeaderboardTable entries={entries} nowSecs={nowSecs} window={window} sort={sort} />

        <p className="mt-4 px-1 font-mono text-label uppercase tracking-[0.14em] text-terminal-fg-faint">
          {entries.length} wallets ranked · pnl in usdc · realized only
        </p>
      </div>

      <BottomNav />
    </main>
  )
}
