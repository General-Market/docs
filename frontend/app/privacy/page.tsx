import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'General Market privacy policy.',
  alternates: {
    canonical: '/privacy',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <a href="/" className="text-text-inverse-muted text-sm hover:text-text-inverse">← Back</a>
          <h1 className="text-3xl font-bold text-text-inverse mt-4">Privacy Policy</h1>
          <p className="text-text-inverse-muted mt-2">Last updated: February 2026</p>
        </div>

        <div className="bg-card rounded-xl shadow-card border border-border-light p-8">
          <div className="space-y-8 text-text-secondary text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Overview</h2>
              <p>
                General Market is a decentralized protocol for on-chain index products.
                We collect minimal data and prioritize your privacy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">What We Collect</h2>
              <ul className="space-y-2 ml-4 list-disc">
                <li><span className="text-text-primary">Wallet addresses</span> — Public blockchain addresses used for trading</li>
                <li><span className="text-text-primary">Transaction data</span> — On-chain trading activity (publicly visible on the Index L3 chain)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">What We Don't Collect</h2>
              <ul className="space-y-2 ml-4 list-disc">
                <li>Private keys — These never leave your local environment</li>
                <li>Personal identity — We don't require KYC or personal information</li>
                <li>Browsing data — We don't use tracking cookies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Blockchain Transparency</h2>
              <p>
                All trading activity occurs on the Index L3 chain, a public blockchain. Your wallet
                address and transaction history are publicly visible on block explorers. This is
                inherent to blockchain technology, not a choice we make.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Data Storage</h2>
              <p>
                ITP configurations and order data are stored on-chain. Off-chain data (like price feeds
                and NAV calculations) is processed by authorized issuers and stored temporarily.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Third Parties</h2>
              <p>
                We interact with CoinGecko for price data and Morpho for lending markets. We don't
                sell or share your data with advertisers or data brokers.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Contact</h2>
              <p>
                Questions? Reach out on X: <a href="https://x.com/otc_max" target="_blank" rel="noopener noreferrer" className="text-zinc-900 font-medium hover:underline">@otc_max</a>
              </p>
            </section>
          </div>
        </div>

        {/* Links */}
        <section className="pt-8 mt-12 border-t border-border-dark">
          <div className="flex items-center gap-6 text-sm">
            <a href="/terms" className="text-text-inverse-muted hover:text-text-inverse">Terms</a>
            <a href="https://x.com/otc_max" target="_blank" rel="noopener noreferrer" className="text-text-inverse-muted hover:text-text-inverse">@otc_max</a>
          </div>
        </section>
      </div>
    </main>
  )
}
