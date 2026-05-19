// Editorial rule for /the-gap
//
// This page documents one thing: the cohort of retail users that got
// scammed across trading venues — once, twice, three times — and
// stopped. Each public-listed broker and casino has a defined KPI for
// the gap between "ever funded" and "currently active". Each one of
// them admits, in their own SEC filings, that the gap is growing.
// Every row on this page must trace to a primary source: SEC filing,
// regulator disclosure, audited dataset, peer-reviewed study.

export interface CohortRow {
  slug: string
  /** Display name. Short. */
  company: string
  /** Stock ticker, used as eyebrow text. */
  ticker: string
  /** The KPI the company itself uses (e.g., "Net Cumulative Funded Accounts vs Monthly Active Users"). */
  kpi: string
  /** Cumulative-ever value — what they admit they touched. */
  cumulative: string
  /** Currently active value — what's still here. */
  active: string
  /** The gap = cumulative − active. The ungetable cohort. */
  gap: string
  /** One-line note about how the gap is growing. */
  growth: string
  /** Citation label. */
  sourceLabel: string
  sourceUrl: string
  /** Optional flag for cases where the company refuses to disclose the cumulative number. */
  obfuscated?: boolean
}

export interface JargonEntry {
  slug: string
  /** Company name. */
  company: string
  /** The word or phrase, exactly as the filing uses it. */
  term: string
  /** Direct quote from filing or earnings call. */
  quote: string
  /** Context: what the company is actually saying. The knife. */
  knife: string
  sourceLabel: string
  sourceUrl: string
}

export interface DisclosureRow {
  slug: string
  /** Product category — CFDs, forex, options, etc. */
  product: string
  /** Broker / study name. */
  source: string
  /** Loss rate — "% of accounts that lose money". */
  lossRate: string
  /** Sample / scope. */
  sample: string
  /** Year of disclosure. */
  year: string
  /** Source type — regulator-mandated disclosure, peer-reviewed study, on-chain audit. */
  kind: 'regulator' | 'academic' | 'on-chain' | 'industry'
  sourceLabel: string
  sourceUrl: string
}

export interface Catastrophe {
  slug: string
  /** Display name. */
  name: string
  /** ISO date for sorting. */
  date: string
  /** Human-readable date label. */
  dateLabel: string
  /** Loss amount in USD, formatted. */
  amount: string
  /** Victim count, formatted. */
  victims: string
  /** What happened, in one short line. */
  what: string
  /** The cohort psychology. Italic. */
  knife: string
  /** Citation label. */
  sourceLabel: string
  sourceUrl: string
  /** Optional tag — "presidential", "celebrity", "broker", "self-custody". */
  tag?: string
}
