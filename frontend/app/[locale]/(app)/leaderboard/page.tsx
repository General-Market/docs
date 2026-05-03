import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { HeroLeaderboard } from '@/components/domain/vision/WelcomeHero'

export const metadata = {
  title: 'Leaderboard',
  description: 'Top traders on the Anti-Cheat.',
}

export default function LeaderboardPage() {
  return (
    <AppShell search={<SourceSearch />}>
      <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h1
            className="font-semibold"
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 28,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text)',
              lineHeight: 1.07,
            }}
          >
            Leaderboard
          </h1>
          <p
            className="mt-2"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 15,
              color: 'var(--apple-text-secondary)',
              letterSpacing: 'var(--apple-track-tighter)',
            }}
          >
            Who is winning. Who is paying. The Anti-Cheat tells the truth.
          </p>
        </div>
        <HeroLeaderboard />
      </div>
    </AppShell>
  )
}
