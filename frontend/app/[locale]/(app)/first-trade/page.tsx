import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { FirstTradeGuide } from '@/components/domain/vision/FirstTradeGuide'

export const metadata = {
  title: 'My First Vision Trade',
  description: 'A step-by-step walkthrough for placing your first prediction on Vision.',
}

export default function FirstTradePage() {
  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <FirstTradeGuide />
      <div className="flex-1" />
      <Footer />
    </main>
  )
}
