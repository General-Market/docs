import type { CohortRow } from './types'

// The cohort-exit table.
// Every public-listed retail trading or casino company that reports
// two user metrics — one cumulative, one active — and admits the gap
// between them is widening. Numbers traced to primary filings or
// company press releases. Where the company refuses to publish a
// cumulative number, that refusal is the disclosure.

export const COHORTS: CohortRow[] = [
  {
    slug: 'robinhood',
    company: 'Robinhood',
    ticker: 'HOOD',
    kpi: 'Funded Customers vs Monthly Active Users',
    cumulative: '27.4M',
    active: '13.0M',
    gap: '14.4M',
    growth: 'Funded Customers only grow. MAU peaked at 21.3M in Q2 2021 and has never recovered.',
    sourceLabel: 'HOOD 10-K FY2025',
    sourceUrl:
      'https://www.sec.gov/Archives/edgar/data/0001783879/000178387926000023/hood-20251231.htm',
  },
  {
    slug: 'coinbase',
    company: 'Coinbase',
    ticker: 'COIN',
    kpi: 'Verified Users vs Monthly Transacting Users',
    cumulative: '110M*',
    active: '8.4M',
    gap: '~101M',
    growth:
      'Verified Users grew 32M → 110M (2019-2022). The company stopped publishing the metric in 2023 when the active-to-verified ratio fell below 9%.',
    sourceLabel: 'COIN FY2022 10-K (last disclosure)',
    sourceUrl:
      'https://www.sec.gov/Archives/edgar/data/0001679788/000167978823000031/coin-20221231.htm',
    obfuscated: true,
  },
  {
    slug: 'etoro',
    company: 'eToro',
    ticker: 'ETOR',
    kpi: 'Registered Users vs Funded Accounts',
    cumulative: '~40M',
    active: '3.73M',
    gap: '~36M',
    growth:
      'Disclosed conversion rate "doubled" to 9-10%. The floor implies ~90% of registrations never fund. Most of the cumulative roster will never trade.',
    sourceLabel: 'ETOR F-1 (2025)',
    sourceUrl:
      'https://www.sec.gov/Archives/edgar/data/1493318/000121390025039451/ea0223534-11.htm',
  },
  {
    slug: 'plus500',
    company: 'Plus500',
    ticker: 'LSE: PLUS',
    kpi: 'New customers (lifetime) vs Active Customers',
    cumulative: 'undisclosed',
    active: '254k',
    gap: 'multi-million',
    growth:
      '67% of OTC revenue now comes from customers acquired more than three years ago. New cohorts pass through. Said as a strength.',
    sourceLabel: 'Plus500 FY2024 Preliminary Results',
    sourceUrl:
      'https://cdn.plus500.com/media/Investors/Reports/Plus500_Preliminary_Results_FY2024.pdf',
    obfuscated: true,
  },
  {
    slug: 'ig-group',
    company: 'IG Group',
    ticker: 'LSE: IGG',
    kpi: 'Funded customers (new KPI Sep 2025) vs Active',
    cumulative: 'undisclosed pre-2025',
    active: '+8% YoY',
    gap: 'regulator-enforced',
    growth:
      'Funded accounts in Europe declining "reflects the implementation of regulation requiring the closure of inactive accounts." The regulator closes them because IG would not.',
    sourceLabel: 'IG Group Annual Report 2025',
    sourceUrl:
      'https://www.iggroup.com/~/media/Files/I/IG-Group/documents/investors/financial-results/results-reports-and-presentations/2025/annual-report-2025.pdf',
    obfuscated: true,
  },
  {
    slug: 'ibkr',
    company: 'Interactive Brokers',
    ticker: 'IBKR',
    kpi: 'Total client accounts only',
    cumulative: '4.65M (Feb 2026)',
    active: 'not published',
    gap: 'unmeasurable by design',
    growth:
      'No MAU disclosure. The deliberate absence of an active-user metric is itself a refusal to publish the gap.',
    sourceLabel: 'IBKR 10-K FY2025',
    sourceUrl:
      'https://www.sec.gov/Archives/edgar/data/0001381197/000138119726000062/ibkr-20251231.htm',
    obfuscated: true,
  },
  {
    slug: 'draftkings',
    company: 'DraftKings',
    ticker: 'DKNG',
    kpi: 'Monthly Unique Payers (MUPs) only',
    cumulative: 'never published',
    active: '3.7M MUPs FY2024',
    gap: 'undisclosed by design',
    growth:
      'Cumulative payer count is the number they will not print. CLV/CAC discussed only as a ratio, never as a cohort survival curve.',
    sourceLabel: 'DKNG FY2024 8-K',
    sourceUrl:
      'https://www.sec.gov/Archives/edgar/data/0001883685/000188368525000007/q424-prx8kexx991.htm',
    obfuscated: true,
  },
  {
    slug: 'flutter',
    company: 'Flutter (FanDuel)',
    ticker: 'FLUT',
    kpi: 'Average Monthly Players (AMP) only',
    cumulative: 'never published',
    active: '15.9M AMPs FY2025',
    gap: 'acknowledged in risk factors',
    growth:
      '10-K risk factor: "There is no guarantee that the company will not experience an erosion of its AMP base." The cohort that left isn\'t counted.',
    sourceLabel: 'FLUT 10-K FY2023',
    sourceUrl:
      'https://www.sec.gov/Archives/edgar/data/0001635327/000119312524076966/d766413d10k.htm',
  },
  {
    slug: 'penn',
    company: 'Penn Entertainment',
    ticker: 'PENN',
    kpi: 'Interactive MAU only',
    cumulative: 'never published',
    active: '560k Q1 2025',
    gap: 'undisclosed',
    growth:
      'theScore app described as "4M MAU across North America." The verb tense — "across" not "this month" — hides the lapsed cohort.',
    sourceLabel: 'PENN 10-K FY2025',
    sourceUrl:
      'https://www.sec.gov/Archives/edgar/data/0000921738/000092173826000008/penn-20251231.htm',
    obfuscated: true,
  },
  {
    slug: 'caesars',
    company: 'Caesars',
    ticker: 'CZR',
    kpi: 'Caesars Rewards members vs active',
    cumulative: '60M+ members',
    active: 'not disclosed',
    gap: 'measured by forfeiture',
    growth:
      'Six-month dormancy clause: "A member\'s Reward Credit balance is forfeited if the member does not earn at least one Reward Credit during a continuous six-month period." Forfeiture is the accounting word for gone.',
    sourceLabel: 'CZR 10-K FY2024',
    sourceUrl:
      'https://www.sec.gov/Archives/edgar/data/0001590895/000159089525000068/czr-20241231.htm',
    obfuscated: true,
  },
]
