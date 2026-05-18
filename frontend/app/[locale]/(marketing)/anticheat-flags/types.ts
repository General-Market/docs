// Mechanism families — one chart component per mechanism, each parameterised
// by the incident's specific damage and named entities.
export type Mechanism =
  | 'price-wick'           // sudden spike takes out stops / mass liquidation
  | 'insider-runup'        // price moves on hidden info before public event
  | 'hack-drain'           // hot wallet balance drops to zero
  | 'withdrawal-freeze'    // user trapped while price falls
  | 'wash-trading'         // same wallet trades with itself, fake volume
  | 'compliance-fine'      // regulator imposes penalty for harms
  | 'rug-cliff'            // parabolic rise, vertical fall, insiders out
  | 'oracle-override'      // validator/admin rewrites the tape
  | 'carveout'             // payoff truncated by contract fine print
  | 'backdoor'             // exchange funnels deposits to insider entity
  | 'b-book-mirror'        // retail equity mirrors broker equity, opposite signs
  | 'outage-cascade'       // engine offline during volatility, snap on resume
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
