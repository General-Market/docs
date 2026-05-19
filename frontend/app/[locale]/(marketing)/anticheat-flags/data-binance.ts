import type { Venue } from './types'

// Cards document one thing: structural unfairness where market makers,
// insiders, or the house extract value from retail. Before adding an incident,
// read the editorial rule at the top of ./types.ts. AML, KYC, sanctions,
// custodial hacks, exchange outages. None of these belong here.

export const binance: Venue = {
  slug: 'binance',
  name: 'Binance',
  founded: 2017,
  heroStat: { value: '$4.3B', label: 'Largest DOJ fine in corporate history' },
  ribbonStats: [
    { value: '$4.3B', label: 'Largest DOJ fine', tone: 'loss' },
    { value: '1.67M', label: 'OFAC violations', tone: 'loss' },
    { value: '4 mo', label: 'CZ prison term' },
  ],
  indictment:
    'The largest corporate crime resolution in DOJ history was a line item. The man who signed it served less time than a sublet, then was pardoned. The customers stayed where they were left.',
  incidents: [
    {
      date: '2023-06-05',
      amount: '$190M',
      headline: 'SEC alleges Sigma Chain wash-traded 48 of 51 Binance.US listings',
      knife: 'Forty-eight of fifty-one new listings traded mostly against themselves. The yacht was real.',
      summary:
        'SEC alleged CZ-owned Sigma Chain was the undisclosed primary market maker on Binance.US. Self-trading up to 99% of volume on some tokens, spending $11M of customer-derived money on a yacht. Case dismissed May 2025 without adjudication.',
      sourceLabel: 'SEC',
      sourceUrl:
        'https://www.sec.gov/newsroom/press-releases/2023-101-sec-files-13-charges-against-binance-entities-founder-changpeng-zhao',
      mechanism: 'wash-trading',
      chart: { loss: 'your fill', extracted: '$190M', recipient: 'Sigma Chain' },
      tag: 'alleged',
    },
    {
      date: '2025-10-10',
      amount: '$19.25B',
      headline: '10/10/2025 cascade. Largest liquidation event in crypto history',
      knife: 'ATOM printed near zero on the world\'s largest exchange. The bots that did it were never named.',
      summary:
        'Tariff announcement triggered selling. API lagged, ATOM and ENJ briefly traded near $0 on Binance as collateral was force-sold, 1.62M accounts liquidated. Binance covered $188M in bad debt and called it macro.',
      sourceLabel: 'CoinGecko',
      sourceUrl: 'https://www.coingecko.com/learn/october-10-crypto-crash-explained',
      mechanism: 'price-wick',
      chart: { loss: '$5,000 long', tickerFrom: '+$200', tickerTo: '−$5,000' },
    },
    {
      date: '2024-12-07',
      amount: '60 seconds',
      headline: '"Year of the Yellow Fruit". Employee front-runs official Futures tweet',
      knife: "Sixty seconds from token creation to the official tweet. They didn't even pretend.",
      summary:
        'A meme token was created on BNB Chain at 05:29 UTC. Under a minute later, @BinanceFutures posted the same imagery. Employee suspended. No criminal referral.',
      sourceLabel: 'BraveNewCoin',
      sourceUrl:
        'https://bravenewcoin.com/insights/binance-suspends-employee-over-insider-trading-scandal-involving-meme-token',
      mechanism: 'insider-runup',
      chart: { loss: '$500 spot', extracted: '$55,600', recipient: 'one employee' },
    },
    {
      date: '2021-07-26',
      amount: '$1.14B liquidated',
      headline: 'BTC perp prints $48,168 vs $40k spot. Scam wick',
      knife: 'Eight thousand dollars of spread, a single user, no name. The shorts paid the bill.',
      summary:
        'BTCUSDT perpetual on Binance printed 20% above spot in seconds. Binance attributed to "a user" placing large buy orders. Researchers documented offer-side spoofing in the minutes before. ~$950M of shorts liquidated.',
      sourceLabel: 'BitMEX Blog',
      sourceUrl: 'https://blog.bitmex.com/scamwicks-and-stop-cascades/',
      mechanism: 'price-wick',
      chart: { loss: '$10,000 short', tickerFrom: '+$240', tickerTo: '−$10,000' },
    },
    {
      date: '2024-12-10',
      amount: '$38M',
      headline: 'MOVE market maker dumps 66M tokens with no buys',
      knife: 'They listed the token, watched the dump, kept the fees, named the culprit three months later.',
      summary:
        'A listing market maker sold 66M MOVE with no offsetting buys, extracting $38M USDT. Binance offboarded the firm in March 2025. Well after the cash had left.',
      sourceLabel: 'The Block',
      sourceUrl:
        'https://www.theblock.co/post/347931/binance-move-market-maker-movement-38-million-usdt-buyback-program',
      mechanism: 'listing-dump',
      chart: { loss: '$1,000 listing buy', extracted: '$38M', recipient: 'the market maker' },
    },
    {
      date: '2019–2022',
      amount: '$190M',
      headline: 'Sigma Chain. CZ\'s "market maker" pocketed $190M from Binance.US',
      knife: 'The market maker for the exchange he owned bought a yacht with the spread. The customers paid for both halves.',
      summary:
        'Per SEC: Sigma Chain, beneficially owned by CZ, was the undisclosed primary market maker on Binance.US. Traded against itself, employee-linked accounts, and inflated volumes shown to equity investors.',
      sourceLabel: 'SEC Complaint',
      sourceUrl: 'https://www.sec.gov/files/litigation/complaints/2023/comp-pr2023-101.pdf',
      mechanism: 'wash-trading',
      chart: { loss: 'your equity bid', extracted: '$190M', recipient: 'Sigma Chain / CZ' },
      tag: 'alleged',
    },
    {
      date: '2024',
      amount: 'Unverified',
      amountTone: 'muted',
      headline: 'Two insider trading suspensions in one calendar year',
      knife: 'Two insider scandals in one year, none referred to prosecutors. They handle their own discipline.',
      summary:
        'The December 2024 meme-token incident was the second time Binance suspended an employee for trading-on-listings activity in 2024. No names, no totals, no referrals to law enforcement.',
      sourceLabel: 'AirdropAlert',
      sourceUrl: 'https://airdropalert.com/blogs/binance-is-pumping-memes-again/',
      mechanism: 'insider-runup',
      chart: { loss: 'your spot order', extracted: 'two suspensions', recipient: 'two employees' },
    },
    {
      date: '2025–ongoing',
      amount: 'Tens of millions',
      headline: 'Listings-as-extraction. Admitted market-maker collusion pattern',
      knife: 'They listed it, the market maker dumped it, the retail bid for it. New rules arrived after the cash did.',
      summary:
        'Following MOVE, Binance disclosed a multi-token pattern of profit-sharing arrangements with market makers pumping then dumping new listings. SIREN fell 71% in 72 hours.',
      sourceLabel: 'CoinDesk',
      sourceUrl:
        'https://www.coindesk.com/business/2026/03/25/binance-tightens-market-maker-rules-tells-token-issuers-they-must-disclose-partners',
      mechanism: 'listing-dump',
      chart: { loss: '$500 SIREN buy', extracted: 'tens of millions', recipient: 'partner MMs' },
    },
  ],
}
