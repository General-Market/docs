import type { Venue } from './types'

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
      date: '2023-11-21',
      amount: '$4.316B',
      headline: 'CZ guilty plea — largest corporate crime resolution in DOJ history',
      knife: 'The largest corporate crime fine in American history. He served four months.',
      summary:
        'Binance pleaded guilty to BSA conspiracy, unregistered money transmission, and IEEPA sanctions violations. CZ resigned, paid $50M personally, served four months.',
      sourceLabel: 'DOJ',
      sourceUrl: 'https://www.justice.gov/archives/opa/pr/binance-and-ceo-plead-guilty-federal-charges-4b-resolution',
      mechanism: 'compliance-fine',
      chart: { loss: 'your custody', extracted: '$4.3B', recipient: 'US Treasury' },
    },
    {
      date: '2023-11-21',
      amount: '$968M',
      headline: 'OFAC settlement — 1,667,153 apparent sanctions violations',
      knife: 'A million violations is no longer carelessness. It is a business model with bookkeeping.',
      summary:
        'Trades matched between U.S. users and counterparties in Iran, Syria, North Korea, Cuba, Crimea, Donetsk, Luhansk between 2017 and 2022. Senior management knew.',
      sourceLabel: 'OFAC',
      sourceUrl: 'https://ofac.treasury.gov/recent-actions/20231121',
      mechanism: 'compliance-fine',
      chart: { loss: 'your KYC paper', extracted: '$968M', recipient: 'Iran · DPRK · Syria' },
    },
    {
      date: '2023-11-21',
      amount: '$3.4B',
      headline: 'FinCEN — 100,000+ unfiled suspicious activity reports',
      knife: 'They wrote no reports because there was nothing to report. There was only everything.',
      summary:
        'Operated as an unregistered MSB. Failed to report 100,000+ suspicious transactions tied to terrorist financing, ransomware, CSAM, dark net markets, scams. Five-year independent monitor.',
      sourceLabel: 'Treasury',
      sourceUrl: 'https://home.treasury.gov/news/press-releases/jy1925',
      mechanism: 'compliance-fine',
      chart: { loss: 'your deposit', extracted: '$3.4B', recipient: 'FinCEN' },
    },
    {
      date: '2023-12-18',
      amount: '$2.85B',
      headline: 'CFTC — willful evasion of U.S. derivatives law',
      knife: 'Compliance staff joked about terrorist accounts in writing. They closed two eyes and kept the chat logs.',
      summary:
        'CFTC alleged Binance, CZ, and ex-CCO Samuel Lim willfully ran an unregistered derivatives exchange for U.S. customers, coaching VIPs to use VPNs. Internal Slack: "we see the bad, but we close 2 eyes."',
      sourceLabel: 'CFTC',
      sourceUrl: 'https://www.cftc.gov/PressRoom/PressReleases/8825-23',
      mechanism: 'compliance-fine',
      chart: { loss: 'your derivatives', extracted: '$2.85B', recipient: 'CFTC' },
    },
    {
      date: '2023-06-05',
      amount: '$190M',
      headline: 'SEC alleges Sigma Chain wash-traded 48 of 51 Binance.US listings',
      knife: 'Forty-eight of fifty-one new listings traded mostly against themselves. The yacht was real.',
      summary:
        'SEC alleged CZ-owned Sigma Chain was the undisclosed primary market maker on Binance.US — self-trading up to 99% of volume on some tokens, spending $11M of customer-derived money on a yacht. Case dismissed May 2025 without adjudication.',
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
      headline: '10/10/2025 cascade — largest liquidation event in crypto history',
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
      headline: '"Year of the Yellow Fruit" — employee front-runs official Futures tweet',
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
      date: '2019-05-07',
      amount: '$40.8M',
      headline: '2019 hot wallet hack — 7,000 BTC drained in one withdrawal',
      knife: 'The CEO publicly considered rewriting Bitcoin to undo his own breach. The keys did not improve.',
      summary:
        'Attackers obtained API keys and 2FA codes via phishing and malware, executed a single coordinated withdrawal. SAFU covered losses. CZ briefly floated rolling back the Bitcoin chain.',
      sourceLabel: 'CoinDesk',
      sourceUrl:
        'https://www.coindesk.com/markets/2019/05/07/hackers-steal-407-million-in-bitcoin-from-crypto-exchange-binance',
      mechanism: 'hack-drain',
      chart: { loss: '7,000 BTC', tickerFrom: '$40.8M', tickerTo: '$0 (covered)' },
    },
    {
      date: '2021-07-26',
      amount: '$1.14B liquidated',
      headline: 'BTC perp prints $48,168 vs $40k spot — scam wick',
      knife: 'Eight thousand dollars of spread, a single user, no name. The shorts paid the bill.',
      summary:
        'BTCUSDT perpetual on Binance printed 20% above spot in seconds. Binance attributed to "a user" placing large buy orders. Researchers documented offer-side spoofing in the minutes before. ~$950M of shorts liquidated.',
      sourceLabel: 'BitMEX Blog',
      sourceUrl: 'https://blog.bitmex.com/scamwicks-and-stop-cascades/',
      mechanism: 'price-wick',
      chart: { loss: '$10,000 short', tickerFrom: '+$240', tickerTo: '−$10,000' },
    },
    {
      date: '2021-05-19',
      amount: '$500B wiped',
      headline: 'May 19 crash — withdrawals frozen, trade data backfilled',
      knife: 'The data they sent later did not obey arithmetic. Their insurance fund obeyed everything.',
      summary:
        'Binance stopped serving retail data during the worst hours. Backfilled trade data later failed Benford\'s Law; futures-spot gap was 7× the reference period — consistent with protecting the insurance fund at users\' expense.',
      sourceLabel: 'IWH-Halle',
      sourceUrl:
        'https://www.iwh-halle.de/en/publications/detail/bitcoin-flash-crash-on-may-19-2021-what-did-really-happen-on-binance',
      mechanism: 'withdrawal-freeze',
      chart: { loss: '$2,000 BTC long', pctMove: '−31%', tickerFrom: '$2,000', tickerTo: '$1,380' },
    },
    {
      date: '2023-11 / 2025-11',
      amount: '~190 accts',
      headline: 'Hamas, Hezbollah, ISIS — funds moved on Binance',
      knife: 'They pleaded guilty in November and let the same wallets keep moving. Compliance, on paper, again.',
      summary:
        'DOJ and Treasury documented Al-Qassam Brigades using Binance from at least 2019. Israel seized ~190 accounts tied to Hamas, ISIS. 535 Oct. 7 victims sued under the Anti-Terrorism Act after CZ\'s pardon.',
      sourceLabel: 'Times of Israel',
      sourceUrl:
        'https://www.timesofisrael.com/hundreds-of-oct-7-victims-sue-worlds-biggest-crypto-exchange-for-hamas-money-laundering/',
      mechanism: 'compliance-fine',
      chart: { loss: 'your KYC', extracted: 'hundreds of millions', recipient: 'Hamas · Hezbollah · ISIS' },
    },
    {
      date: '2024-02 / 2024-10',
      amount: '8 months',
      headline: 'Tigran Gambaryan detained 8 months in Nigeria',
      knife: 'They sent the compliance chief into the country negotiating with them. He came back in a wheelchair.',
      summary:
        'Binance flew its head of financial crime compliance — a former IRS agent — into Nigeria to negotiate. He was detained, charged, contracted malaria and pneumonia. Charges dropped after 8 months.',
      sourceLabel: 'NPR',
      sourceUrl: 'https://www.npr.org/2025/02/12/1230862333/tigran-gambarian-crypto-binance-nigeria-prison',
      mechanism: 'compliance-fine',
      chart: { loss: 'your trust', extracted: 'one employee', recipient: 'Nigerian custody' },
    },
    {
      date: '2024-12-10',
      amount: '$38M',
      headline: 'MOVE market maker dumps 66M tokens with no buys',
      knife: 'They listed the token, watched the dump, kept the fees, named the culprit three months later.',
      summary:
        'A listing market maker sold 66M MOVE with no offsetting buys, extracting $38M USDT. Binance offboarded the firm in March 2025 — well after the cash had left.',
      sourceLabel: 'The Block',
      sourceUrl:
        'https://www.theblock.co/post/347931/binance-move-market-maker-movement-38-million-usdt-buyback-program',
      mechanism: 'listing-dump',
      chart: { loss: '$1,000 listing buy', extracted: '$38M', recipient: 'the market maker' },
    },
    {
      date: '2022-12-16',
      amount: 'Audit pulled',
      amountTone: 'muted',
      headline: 'Mazars walks away from the proof-of-reserves report',
      knife: 'The auditor signed, then erased the page from its own website. The reserves they certified were never recertified.',
      summary:
        'Mazars published an agreed-upon-procedures report December 7, 2022 claiming Binance BTC reserves were "101% collateralized." Within nine days Mazars paused all crypto work and deleted the report.',
      sourceLabel: 'CoinDesk',
      sourceUrl:
        'https://www.coindesk.com/business/2022/12/16/binance-proof-of-reserves-auditor-mazars-pauses-all-work-for-crypto-clients',
      mechanism: 'compliance-fine',
      chart: { loss: 'your reserves report', extracted: 'one signature', recipient: 'Mazars (rescinded)' },
    },
    {
      date: '2021–2023',
      amount: '€3.3M+',
      headline: 'Italy, Netherlands, UK, Germany — regulators close the doors',
      knife: 'Every regulator in Europe asked them to leave. They called it geographic optimization.',
      summary:
        'Italy\'s Consob declared Binance entities unauthorized. UK FCA barred regulated activity. Netherlands fined €3.3M; Binance exited 2023. Futures withdrawn from Germany, Italy, Netherlands.',
      sourceLabel: 'TRT',
      sourceUrl:
        'https://www.trtworld.com/magazine/crypto-exchange-binance-is-unauthorised-in-italy-as-crackdown-widens-48434',
      mechanism: 'compliance-fine',
      chart: { loss: 'EU access', extracted: '€3.3M', recipient: 'AFM · Consob · FCA' },
    },
    {
      date: '2022-03+',
      amount: '77% share',
      headline: 'Russia ruble corridor after the invasion',
      knife: 'The world sanctioned a country. The exchange noticed the volume and stayed open.',
      summary:
        'After EU sanctions, Binance briefly restricted Visa/Mastercard ruble deposits, then walked it back. WSJ and Reuters documented Binance\'s dominant role as a sanctions-evasion corridor — estimated 77% of CIS crypto-fiat in March 2022.',
      sourceLabel: 'Moscow Times',
      sourceUrl: 'https://www.themoscowtimes.com/2023/08/28/binance-restricts-russian-clients-to-ruble-transactions-a82263',
      mechanism: 'compliance-fine',
      chart: { loss: 'your ruling regime', extracted: 'billions in rubles', recipient: 'sanctioned wallets' },
      tag: 'alleged',
    },
    {
      date: '2026-03',
      amount: '$1B+',
      headline: 'Iran corridor — VIP accounts moved $1B+ to Iran-linked entities',
      knife: 'The VIP team had a 79-year-old gold smuggler on file. They knew. They kept it open.',
      summary:
        'Internal Binance investigators reportedly flagged a 79-year-old Chinese VIP and a suspected Iranian gold smuggler. Senate inquiry references $1.7B aggregate tied to Iran proxies and Russia\'s shadow fleet.',
      sourceLabel: 'Fortune',
      sourceUrl: 'https://fortune.com/2026/03/12/binance-accounts-iranian-entities-sanctions-chinese-vips-gold-smuggler/',
      mechanism: 'compliance-fine',
      chart: { loss: 'your moral cover', extracted: '$1B+', recipient: 'Iran proxies' },
    },
    {
      date: '2025-10-23',
      amount: '$2B',
      headline: 'Trump pardons CZ — with $2B Emirati capital arriving in a Trump-family stablecoin',
      knife: "Two billion in Emirati capital, eight hundred thousand in lobbying, a presidential pardon. He didn't even know him.",
      summary:
        'Trump pardoned CZ after a Trump-family crypto venture announced a $2B Emirati investment in Binance settled in WLF\'s USD1. Binance spent ~$800k on lobbying. Trump told 60 Minutes he had "no idea" who CZ was.',
      sourceLabel: 'CNBC',
      sourceUrl: 'https://www.cnbc.com/2025/10/23/trump-pardons-binance-founder-cz-zhao.html',
      mechanism: 'compliance-fine',
      chart: { loss: 'the prosecution', extracted: '$2B', recipient: 'Emirati LP · Trump family' },
    },
    {
      date: '2019–2022',
      amount: '$190M',
      headline: 'Sigma Chain — CZ\'s "market maker" pocketed $190M from Binance.US',
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
      date: '2022-05-12',
      amount: '99% drop',
      headline: 'LUNA/UST — withdrawals frozen as the chain ate itself',
      knife: 'The early backer suspended withdrawals while the chain ate itself. The retail bagholder went last.',
      summary:
        'Binance suspended LUNA/UST trading and withdrawals "due to high volume." Users were trapped on a dying chain. Binance had been an early backer through Binance Labs.',
      sourceLabel: 'TechCrunch',
      sourceUrl:
        'https://techcrunch.com/2022/05/12/binance-halts-luna-and-ust-trading-across-most-of-its-spot-pairs-following-meltdown/',
      mechanism: 'withdrawal-freeze',
      chart: { loss: '$5,000 LUNA', pctMove: '−99%', tickerFrom: '$5,000', tickerTo: '$50' },
    },
    {
      date: '2025–ongoing',
      amount: 'Tens of millions',
      headline: 'Listings-as-extraction — admitted market-maker collusion pattern',
      knife: 'They listed it, the market maker dumped it, the retail bid for it. New rules arrived after the cash did.',
      summary:
        'Following MOVE, Binance disclosed a multi-token pattern of profit-sharing arrangements with market makers pumping then dumping new listings. SIREN fell 71% in 72 hours.',
      sourceLabel: 'CoinDesk',
      sourceUrl:
        'https://www.coindesk.com/business/2026/03/25/binance-tightens-market-maker-rules-tells-token-issuers-they-must-disclose-partners',
      mechanism: 'listing-dump',
      chart: { loss: '$500 SIREN buy', extracted: 'tens of millions', recipient: 'partner MMs' },
    },
    {
      date: '2023-10-25',
      amount: 'Unverified',
      amountTone: 'muted',
      headline: 'Withdrawals halted October 2023 — "technical issues"',
      knife: 'Withdrawals fail on the days you need them. The technical issues are seasonal.',
      summary:
        'Binance paused crypto withdrawals during volatile Bitcoin price action, citing technical issues. Pattern repeats: stop trading or withdrawals when conditions become unfavorable to the exchange\'s risk book.',
      sourceLabel: 'CoinDesk',
      sourceUrl:
        'https://www.coindesk.com/business/2023/10/25/binance-crypto-withdrawals-temporarily-unavailable-due-to-technical-issues',
      mechanism: 'withdrawal-freeze',
      chart: { loss: 'your withdraw', pctMove: 'while volatile', tickerFrom: '$10,000', tickerTo: 'locked' },
    },
  ],
}
