import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/AppShell'
import { Reveal } from '@/components/ui/Reveal'
import { TheoremSection } from './TheoremSection'
import { GraveyardTimelineSection } from './GraveyardTimelineSection'
import { InclusionPremiumSection } from './InclusionPremiumSection'
import { CohortGapSection } from './CohortGapSection'
import { DecayStackSection } from './DecayStackSection'
import { AnomalyCard } from './AnomalyCard'
import { DEAD_ANOMALIES } from './data-anomalies'
import './mobile.css'

export const metadata: Metadata = {
  title: 'Alpha is Shrinking. General Market',
  description:
    'Every door retail had to win has been measured and shut. The decay was published in the Journal of Finance. Fourteen anomalies, the receipts on file.',
  alternates: { canonical: '/alpha-shrinking' },
  robots: { index: true, follow: true },
}

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'

export default function AlphaShrinkingPage() {
  // Sort cards by year of death — most recent deaths first so the
  // visitor sees the freshest evidence at the top of the gallery.
  const sortedAnomalies = [...DEAD_ANOMALIES].sort(
    (a, b) => b.died.year - a.died.year,
  )

  return (
    <AppShell>
      <div className="w-full">
        <div
          className="ash-shell mx-auto w-full"
          style={{ maxWidth: 1068, padding: '0 24px' }}
        >
          {/* HERO */}
          <section className="ash-hero" style={{ padding: '120px 0 80px' }}>
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
                Every door retail had to win has been measured and shut. The decay
                was published in the Journal of Finance.
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
                Markets get harder each year for retail and small firms to win. Predatory
                actors reinvest the billions they extract, and extract more. Like the dead
                internet theory, this is proof of the dead financial market theory.
                General Market builds products to return markets to what they were ten
                years ago.
              </p>
            </Reveal>

            {/* Three headline stats — the page's evidence in one glance */}
            <Reveal delay={0.2}>
              <div
                className="grid grid-cols-1 md:grid-cols-3"
                style={{
                  marginTop: 40,
                  paddingTop: 24,
                  borderTop: `1px solid ${LINE}`,
                  gap: 24,
                }}
              >
                <HeroStat
                  value="−58%"
                  label="Average post-publication decay across 97 named anomalies (McLean & Pontiff, JoF 2016)"
                />
                <HeroStat
                  value="14 → 1"
                  label="Retail-accessible alphas still profitable after costs, 2000 → 2024"
                />
                <HeroStat
                  value="0.53 → 1.01"
                  label="Adjacent-cohort retail timing drag, % per year, 2015–19 vs 2020–24 (Horstmeyer / Zacks IM)"
                />
              </div>
            </Reveal>
          </section>

          {/* 1 — THE THEOREM */}
          <TheoremSection />

          {/* 2 — THE TIMELINE */}
          <GraveyardTimelineSection />

          {/* 3 — THE INCLUSION PREMIUM (Greenwood & Sammon) */}
          <InclusionPremiumSection />

          {/* 4 — COHORT GAP (Horstmeyer) */}
          <CohortGapSection />

          {/* 5 — DECAY STACK (per anomaly, peak vs current) */}
          <DecayStackSection />

          {/* 6 — THE GRAVEYARD CARDS */}
          <section
            id="graveyard"
            style={{
              paddingTop: 80,
              paddingBottom: 24,
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
                  The graveyard
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
                  Each card is one retail-accessible alpha. The years are birth and death.
                  The number is the peak documented return, then what is measurable today.
                  The citation is the paper that proved the decay, or the structural change
                  that ate the spread.
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
                  {sortedAnomalies.length} dead alphas · sorted most recent death first
                </div>
              </Reveal>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedAnomalies.map((anomaly, i) => (
                <AnomalyCard
                  key={anomaly.slug}
                  anomaly={anomaly}
                  delay={Math.min(i * 0.04, 0.28)}
                />
              ))}
            </div>
          </section>

          {/* 7 — THE FRONTIERS */}
          <section
            id="frontiers"
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
                  Every financial instrument decays. The edge is being first.
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
                  Every financial instrument decays to zero alpha as it becomes popular.
                  The only thing a trader can do is to arrive at a new instrument before
                  the sophisticated participants do. Options had a decade. AMM liquidity,
                  two years. Perpetual funding, three. Pump.fun, six months. Prediction
                  markets are already half-eaten. Each window opens. Each window closes.
                </p>
              </Reveal>
            </div>

            {/* Final knife */}
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
                  The only edge that does not decay is being first. The window on Blocks
                  by General is open. It will close.
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

