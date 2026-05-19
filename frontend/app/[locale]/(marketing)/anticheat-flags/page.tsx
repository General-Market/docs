import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/AppShell'
import { Reveal } from '@/components/ui/Reveal'
import { IncidentCard } from './IncidentCard'
import { ColocationSection } from './ColocationSection'
import { FeeTierSection } from './FeeTierSection'
import { EdgeMatrixSection } from './EdgeMatrixSection'
import { EdgeWaysSection } from './EdgeWaysSection'
import { VenueBleedSection } from './VenueBleedSection'
import { binance } from './data-binance'
import { coinbase, bybit } from './data-crypto-1'
import { hyperliquid, deribit } from './data-crypto-2'
import { polymarket, kalshi, robinhood } from './data-prediction'
import { ibkr, etoro } from './data-brokers'
import { pumpfun } from './data-misc'
import type { Venue } from './types'
import './mobile.css'

export const metadata: Metadata = {
  title: 'Anti-Cheat Flags. General Market',
  description:
    'The first exchange to publish how rigged this industry is. And the first to fix it. Eleven venues, the receipts on file.',
  alternates: { canonical: '/anticheat-flags' },
  robots: { index: true, follow: true },
}

const VENUES: Venue[] = [
  binance, coinbase, bybit, hyperliquid, deribit,
  polymarket, kalshi, robinhood, ibkr, etoro,
  pumpfun,
]

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'

function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-4 gap-4">
      <Reveal mask>
        <h2
          className="font-semibold"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 22,
            letterSpacing: 'var(--apple-track-tight)',
            color: TEXT,
          }}
        >
          {title}
        </h2>
      </Reveal>
      {meta && (
        <Reveal delay={0.08}>
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              whiteSpace: 'nowrap',
            }}
          >
            {meta}
          </span>
        </Reveal>
      )}
    </div>
  )
}

export default function AntiCheatFlagsPage() {
  return (
    <AppShell>
      <div className="w-full">
        <div className="acf-shell mx-auto w-full" style={{ maxWidth: 1068, padding: '0 24px' }}>
          {/* HERO */}
          <section className="acf-hero" style={{ padding: '120px 0 80px' }}>
            <Reveal mask delay={0.04}>
              <h1
                className="font-semibold"
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 'clamp(32px, 4.6vw, 56px)',
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tighter)',
                  lineHeight: 1.1,
                  color: TEXT,
                  maxWidth: 880,
                  fontFeatureSettings: '"ss01"',
                }}
              >
                The first exchange to publish how rigged this industry is. And the first to fix it.
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 19,
                  lineHeight: 1.5,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: SECONDARY,
                  marginTop: 24,
                  maxWidth: 820,
                }}
              >
                Markets get harder each year for retail and small firms to win. Predatory actors reinvest the billions they extract, and extract more. Like the dead internet theory, this is proof of the dead financial market theory. General Market builds products to return markets to what they were ten years ago.
              </p>
            </Reveal>
          </section>

          {/* PER-VENUE TRIPLE-BAR. Cumulative bleed at 100 / 1K / 100K trades */}
          <VenueBleedSection />

          {/* THIRTEEN MECHANISMS. The page thesis as a chart */}
          <EdgeWaysSection />

          {/* COLOCATION EDGE. The receipts that aren't even illegal */}
          <ColocationSection />

          {/* FEE TIER EDGE. The spread in basis points + cost of staying inside */}
          <FeeTierSection />

          {/* STRUCTURAL EDGE INVENTORY. Twelve mechanisms across five rulers */}
          <EdgeMatrixSection />

          {/* VENUE PILLS. Matches the homepage See All pattern */}
          <section style={{ paddingTop: 64, paddingBottom: 16, borderTop: `1px solid ${LINE}` }}>
            <Reveal>
              <nav
                className="flex flex-wrap gap-2"
                aria-label="Venues"
              >
                {VENUES.map(v => (
                  <a
                    key={v.slug}
                    href={`#${v.slug}`}
                    className="border transition hover:bg-[rgba(0,0,0,0.04)] inline-flex items-center gap-2"
                    style={{
                      background: 'var(--apple-panel)',
                      color: TEXT,
                      borderColor: LINE,
                      borderRadius: 'var(--apple-r-pill)',
                      padding: '6px 14px',
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 12,
                      fontWeight: 500,
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {v.name}
                    <span
                      style={{
                        color: TERTIARY,
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 500,
                      }}
                    >
                      {v.incidents.length}
                    </span>
                  </a>
                ))}
              </nav>
            </Reveal>
          </section>

          {/* VENUE SECTIONS */}
          {VENUES.map((venue) => (
            <section
              key={venue.slug}
              id={venue.slug}
              style={{
                paddingTop: 64,
                paddingBottom: 24,
                borderTop: `1px solid ${LINE}`,
                scrollMarginTop: 80,
              }}
            >
              {/* Venue head */}
              <div style={{ marginBottom: 28 }}>
                <Reveal>
                  <div
                    style={{
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 12,
                      color: TERTIARY,
                      letterSpacing: '-0.005em',
                      marginBottom: 10,
                    }}
                  >
                    Founded {venue.founded}
                    {venue.collapsed && ` · Collapsed ${venue.collapsed}`} · {venue.incidents.length} incidents
                  </div>
                </Reveal>
                <Reveal mask delay={0.04}>
                  <h2
                    className="font-semibold"
                    style={{
                      fontFamily: 'var(--apple-font-display)',
                      fontSize: 'clamp(28px, 3.6vw, 40px)',
                      fontWeight: 600,
                      letterSpacing: 'var(--apple-track-tighter)',
                      lineHeight: 1.1,
                      color: TEXT,
                    }}
                  >
                    {venue.name}
                  </h2>
                </Reveal>
                <Reveal delay={0.1}>
                  <p
                    style={{
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 17,
                      lineHeight: 1.47,
                      letterSpacing: 'var(--apple-track-tight)',
                      color: SECONDARY,
                      marginTop: 12,
                      maxWidth: 780,
                    }}
                  >
                    {venue.indictment}
                  </p>
                </Reveal>

                {/* Ribbon */}
                <Reveal delay={0.16}>
                  <div
                    className="grid grid-cols-2 md:grid-cols-3"
                    style={{
                      marginTop: 24,
                      paddingTop: 16,
                      paddingBottom: 16,
                      borderTop: `1px solid ${LINE}`,
                      borderBottom: `1px solid ${LINE}`,
                    }}
                  >
                    {venue.ribbonStats.map((s, i) => (
                      <div key={i} style={{ padding: '0 4px' }}>
                        <div
                          style={{
                            fontFamily: 'var(--apple-font-display)',
                            fontSize: 'clamp(20px, 2vw, 24px)',
                            fontWeight: 600,
                            letterSpacing: 'var(--apple-track-tighter)',
                            color: s.tone === 'loss' ? 'var(--apple-accent)' : TEXT,
                            lineHeight: 1,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {s.value}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--apple-font-text)',
                            fontSize: 12,
                            color: TERTIARY,
                            letterSpacing: '-0.005em',
                            marginTop: 6,
                          }}
                        >
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </Reveal>
              </div>

              <SectionHeader title="Incidents" meta={`${venue.incidents.length} receipts`} />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {venue.incidents.map((incident, i) => (
                  <IncidentCard
                    key={`${venue.slug}-${i}`}
                    incident={incident}
                    delay={Math.min(i * 0.04, 0.24)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
