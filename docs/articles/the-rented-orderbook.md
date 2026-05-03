# The Exchange Polymarket Is Becoming
## A familiar story told one more time

---

### I. The Boom

April 2026 was a record month. Kalshi cleared $14.81 billion in volume; Polymarket cleared $9.01 billion. The two venues together moved twenty-four billion dollars of bets in thirty days, which is more than the entire prediction-market industry transacted in the four years before. The valuations track the volume — Polymarket at $8B, Kalshi at $5B — and a third venue (Robinhood × Susquehanna) is being built to enter the same room.

The growth is real. The product is real. Something is happening.

---

### II. The Hood

Open the hood and the engine is familiar. Two firms write most of the quotes. The takers pay a fee on every trade. The venue rebates twenty-five cents of every fee dollar back to the same firms that wrote the quote. The book is tight because someone is paying for the book to be tight, and that someone is the trader who arrived to bet.

This is how the engine works. This is how all the other engines worked.

---

### III. The Cost

Here is what each market structure pays to keep its depth alive, per thousand dollars of book, per day. The numbers come from primary sources — exchange fee schedules, CFTC filings, venue help-center articles.

| Asset class | Daily / $1K depth | Mechanism |
|---|---:|---|
| US equities (NMS, Nasdaq) | ~$0 net | Maker rebate ≈ taker fee, self-funding |
| Coinbase / Binance spot | $0 | No structural subsidy; maker fee bottoms at 0% |
| FX EUR/USD (EBS) | ~$0.63 | 0.63 pip × ~100x daily turnover |
| Hyperliquid (DEX) | ~$0.30 | Maker rebate −0.003% × ~10 turns/day |
| dYdX v4 (DEX) | ~$2.00 | $1.5M/mo trader rewards / ~$50M depth |
| **Polymarket — structural** | **~$22** | $80M/yr MM rebate / ~$10M aggregate depth |
| **Kalshi — structural + LIP** | **~$46** | ~$250M/yr / ~$15M aggregate depth |
| **Polymarket — premium event** | **$80–160** | Champions League QF: $24K over 2 days on ~$75K depth |

Polymarket pays roughly one hundred to one thousand times more per dollar of depth than any centralized exchange in any other asset class. The reason is structural and we documented it elsewhere in [How Much Do Insiders Take From You on Polymarket?](../../insider/MEGA_REPORT.md) (synthesis of 192 papers) and [The Drag Study](../../insider/THE_70_PERCENT_STUDY.md) (200). Every taker on a prediction market arrives with a thesis about an event resolving in days; the market maker quotes blind against that thesis; the compensation has to be enormous because the position is structurally a losing one.

---

### IV. The Graveyard

This is where the story stops being new.

Augur shipped a CLOB prediction market in 2018; by 2020 the books were empty and the team had migrated to AMMs. Veil paid market makers out of pocket to wrap Augur and shut down nine months after launching. Gnosis Conditional Tokens — same architecture, different brand, empty. PredictIt — empty before the regulators arrived. The 0x relayer wave (IDEX, Radar, Paradex, Hashflow) shipped CLOB DEXes with maker rebates and almost none survive. Serum had Sam's money and Solana's speed, and when one of those disappeared the order book disappeared with it. Polymarket's own AMM era (2020-2023) is in a TUM master's thesis: 26% of LPs profitable, more than $400K of impermanent loss documented, the team migrated to CLOB to stop the bleeding. Kalshi spent its first three years with books so thin the CEO admitted publicly that liquidity was "the most elusive challenge" the category had failed to solve — until Susquehanna walked in with a thirty-times multiplier on depth and the spreads tightened the same day.

The pattern is the same in every case: build a CLOB, subsidize the makers, run out of money or run out of takers, die. The script does not depend on the team. It depends on the math.

---

### V. The Closed Loop

The trader pays the fee, the fee funds the rebate, the rebate funds the maker, and the maker uses the rebate to absorb the trader's loss. The trader is paying, indirectly, to be hunted.

Bloomberg measured 84% of Polymarket wallets unprofitable in April 2026, before any fee. The microstructure literature measured another 1.12% loss to the maker before any fee. Stack the new 1–2% taker fee on top and friction per round-trip approaches three percent. Casinos work because losers return; markets where every round-trip costs three percent deplete the pool faster than they replenish it.

---

### VI. The Fix

GeneralMarket Vision does not run an order book — it runs a parimutuel pool, sealed and round-based, in which all bets accumulate into a single pool, the pool is split among winners proportional to stake, and there is no quote, no spread, no market maker, no subsidy. The pool itself is the liquidity.

| Cost line on CLOB venues | Vision |
|---|---|
| Maker rebate (~22.5% of taker fees) | $0 |
| Per-event campaign incentives | $0 |
| Resting-quote payments (LIP / VIP) | $0 |
| Single-MM concentration risk | None — no MM exists |
| Adverse selection toll on retail | None — winners pay losers directly |

The cost of running a Vision round is the cost of a smart-contract execution. The cost of running a Polymarket market is twenty-two dollars per thousand of depth per day, perpetually, paid to a counterparty who can leave for a richer rebate next quarter.

---

### VII. The Ending Already Written

Polymarket is not failing. They are doing every operational thing well — growing volume, securing partnerships, raising at higher valuations. None of that contradicts the shape of the curve. Every venue in the graveyard was doing well, until it was not. The shape is determined by the closed loop, and the closed loop has not changed.

The asset class needs to outgrow the engine that built it. Vision is what that looks like.

One model has unit economics. The other has a subsidy.

---

## Sources

| # | Source | Used for |
|---|---|---|
| 1 | [Nasdaq US Equities Price List](https://www.nasdaqtrader.com/Trader.aspx?id=PriceListTrading2) | Maker rebate / taker fee values |
| 2 | [Binance Spot Fee Schedule](https://www.binance.com/en/fee/spotMaker) | Centralized crypto fee tiers |
| 3 | [Coinbase Advanced Fees](https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees) | Centralized crypto fee structure |
| 4 | [Hyperliquid Fees](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees) | DEX maker rebate |
| 5 | [dYdX LP Rewards](https://www.dydx.foundation/blog/liquidity-provider-rewards) | DEX LP economics |
| 6 | [CME EBS Q1 2024](https://www.cmegroup.com/articles/2024/strengthening-fx-primary-liquidity-on-ebs.html) | FX top-of-book spread |
| 7 | [Polymarket Liquidity Rewards](https://docs.polymarket.com/market-makers/liquidity-rewards) | Per-event subsidy tiers |
| 8 | [Polymarket Maker Rebates](https://docs.polymarket.com/market-makers/maker-rebates) | 20–25% rebate split |
| 9 | [Polymarket Trading Fees](https://docs.polymarket.com/trading/fees) | Taker fee formula |
| 10 | [Kalshi Liquidity Incentive Program](https://help.kalshi.com/en/articles/13823851-liquidity-incentive-program) | $10–$1,000/day per market |
| 11 | [Kalshi News — SIG Liquidity](https://news.kalshi.com/p/liquid-prediction-markets-are-finally-here) | "30x previous liquidity" |
| 12 | [Stratechery — Mansour Interview](https://stratechery.com/2026/an-interview-with-kalshi-ceo-tarek-monsour-about-prediction-markets/) | "Most elusive challenge" quote |
| 13 | [Becker — PM Microstructure](https://www.jbecker.dev/research/prediction-market-microstructure) | 72.1M trades, 1.12% taker loss |
| 14 | [Bloomberg — Apr 2026](https://www.bloomberg.com/news/articles/2026-04-28/most-prediction-market-traders-are-losing-money-while-bots-rack-up-gains) | 84% unprofitable wallets |
| 15 | [TUM Thesis — Polymarket AMM](https://www.cs.cit.tum.de/fileadmin/w00cfj/sebis/_my_direct_uploads/20250903_Parshant_MA_Thesis.pdf) | 26% LPs profitable, $400K+ IL |
| L1 | [insider/MEGA_REPORT.md](../../insider/MEGA_REPORT.md) | 192-paper synthesis, retail loses 2–5%/trade |
| L2 | [insider/THE_70_PERCENT_STUDY.md](../../insider/THE_70_PERCENT_STUDY.md) | 200-paper drag study, compounded loss |

Aggregate book depth on Polymarket and Kalshi is not publicly disclosed; the figures used for the per-$1K-depth calculation are derived order-of-magnitude estimates.
