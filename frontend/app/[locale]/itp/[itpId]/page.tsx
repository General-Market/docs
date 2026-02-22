import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getItpDetail, getItpSummaries } from '@/lib/api/server-data'
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd'

interface Props {
  params: Promise<{ itpId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { itpId } = await params
  const itp = await getItpDetail(itpId)

  if (!itp) {
    return { title: 'ITP Not Found' }
  }

  const description = `${itp.name} (${itp.symbol}) — on-chain index tracking product with ${itp.assetCount} crypto assets. Current NAV: $${itp.nav.toFixed(4)}.`

  return {
    title: `${itp.name} (${itp.symbol})`,
    description,
    openGraph: {
      title: `${itp.name} | General Market`,
      description,
      url: `https://generalmarket.io/itp/${itpId}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${itp.name} | General Market`,
      description,
    },
  }
}

export async function generateStaticParams() {
  const itps = await getItpSummaries()
  return itps.map((itp) => ({ itpId: itp.itpId }))
}

export default async function ItpPage({ params }: Props) {
  const { itpId } = await params
  const itp = await getItpDetail(itpId)

  if (!itp) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-page">
      <BreadcrumbJsonLd items={[
        { name: 'Home', url: 'https://generalmarket.io' },
        { name: 'Markets', url: 'https://generalmarket.io/#markets' },
        { name: itp.name, url: `https://generalmarket.io/itp/${itpId}` },
      ]} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "InvestmentFund",
            name: itp.name,
            tickerSymbol: itp.symbol,
            description: `${itp.name} — on-chain index tracking product with ${itp.assetCount} crypto assets.`,
            url: `https://generalmarket.io/itp/${itpId}`,
            provider: {
              "@type": "Organization",
              name: "General Market",
              url: "https://generalmarket.io",
            },
          }),
        }}
      />

      <div className="px-6 lg:px-12 py-12">
        <div className="max-w-4xl mx-auto">
          <nav className="text-sm text-text-muted mb-6">
            <a href="/" className="hover:text-black transition-colors">Home</a>
            <span className="mx-2">/</span>
            <a href="/#markets" className="hover:text-black transition-colors">Markets</a>
            <span className="mx-2">/</span>
            <span className="text-text-primary">{itp.name}</span>
          </nav>

          <header className="mb-8">
            <h1 className="text-3xl font-black tracking-tight text-black mb-2">
              {itp.name}
            </h1>
            <p className="text-lg text-text-secondary">
              {itp.symbol} — On-chain index tracking product
            </p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-border-light rounded-lg p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">NAV / Share</div>
              <div className="text-2xl font-bold font-mono">${itp.nav.toFixed(4)}</div>
            </div>
            <div className="bg-white border border-border-light rounded-lg p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">AUM</div>
              <div className="text-2xl font-bold font-mono">${itp.aum.toFixed(2)}</div>
            </div>
            <div className="bg-white border border-border-light rounded-lg p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">Assets</div>
              <div className="text-2xl font-bold font-mono">{itp.assetCount}</div>
            </div>
          </div>

          {itp.holdings.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4">Holdings</h2>
              <div className="bg-white border border-border-light rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-text-secondary">Asset</th>
                      <th className="text-right px-4 py-2 font-semibold text-text-secondary">Weight</th>
                      <th className="text-right px-4 py-2 font-semibold text-text-secondary">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itp.holdings.map((h) => (
                      <tr key={h.symbol} className="border-t border-border-light">
                        <td className="px-4 py-2 font-medium">{h.symbol}</td>
                        <td className="px-4 py-2 text-right font-mono">{(h.weight * 100).toFixed(2)}%</td>
                        <td className="px-4 py-2 text-right font-mono">${h.price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="mt-8 flex gap-3">
            <a
              href="/#markets"
              className="px-6 py-3 bg-black text-white text-sm font-bold rounded-md hover:bg-zinc-800 transition-colors"
            >
              Trade This ITP
            </a>
            <a
              href="/docs/concepts/itps"
              className="px-6 py-3 border-2 border-black text-sm font-bold rounded-md hover:bg-black hover:text-white transition-colors"
            >
              Learn About ITPs
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
