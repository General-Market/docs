# The Rented Orderbook
## What prediction markets pay to look like markets

There is no order book on Polymarket. There is a paid actor pretending to be one.

This is not a metaphor. The depth on Kalshi and Polymarket is not the result of natural two-sided flow. It is a service the venue purchases from a small number of professional firms, paid in cash on a daily schedule. Strip the payment and the depth disappears. The book widens. The thing called a market becomes a placeholder.

Below is what that service costs, measured against every other asset class, sourced from primary documentation.

---

## What it costs to manufacture $1,000 of depth, by asset class

| Asset class                          |   Daily / $1K depth | Mechanism |
|--------------------------------------|--------------------:|-----------|
| US equities (NMS, Nasdaq)            |             ~$0 net | Maker rebate ≈ taker fee, self-funding |
| Coinbase / Binance spot              |                  $0 | No structural subsidy; maker fee bottoms at 0% |
| FX EUR/USD (EBS)                     |    ~$0.63 spread cap | 0.63 pip × ~100x daily turnover |
| Hyperliquid (DEX)                    |              ~$0.30 | Maker rebate −0.003% × ~10 turns/day |
| dYdX v4 (DEX)                        |              ~$2.00 | $1.5M/mo trader rewards across ~$50M depth |
| **Polymarket — structural**          |              **~$22** | $80M/yr MM rebate / ~$10M aggregate depth |
| **Kalshi — structural + LIP**        |              **~$46** | ~$250M/yr / ~$15M aggregate depth |
| **Polymarket — premium event tier**  |          **$80–160** | Champions League QF: $24K over 2 days on ~$75K depth |

Sources at the bottom. Aggregate-depth figures for Polymarket and Kalshi are estimated; everything else is direct.

The number that should disturb anyone reading this is the gap between the equities row and the prediction-market row. **Polymarket pays roughly 100 to 1,000 times more per dollar of standing depth than any centralized exchange in any other asset class.**

This is not because the engineering is harder. It is because the takers are smarter. Every trader who arrives at a Polymarket book has a thesis about a discrete event that resolves in days. The market maker quotes blind against that thesis. The compensation has to be enormous because the position is, structurally, a losing one.

---

## Why the model is unsustainable

The fee structure on both venues now resembles a closed loop.

1. Takers pay a fee per trade. Polymarket: 0.75–1.80% peak. Kalshi: 1.75% peak.
2. The venue rebates 20–30% of that fee back to makers as a depth payment.
3. The market maker uses the rebate to offset adverse selection from the same takers.

The takers are paying, indirectly, to be hunted.

Three pressures break this loop over time.

**The taker pool depletes.** Bloomberg documented in April 2026 that 84% of Polymarket wallets are unprofitable. Add a 1–2% fee on top of a 1.12% structural maker edge, and the friction per round-trip approaches 3%. Casinos work because losers return. Markets where every round-trip costs 3% deplete the pool faster than they replenish it.

**The market makers concentrate.** Top three firms hold ~70% of Kalshi's election liquidity. SIG provides depth to Kalshi, Polymarket, and Robinhood's new venue simultaneously. The depth is rented from a counterparty whose loyalty is mercenary. If one venue offers a richer rebate next quarter, the book migrates overnight.

**The categories don't scale.** Kalshi takes 89% of fee revenue from sports. Polymarket takes most of its depth from elections, which arrive every two years. The unit economics work at peak volume. They do not survive the regression to median activity.

The verdict is not that these venues will collapse. They will not. The verdict is narrower. **Order-book prediction markets cannot sustain themselves without a recurring institutional bribe, paid out of fee revenue, paid back to a small cartel of makers, hidden from the trader who funds it.**

That is a business. It is not a market.

---

## The fix — GeneralMarket Vision

GeneralMarket does not run an order book. It runs a parimutuel pool, sealed and round-based.

The mechanics are simple enough that the entire economic stack of the previous section disappears.

- Each round, all bets accumulate into a pool.
- The pool is split among winners, proportional to stake.
- No quote. No spread. No market maker. No subsidy.
- The pool itself is the liquidity.

| Cost line on CLOB venues                  | Vision |
|-------------------------------------------|--------|
| Maker rebate (~22.5% of taker fees)       | $0 |
| Per-event campaign incentives             | $0 |
| Resting-quote payments (LIP)              | $0 |
| Volume rebates (VIP)                      | $0 |
| Single-MM concentration risk              | None — no MM exists |
| Adverse selection toll on retail          | None — winners pay losers directly |

The retail trader does not pay 1–2% per round-trip to fund a hidden cartel. The trader pays nothing to a market maker because there is no market maker. The pool resolves on chain. The contract distributes. The protocol takes a small cut at settlement and that is the entire fee structure.

The cost of running a Vision round is the cost of a smart-contract execution. The cost of running a Polymarket market is roughly $22 per $1,000 of depth per day, every day, perpetually.

One model has unit economics. The other has a subsidy.

---

## What this means for new market types

The order-book economics force a particular shape onto prediction-market venues. They can only afford to run perhaps 1,500–4,000 well-supported markets at current spend. Beyond that ceiling, markets exist but become tail — wide spreads, no depth, no real price discovery. This is exactly what is observed: Polymarket lists tens of thousands and supports a few hundred.

Parimutuel removes the ceiling. The cost of listing a market is the cost of deploying it. Niche markets, regional markets, short-cycle markets, derivative-of-derivative markets — none require a per-market subsidy budget. The pool funds the pool.

The result is not a tighter version of Polymarket. It is a different category of product.

---

## Sources

| # | Source | Used for |
|---|--------|---------|
| 1 | [Nasdaq US Equities Price List](https://www.nasdaqtrader.com/Trader.aspx?id=PriceListTrading2) | Maker rebate / taker fee values |
| 2 | [Binance Spot Fee Schedule](https://www.binance.com/en/fee/spotMaker) | Centralized crypto maker fee tiers |
| 3 | [Coinbase Advanced Fees](https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees) | Centralized crypto fee structure |
| 4 | [Hyperliquid Fees](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees) | DEX maker rebate |
| 5 | [dYdX LP Rewards](https://www.dydx.foundation/blog/liquidity-provider-rewards) | DEX LP economics |
| 6 | [CME EBS Q1 2024](https://www.cmegroup.com/articles/2024/strengthening-fx-primary-liquidity-on-ebs.html) | FX top-of-book spread |
| 7 | [BIS Triennial Survey 2022](https://www.bis.org/statistics/rpfx22_fx.htm) | FX volume |
| 8 | [Polymarket Liquidity Rewards](https://docs.polymarket.com/market-makers/liquidity-rewards) | PM per-event subsidy tiers |
| 9 | [Polymarket Maker Rebates](https://docs.polymarket.com/market-makers/maker-rebates) | 20–25% rebate split, daily USDC payout |
| 10 | [Polymarket Trading Fees](https://docs.polymarket.com/trading/fees) | Taker fee formula |
| 11 | [Polymarket CLOB v2 Upgrade](https://help.polymarket.com/en/articles/14762452-polymarket-exchange-upgrade-april-28-2026) | $1M launch pool, V2 mechanics |
| 12 | [Kalshi Liquidity Incentive Program](https://help.kalshi.com/en/articles/13823851-liquidity-incentive-program) | $10–$1,000/day per market |
| 13 | [Kalshi Volume Incentive Program](https://help.kalshi.com/en/articles/13823850-volume-incentive-program) | $0.005/contract cap |
| 14 | [Kalshi CFTC Filing — Aug 2025](https://kalshi-public-docs.s3.amazonaws.com/regulatory/notices/Volume%20and%20Liquidity%20Incentive%20Program%20-%20August%202025.pdf) | Regulatory primary source |
| 15 | [Becker — Prediction Market Microstructure](https://www.jbecker.dev/research/prediction-market-microstructure) | 72.1M Kalshi trades, 1.12% taker loss |
| 16 | [Bloomberg — Apr 2026](https://www.bloomberg.com/news/articles/2026-04-28/most-prediction-market-traders-are-losing-money-while-bots-rack-up-gains) | 84% unprofitable wallets |
| 17 | [Multicoin — Adverse Selection](https://multicoin.capital/2026/02/17/adverse-selection-rules-everything-around-me/) | 3-second order-delay rationale |
| 18 | [TUM Thesis — Polymarket AMM](https://www.cs.cit.tum.de/fileadmin/w00cfj/sebis/_my_direct_uploads/20250903_Parshant_MA_Thesis.pdf) | 26% LPs profitable, $400K+ IL |
| 19 | [Kalshi News — SIG Liquidity Multiplier](https://news.kalshi.com/p/liquid-prediction-markets-are-finally-here) | "30x previous liquidity," concentration |
| 20 | [Stratechery — Mansour Interview](https://stratechery.com/2026/an-interview-with-kalshi-ceo-tarek-monsour-about-prediction-markets/) | "95% from individuals" framing |

Estimates marked **[est]** in the body are derived from the cited primary sources. Aggregate book depth on Polymarket and Kalshi is not publicly disclosed and is order-of-magnitude only. Annual MM-spend totals for both venues are derived from disclosed program rules and announcements; neither venue publishes a consolidated subsidy budget.
