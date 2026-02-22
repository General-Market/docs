import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'General Market terms of service.',
  alternates: {
    canonical: '/terms',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <a href="/" className="text-text-inverse-muted text-sm hover:text-text-inverse">← Back</a>
          <h1 className="text-3xl font-bold text-text-inverse mt-4">Terms of Service</h1>
          <p className="text-text-inverse-muted mt-2">Last updated: February 2026</p>
        </div>

        <div className="bg-card rounded-xl shadow-card border border-border-light p-8">
          <div className="space-y-8 text-text-secondary text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Acceptance</h2>
              <p>
                By using General Market, you agree to these terms. If you don't agree, don't use the platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">What General Market Is</h2>
              <p>
                General Market is an institutional-grade protocol for on-chain index products. It runs on
                the Index L3 chain using smart contracts. You can create, trade, and manage tokenized
                index tracking products (ITPs).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Risk Warning</h2>
              <div className="bg-surface-warning border border-color-warning/30 rounded-lg p-4 text-text-primary">
                <p className="font-medium mb-2">You can lose money.</p>
                <p className="text-text-secondary">
                  Trading index products involves significant risk. ITP values fluctuate with underlying
                  asset prices. You could lose some or all of your capital. Only use funds you can afford
                  to lose.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Experimental Software</h2>
              <p>
                General Market is experimental software. Smart contracts are immutable once deployed—bugs
                cannot be patched. Use at your own risk. We make no guarantees about security, uptime,
                or functionality.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Your Responsibilities</h2>
              <ul className="space-y-2 ml-4 list-disc">
                <li>You control your private keys — we can't recover them if lost</li>
                <li>You're responsible for your trading decisions</li>
                <li>You must comply with laws in your jurisdiction</li>
                <li>You're responsible for tax obligations on any profits</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">No Financial Advice</h2>
              <p>
                Nothing on General Market is financial advice. We don't recommend specific trades,
                indices, or strategies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Prohibited Use</h2>
              <ul className="space-y-2 ml-4 list-disc">
                <li>Market manipulation or wash trading</li>
                <li>Exploiting bugs or vulnerabilities</li>
                <li>Interfering with other users</li>
                <li>Using the platform for illegal activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Limitation of Liability</h2>
              <p>
                General Market is provided "as is" without warranties. We're not liable for losses from
                trading, bugs, hacks, smart contract failures, or any other cause.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-3">Changes</h2>
              <p>
                We may update these terms. Continued use after changes means you accept the new terms.
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
            <a href="/privacy" className="text-text-inverse-muted hover:text-text-inverse">Privacy</a>
            <a href="https://x.com/otc_max" target="_blank" rel="noopener noreferrer" className="text-text-inverse-muted hover:text-text-inverse">@otc_max</a>
          </div>
        </section>
      </div>
    </main>
  )
}
