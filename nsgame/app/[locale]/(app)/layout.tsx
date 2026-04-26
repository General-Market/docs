import { Web3Providers } from './web3-providers'
import { CookieBanner } from '@/components/layout/CookieBanner'
import { AgeGateModal } from '@/components/layout/AgeGateModal'
import { Footer } from '@/components/layout/Footer'

// Footer mounts at the layout level — single source for every route in
// (app). Renders on every viewport: the mobile bottom-nav sheet is opt-in,
// the footer is the always-on path to legal and resource links.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      {children}
      <Footer />
      <AgeGateModal />
      <CookieBanner />
    </Web3Providers>
  )
}
