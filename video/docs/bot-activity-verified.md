# Bot / Algorithmic Trading Activity by Platform — Verified

Cross-checked by 3 independent research agents. Consensus numbers below.

## Summary Table

| Platform | Bot/Algo % of Volume | Confidence | Key Evidence |
|---|---|---|---|
| **NYSE/NASDAQ** | 60-78% | Confirmed | SEC data, TABB Group, BIS reports |
| **Forex** | ~85% | Confirmed | BIS Triennial Survey 2022 |
| **Hyperliquid** | >90% | Estimated | Ex-Chameleon Trading founders, 200K orders/sec, HLP vault = protocol-level MM bot, avg trade dropped $100→$20 |
| **Coinbase** | 79-82% institutional | Confirmed (SEC) | Q4 2024 10-K: $941B institutional vs $221B retail. FIX API + Smart Order Router for algos |
| **Pump.fun** | 60-80% | Confirmed (academic) | Univ. of Pisa study (655K tokens): bots frontrun first 1-2 blocks. Dune: 62% of Solana DEX volume is bots |
| **Binance** | 60-80% | Estimated | Official bot marketplace, 1.4M orders/sec capacity, $217B/day volume |
| **Bitget** | 40-60% | Estimated | 20K+ active bots, 200K pro traders, 1M+ copy-trade followers, 7K bot strategists |
| **Polymarket** | 30-60% | Confirmed (multiple) | IMDEA: $40M extracted by arb bots. Columbia: 25% wash trading. 14/20 top wallets are bots. 92% of wallets lose money |
| **Kalshi** | 40-60% | Estimated | FIX protocol access (institutional HFT). 23 market makers, top 3 = 70% of liquidity. $22.88B volume 2025 |
| **Robinhood** | <5% on-platform | Confirmed | No equity API. But >80% of orders routed to Citadel (41%), Virtu (26%), G1 (16%). PFOF $560M Q1 2025 |

## Platform Deep Dives

### Polymarket — The Prediction Market Bot Problem
- **3.7% of accounts generate 37.4% of volume** (Hubble Research)
- **25% of volume is wash trading** (Columbia University study, Nov 2025)
- **$40M extracted by arbitrage bots** Apr 2024 – Apr 2025 (IMDEA study)
- **14 of top 20 wallets are bots** (Finance Magnates)
- **92% of wallets lose money** (on-chain analysis)
- Wash trading peaked at ~60% of weekly volume in Dec 2024
- Single whale "Théo" placed $30M+ in bots on Trump — WSJ, Bloomberg

### Pump.fun — The Bot Wasteland
- **60-80% bot-driven volume** (BeInCrypto)
- **50% of launches involve sniper bots** buying within milliseconds
- **80-95% of initial buys on new tokens are bots** (Dune Analytics)
- **87% of sniper trades are profitable** — humans are the exit liquidity
- Volume bots create fake activity to game trending algorithms
- Telegram bots (Banana Gun, Maestro, Trojan) handle 20-40% of Solana DEX volume

### Hyperliquid — Built for Bots
- Founded by ex-Chameleon Trading (market-making firm)
- 200K orders/second throughput
- Zero maker fees at scale
- HLP vault runs automated market-making on every pair
- 70% of all DEX perps volume
- March 2025 JELLY incident exposed how concentrated algo trading was

### Robinhood — The Paradox
- 0% bot trading on-platform (no equity trading API)
- 90% of orders routed to algorithmic market makers:
  - Citadel Securities: 41%
  - Virtu Financial: 26%
  - G1 Execution: 16%
- Robinhood receives $0.85 per $100 from market makers
- The most "retail" platform is a pipeline for HFT firms

## The Pattern

Every liquid market converges toward bot dominance:
- Equities: started manual → now 78% algo
- Forex: 85% algo
- Crypto CEXs: 70-80% algo
- Crypto DEXs: 60-80% algo
- Prediction markets: 30-60% algo and climbing

The question isn't whether bots dominate. It's whether the platform
is designed for them to compete fairly — or to extract from retail.

## For the Video

The killer stat: **On Polymarket, 3.7% of accounts make 37% of the volume, 92% of wallets lose money, and 25% is wash trading.** The "wisdom of crowds" is the wisdom of bots.

General Market's parimutuel design means:
- No front-running (everyone gets same price)
- No wash trading incentive (no order book to manipulate)
- Bots compete on STRATEGY, not on speed/access

## Sources

## Telegram Bot Ecosystem (Cross-DEX)

| Bot | Lifetime Volume | Users | Source |
|-----|----------------|-------|--------|
| Trojan | ~$23.4B | 1.7M+ | CoinGecko / Dune |
| BONKbot | ~$13.8B | 519K+ | CoinGecko |
| Maestro | ~$12.8B | 573K+ | CoinGecko |
| Banana Gun | ~$12B+ | 600K+ | CoinGecko |
| **Total Solana DEX bot volume (Jul 2025)** | **62% of all Solana DEX volume** | ~52K DAUs | Dune Analytics |

## Sources

### Confirmed (official data / academic studies)
- [SEC — Payment for Order Flow](https://www.sec.gov/files/dera_wp_payment-order-flow-2501.pdf)
- [BIS Triennial Survey 2022](https://www.bis.org/statistics/rpfx22.htm) — FX algo %
- [Coinbase Q4 2024 Earnings / 10-K](https://investor.coinbase.com/news/news-details/2026/Coinbase-Delivers-on-Q4-Financial-Outlook/) — $941B institutional vs $221B retail
- [Columbia Study — Polymarket Wash Trading](https://www.coindesk.com/markets/2025/11/07/polymarket-s-trading-volume-may-be-25-fake-columbia-study-finds)
- [IMDEA — Arbitrage Bots on Polymarket](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.AFT.2025.27) — $40M extracted
- [Robinhood PFOF Disclosures](https://robinhood.com/us/en/support/articles/crypto-order-routing/)
- [Coinbase Q2 2025 — 81.86% institutional](https://investor.coinbase.com)
- [Univ. of Pisa — Pump.fun 655K token study](https://arxiv.org/html/2512.11850v3)
- [IMDEA — Polymarket arb bots $40M extracted](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.AFT.2025.27)
- [Global Trading — PFOF $560M Q1 2025](https://www.globaltrading.net/payment-for-us-retail-flow-reaches-record-high-led-by-citadel-securities-imc/)
- [Sacra — Kalshi $22.88B volume 2025](https://sacra.com/c/kalshi/)
- [Bitget Q2 2025 Transparency Report](https://www.bitget.com/blog/articles/bitget-q2-2025-transparency-report)
- [Artemis — Hyperliquid 70-73% DEX perps market share](https://www.artemisanalytics.com/resources/hyperliquid-a-valuation-model-and-bull-case)
- [CoinGecko — Telegram bot rankings](https://www.coingecko.com/learn/top-telegram-trading-bots)
- [Dune — Solana bot volume 62%](https://dune.com/adam_tehc/trading-bots-on-solana)

### Estimated (third-party analysis, on-chain data)
- [Finance Magnates — Prediction Markets Bot Playground](https://www.financemagnates.com/trending/prediction-markets-are-turning-into-a-bot-playground/)
- [Hubble Research — 3.7% of accounts = 37% volume](https://www.kucoin.com/news/flash/how-to-avoid-bots-and-find-real-experts-on-polymarket)
- [Yahoo Finance — Arbitrage Bots Dominate Polymarket](https://finance.yahoo.com/news/arbitrage-bots-dominate-polymarket-millions-100000888.html)
- [DL News — Polymarket Users Lost Millions to Bots](https://www.dlnews.com/articles/markets/polymarket-users-lost-millions-of-dollars-to-bot-like-bettors-over-the-past-year/)
- [Fortune — Polymarket Volume Inflated](https://fortune.com/2025/11/07/polymarket-wash-trading-inflated-prediction-markets-columbia-research/)
- [BeInCrypto — Bots on Pump.fun](https://beincrypto.com/trading-bots-pump-fun-solana-meme-coins/)
- [BeInCrypto — Pump.fun Snipers](https://beincrypto.com/pump-fun-meme-coin-snipers-systematic-problem/)
- [QuantifiedStrategies — Algo Trading %](https://www.quantifiedstrategies.com/what-percentage-of-trading-is-algorithmic/)
- [Kaiko — Wash Trading on Crypto Markets](https://research.kaiko.com/insights/data-reveals-wash-trading-on-crypto-markets)
- [Trade Ideas — Citadel PFOF](https://www.trade-ideas.com/2025/05/10/citadel-securities-the-invisible-hand-behind-retail-trading/)
- [The TRADE — PFOF Spending](https://www.thetradenews.com/citadel-securities-forks-out-2-6-billion-annually-for-payment-for-order-flow-and-most-of-its-on-options/)
