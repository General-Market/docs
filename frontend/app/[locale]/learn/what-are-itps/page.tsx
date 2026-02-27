import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Link } from '@/i18n/routing'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'seo.pages.learn_itps' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/learn/what-are-itps',
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: 'https://generalmarket.io/learn/what-are-itps',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  }
}

const comparisonData = [
  { feature: 'Settlement', etf: 'T+1 days', itp: '~30 seconds' },
  { feature: 'Minimum Investment', etf: '$100+', itp: '$1' },
  { feature: 'Trading Hours', etf: 'Market hours', itp: '24/7' },
  { feature: 'Custody', etf: 'Broker', itp: 'Your wallet' },
  { feature: 'Creation', etf: 'SEC filing', itp: '1 transaction' },
  { feature: 'Fees', etf: '0.03 - 1%', itp: '~0.3%' },
  { feature: 'Transparency', etf: 'Quarterly', itp: 'Real-time' },
]

const exampleHoldings = [
  { symbol: 'AAVE', weight: 20 },
  { symbol: 'UNI', weight: 20 },
  { symbol: 'MKR', weight: 15 },
  { symbol: 'COMP', weight: 15 },
  { symbol: 'SNX', weight: 10 },
  { symbol: 'CRV', weight: 10 },
  { symbol: 'SUSHI', weight: 5 },
  { symbol: 'YFI', weight: 5 },
]

export default async function LearnItpsPage() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'What Are Index Tracking Products (ITPs)?',
    description:
      'ITPs are on-chain tokenized index products — the crypto equivalent of ETFs. Learn how they work, how NAV is calculated, and how to get started.',
    author: {
      '@type': 'Organization',
      name: 'General Market',
    },
    publisher: {
      '@type': 'Organization',
      name: 'General Market',
      url: 'https://generalmarket.io',
    },
    datePublished: '2026-02-27',
    dateModified: '2026-02-27',
    mainEntityOfPage: 'https://generalmarket.io/learn/what-are-itps',
  }

  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <article className="max-w-3xl mx-auto px-6 py-12 md:py-16 w-full">
        {/* Label */}
        <div className="text-[13px] text-text-secondary font-medium tracking-wide mb-4">
          Learn &middot; 8 min read
        </div>

        {/* H1 */}
        <h1 className="text-[32px] md:text-[40px] font-black tracking-[-0.02em] text-black leading-[1.1] mb-4">
          What Are Index Tracking Products (ITPs)?
        </h1>

        {/* Subtitle */}
        <p className="text-[17px] text-text-secondary leading-relaxed mb-12">
          The on-chain equivalent of ETFs. A single token that holds a basket of crypto assets with fixed weights.
        </p>

        {/* ── The 30-Second Version ── */}
        <section>
          <h2 className="text-[22px] font-black tracking-[-0.01em] mt-12 mb-4 text-black">
            The 30-Second Version
          </h2>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            You want exposure to &ldquo;DeFi&rdquo; but don&rsquo;t want to buy 10 tokens separately. An ITP lets you buy one token that holds all 10. The price floats with the basket. Like buying an S&P 500 ETF instead of 500 individual stocks.
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
            Someone picks the assets, assigns weights, and deploys the ITP on-chain. You buy shares at the current price. When the underlying tokens go up, your share price goes up. When they go down, so does yours. One token, many assets.
          </p>

          {/* Example box */}
          <div className="border border-border-light bg-surface/30 p-6 rounded-none mb-6">
            <div className="text-[15px] font-bold text-black mb-4">
              Example: &ldquo;DeFi Blue Chips&rdquo; ITP
            </div>
            <div className="space-y-2 mb-5">
              {exampleHoldings.map((h) => (
                <div key={h.symbol} className="flex items-center gap-3 text-[14px]">
                  <span className="font-mono font-bold text-black w-14">{h.symbol}</span>
                  <span className="text-text-secondary w-10 text-right">{h.weight}%</span>
                  <div className="flex-1 h-3 bg-border-light overflow-hidden">
                    <div
                      className="h-full bg-black"
                      style={{ width: `${h.weight * 5}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-6 text-[14px] text-text-secondary border-t border-border-light pt-4">
              <div>
                <span className="font-bold text-black">NAV:</span> $1.24
              </div>
              <div>
                <span className="font-bold text-black">AUM:</span> $47,000
              </div>
            </div>
            <p className="text-[14px] text-text-secondary mt-3">
              You buy 100 shares &rarr; $124 exposure to all 8 tokens in one transaction.
            </p>
          </div>
        </section>

        {/* ── How ITPs Work ── */}
        <section>
          <h2 className="text-[22px] font-black tracking-[-0.01em] mt-12 mb-4 text-black">
            How ITPs Work
          </h2>

          <h3 className="text-[17px] font-bold mt-6 mb-2 text-black">Creation</h3>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            Anyone can create an ITP. Pick assets from 100+ supported tokens, assign weights (e.g. 30% ETH, 20% BTC, 50% stablecoins), and deploy in a single transaction. Your ITP starts at $1 NAV. Each share holds a fixed quantity of each underlying asset, calculated from the weights and prices at the time of creation.
          </p>

          <h3 className="text-[17px] font-bold mt-6 mb-2 text-black">NAV (Net Asset Value)</h3>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            The price of one ITP share. Calculated as: sum of (quantity &times; price) for each asset in the basket. Updates every cycle, roughly every 30 seconds.
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            If ETH goes up 10% and your ITP is 50% ETH, your NAV goes up roughly 5%. If everything drops 20%, your NAV drops 20%. The math is transparent and verifiable on-chain at all times.
          </p>

          <h3 className="text-[17px] font-bold mt-6 mb-2 text-black">Buying and Selling</h3>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            To buy: deposit USDC and receive ITP shares at the current NAV. If the NAV is $1.24 and you deposit $124, you get 100 shares. To sell: return your shares and receive USDC at the current NAV. Settlement happens on-chain in one cycle &mdash; no waiting days for your funds.
          </p>

          <h3 className="text-[17px] font-bold mt-6 mb-2 text-black">Rebalancing</h3>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            Weights can be updated by the ITP creator. When this happens, the underlying quantities are recalculated to preserve the current NAV. Your share count stays the same &mdash; only what each share holds changes. Think of it like an ETF manager adjusting the portfolio allocation without affecting your account balance.
          </p>
        </section>

        {/* ── ITPs vs Traditional ETFs ── */}
        <section>
          <h2 className="text-[22px] font-black tracking-[-0.01em] mt-12 mb-4 text-black">
            ITPs vs Traditional ETFs
          </h2>
          <div className="border border-border-light overflow-hidden mb-4">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="bg-surface">
                  <th className="text-left px-4 py-3 font-bold text-black" />
                  <th className="text-left px-4 py-3 font-bold text-black">ETF</th>
                  <th className="text-left px-4 py-3 font-bold text-black">ITP</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={`border-t border-border-light ${i % 2 === 1 ? 'bg-surface/40' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-black">{row.feature}</td>
                    <td className="px-4 py-3 text-text-secondary">{row.etf}</td>
                    <td className="px-4 py-3 text-text-secondary">{row.itp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            Not better or worse &mdash; different tradeoffs. ITPs trade speed and permissionlessness for regulatory clarity and deposit insurance. ETFs are battle-tested over decades with clear legal frameworks. ITPs are new, operate 24/7, and anyone can create one without filing paperwork. Pick what matters to you.
          </p>
        </section>

        {/* ── ITPs vs Buying Tokens Directly ── */}
        <section>
          <h2 className="text-[22px] font-black tracking-[-0.01em] mt-12 mb-4 text-black">
            ITPs vs Buying Tokens Directly
          </h2>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            Why not just buy the 10 tokens yourself? You can. But there are practical reasons people don&rsquo;t:
          </p>
          <ol className="list-decimal ml-6 space-y-3 text-[15px] text-text-secondary leading-relaxed mb-4">
            <li>
              <span className="font-bold text-black">Gas.</span> 10 separate swaps cost 10x the gas. An ITP purchase is one transaction.
            </li>
            <li>
              <span className="font-bold text-black">Rebalancing.</span> If you want to maintain 20% ETH / 20% BTC, you need to manually rebalance when prices shift. An ITP handles this automatically.
            </li>
            <li>
              <span className="font-bold text-black">Tracking.</span> One NAV number vs tracking 10 different prices across 10 different positions.
            </li>
            <li>
              <span className="font-bold text-black">Sharing.</span> You can share one token link that represents a thesis. &ldquo;I&rsquo;m bullish on DeFi&rdquo; becomes a single tradeable asset, not a spreadsheet.
            </li>
          </ol>
          <p className="text-[15px] text-text-secondary leading-relaxed">
            The same reason people buy SPY instead of 500 individual stocks.
          </p>
        </section>

        {/* ── How to Get Started ── */}
        <section>
          <h2 className="text-[22px] font-black tracking-[-0.01em] mt-12 mb-4 text-black">
            How to Get Started
          </h2>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            Three steps. No jargon required.
          </p>
          <ol className="list-decimal ml-6 space-y-3 text-[15px] text-text-secondary leading-relaxed mb-4">
            <li>
              <span className="font-bold text-black">Connect your wallet</span> on Index L3. MetaMask, WalletConnect, or any EVM-compatible wallet.
            </li>
            <li>
              <span className="font-bold text-black">Browse ITPs</span> on the Markets page. Each one shows its holdings, NAV, and AUM.
            </li>
            <li>
              <span className="font-bold text-black">Buy shares with USDC.</span> Enter the amount, confirm the transaction. Done.
            </li>
          </ol>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-6">
            Or create your own ITP from 100+ supported assets. Pick the tokens, set the weights, deploy in one transaction.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/index"
              className="inline-flex items-center px-6 py-3 bg-black text-white text-[15px] font-bold hover:bg-zinc-800 transition-colors"
            >
              Browse Markets
            </Link>
            <a
              href="/#create-itp"
              className="inline-flex items-center px-6 py-3 border-2 border-black text-[15px] font-bold text-black hover:bg-black hover:text-white transition-colors"
            >
              Create an ITP
            </a>
          </div>
        </section>

        {/* ── Risks ── */}
        <section>
          <h2 className="text-[22px] font-black tracking-[-0.01em] mt-12 mb-4 text-black">
            Risks
          </h2>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            ITPs are an emerging financial primitive. Here are the real risks:
          </p>
          <ul className="space-y-3 text-[15px] text-text-secondary leading-relaxed mb-4">
            <li>
              <span className="font-bold text-black">Smart contract risk.</span> ITPs are governed by smart contracts. Code can have bugs. Contracts are audited but not guaranteed to be bug-free. Funds held in a contract are only as safe as the contract itself.
            </li>
            <li>
              <span className="font-bold text-black">Oracle risk.</span> NAV depends on price feeds from external oracles. If an oracle reports an incorrect price, your NAV calculation will be wrong. This can cause you to buy too high or sell too low.
            </li>
            <li>
              <span className="font-bold text-black">Liquidity risk.</span> Low-AUM ITPs may have wider effective spreads. If you hold a large position relative to the ITP&rsquo;s total AUM, exiting may take multiple cycles.
            </li>
            <li>
              <span className="font-bold text-black">Regulatory risk.</span> Rules around tokenized index products are still evolving. What is permissible today may face restrictions tomorrow. This space does not yet have the regulatory clarity of traditional ETFs.
            </li>
          </ul>
          <p className="text-[15px] text-text-secondary leading-relaxed">
            None of this is meant to discourage you. It&rsquo;s meant to make sure you go in with open eyes. Do your own research and never invest more than you can afford to lose.
          </p>
        </section>

        {/* ── Further Reading ── */}
        <section>
          <h2 className="text-[22px] font-black tracking-[-0.01em] mt-12 mb-4 text-black">
            Further Reading
          </h2>
          <ul className="space-y-3 text-[15px] leading-relaxed">
            <li>
              <a
                href="/docs"
                className="text-black font-bold underline hover:no-underline"
              >
                Documentation: ITP Architecture
              </a>
              <span className="text-text-secondary"> &mdash; How the contracts work under the hood.</span>
            </li>
            <li>
              <a
                href="/#create-itp"
                className="text-black font-bold underline hover:no-underline"
              >
                Create: Design Your First ITP
              </a>
              <span className="text-text-secondary"> &mdash; Pick assets, set weights, deploy.</span>
            </li>
            <li>
              <a
                href="/#backtest"
                className="text-black font-bold underline hover:no-underline"
              >
                Backtest: Test Before You Deploy
              </a>
              <span className="text-text-secondary"> &mdash; Simulate performance with historical data.</span>
            </li>
          </ul>
        </section>
      </article>

      <Footer />
    </main>
  )
}
