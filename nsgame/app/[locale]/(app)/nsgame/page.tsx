import { MockTradePanel } from '@/components/domain/MockTradePanel'

export const metadata = {
  title: 'nsgame — 1-click trading on Solana',
  description: 'Session-wallet prediction market on Solana devnet. Real on-chain transactions, parimutuel payouts.',
}

export default function NsgamePage() {
  return (
    <main className="min-h-screen bg-zinc-50 py-12">
      <MockTradePanel />
    </main>
  )
}
