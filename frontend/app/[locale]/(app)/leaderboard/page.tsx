import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { LeaderboardApple } from '@/components/domain/vision/LeaderboardApple'
import { prefetchLeaderboard } from '@/lib/vision/prefetch'

export const metadata = {
  title: 'Leaderboard',
  description: 'Top traders on the Anti-Cheat.',
}

export const revalidate = 60

export default async function LeaderboardPage() {
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({
    queryKey: ['vision-leaderboard', undefined, undefined],
    queryFn: () => prefetchLeaderboard(),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppShell search={<SourceSearch />}>
        <div
          className="px-4 sm:px-6 lg:px-10 py-8 lg:py-12"
          style={{ maxWidth: 'var(--apple-content-wide)', margin: '0 auto', width: '100%' }}
        >
          <header className="mb-8">
            <h1
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 'clamp(32px, 3.5vw, 40px)',
                letterSpacing: 'var(--apple-track-tighter)',
                lineHeight: 1.1,
                fontWeight: 600,
                color: 'var(--apple-text)',
                margin: 0,
              }}
            >
              Leaderboard
            </h1>
            <p
              className="mt-3"
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 17,
                lineHeight: 1.47,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text-secondary)',
                maxWidth: 560,
              }}
            >
              Who is winning. Who is paying. The Anti-Cheat tells the truth.
            </p>
          </header>
          <LeaderboardApple />
        </div>
      </AppShell>
    </HydrationBoundary>
  )
}
