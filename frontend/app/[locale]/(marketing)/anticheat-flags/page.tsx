import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Reveal } from '@/components/ui/Reveal'
import { IncidentCard } from './IncidentCard'
import { ColocationSection } from './ColocationSection'
import { binance } from './data-binance'
import { coinbase, ftx, bybit } from './data-crypto-1'
import { hyperliquid, bitmex, deribit, kraken } from './data-crypto-2'
import { okx, polymarket, kalshi, robinhood } from './data-prediction'
import { pumpfun, fxcfd } from './data-misc'
import type { Venue } from './types'

export const metadata: Metadata = {
  title: 'Anti-Cheat Flags — General Market',
  description:
    'Fourteen venues. The iconic flag from each one. What retail lost, what the regulator wrote, what the executive eventually admitted.',
  alternates: { canonical: '/anticheat-flags' },
  robots: { index: true, follow: true },
}

const VENUES: Venue[] = [
  binance, coinbase, ftx, bybit, hyperliquid,
  bitmex, deribit, kraken, okx, polymarket,
  kalshi, robinhood, pumpfun, fxcfd,
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

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ padding: '0 4px' }}>
      <div
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 'clamp(22px, 2.4vw, 28px)',
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-tighter)',
          color: TEXT,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          color: TERTIARY,
          letterSpacing: '-0.005em',
          marginTop: 8,
        }}
      >
        {label}
      </div>
    </div>
  )
}

export default function AntiCheatFlagsPage() {
  const totalIncidents = VENUES.reduce((acc, v) => acc + v.incidents.length, 0)

  return (
    <main className="min-h-screen bg-page flex flex-col" style={{ background: 'var(--apple-panel)' }}>
      <Header />

      <div className="flex-1 w-full">
        <div className="mx-auto w-full" style={{ maxWidth: 1280, padding: '0 24px' }}>
          {/* HERO */}
          <section style={{ padding: '64px 0 40px' }}>
            <Reveal mask>
              <h1
                className="font-semibold"
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 'clamp(40px, 5.6vw, 56px)',
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tighter)',
                  lineHeight: 1.07,
                  color: TEXT,
                  maxWidth: 920,
                }}
              >
                Anti-Cheat Flags.
              </h1>
            </Reveal>
            <Reveal delay={0.08}>
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 21,
                  lineHeight: 1.38,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: SECONDARY,
                  marginTop: 16,
                  maxWidth: 680,
                }}
              >
                Fourteen venues. The iconic flag from each one. What retail lost, what the regulator wrote, what the executive eventually admitted.
              </p>
            </Reveal>

            <Reveal delay={0.16}>
              <div
                className="grid grid-cols-2 md:grid-cols-4"
                style={{
                  marginTop: 40,
                  paddingTop: 20,
                  paddingBottom: 20,
                  borderTop: `1px solid ${LINE}`,
                  borderBottom: `1px solid ${LINE}`,
                }}
              >
                <HeroStat value={String(VENUES.length)} label="Venues flagged" />
                <HeroStat value="$60B+" label="Fines, hacks, losses" />
                <HeroStat value={String(totalIncidents)} label="Receipts on file" />
                <HeroStat value="2015–26" label="Years documented" />
              </div>
            </Reveal>
          </section>

          {/* VENUE PILLS — matches the homepage See All pattern */}
          <section style={{ paddingBottom: 16 }}>
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

          {/* COLOCATION EDGE — the receipts that aren't even illegal */}
          <ColocationSection />

          {/* CLOSER */}
          <section
            style={{
              marginTop: 80,
              marginBottom: 80,
              paddingTop: 64,
              paddingBottom: 64,
              borderTop: `1px solid ${LINE}`,
              borderBottom: `1px solid ${LINE}`,
            }}
          >
            <Reveal mask>
              <h2
                className="font-semibold"
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 'clamp(28px, 3.6vw, 40px)',
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tighter)',
                  lineHeight: 1.1,
                  color: TEXT,
                  maxWidth: 820,
                }}
              >
                Fourteen venues. The same handful of mechanisms. We built one without the room.
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 17,
                  lineHeight: 1.47,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: SECONDARY,
                  marginTop: 16,
                  maxWidth: 720,
                }}
              >
                When the venue keeps the order book, the matching engine, the price feed, the listing decision, and the audit — the receipts arrive on schedule. General Market is on-chain. Sealed bets. Parimutuel pools. BLS-verified oracles. The house cannot front-run because there is no house.
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <a
                href="/"
                className="inline-flex items-center transition hover:opacity-90"
                style={{
                  marginTop: 28,
                  background: 'var(--apple-accent)',
                  color: '#fff',
                  borderRadius: 'var(--apple-r-pill)',
                  padding: '10px 22px',
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: '-0.005em',
                }}
              >
                Open General Market ›
              </a>
            </Reveal>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  )
}
