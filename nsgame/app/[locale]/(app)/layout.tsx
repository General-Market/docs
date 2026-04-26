import { Web3Providers } from './web3-providers'
import { CookieBanner } from '@/components/layout/CookieBanner'
import { AgeGateModal } from '@/components/layout/AgeGateModal'
import { Footer } from '@/components/layout/Footer'
import { ResolutionToast } from '@/components/markets/ResolutionToast'
import { BetPill } from '@/components/markets/BetPill'

// Footer mounts at the layout level — single source for every route in
// (app). Renders on every viewport: the mobile bottom-nav sheet is opt-in,
// the footer is the always-on path to legal and resource links. The
// resolution toast joins the chorus — silent until something resolves
// while the user was away. The BetPill rides along for the same reason:
// every route, one mount point, hidden when there is nothing to say.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      {children}
      <Footer />
      <AgeGateModal />
      <CookieBanner />
      <ResolutionToast />
      <BetPill />
    </Web3Providers>
  )
}
