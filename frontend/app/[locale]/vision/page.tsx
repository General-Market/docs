import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { P2PoolPage } from '@/components/domain/p2pool/P2PoolPage'

export const metadata = { title: 'Vision' }

export default function VisionPage() {
  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <div className="flex-1 overflow-x-clip">
        <P2PoolPage />
      </div>
      <Footer />
    </main>
  )
}
