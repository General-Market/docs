# The Geometry of Winning

*On how much trading profit is captured by how few, across Polymarket, Pump.fun, and Hyperliquid. An inquiry in three markets and one distribution.*

Last updated: 2026-04-15.

---

## The stat that started it

In December 2025, an on-chain analyst publishing as DeFi Oasis measured every realized trade ever made on Polymarket. One million seven hundred thousand addresses. Seventy percent lost money. Six hundred and sixty-eight addresses — four in every ten thousand — captured $3.7 billion, which is seventy percent of all realized profits on the platform.

The headline wrote itself. *0.04% captures 70%.*

The figure is true. It is also, in the way of all such figures, a simplification disguised as a revelation. What follows is the attempt to check it — against other crypto venues, against a century of retail-trading research, and against the platform underneath every statistic: the wallet, which is not a person; the person, who is not a trader; the trader, who is not a winner for long.

---

## The same shape, three platforms

Pump.fun and Hyperliquid have never published a Polymarket-style concentration figure. They expose enough public data that one can be computed. The method: fit a Pareto distribution to two observed wallet-count thresholds, estimate the profit pool by bucket summation, then ask at what point the cumulative top N wallets reaches 70%.

### Polymarket

- 1,700,000 addresses analyzed.
- 668 addresses with realized profit > $1M.
- $3.7B captured, out of a $5.29B total realized-profit pool.
- **Top 0.04% — one in 2,545 addresses — captures 70%.**

Source: [DeFi Oasis, Dec 2025](https://cryptonews.com/news/70-of-polymarket-traders-lost-money-as-top-0-04-captured-most-profits-research/), covered by [Yellow](https://yellow.com/news/polymarket-data-70-of-traders-lose-money-while-elite-004-captures-dollar37b-in-profits).

### Pump.fun

Dune dashboards by `adam_tehc`, June 2025 snapshot:

- 13,550,000 wallets total.
- 55,296 with profit > $10,000 (0.41%).
- 6,500 with profit > $100,000 (0.048%).
- 293 with profit > $1,000,000 (0.00217%).
- Top single wallet: ~$40M ([The Block](https://www.theblock.co/post/345046/top-pump-fun-traders-profits-near-40-million-as-solana-memecoin-volumes-shrink)).

Pareto fit between the $10K and $1M thresholds gives α = 1.138. Mean profit conditional on being above $10K: ~$82,464. Tail sum: ~$4.56B. Plus an estimated ~$2B from the ~6.7M wallets with positive PnL under $10K. Total pool: **~$6.76B**, with roughly ±$2B uncertainty in the lower tail (this estimate is not derived from disclosed data — see below).

Cumulative capture:

| Top N wallets | $ captured | % of total |
|---|---|---|
| 293 | $1.75B | 26% |
| 6,500 | $3.30B | 49% |
| ~55,000 | ~$4.76B | **70%** |

- **Top 0.41% — one in 245 addresses — captures 70%.**

### Hyperliquid

Leaderboard data via Hyperdash and ASXN:

- 170 addresses with profit > $10M.
- 1,589 with profit > $1M.
- Top trader (White Whale): >$50M.
- Reported profitability rate in the Hyperdash 1,000-sample: ~14%.

Pareto fit gives α = 0.97. Because α < 1, the theoretical mean diverges — a mathematical way of saying the distribution has no center. Bucket summation instead:

| Bucket | Wallets | Avg profit | Subtotal |
|---|---|---|---|
| > $10M | 170 | ~$20M | $3.4B |
| $1M – $10M | 1,419 | ~$3M | $4.3B |
| $100K – $1M | ~13,237 | ~$260K | $3.4B |
| < $100K | ~100K | ~$10K | ~$1.0B |
| **Total** | | | **~$12.1B** |

Cumulative:

| Top N wallets | $ captured | % of total |
|---|---|---|
| 170 | $3.4B | 28% |
| 1,589 | $7.66B | 63% |
| ~4,700 | $8.47B | **70%** |

Against an estimated active-trader base of 500K–1M (midpoint 750K):

- **Top ~0.6% — one in ~160 addresses — captures 70%.**

Sources: [BeInCrypto / Hyperdash](https://beincrypto.com/hyperliquid-traders-profitability/), [ASXN stats](https://stats.hyperliquid.xyz/), [Hyperliquid leaderboard](https://app.hyperliquid.xyz/leaderboard).

---

## The denominator problem

Every headline number divides by a fuzzy count.

Pump.fun's thirteen and a half million wallets include sniper bots, abandoned addresses, one-shot tourists, and individuals running fifty wallets apiece. Hyperliquid's "500K–1M active traders" is an estimate with a factor of two inside it. Polymarket's 1.7M addresses include CREATE2 proxy wallets, accounts that traded once, and VPN-routed Americans who abandoned their seed phrases. These populations are not the same thing.

The statistic "1 in X" performs certainty. The underlying counts do not earn it.

This is not a reason to discard the numbers. It is a reason to notice what they are measuring. The headline "1 in 2,545" on Polymarket is really a statement about *addresses that have interacted with the contract*, not about *humans who have placed a bet*. The distance between those two is the entire game.

---

## The shrinkage factor

Four independent lines of evidence bound the wallet-to-human ratio.

**Documented cluster cases.** Chainalysis and the WSJ, working separately, linked eleven Polymarket wallets to a single French trader known as Théo. Lookonchain identified four wallets owned by the Hyperliquid trader known as The White Whale, and twenty-four Ethereum wallets owned by James Wynn during his PEPE era. A Bitget analysis of Pump.fun launch-sniping identified 4,600 sniper wallets funded by 10,400 deployer wallets in a pattern that implies each operator runs twenty to fifty. The median documented whale runs about four wallets; the tail of the tail runs eleven to twenty-four.

Sources: [Chainalysis on Théo](https://x.com/chainalysis/status/1854584905776431343), [Lookonchain on White Whale](https://x.com/lookonchain/status/1946957494364103135), [Lookonchain on Wynn](https://x.com/lookonchain/status/1927327814694375861), [Bitget sniper analysis](https://www.bitget.com/news/detail/12560604803448).

**Airdrop filtering disclosures.** LayerZero filtered 803,000 sybil addresses from ~6M eligible wallets — ~59% of the shortlist. Arbitrum filtered ~73% of bridgers. Linea flagged ~50% via Nansen clustering. Sybil farmers who went undetected still captured ~40% of tokens distributed across 2023–2024 campaigns (Trusta Labs aggregate). When the filter is honest, half to three-quarters of wallets are masks.

Sources: [LayerZero Medium](https://medium.com/layerzero-official/addressing-sybil-activity-a2f92218ddd3), [Nansen on Arbitrum](https://www.nansen.ai/research/an-on-chain-distribution-model-for-the-arbitrum-community), [Nansen on Linea](https://research.nansen.ai/articles/linea-airdrop-sybil-detection).

**Top-down population estimates.** Polymarket reports monthly active traders in the 350K–700K band per [The Block](https://www.theblock.co/data/decentralized-finance/prediction-markets-and-betting/polymarket-active-traders-monthly) and [Token Terminal](https://tokenterminal.com/explorer/projects/polymarket/metrics/user-mau); cumulative humans likely 600K–700K. Pump.fun's 13.55M wallets, after removing one-shot addresses and estimated 30–50% bot share in the active subset, reduce to ~1.5M–2M plausible humans ([BeInCrypto](https://beincrypto.com/pump-fun-bot-activity-may-be-epidemic/), [Cryptopolitan](https://www.cryptopolitan.com/active-wallets-on-pump-fun-automate-trades/)). Hyperliquid added 609,000 users in 2025 and has ~1.4M cumulative ([Cryptobriefing](https://cryptobriefing.com/hyperliquid-strong-growth-2025-revenue-metrics/)); deposits gate the funnel, so the wallet-to-human ratio is the lowest of the three.

**Protocol-level signals.** Hyperliquid's `subAccounts` info endpoint returns the master-to-child relationship for any address — entity resolution without inference. Polymarket users receive a CREATE2-deterministic proxy wallet owned by either a MetaMask EOA or a Magic.link email; Magic users are 1:1 email-to-proxy by construction. Pump.fun has no account layer at all. Every Solana keypair stands alone; clustering is heuristic or it is nothing.

Sources: [Hyperliquid docs](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint), [Polymarket proxy docs](https://docs.polymarket.com/developers/proxy-wallet).

### Implied shrinkage

| Platform | Average wallet-to-human ratio | Top-tier ratio |
|---|---|---|
| Polymarket | 2.4× – 3× | 4× – 11× |
| Hyperliquid | 1.5× – 2× | 3× – 6× |
| Pump.fun | 7× – 9× | 10× – 50× |

---

## The ranges

Applying the shrinkage factors yields a concentration estimate, with uncertainty.

### Polymarket

- Raw: 1 in 2,545 wallets.
- If shrinkage is uniform across all tiers (2.8×), the ratio is preserved — both numerator and denominator contract proportionally.
- If the top tier clusters more aggressively than the average (closer to the Théo 11× than the Polymarket-average 2.8×), concentration tightens.
- **Low end: 1 in ~2,500 humans. High end: 1 in ~10,000 humans. Central estimate: 1 in ~3,000 to 1 in ~5,000.**

### Hyperliquid

- Raw: 1 in 160 wallets.
- Moderate shrinkage (1.5–2× uniform): ~1 in 300.
- Whales cluster more (assumed 3–6× for top tier): **low end 1 in ~300, high end 1 in ~1,500. Central estimate: 1 in ~500.**
- An alternative denominator of 94,000 HYPE-airdrop-filtered recipients yields 1 in 60, but this figure is a single-moment Nov 2024 snapshot that excludes all post-airdrop traders. It should be read as an upper bound on how concentrated the platform could look under the tightest framing, not as a typical value.

### Pump.fun

- Raw: 1 in 245 wallets to capture 70% of the full profit pool.
- Low-end adjustment (uniform 8× shrinkage): ~1 in 246 humans. The ratio is stable because shrinkage applies on both sides.
- High-end adjustment (heavy bot clustering at the top, modest at the bottom): ~1 in 2,500.
- A narrower question — "who captures the $1M+ tier" — collapses to roughly 50–80 operators. Against an estimated 1.5–2M human base, this is **one in 20,000 to one in 35,000.**

The Pump.fun range is wide because Pump.fun is the only platform of the three with no structural account layer. A hundredfold spread (1 in 245 to 1 in 25,000) is not a failure of analysis; it is the honest confession that the distribution has no stable denominator. When the population itself is mostly machinery, every per-capita statistic becomes a polite fiction.

---

## Summary

| Platform | 70% of profits captured by (wallets) | 70% of profits captured by (humans, central range) | Total realized profit pool |
|---|---|---|---|
| Polymarket | 1 in 2,545 | 1 in 3,000 – 10,000 | $5.29B |
| Hyperliquid | 1 in ~160 | 1 in 300 – 1,500 | ~$12B |
| Pump.fun | 1 in ~245 | 1 in 250 – 25,000 | ~$6.76B |

---

## Compared with classical markets

Four studies of retail trading outside crypto. Different metrics, same distribution.

- **Chague, De-Losso, Giovannetti (2020).** Every individual who day-traded Brazilian equity futures between 2013 and 2015. Of those who persisted over 300 days, 97% lost money. 1.1% earned above Brazilian minimum wage. 0.5% earned above a bank teller's starting salary. [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3423101).

- **Barber, Lee, Liu, Odean (2014).** Taiwan Stock Exchange, fifteen years. Top 1% of day traders generate 50% of day-trading volume. Fewer than 1% predictably earn positive abnormal returns net of fees. Over 80% lose money. [Haas/Berkeley](https://faculty.haas.berkeley.edu/odean/papers/Day%20Traders/Day%20Trade%20040330.pdf).

- **SEBI (2024).** Over ten million Indian retail futures-and-options traders across FY22–FY24. 93% lost money. Aggregate losses: ₹1.8 lakh crore, approximately $21 billion. Proprietary desks and foreign institutional investors captured $8 billion in gross profits, 96–97% of it through algorithmic trading. [SEBI press release](https://www.sebi.gov.in/media-and-notifications/press-releases/sep-2024/updated-sebi-study-reveals-93-of-individual-traders-incurred-losses-in-equity-fando-between-fy22-and-fy24-aggregate-losses-exceed-1-8-lakh-crores-over-three-years_86906.html).

- **ESMA and CFTC disclosures.** Aggregated retail CFD and forex broker reports: 74–89% of clients lose money (ESMA); 70–80% quarterly (CFTC). [Babypips summary](https://www.babypips.com/news/almost-80-percent-of-retail-traders-are-unprofitable).

None of these four publishes a "top X% captures 70%" figure directly. All four converge on the same qualitative finding: a fraction of one percent of participants captures the vast majority of realized trading profit. Crypto did not invent this geometry. It is simply running the experiment faster, with on-chain receipts, in public.

---

## Caveats

- All figures are realized profit only. Unrealized gains — tokens sitting in wallets that have appreciated but not been sold — are excluded.
- Time windows differ. Polymarket = cumulative to Dec 2025. Pump.fun = June 2025 snapshot. Hyperliquid = lifetime leaderboard. Classical studies span 1992–2024.
- Pump.fun data excludes post-bonding Raydium trades per cofounder Alon's public critique.
- The Pump.fun lower-tail profit estimate (~$2B from sub-$10K winners) is not derived from disclosed data. Total pool carries ±$2B uncertainty.
- Hyperliquid bucket averages ($20M, $3M, $260K) are shape-consistent estimates, not empirical means.
- Pareto extrapolation is reliable for α > 1 (Pump.fun, Polymarket). Less so for α < 1 (Hyperliquid), where bucket summation is used.
- Wallet counts overstate unique humans. The shrinkage factor is itself a range, not a point.
- Fees and gas are excluded from realized PnL on all three platforms. Hyperliquid maker rebates in particular are material.
- Survivorship: dead wallets, rugged tokens, and banned accounts may be absent from source datasets.

---

## Methodology (reproducible)

### Core inputs

```
Polymarket:   N_total = 1.7M,   N(>$1M) = 668,        share = 0.70
Pump.fun:     N_total = 13.55M, N(>$10K) = 55,296,    N(>$1M) = 293
Hyperliquid:  N(>$1M) = 1,589,  N(>$10M) = 170,       N_active ≈ 500K–1M
```

### Pareto shape parameter

`α = log(N₁ / N₂) / log(x₂ / x₁)` — from two observed threshold counts.

### Mean above threshold (α > 1)

`E[X | X > L] = α · L / (α − 1)`

### Cumulative capture

Sum from top bucket downward until target share of total profit pool is reached. The wallet count at crossing is the answer.

### Within-tail concentration

`share(p) = p^(1 − 1/α)` for the top p-fraction of the Pareto tail.

---

## Sources

### Primary

- [DeFi Oasis study summary — Cryptonews](https://cryptonews.com/news/70-of-polymarket-traders-lost-money-as-top-0-04-captured-most-profits-research/)
- [DeFi Oasis study summary — Yellow](https://yellow.com/news/polymarket-data-70-of-traders-lose-money-while-elite-004-captures-dollar37b-in-profits)
- [Dune: Pump.Fun Alpha Wallets](https://dune.com/adam_tehc/pump-fun-alpha-wallets)
- [Dune: Pump.Fun Wallet Analysor](https://dune.com/adam_tehc/pumpfun-wallet-analysor)
- [Cointelegraph on Pump.fun realized-profit distribution](https://cointelegraph.com/news/pump-fun-crypto-traders-majority-do-not-realize-profits-dune-data)
- [The Block — top Pump.fun trader ~$40M](https://www.theblock.co/post/345046/top-pump-fun-traders-profits-near-40-million-as-solana-memecoin-volumes-shrink)
- [BeInCrypto — 86% of Hyperliquid traders unprofitable](https://beincrypto.com/hyperliquid-traders-profitability/)
- [ASXN Hyperliquid stats](https://stats.hyperliquid.xyz/)
- [Hyperliquid leaderboard](https://app.hyperliquid.xyz/leaderboard)
- [Hyperliquid info API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint)

### Entity resolution

- [Chainalysis — 11 wallets linked to Théo](https://x.com/chainalysis/status/1854584905776431343)
- [Bloomberg — Trump Whale $85M haul](https://www.bloomberg.com/news/articles/2024-11-07/trump-whale-s-polymarket-haul-boosted-to-85-million-in-new-analysis)
- [Lookonchain — White Whale 4 wallets](https://x.com/lookonchain/status/1946957494364103135)
- [Lookonchain — Wynn 24 wallets](https://x.com/lookonchain/status/1927327814694375861)
- [Bitget — Pump.fun sniper analysis](https://www.bitget.com/news/detail/12560604803448)

### Airdrop sybil disclosures

- [LayerZero — Addressing Sybil Activity](https://medium.com/layerzero-official/addressing-sybil-activity-a2f92218ddd3)
- [Nansen — Arbitrum distribution model](https://www.nansen.ai/research/an-on-chain-distribution-model-for-the-arbitrum-community)
- [Nansen — Linea sybil detection](https://research.nansen.ai/articles/linea-airdrop-sybil-detection)
- [X-explore — Arbitrum sybil analysis](https://mirror.xyz/x-explore.eth/AFroG11e24I6S1oDvTitNdQSDh8lN5bz9VZAink8lZ4)

### Population estimates

- [The Block — Polymarket MAU](https://www.theblock.co/data/decentralized-finance/prediction-markets-and-betting/polymarket-active-traders-monthly)
- [Token Terminal — Polymarket MAU](https://tokenterminal.com/explorer/projects/polymarket/metrics/user-mau)
- [Reuters via Yahoo — Polymarket $3B / 338K traders](https://finance.yahoo.com/news/polymarket-handles-3b-volume-polygon-174742364.html)
- [Cryptobriefing — Hyperliquid 609K new users 2025](https://cryptobriefing.com/hyperliquid-strong-growth-2025-revenue-metrics/)
- [PANews — HYPE airdrop 94K recipients](https://www.panewslab.com/en/articles/1m37x8gd)
- [BeInCrypto — Pump.fun bot-share epidemic](https://beincrypto.com/pump-fun-bot-activity-may-be-epidemic/)
- [Cryptopolitan — 93 of top 100 Pump.fun wallets automated](https://www.cryptopolitan.com/active-wallets-on-pump-fun-automate-trades/)

### Classical-market studies

- [Chague, De-Losso, Giovannetti — Day Trading for a Living?](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3423101)
- [Barber, Lee, Liu, Odean — Do Individual Day Traders Make Money?](https://faculty.haas.berkeley.edu/odean/papers/Day%20Traders/Day%20Trade%20040330.pdf)
- [SEBI — 93% of Indian F&O traders lost money FY22–FY24](https://www.sebi.gov.in/media-and-notifications/press-releases/sep-2024/updated-sebi-study-reveals-93-of-individual-traders-incurred-losses-in-equity-fando-between-fy22-and-fy24-aggregate-losses-exceed-1-8-lakh-crores-over-three-years_86906.html)
- [Babypips — ESMA and CFTC retail loss aggregates](https://www.babypips.com/news/almost-80-percent-of-retail-traders-are-unprofitable)

### Tooling

- [Bubblemaps — cluster visualization](https://bubblemaps.io/)
- [Arkham Intelligence — entity labels](https://intel.arkm.com/)
- [Polymarket proxy wallet docs](https://docs.polymarket.com/developers/proxy-wallet)

---

*A small fraction of participants captures the majority of realized trading profit. The shape is not new. The receipts are.*
