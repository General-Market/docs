import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/AppShell'
import { Reveal } from '@/components/ui/Reveal'
import { CohortExitSection } from './CohortExitSection'
import { JargonSection } from './JargonSection'
import { DisclosureWallSection } from './DisclosureWallSection'
import { CatastropheCard } from './CatastropheCard'
import { CATASTROPHES } from './data-catastrophes'
import './mobile.css'

export const metadata: Metadata = {
  title: 'The Gap. General Market',
  description:
    'Every retail venue tracks two numbers. The first is everyone who ever showed up. The second is who is still here. The gap has a name. The companies print it themselves.',
  alternates: { canonical: '/the-gap' },
  robots: { index: true, follow: true },
}

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'

export default function TheGapPage() {
  const sortedCatastrophes = [...CATASTROPHES].sort((a, b) =>
    a.date < b.date ? 1 : -1,
  )

  return (
    <AppShell>
      <div className="w-full">
        <div
          className="tg-shell mx-auto w-full"
          style={{ maxWidth: 1068, padding: '0 24px' }}
        >
          {/* HERO */}
          <section className="tg-hero" style={{ padding: '120px 0 80px' }}>
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
                A class of users got scammed once. Came back. Got scammed twice.
                Came back. Got scammed a third time. They stopped.
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
                The companies they tried — brokers, casinos, exchanges, lenders —
                report the cohort in their own SEC filings. The cohort has a
                name in every filing. The name is the confession. General Market
                is built for the user the rest of the industry has written off.
              </p>
            </Reveal>

            {/* Three headline stats — the page's evidence in one glance */}
            <Reveal delay={0.2}>
              <div
                className="tg-stat-grid"
                style={{
                  marginTop: 40,
                  paddingTop: 24,
                  borderTop: `1px solid ${LINE}`,
                }}
              >
                <HeroStat
                  value="14.4M"
                  label="Robinhood Funded Customers (27.4M) minus current MAU (13.0M). The company's own equation: New Funded − Churned + Resurrected."
                />
                <HeroStat
                  value="62%"
                  label="of fraud victims experience more than one incident; the average is nine. Snyder & Golladay, Journal of White Collar & Corporate Crime, 2024."
                />
                <HeroStat
                  value="4.3M"
                  label="investors caught in the five US crypto-lender bankruptcies of 2022-2023 alone. Chicago Fed, Patel & Rose. $46.5B over five months."
                />
              </div>
            </Reveal>
          </section>

          {/* 1 — THE COHORT EXIT TABLE — the page's spine */}
          <CohortExitSection />

          {/* 2 — THE JARGON DICTIONARY — the industry's own words */}
          <JargonSection />

          {/* 3 — THE DISCLOSURE WALL — why the cohort doesn't come back */}
          <DisclosureWallSection />

          {/* 4 — THE CATASTROPHE CHAIN — the receipts the cohort remembers */}
          <section
            id="catastrophes"
            style={{
              paddingTop: 80,
              paddingBottom: 24,
              borderTop: `1px solid ${LINE}`,
              scrollMarginTop: 80,
            }}
          >
            <div style={{ marginBottom: 32 }}>
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
                  }}
                >
                  The catalogue of harms.
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
                    marginTop: 12,
                    maxWidth: 780,
                  }}
                >
                  Each card is one moment the ungetable cohort grew by
                  thousands or millions of names. Mt. Gox generated the original
                  wound; eleven years later only 19,500 of its 127,000 creditors
                  have been paid. BlockFi went into bankruptcy in 2022; in April
                  2025 the trustees announced that half of the non-US creditors
                  had not even come forward to claim their distributions. The
                  silence is the data point.
                </p>
              </Reveal>
              <Reveal delay={0.14}>
                <div
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 12,
                    color: TERTIARY,
                    letterSpacing: '-0.005em',
                    marginTop: 14,
                  }}
                >
                  {sortedCatastrophes.length} receipts · sorted most recent first
                </div>
              </Reveal>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedCatastrophes.map((c, i) => (
                <CatastropheCard
                  key={c.slug}
                  catastrophe={c}
                  delay={Math.min(i * 0.03, 0.24)}
                />
              ))}
            </div>
          </section>

          {/* 5 — FINAL KNIFE */}
          <section
            id="closer"
            style={{
              paddingTop: 80,
              paddingBottom: 80,
              borderTop: `1px solid ${LINE}`,
              scrollMarginTop: 80,
            }}
          >
            <div style={{ marginBottom: 28 }}>
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
                  }}
                >
                  The cohort holds chips and refuses to play.
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
                    marginTop: 12,
                    maxWidth: 780,
                  }}
                >
                  Stablecoin supply crossed $320B in May 2026. Retail-sized
                  stablecoin transfers fell 16% in the first quarter — the
                  largest drop on record. The money is on-chain. The chips are
                  on the table. The cohort refuses to bet them at any of the
                  venues that hurt them. The companies they used to trade with
                  call this attrition, erosion, vintage concentration, lapsed,
                  inactive, forfeited. Each company has a word. The word is the
                  same word.
                </p>
              </Reveal>
            </div>

            <Reveal delay={0.16}>
              <div
                style={{
                  marginTop: 56,
                  paddingTop: 40,
                  borderTop: `1px solid ${LINE}`,
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--apple-font-display)',
                    fontSize: 'clamp(24px, 2.8vw, 32px)',
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-tighter)',
                    lineHeight: 1.2,
                    color: TEXT,
                    maxWidth: 760,
                    margin: '0 auto',
                  }}
                >
                  The cohort is large. The cohort is growing. The cohort is
                  looking for somewhere they have not yet been betrayed.
                </p>
              </div>
            </Reveal>
          </section>
        </div>
      </div>
    </AppShell>
  )
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontSize: 'clamp(28px, 3.2vw, 38px)',
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-tighter)',
          color: 'var(--apple-accent)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 13,
          color: TERTIARY,
          letterSpacing: '-0.005em',
          marginTop: 10,
          lineHeight: 1.45,
        }}
      >
        {label}
      </div>
    </div>
  )
}
