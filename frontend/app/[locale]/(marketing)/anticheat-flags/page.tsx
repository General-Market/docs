import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { IncidentCard } from './IncidentCard'
import { binance } from './data-binance'
import { coinbase, ftx, bybit } from './data-crypto-1'
import { hyperliquid, bitmex, deribit, kraken } from './data-crypto-2'
import { okx, polymarket, kalshi, robinhood } from './data-prediction'
import { pumpfun, fxcfd } from './data-misc'
import type { Venue } from './types'
import './anticheat-flags.css'

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

export default function AntiCheatFlagsPage() {
  const totalIncidents = VENUES.reduce((acc, v) => acc + v.incidents.length, 0)

  return (
    <>
      <Header />
      <main className="acf">
        {/* HERO */}
        <header className="acf-hero">
          <div className="acf-hero-inner">
            <div className="acf-eyebrow">Technical Review № 003</div>
            <h1 className="acf-title">
              Anti-Cheat <em>Flags</em>
            </h1>
            <p className="acf-dek">
              Fourteen venues. The iconic flag from each one. What retail lost, what the regulator
              wrote, what the executive eventually admitted.
            </p>
            <div className="acf-hero-stats">
              <div className="acf-hero-stat">
                <div className="acf-hero-stat-fig">{VENUES.length}</div>
                <div className="acf-hero-stat-lbl">Venues flagged</div>
              </div>
              <div className="acf-hero-stat">
                <div className="acf-hero-stat-fig">$60B+</div>
                <div className="acf-hero-stat-lbl">Fines, hacks, losses</div>
              </div>
              <div className="acf-hero-stat">
                <div className="acf-hero-stat-fig">{totalIncidents}</div>
                <div className="acf-hero-stat-lbl">Receipts on file</div>
              </div>
              <div className="acf-hero-stat">
                <div className="acf-hero-stat-fig">2015–26</div>
                <div className="acf-hero-stat-lbl">Years documented</div>
              </div>
            </div>
          </div>
        </header>

        {/* VENUE NAV — small pill row, matches the homepage "See All" pattern */}
        <nav className="acf-venue-nav" aria-label="Venues">
          {VENUES.map(v => (
            <a key={v.slug} href={`#${v.slug}`} className="acf-venue-pill">
              {v.name}
              <span className="count">{v.incidents.length}</span>
            </a>
          ))}
        </nav>

        {/* VENUE SECTIONS */}
        {VENUES.map(venue => (
          <section key={venue.slug} id={venue.slug} className="acf-venue">
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
                    <div className="acf-venue-ribbon-fig" style={s.tone === 'loss' ? { color: '#DC2626' } : undefined}>
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
              Fourteen venues, the same handful of mechanisms, a different fine each year. When the venue
              keeps the order book, the matching engine, the price feed, the listing decision, and the
              audit — the receipts arrive on schedule.
            </p>
            <p>
              General Market is on-chain. Sealed bets. Parimutuel pools. BLS-verified oracles. The house
              cannot front-run because there is no house.
            </p>
            <a className="acf-closer-cta" href="/">Open General Market ›</a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
