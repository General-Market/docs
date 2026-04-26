import { Web3Providers } from './web3-providers'
import { CookieBanner } from '@/components/layout/CookieBanner'
import { AgeGateModal } from '@/components/layout/AgeGateModal'
import { Footer } from '@/components/layout/Footer'

// Footer mounts at the layout level — single source for every route in
// (app). Hidden below sm: because BottomNav already covers the mobile case
// via its More sheet. The doc-route pages used to render Footer themselves;
// those calls have been excised.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      {children}
      <div className="hidden sm:block">
        <Footer />
      </div>
      <AgeGateModal />
      <CookieBanner />
    </Web3Providers>
  )
}
