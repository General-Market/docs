import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { VaultPortfolioView } from '@/components/domain/vision/vault/VaultPortfolioView'
import { getSourceDisplayServer } from '@/lib/vision/sources-server'
import fundData from '@/data/fund-branding.json'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string; sourceId: string; vaultAddress: string }>
}

type FundEntry = {
  name: string
  symbol: string
  source: string
  strategy: string
  vault?: string
  tagline?: string
  color?: string
  fee?: number
  category?: string
}

function findFund(vaultAddress: string): FundEntry | null {
  const lower = vaultAddress.toLowerCase()
  return (
    (fundData as { funds: FundEntry[] }).funds.find(
      (f) => f.vault?.toLowerCase() === lower,
    ) ?? null
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sourceId, vaultAddress } = await params
  const fund = findFund(vaultAddress)
  const source = await getSourceDisplayServer(sourceId)

  const name = fund?.name ?? `Vault ${vaultAddress.slice(0, 6)}…${vaultAddress.slice(-4)}`
  const title = `${name} · Portfolio | Vision`
  const description = `${name} vault portfolio — fills, realized PnL, and market activity on the ${source?.name ?? sourceId} data source.`

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function VaultPage({ params }: Props) {
  const { sourceId, vaultAddress } = await params
  const fund = findFund(vaultAddress)

  // Vault must appear in fund-branding.json to be renderable.
  // Unknown addresses get a 404 rather than a blank shell.
  if (!fund) notFound()

  const vaultName = fund.name

  // NAV and TVL: we server-render placeholder values (1.0 / 0)
  // and the client view fetches live on-chain data via the existing
  // useVaultsByAddresses hook. For static rendering we keep it simple.
  const navPerShare = 1.0
  const performanceSinceInception = 0
  const tvlFormatted = '0'

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--apple-page-bg,#f5f5f7)' }}>
      <Header />

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mx-auto w-full max-w-[var(--apple-content-max,1680px)] px-5 lg:px-10 pt-5 pb-0"
      >
        <ol
          className="flex items-center gap-1.5 flex-wrap"
          style={{
            fontFamily: 'var(--apple-font-text,"SF Pro Text",Helvetica,Arial,sans-serif)',
            fontSize: 13,
            color: 'var(--apple-text-secondary,#6e6e73)',
            letterSpacing: 'var(--apple-track-tight,-0.022em)',
          }}
        >
          <li><a href="/" className="hover:underline">Vision</a></li>
          <li aria-hidden>›</li>
          <li><a href={`/source/${sourceId}`} className="hover:underline">{sourceId}</a></li>
          <li aria-hidden>›</li>
          <li><a href={`/source/${sourceId}#vaults`} className="hover:underline">Vaults</a></li>
          <li aria-hidden>›</li>
          <li aria-current="page" style={{ color: 'var(--apple-text,#1d1d1f)' }}>{vaultName}</li>
        </ol>
      </nav>

      <div
        className="flex-1 mx-auto w-full max-w-[var(--apple-content-max,1680px)] px-5 lg:px-10 pb-20 mt-5"
      >
        <div
          style={{
            background: 'var(--apple-panel,#ffffff)',
            borderRadius: 'var(--apple-r-card,28px)',
            border: '1px solid var(--apple-divider,#e8e8ed)',
            overflow: 'hidden',
            boxShadow: 'var(--apple-shadow-card,0 1px 2px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.06))',
          }}
        >
          <Suspense
            fallback={
              <div
                className="flex items-center justify-center py-24"
                style={{
                  fontFamily: 'var(--apple-font-text,"SF Pro Text",Helvetica,Arial,sans-serif)',
                  fontSize: 15,
                  color: 'var(--apple-text-secondary,#6e6e73)',
                }}
              >
                loading…
              </div>
            }
          >
            <VaultPortfolioView
              vaultAddress={vaultAddress}
              vaultName={vaultName}
              sourceId={sourceId}
              navPerShare={navPerShare}
              performanceSinceInception={performanceSinceInception}
              tvlFormatted={tvlFormatted}
            />
          </Suspense>
        </div>
      </div>

      <Footer />
    </main>
  )
}
