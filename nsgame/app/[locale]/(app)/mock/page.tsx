import { MockTradePanel } from '@/components/domain/MockTradePanel'

export const metadata = {
  title: '1-click trading demo',
  description: 'Session wallet demo on Solana devnet — real transactions, fake odds.',
}

export default function MockPage() {
  return (
    <main className="min-h-screen bg-zinc-50 py-12">
      <MockTradePanel />
    </main>
  )
}
