import type { Venue } from './types'

// Cards document one thing: structural unfairness where market makers,
// insiders, or the house extract value from retail. Before adding an incident,
// read the editorial rule at the top of ./types.ts. AML, KYC, sanctions,
// custodial hacks, exchange outages — none of these belong here.

export const ibkr: Venue = {
  slug: 'ibkr',
  name: 'Interactive Brokers',
  founded: 1978,
  heroStat: { value: '$82.57M', label: 'CFTC restitution · negative oil' },
  ribbonStats: [
    { value: '$82.57M', label: 'Oil restitution', tone: 'loss' },
    { value: '$38M', label: 'AML penalties' },
    { value: '$5M', label: 'Liquidation-corridor class action' },
  ],
  indictment:
    "A broker that the professionals respect. The professionals know what the machine does when the machine has not been told a price can be negative. The customer was the one who found out.",
  incidents: [
    {
      date: '2020-04-20', amount: '$82.57M restitution',
      headline: 'WTI prints −$37; IBKR system clamps the tape at $0',
      knife: "Their engine refused to believe what the market just said. The customers paid the difference between the market and the engine's imagination.",
      summary: 'IBKR\'s electronic trading system was not configured to handle negative prices. When WTI May futures settled at −$37.63, long customers were not liquidated in real time; losses crystallised after the close. CFTC ordered $1.75M penalty and $82.57M restitution.',
      sourceLabel: 'CFTC',
      sourceUrl: 'https://www.cftc.gov/PressRoom/PressReleases/8432-21',
      mechanism: 'oracle-override',
      chart: { loss: '$10,000 long WTI', extracted: '$82.57M', recipient: 'customers (eventually)' },
    },
    {
      date: '2021-01-28', amount: 'Restrictions',
      amountTone: 'muted',
      headline: 'IBKR forces GameStop, AMC, KOSS options into liquidation-only',
      knife: 'Peterffy went on TV to defend protecting the clearinghouse. The retail bid is what the clearinghouse needed protection from.',
      summary: 'During the meme-stock squeeze, IBKR restricted opening trades on a handful of names and raised margin to 100%. Chairman Thomas Peterffy told CNBC the move was to protect "the market and the clearing systems."',
      sourceLabel: 'CNBC',
      sourceUrl: 'https://www.cnbc.com/2021/01/28/interactive-brokers-restricted-gamestop-trading-to-protect-the-market-says-chairman-peterffy.html',
      mechanism: 'button-freeze',
      chart: { loss: 'retail entry', extracted: 'opening orders blocked', recipient: 'short-side relief' },
    },
    {
      date: '2025-07-14', amount: '$5M class settlement',
      headline: 'Auto-liquidation algo sold positions outside its own pricing corridor',
      knife: 'The machine had rules for itself. The machine did not follow them. The settlement covered twelve years of customers who learned it after the fact.',
      summary: 'Batchelar v. Interactive Brokers — class certified for margin accounts where the auto-liquidation algorithm executed trades at prices outside the corridor defined by IBKR\'s own software. $5M settlement covering Dec 18, 2013 through Jul 14, 2025.',
      sourceLabel: 'Class admin',
      sourceUrl: 'https://interactivebrokerssettlement.com/',
      mechanism: 'oracle-override',
      chart: { loss: '$10,000 margin long', extracted: 'corridor breach', recipient: 'IBKR algo' },
    },
  ],
}

export const etoro: Venue = {
  slug: 'etoro',
  name: 'eToro',
  founded: 2007,
  heroStat: { value: '76%', label: 'of retail CFD clients lose money' },
  ribbonStats: [
    { value: '76%', label: 'CFD clients losing — disclosed', tone: 'loss' },
    { value: '$1.5M', label: 'SEC settlement (2024)' },
    { value: '4 jurisdictions', label: 'Regulators on file' },
  ],
  indictment:
    "Copy trading is the friendliest version of the b-book. The platform you imitate, the trader you imitate, the loss you actually take — three different parties, one disclaimer at the bottom that admits seventy-six out of a hundred of you will end up here.",
  incidents: [
    {
      date: '2023-08-03', amount: 'ASIC suit',
      amountTone: 'muted',
      headline: 'ASIC sues eToro Australia — CFD screening "so lax anyone qualified"',
      knife: 'A high-risk product needs a wide target market. They simply made the door wide.',
      summary: 'Australian Securities and Investments Commission filed Federal Court action: eToro Aus Capital Ltd\'s design-and-distribution screening test for CFDs was so weak that almost any retail applicant passed.',
      sourceLabel: 'ASIC',
      sourceUrl: 'https://asic.gov.au/about-asic/news-centre/find-a-media-release/2023-releases/23-209mr-asic-sues-etoro-for-design-and-distribution-failings-and-misleading-conduct-relating-to-its-cfd-product/',
      mechanism: 'b-book-mirror',
      chart: { loss: 'retail CFD onboarding', extracted: 'lax screening', recipient: 'eToro book' },
    },
    {
      date: 'Ongoing', amount: '76% retail lose',
      amountTone: 'loss',
      headline: 'ESMA-mandated disclosure: most CFD retail clients lose money',
      knife: 'The number is at the bottom of every page in light grey. It is the only honest sentence in the marketing.',
      summary: 'Under ESMA rules, eToro must display the proportion of retail CFD accounts losing money on the broker. The current figure on eToro Europe: 76% of retail investor accounts lose money trading CFDs with this provider.',
      sourceLabel: 'eToro disclosure',
      sourceUrl: 'https://www.etoro.com/customer-service/regulation-license/',
      mechanism: 'b-book-mirror',
      chart: { loss: '76 of every 100', extracted: 'their balance', recipient: 'eToro book' },
    },
  ],
}
