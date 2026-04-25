import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { NavBar } from '@/components/markets/NavBar'
import { BottomNav } from '@/components/markets/BottomNav'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { PositionsTable } from '@/components/profile/PositionsTable'
import { RecentFills } from '@/components/profile/RecentFills'
import type { UserSummaryDTO } from '@/app/api/users/[wallet]/summary/route'
import type { UserPositionDTO } from '@/app/api/positions/[wallet]/route'
import { shortAddress } from '@/lib/utils/usdc'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ handle: string }>
}

function isPlausibleWallet(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params
  if (!isPlausibleWallet(handle)) {
    return { title: 'nsgame · profile' }
  }
  const short = shortAddress(handle)
  return {
    title: `${short} · nsgame`,
    description: `Trader profile for ${short}. Lifetime PnL, open positions, recent fills.`,
  }
}

async function fetchProfile(wallet: string): Promise<{
  summary: UserSummaryDTO
  positions: UserPositionDTO[]
}> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3001'
  const base = `${proto}://${host}`

  const [sumRes, posRes] = await Promise.all([
    fetch(`${base}/api/users/${wallet}/summary`, { cache: 'no-store' }).catch(() => null),
    fetch(`${base}/api/positions/${wallet}`, { cache: 'no-store' }).catch(() => null),
  ])

  const summary = sumRes && sumRes.ok
    ? ((await sumRes.json()) as UserSummaryDTO)
    : {
        wallet,
        joinedAt: null,
        volume: '0',
        pnlRealized: '0',
        stakeAtRisk: '0',
        betsCount: 0,
        resolvedCount: 0,
        winCount: 0,
        winRate: null,
        pnlSeries: [],
      }

  const positionsPayload = posRes && posRes.ok
    ? ((await posRes.json()) as { positions?: UserPositionDTO[] })
    : { positions: [] as UserPositionDTO[] }

  return { summary, positions: positionsPayload.positions ?? [] }
}

export default async function ProfilePage({ params }: PageProps) {
  const { handle } = await params

  if (!isPlausibleWallet(handle)) {
    notFound()
  }

  const { summary, positions } = await fetchProfile(handle)
  const nowSecs = Math.floor(Date.now() / 1000)

  // Bucket positions: open + settling go on top, resolved underneath as
  // recent fills. Profile is for active state — settled rows live as
  // history.
  const live = positions.filter(p => p.state === 'open' || p.state === 'settling')

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pb-[calc(env(safe-area-inset-bottom,0)+64px)] lg:pb-0">
      <NavBar />

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <header className="flex items-center gap-3 py-6 sm:py-8">
          <Link
            href="/leaderboard"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-200"
          >
            ← leaderboard
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            profile
          </span>
        </header>

        <div className="space-y-6">
          <ProfileHeader summary={summary} />

          <section className="space-y-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400">
              open positions
            </h2>
            <PositionsTable positions={live} nowSecs={nowSecs} />
          </section>

          <section className="space-y-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400">
              recent fills
            </h2>
            <RecentFills positions={positions} nowSecs={nowSecs} limit={25} />
          </section>
        </div>

        <p className="mt-8 px-1 pb-8 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">
          pnl is realized only · solana usdc, six decimals · indexer is the source of truth
        </p>
      </div>

      <BottomNav />
    </main>
  )
}
