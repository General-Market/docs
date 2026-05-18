// ─────────────────────────────────────────────────────────────────────────────
// Editorial rule for /anticheat-flags
//
// This page documents one thing: structural unfairness where market makers,
// insiders, or the house extract value from retail. Every card on the wall
// must be a receipt of that mechanism. Everything else belongs elsewhere.
//
// QUALIFIES — add a card if the incident is one of:
//   price-wick      — stop-hunt wick into a thin book, retail stops taken
//   insider-runup   — hidden info → buy before the public event
//   wash-trading    — fake volume to lure retail into a real position
//   listing-dump    — MM/insider allocated supply dumped on retail post-listing
//   oracle-override — validator or admin rewrites the tape against retail
//   backdoor        — exchange routes flow to an insider entity (Alameda-style)
//   rug-cliff       — insider exit at peak after a parabolic run
//   b-book-mirror   — broker IS the MM; retail loss equals house profit
//   socialized-loss — winners clawed back to cover a whale's loss
//   margin-doubled  — margin requirements raised mid-position to force liq
//   button-freeze   — buy disabled while sell remains active (or vice versa)
//   carveout        — payoff truncated by contract fine print after the fact
//
// DOES NOT QUALIFY — kept in the union for legacy chart components, but no
// new cards should use these:
//   hack-drain        — external attacker theft. Custodial failure, not MM cheat.
//   withdrawal-freeze — exchange insolvency or pause. Operational, not MM cheat.
//   outage-cascade    — engine offline during volatility. Bug, not cheat.
//   compliance-fine   — outcome, not mechanism. If the fine punishes one of
//                       the qualifying mechanisms above, file the card under
//                       that mechanism. AML / KYC / sanctions / unregistered
//                       operations / books-and-records / terror financing /
//                       tax — none of these belong on this page.
// ─────────────────────────────────────────────────────────────────────────────
export type Mechanism =
  | 'price-wick'           // stop-hunt wick into thin book
  | 'insider-runup'        // hidden info → buy before public event
  | 'hack-drain'           // DEPRECATED — external theft, not MM cheat
  | 'withdrawal-freeze'    // DEPRECATED — operational, not MM cheat
  | 'wash-trading'         // self-trading to fake volume
  | 'compliance-fine'      // DEPRECATED — reclassify to the underlying mechanism
  | 'rug-cliff'            // parabolic rise, vertical fall, insiders out
  | 'oracle-override'      // validator/admin rewrites the tape
  | 'carveout'             // payoff truncated by contract fine print
  | 'backdoor'             // exchange funnels deposits to insider entity
  | 'b-book-mirror'        // retail equity mirrors broker equity, opposite signs
  | 'outage-cascade'       // DEPRECATED — operational bug, not MM cheat
  | 'margin-doubled'       // margin requirements raised mid-position
  | 'socialized-loss'      // winners' profits clawed back to cover whale loss
  | 'listing-dump'         // market maker / insider dumps post-listing
  | 'button-freeze'        // buy disabled while sell remains active

export interface ChartProps {
  // Concrete dollars the trader / user lost in this incident.
  loss?: string
  // Concrete dollars the cheat extracted (counterparty / house gain).
  extracted?: string
  // The named third party who received the value (Alameda, DPRK, MM, etc.)
  recipient?: string
  // The headline percentage move (for parabolas, drawdowns)
  pctMove?: string
  // Optional override for ticker animation starting value
  tickerFrom?: string
  // Optional override for ticker ending value
  tickerTo?: string
}

export interface Incident {
  date: string                // YYYY-MM-DD or YYYY-MM
  amount: string              // human display: "$4.316B" / "$1.5B" / "—"
  amountTone?: 'loss' | 'muted' | 'alleged' | 'default'
  headline: string
  knife: string               // single-sentence Cioran knife
  summary: string             // 1-2 sentence plain summary
  sourceLabel: string         // "DOJ" / "SEC" / "Bloomberg"
  sourceUrl: string
  mechanism: Mechanism
  chart: ChartProps
  tag?: 'alleged' | 'unverified'
}

export interface Venue {
  slug: string                // 'binance', 'ftx', 'pumpfun'
  name: string
  founded: number
  collapsed?: number
  heroStat: { value: string; label: string }
  ribbonStats: Array<{ value: string; label: string; tone?: 'loss' | 'default' }>
  indictment: string          // 1-2 sentence opening paragraph
  incidents: Incident[]
}
