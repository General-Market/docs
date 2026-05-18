import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { IncidentCard } from './IncidentCard'
import { binance } from './data-binance'
import type { Venue } from './types'
import './anticheat-flags.css'

export const metadata: Metadata = {
  title: 'Anti-Cheat Flags — General Market',
  description:
    'Fourteen venues. The iconic flag from each one. What retail lost, what the regulator wrote, what the executive eventually admitted.',
  alternates: { canonical: '/anticheat-flags' },
  robots: { index: true, follow: true },
}

const VENUES: Venue[] = [binance]

export default function AntiCheatFlagsPage() {
  const totalIncidents = VENUES.reduce((acc, v) => acc + v.incidents.length, 0)
  return (
    <>
      <Header />
      <main className="acf-page">
        {/* HERO */}
        <header className="acf-hero">
          <div className="acf-hero-inner">
            <div className="acf-hero-eyebrow">Technical Review № 003</div>
            <h1 className="acf-hero-title">
              Anti-Cheat <em>Flags</em>
            </h1>
            <p className="acf-hero-dek">
              Fourteen venues. The iconic flag from each one. What retail lost, what the regulator
              wrote, what the executive eventually admitted.
            </p>
            <div className="acf-hero-stats">
              <div className="acf-hero-stat">
                <div className="acf-hero-stat-fig">14</div>
                <div className="acf-hero-stat-lbl">Venues flagged</div>
              </div>
              <div className="acf-hero-stat">
                <div className="acf-hero-stat-fig">$60B+</div>
                <div className="acf-hero-stat-lbl">Fines, hacks, losses</div>
              </div>
              <div className="acf-hero-stat">
                <div className="acf-hero-stat-fig">214</div>
                <div className="acf-hero-stat-lbl">Receipts on file</div>
              </div>
              <div className="acf-hero-stat">
                <div className="acf-hero-stat-fig">2015–26</div>
                <div className="acf-hero-stat-lbl">Years documented</div>
              </div>
            </div>
          </div>
        </header>

        {/* PILOT NOTE — remove once all venues land */}
        <div className="acf-hero" style={{ paddingTop: 32, paddingBottom: 24, borderBottom: '1px solid var(--apple-divider)', background: 'var(--apple-surface)' }}>
          <div className="acf-hero-inner">
            <p style={{ fontFamily: 'var(--mono, monospace)', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--apple-text-tertiary)', fontWeight: 700 }}>
              Pilot · Binance · {totalIncidents} of 214 receipts shown
            </p>
            <p style={{ marginTop: 10, fontSize: 17, color: 'var(--apple-text-secondary)', maxWidth: 640 }}>
              Each receipt below ships with an animated diagram of the mechanism — your position,
              the cheat, the ghost line of what should have happened. Thirteen more venues land in the
              next pass.
            </p>
          </div>
        </div>

        {/* VENUES */}
        {VENUES.map(venue => (
          <section key={venue.slug} id={venue.slug} className="acf-venue">
            <div className="acf-venue-band">
              <div className="acf-venue-band-inner">
                <span className="acf-venue-band-title">{venue.name}</span>
                <span className="acf-venue-band-count">
                  Founded {venue.founded} · {venue.incidents.length} receipts
                </span>
              </div>
            </div>

            <div className="acf-venue-head">
              <div className="acf-venue-eyebrow">
                Founded {venue.founded}
                {venue.collapsed && ` · Collapsed ${venue.collapsed}`} · {venue.incidents.length} incidents
              </div>
              <h2 className="acf-venue-name">{venue.name}</h2>
              <p className="acf-venue-indictment">{venue.indictment}</p>
              <div className="acf-venue-ribbon">
                {venue.ribbonStats.map((s, i) => (
                  <div key={i} className="acf-venue-ribbon-stat">
                    <div className="acf-venue-ribbon-fig" data-tone={s.tone ?? 'default'}>
                      {s.value}
                    </div>
                    <div className="acf-venue-ribbon-lbl">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="acf-docket">
              {venue.incidents.map((incident, i) => (
                <IncidentCard key={`${venue.slug}-${i}`} incident={incident} />
              ))}
            </div>
          </section>
        ))}

        {/* CLOSER */}
        <section className="acf-closer">
          <div className="acf-closer-inner">
            <div className="acf-closer-eyebrow">The Fix</div>
            <h2>
              Cheating priced into every venue. We built one <em>without the room.</em>
            </h2>
            <p>
              The list above is what happens when the venue keeps the order book, the matching engine,
              the price feed, the listing decision, and the audit. Fourteen venues, the same handful of
              mechanisms, a different fine each year.
            </p>
            <p>
              General Market is on-chain. Sealed bets. Parimutuel pools. BLS-verified oracles. The
              house cannot front-run because there is no house.
            </p>
            <a className="acf-closer-cta" href="/">
              Open General Market →
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
