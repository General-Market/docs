# The Rented Orderbook
## What prediction markets pay to look like markets

There is no order book on Polymarket — there is a paid actor pretending to be one. Depth on Kalshi and Polymarket is not natural two-sided flow but a service the venue purchases from a small cartel of professional firms, paid in cash on a daily schedule; strip the payment and the depth disappears.

Below is what that service costs against every other asset class, sourced from primary documentation.

---

## What it costs to manufacture $1,000 of depth, by asset class

| Asset class | Daily / $1K depth | Mechanism |
|---|---:|---|
| US equities (NMS, Nasdaq) | ~$0 net | Maker rebate ≈ taker fee, self-funding |
| Coinbase / Binance spot | $0 | No structural subsidy; maker fee bottoms at 0% |
| FX EUR/USD (EBS) | ~$0.63 | 0.63 pip × ~100x daily turnover |
| Hyperliquid (DEX) | ~$0.30 | Maker rebate −0.003% × ~10 turns/day |
| dYdX v4 (DEX) | ~$2.00 | $1.5M/mo trader rewards across ~$50M depth |
| **Polymarket — structural** | **~$22** | $80M/yr MM rebate / ~$10M aggregate depth |
| **Kalshi — structural + LIP** | **~$46** | ~$250M/yr / ~$15M aggregate depth |
| **Polymarket — premium event** | **$80–160** | Champions League QF: $24K over 2 days on ~$75K depth |

**Polymarket pays roughly 100 to 1,000 times more per dollar of standing depth than any centralized exchange in any other asset class.** The reason is structural and we documented it separately: every taker arrives with a thesis about a discrete event resolving in days, and the market maker quotes blind against that thesis. Full math — who takes the 2–5% per trade and why — in [How Much Do Insiders Take From You on Polymarket?](../../insider/MEGA_REPORT.md), a synthesis of 192 academic papers, and [The Drag Study](../../insider/THE_70_PERCENT_STUDY.md), drawing on 200.

---

## Why the model is unsustainable

The fee structure on both venues is a closed loop: takers pay a fee per trade (Polymarket 0.75–1.80% peak, Kalshi 1.75% peak), the venue rebates 20–30% of that fee back to makers, and the market maker uses the rebate to offset adverse selection from the same takers. The takers are paying, indirectly, to be hunted.

Three pressures break this loop over time.

**The taker pool depletes.** Bloomberg documented in April 2026 that 84% of Polymarket wallets are unprofitable, and adding 1–2% fees on top of the structural maker edge pushes friction per round-trip toward 3% — casinos work because losers return, but markets where every round-trip costs 3% deplete the pool faster than they replenish it.

**The market makers concentrate.** Top three firms hold ~70% of Kalshi's election liquidity, and SIG provides depth to Kalshi, Polymarket, and Robinhood's new venue simultaneously — depth is rented from a counterparty whose loyalty is mercenary and migrates overnight when a richer rebate appears.

**The categories don't scale.** Kalshi takes 89% of fee revenue from sports and Polymarket takes most of its depth from elections every two years; the unit economics work at peak volume but not at the median.

Order-book prediction markets cannot sustain themselves without a recurring institutional bribe, paid out of fee revenue, paid back to a small cartel of makers, hidden from the trader who funds it. That is a business, not a market.

---

## The fix — GeneralMarket Vision

Vision does not run an order book; it runs a parimutuel pool, sealed and round-based — each round all bets accumulate into a pool, the pool is split among winners proportional to stake, and there is no quote, no spread, no market maker, and no subsidy. The pool itself is the liquidity.

| Cost line on CLOB venues | Vision |
|---|---|
| Maker rebate (~22.5% of taker fees) | $0 |
| Per-event campaign incentives | $0 |
| Resting-quote payments (LIP) | $0 |
| Volume rebates (VIP) | $0 |
| Single-MM concentration risk | None — no MM exists |
| Adverse selection toll on retail | None — winners pay losers directly |

The cost of running a Vision round is the cost of a smart-contract execution; the cost of running a Polymarket market is roughly $22 per $1,000 of depth per day, perpetually. One model has unit economics. The other has a subsidy.

---

## What this means for new market types

Order-book economics force a shape onto prediction-market venues: they can only afford 1,500–4,000 well-supported markets at current spend, with everything beyond becoming tail — wide spreads, no depth, no real price discovery (which is exactly why Polymarket lists tens of thousands and supports a few hundred). Parimutuel removes the ceiling because the cost of listing a market is the cost of deploying it, so niche, regional, short-cycle, and derivative-of-derivative markets need no per-market subsidy budget.

The result is not a tighter version of Polymarket. It is a different category of product.

---

## Sources

| # | Source | Used for |
|---|---|---|
| 1 | [Nasdaq US Equities Price List](https://www.nasdaqtrader.com/Trader.aspx?id=PriceListTrading2) | Maker rebate / taker fee values |
| 2 | [Binance Spot Fee Schedule](https://www.binance.com/en/fee/spotMaker) | Centralized crypto maker fee tiers |
| 3 | [Coinbase Advanced Fees](https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees) | Centralized crypto fee structure |
| 4 | [Hyperliquid Fees](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees) | DEX maker rebate |
| 5 | [dYdX LP Rewards](https://www.dydx.foundation/blog/liquidity-provider-rewards) | DEX LP economics |
| 6 | [CME EBS Q1 2024](https://www.cmegroup.com/articles/2024/strengthening-fx-primary-liquidity-on-ebs.html) | FX top-of-book spread |
| 7 | [Polymarket Liquidity Rewards](https://docs.polymarket.com/market-makers/liquidity-rewards) | PM per-event subsidy tiers |
| 8 | [Polymarket Maker Rebates](https://docs.polymarket.com/market-makers/maker-rebates) | 20–25% rebate split, daily USDC payout |
| 9 | [Polymarket Trading Fees](https://docs.polymarket.com/trading/fees) | Taker fee formula |
| 10 | [Kalshi Liquidity Incentive Program](https://help.kalshi.com/en/articles/13823851-liquidity-incentive-program) | $10–$1,000/day per market |
| 11 | [Kalshi Volume Incentive Program](https://help.kalshi.com/en/articles/13823850-volume-incentive-program) | $0.005/contract cap |
| 12 | [Kalshi News — SIG Liquidity](https://news.kalshi.com/p/liquid-prediction-markets-are-finally-here) | "30x previous liquidity," concentration |
| 13 | [Becker — Prediction Market Microstructure](https://www.jbecker.dev/research/prediction-market-microstructure) | 72.1M Kalshi trades, 1.12% taker loss |
| 14 | [Bloomberg — Apr 2026](https://www.bloomberg.com/news/articles/2026-04-28/most-prediction-market-traders-are-losing-money-while-bots-rack-up-gains) | 84% unprofitable wallets |
| L1 | [insider/MEGA_REPORT.md](../../insider/MEGA_REPORT.md) | 192-paper synthesis, retail loses 2–5%/trade |
| L2 | [insider/THE_70_PERCENT_STUDY.md](../../insider/THE_70_PERCENT_STUDY.md) | 200-paper drag study, compounded loss |

Estimates marked **[est]** are derived from the cited primary sources. Aggregate book depth on Polymarket and Kalshi is not publicly disclosed and is order-of-magnitude only.
