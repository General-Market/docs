import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation' // malformed-address guard only
import { AppShell } from '@/components/layout/AppShell'
import { SourceSearch } from '@/components/layout/SourceSearch'
import { SourceSidebarApple } from '@/components/domain/vision/detail/SourceSidebarApple'
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

/** /^0x[0-9a-f]{40}$/i — the only shape a vault address can take. */
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

export default async function VaultPage({ params }: Props) {
  const { sourceId, vaultAddress } = await params

  // Reject genuinely malformed addresses (wrong length, non-hex, etc).
  // A well-formed address with no branding entry is still renderable.
  if (!EVM_ADDRESS_RE.test(vaultAddress)) notFound()

  const fund = findFund(vaultAddress)
  const source = await getSourceDisplayServer(sourceId)

  // Branding is optional. Fall back to a truncated address as the display name.
  const vaultName = fund?.name ?? `${vaultAddress.slice(0, 6)}…${vaultAddress.slice(-4)}`

  // NAV and TVL: server-render placeholder values (1.0 / 0).
  // The client view fetches live on-chain data via useVaultsByAddresses.
  const navPerShare = 1.0
  const performanceSinceInception = 0
  const tvlFormatted = '0'

  return (
    <AppShell
      search={<SourceSearch />}
      sidebar={<SourceSidebarApple sourceId={sourceId} category={source?.category} />}
    >
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="px-5 lg:px-10 pt-5 pb-0"
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

      <div className="px-5 lg:px-10 pb-20 mt-5">
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
    </AppShell>
  )
}
