import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SourceDetailSkeleton } from '@/components/ui/VisionLoader'

export default function SourceLoading() {
  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <div className="flex-1 overflow-x-clip">
        <SourceDetailSkeleton />
      </div>
      <Footer />
    </main>
  )
}
