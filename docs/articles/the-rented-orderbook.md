# Polymarket's $80 Million Year
## Two firms. One bill. The script that killed dYdX v3.

---

### I. The Boom

April 2026 was a record month — Kalshi cleared $14.81 billion in volume, Polymarket cleared $9.01 billion, the two venues together moved more in thirty days than the entire prediction-market industry transacted in the four years before, and the valuations track the volume (Polymarket $8B, Kalshi $5B, with a third venue from Robinhood × Susquehanna building to enter the same room).

The growth is real. The product is real. Something is happening.

---

### II. The Hood

Open the hood and the engine is familiar: two firms write most of the quotes, takers pay a fee on every trade, and the venue rebates twenty-five cents of every fee dollar back to the same firms that wrote the quote. The book is tight because someone is paying for the book to be tight, and that someone is the trader who arrived to bet.

This is how all the other engines worked.

---

### III. The Cost

Here is what each market structure pays to keep its depth alive, per thousand dollars of book, per day — every figure from primary sources (exchange fee schedules, CFTC filings, venue help-center articles).

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

Polymarket pays roughly one hundred to one thousand times more per dollar of depth than any centralized exchange in any other asset class — a structural cost we covered separately in [How Much Do Insiders Take From You on Polymarket?](../../insider/MEGA_REPORT.md) (synthesis of 192 papers) and [The Drag Study](../../insider/THE_70_PERCENT_STUDY.md) (200). Every taker arrives with a thesis about an event resolving in days, the market maker quotes blind against that thesis, and the compensation has to be enormous because the position is structurally a losing one.

---

### IV. The Graveyard

This is where the story stops being new. The three largest on-chain perpetuals venues that ever paid heavy subsidies for their order books each ran the same playbook, and each ended the same way.

**dYdX v3** shipped roughly 122 million DYDX tokens — dollar-weighted around $200–250 million — in trader rewards across 32 epochs; monthly volume cleared $30–40 billion at peak, lifetime volume crossed $1.46 trillion, and for a window of months it out-traded Coinbase. The rewards schedule decayed, the volume curve decayed with it, and on October 28, 2024 the entire v3 chain was switched off.

**Synthetix Perps via Kwenta** ran the most explicit subsidy farm on-chain — 5.31 million OP tokens over twenty weeks plus continuous KWENTA emissions, with a Dune dashboard showing traders earning **$1.27 in OP rewards for every $1 of fees they paid**, i.e. the venue paid traders 27% more than it took from them. Daily volume hit $450 million and 34.5% of the entire perp DEX market; when OP rewards ended in late 2023, volume fell three consecutive quarters to $5.1 billion in Q3 2024 and Synthetix folded Kwenta back into the parent in a wind-down acquisition.

**Aevo** is the cleanest before-and-after on the chart — the Ribbon team's pre-airdrop incentive program drove daily volume to $4.5 billion in February–March 2024, the airdrop dropped on March 13, and within weeks daily volume was below $100 million (a 97% fall) with CoinDesk quoting open wash-trading allegations on the way down. AEVO fell 70%+ from launch.

The script does not depend on the team — it depends on the math. Polymarket is the best-funded current iteration of it.

---

### V. The Closed Loop

The trader pays the fee, the fee funds the rebate, the rebate funds the maker, and the maker uses the rebate to absorb the trader's loss — the trader is paying, indirectly, to be hunted. Bloomberg measured 84% of Polymarket wallets unprofitable before any fee was charged, the microstructure literature measured another 1.12% loss to the maker, and the new 1–2% taker fee on top pushes friction per round-trip toward three percent — markets where every round-trip costs three percent deplete the pool faster than they replenish it.

---

### VI. The Fix

GeneralMarket Vision does not run an order book — it runs a parimutuel pool, sealed and round-based, where all bets accumulate into a single pool, the pool splits among winners proportional to stake, and there is no quote, no spread, no market maker, no subsidy.

| Cost line on CLOB venues | Vision |
|---|---|
| Maker rebate (~22.5% of taker fees) | $0 |
| Per-event campaign incentives | $0 |
| Resting-quote payments (LIP / VIP) | $0 |
| Single-MM concentration risk | None — no MM exists |
| Adverse selection toll on retail | None — winners pay losers directly |

The cost of running a Vision round is the cost of a smart-contract execution; the cost of running a Polymarket market is roughly $22 per $1,000 of depth per day, perpetually, paid to a counterparty who can leave for a richer rebate next quarter.

One model has unit economics. The other has a subsidy.

---

### VII. The Ending Already Written

Polymarket is not failing — they are growing volume, securing partnerships, raising at higher valuations, doing every operational thing well, and none of that contradicts the shape of the curve. Every venue in the graveyard was doing well, until it was not. The asset class needs to outgrow the engine that built it; Vision is what comes after the engine.

---

## Sources

| # | Source | Used for |
|---|---|---|
| 1 | [Nasdaq US Equities Price List](https://www.nasdaqtrader.com/Trader.aspx?id=PriceListTrading2) | Maker rebate / taker fee values |
| 2 | [Binance Spot Fee Schedule](https://www.binance.com/en/fee/spotMaker) | Centralized crypto fee tiers |
| 3 | [Coinbase Advanced Fees](https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/advanced-trade-fees) | Centralized crypto fee structure |
| 4 | [Hyperliquid Fees](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees) | DEX maker rebate |
| 5 | [dYdX v4 LP Rewards](https://www.dydx.foundation/blog/liquidity-provider-rewards) | DEX LP economics |
| 6 | [CME EBS Q1 2024](https://www.cmegroup.com/articles/2024/strengthening-fx-primary-liquidity-on-ebs.html) | FX top-of-book spread |
| 7 | [Polymarket Liquidity Rewards](https://docs.polymarket.com/market-makers/liquidity-rewards) | Per-event subsidy tiers |
| 8 | [Polymarket Maker Rebates](https://docs.polymarket.com/market-makers/maker-rebates) | 20–25% rebate split |
| 9 | [Polymarket Trading Fees](https://docs.polymarket.com/trading/fees) | Taker fee formula |
| 10 | [Kalshi Liquidity Incentive Program](https://help.kalshi.com/en/articles/13823851-liquidity-incentive-program) | $10–$1,000/day per market |
| 11 | [dYdX 2023 Semi-Annual Report](https://www.dydx.foundation/blog/dydx-2023-semi-annual-ecosystem-report) | dYdX v3 volume |
| 12 | [dYdX Trading Rewards](https://www.dydx.foundation/blog/trading-rewards) | 122M DYDX rewards across 32 epochs |
| 13 | [dYdX v3 Product Sunset](https://www.dydx.xyz/blog/v3-product-sunset) | Oct 28, 2024 shutdown |
| 14 | [Synthetix — Kwenta program](https://blog.synthetix.io/what-is-kwenta-everything-you-need-to-know-about-the-leading-synthetix-perp-intgerator/) | $450M peak, 34.5% market share |
| 15 | [Cointelegraph — $1.27 OP per $1 fees](https://cointelegraph.com/news/synthetix-snx-trading-volume-overtakes-gmx-but-is-the-dex-token-rally-sustainable) | Subsidy farming ratio |
| 16 | [Messari — Synthetix Q3 2024](https://messari.io/report/synthetix-q3-2024-brief) | Three quarterly declines, $5.1B Q3 |
| 17 | [CoinDesk — Aevo wash-trading allegations](https://www.coindesk.com/markets/2024/03/15/billion-dollar-volumes-and-then-a-steep-drop-prompts-allegations-of-wash-trading-on-aevo) | $4.5B → <$100M in weeks |
| 18 | [Becker — PM Microstructure](https://www.jbecker.dev/research/prediction-market-microstructure) | 72.1M trades, 1.12% taker loss |
| 19 | [Bloomberg — Apr 2026](https://www.bloomberg.com/news/articles/2026-04-28/most-prediction-market-traders-are-losing-money-while-bots-rack-up-gains) | 84% unprofitable wallets |
| L1 | [insider/MEGA_REPORT.md](../../insider/MEGA_REPORT.md) | 192-paper synthesis, retail loses 2–5%/trade |
| L2 | [insider/THE_70_PERCENT_STUDY.md](../../insider/THE_70_PERCENT_STUDY.md) | 200-paper drag study |

Aggregate book depth on Polymarket and Kalshi is not publicly disclosed; the figures used for the per-$1K-depth calculation are derived order-of-magnitude estimates.
