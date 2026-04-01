import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { VaultsPage } from '@/components/domain/vaults/VaultsPage'

export default function VaultsRoute() {
  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <VaultsPage />
      <Footer />
    </main>
  )
}
