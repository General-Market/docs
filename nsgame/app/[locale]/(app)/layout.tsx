import { Web3Providers } from './web3-providers'
import { CookieBanner } from '@/components/layout/CookieBanner'
import { AgeGateModal } from '@/components/layout/AgeGateModal'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Providers>
      {children}
      <AgeGateModal />
      <CookieBanner />
    </Web3Providers>
  )
}
