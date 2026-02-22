import { getItpSummaries } from '@/lib/api/server-data'
import { InvestmentFundJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { HomeClient } from '@/components/domain/HomeClient'

export default async function Home() {
  const itps = await getItpSummaries()

  return (
    <main className="min-h-screen bg-page flex flex-col">
      {/* SEO shell — visible to crawlers, sr-only for users */}
      <h1 className="sr-only">General Market — On-Chain Index Products</h1>

      <div className="sr-only">
        <section aria-label="Markets">
          <h2>Index Tracking Products (ITPs)</h2>
          <p>
            Explore decentralized index products. Each ITP tracks a basket of crypto assets
            with live NAV pricing and on-chain settlement on Arbitrum Orbit L3.
          </p>
          {itps.map((itp) => (
            <article key={itp.itpId}>
              <h3>{itp.name} ({itp.symbol})</h3>
              <p>NAV per share: ${itp.nav.toFixed(4)}</p>
              <p>Assets under management: ${itp.aum.toFixed(2)}</p>
              <p>Holdings: {itp.assetCount} assets</p>
              <a href={`/itp/${itp.itpId}`}>View {itp.name} details</a>
            </article>
          ))}
        </section>

        <section aria-label="Portfolio">
          <h2>Portfolio Tracking</h2>
          <p>
            Track your ITP holdings, view real-time P&amp;L, cost basis, and trade history.
            Connect your wallet to see your portfolio performance across all index products.
          </p>
        </section>

        <section aria-label="Create Index">
          <h2>Create Your Own ITP</h2>
          <p>
            Design custom index products by selecting from 100+ crypto assets and assigning weights.
            Deploy in a single transaction. Your ITP starts at $1 NAV and floats with underlying prices.
          </p>
        </section>

        <section aria-label="Lending">
          <h2>Lend &amp; Borrow</h2>
          <p>
            Deposit USDC to earn yield through Morpho lending markets.
            Or use your ITP shares as collateral to borrow USDC against your positions.
          </p>
        </section>

        <section aria-label="Backtesting">
          <h2>Backtest Strategies</h2>
          <p>
            Simulate portfolio performance with historical price data before deploying real capital.
            View returns, drawdowns, and Sharpe ratios. Deploy winning strategies directly as ITPs.
          </p>
        </section>
      </div>

      {/* JSON-LD structured data */}
      <InvestmentFundJsonLd itps={itps} />
      <BreadcrumbJsonLd items={[
        { name: 'Home', url: 'https://generalmarket.io' },
        { name: 'Markets', url: 'https://generalmarket.io/#markets' },
        { name: 'Documentation', url: 'https://generalmarket.io/docs' },
      ]} />

      {/* Interactive client app */}
      <HomeClient />
    </main>
  )
}
