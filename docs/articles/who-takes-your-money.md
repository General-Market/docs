# Who Takes Your Money
## Polymarket grew faster than anything in this category. Then we read the leaderboard.

---

### I. The Boom

April 2026 was the moment the prediction-market thesis became respectable. Polymarket cleared $9.01 billion in monthly volume; Kalshi cleared $14.81 billion alongside it; the category transacted more in thirty days than in the previous four years combined. Polymarket carries an $8B valuation, Kalshi $5B, Robinhood-and-Susquehanna are building a third venue to enter the same room. The product works. The thesis was correct. Something is happening.

You read the headlines and feel a small, specific awe — that the niche finally arrived.

---

### II. The Question

Then someone opens the leaderboard.

Polymarket has roughly 2.5 million wallets that have ever placed a trade. **84.1% of them have lost money.** **668 wallets — 0.027% of all traders — captured $3.7 billion, which is 71% of every dollar of realized profit on the platform** (Reichenbach & Walther 2025; Sergeenkov 2026). Of two and a half million participants, exactly thirty-five sustained the equivalent of a US median salary for twelve consecutive months. The remaining 2,499,332 split, collectively, the negative.

A market this large is not supposed to be this concentrated. But every market this large eventually is.

---

### III. The Three Adversaries

The 668 are not a single class. The academic literature has spent forty years decomposing them into three groups, and the distinction matters more than the headline.

| Group | Per-trade extraction | What they actually know | Source |
|---|---:|---|---|
| Market-making bots | ~1–2% | Nothing. They quote the spread | Glosten-Milgrom 1985 |
| Better-calibrated traders | ~0.5–1% | Public information, read more carefully | Erikson & Wlezien 2008 |
| True insiders (know the outcome) | 0.5–2% on average; 100% when present | The answer | Ottaviani & Sorensen 2003 |
| **Total per round-trip** | **2–5%** | | Synthesis, [MEGA_REPORT.md](../../insider/MEGA_REPORT.md) |

The market makers are the house, not the predator. They earn the spread the way a casino earns the rake — Glosten-Milgrom (1985) proved their cut exists because of the insider, not in spite of him. The better-calibrated trader is a quant with a poll aggregator; Erikson & Wlezien (2008) showed that a poll-literate IEM trader picks the underpriced candidate **87%** of the time and earns **15%** on capital. They are not insiders. They are simply less wrong than you.

The third group is the one that ends careers. The Venezuela/Maduro trader who turned **$32K into $400K** on the recall vote. The Google Year-In-Search account that called **22 of 23** rankings before publication. Cohen-Malloy-Pomorski (2010) measured insider edges of 6–12% annualized in equities; in thin prediction markets, the edge is the entire position. They appear rarely. When they appear, the counterparty is bankrupt by Tuesday.

The literature conflates all three under the single phrase *adverse selection*. The retail trader pays all three at once.

---

### IV. The Cost

Per Polymarket round-trip, the trader pays roughly 2–3% on liquid markets, 6–10% on thin ones, and 8–14% on markets where the insider is present (synthesis of Madhavan 2000, Snowberg & Wolfers 2010, Whelan 2024). Whelan's own data on bookmaker-grade venues found average bettor loss of **7.8% per bet**. We covered the full cost-of-liquidity side of this question separately in [The Exchange Polymarket Is Becoming](./the-rented-orderbook.md); the present question is who pockets the cost.

The compounding has been worked out at full precision in [The Drag Study](../../insider/THE_70_PERCENT_STUDY.md). Eight cents per dollar, recurring, on a population that turns its account over ten to fifty times a year, eventually erases the population. 84% is not a coincidence. It is what the arithmetic predicts when the literature's drag is applied to the literature's turnover.

---

### V. The Pattern

This story has been told before. The three largest orderbook venues that ever paid heavy subsidies to manufacture their depth each printed the same leaderboard before they died.

**dYdX v3** launched perpetual futures on StarkEx in August 2021 and shipped roughly $200 million worth of DYDX in trader rewards across 2021–2022; monthly volume peaked above $30 billion in late 2021, and the rewards leaderboard was dominated by a small set of professional accounts that captured both the rebate and the retail flow it attracted. As the rewards decayed retail did not return — volume fell more than 90%, and the team rebuilt the architecture from scratch as v4 on a new chain.

**FCoin** invented "trans-fee mining" in May 2018, rebating 100% of trading fees back to users in its FT token, peaked at $5.6 billion of daily volume by mid-June, and by February 2020 had frozen roughly $125 million of customer funds inside an exchange whose token had collapsed by 96%. The retail buyers who chased the rebate financed the rebate. The leaderboard, when finally examined, was the same shape every CEX leaderboard prints — a thin layer of professional accounts at the top, a long tail of users who arrived for the bonus and stayed for the loss.

**Serum** was Solana's flagship CLOB DEX, underwritten by Alameda's market making and FTX's token reserves. The depth was real, the leaderboard was Alameda; when the underwriter went bankrupt in November 2022 the book emptied within days.

These venues did not die because they were poorly run. They died because, given enough time, every CLOB with retail and informed flow on the same book converges to a state where only the informed remain, and the informed have no one left to trade against. The subsidy delays the convergence. It does not change the destination.

Polymarket is in the early phase of the same arc. Volume is up. Concentration is rising. The leaderboard already prints the distribution every prior orderbook venue printed before its retail base gave up. The script does not depend on the operator.

---

### VI. The Fix

There is one structure where the pattern does not run, because the structure has no counterparty for the insider to extract from. **A parimutuel pool.** All bets accumulate into one pool, the pool splits among winners proportional to stake, and there is no quote, no spread, no market maker, no order book to be hunted on.

GeneralMarket Vision is built this way. The insider, when present, still wins — but they win *from the other winners*, not from a market maker who passes the bill back to you through the spread. There is no maker rebate to fund. There is no adverse-selection toll to pay. The losers pay the winners directly. This is the mechanism every betting market in the eighteenth century used before someone, somewhere, decided the orderbook was more elegant.

Eliminating the intermediary eliminates the intermediary's tax.

---

### VII. The Verdict

Polymarket is not failing. They are doing every operational thing well. None of that matters. The leaderboard already shows what every prior venue's leaderboard showed at the same age — concentration accelerating, retail going negative, the informed gathering near the door. The growth curve and the extraction curve are the same curve viewed from opposite ends.

The category will outlive the engine that built it. Vision is what comes after the engine.

The market that survives is the one with no spread for an insider to hide inside.

---

## Sources

| # | Source | Used for |
|---|---|---|
| 1 | Reichenbach & Walther, *Profit Concentration on Polymarket* (2025) | 668 wallets capture 71% / $3.7B of profits |
| 2 | Sergeenkov, Yahoo Finance data (2026) | 84.1% of Polymarket traders lose money |
| 3 | Glosten & Milgrom, *Bid, Ask, and Transaction Prices* (JFE 1985) | Adverse-selection origin of the spread |
| 4 | Kyle, *Continuous Auctions and Insider Trading* (Econometrica 1985) | Insider captures half of information rents |
| 5 | Madhavan, *Market Microstructure: A Survey* (JFM 2000) | 30–60% of spread is adverse selection |
| 6 | Easley, Kiefer & O'Hara, *PIN* (1996) | 10–50% of trades are informed |
| 7 | Erikson & Wlezien (PNAS 2008) | Poll-literate IEM trader earns 15% / picks 87% correctly |
| 8 | Ottaviani & Sorensen (2003) | Informed bettors wait until last moment |
| 9 | Snowberg & Wolfers (2010) | Favorite-longshot gradient: -5.5% to -61% |
| 10 | Whelan (2024) | Average bettor loses 7.8% per bet; Shin z confounds |
| 11 | Wolfers & Zitzewitz (JEP 2004) | Insider-known markets generate no trade |
| 12 | Rothschild & Sethi (2016) | Top 1% drove 67% of Intrade volume |
| 13 | Cohen, Malloy, Pomorski (JF 2010) | Insider edge 6–12% annualized in equities |
| 14 | Columbia-Haifa (2026), *Anomalous Profits on Polymarket* | $143M anomalous profits, 69.9% flagged win rate |
| 15 | Cowgill, Wolfers & Zitzewitz (2009) | Google internal markets: physical proximity correlates positions |
| L1 | [insider/MEGA_REPORT.md](../../insider/MEGA_REPORT.md) | 192-paper synthesis, three-group decomposition |
| L2 | [insider/THE_70_PERCENT_STUDY.md](../../insider/THE_70_PERCENT_STUDY.md) | 200-paper drag study, 8¢/dollar central estimate |
| L3 | [docs/articles/the-rented-orderbook.md](./the-rented-orderbook.md) | Cost-of-depth side of the same question |

The decomposition of the top 668 Polymarket wallets by type (market makers / sharps / true insiders) is inferred from leaderboard PnL-to-volume ratios. No public study has labeled them individually.
