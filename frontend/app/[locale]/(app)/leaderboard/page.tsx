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
      <div className="mb-8">
        <h1
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'var(--apple-fs-40)',
            letterSpacing: 'var(--apple-track-tighter)',
            color: 'var(--apple-text)',
            lineHeight: 1.1,
            fontWeight: 600,
          }}
        >
          Leaderboard
        </h1>
        <p
          className="mt-2"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-17)',
            color: 'var(--apple-text-secondary)',
            letterSpacing: 'var(--apple-track-tight)',
          }}
        >
          Who is winning. Who is paying. The Anti-Cheat tells the truth.
        </p>
      </div>
      <HeroLeaderboard />
    </AppShell>
  )
}
