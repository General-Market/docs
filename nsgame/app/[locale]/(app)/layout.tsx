import { Web3Providers } from './web3-providers'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Web3Providers>{children}</Web3Providers>
}
