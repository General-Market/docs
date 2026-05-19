# Angle C — The Mathematical Inevitability

> **Headline candidate**: *It is not that the market is unfair to the uninformed trader. It is that any market with adverse selection requires uninformed traders to lose in expectation. The theorem is forty years old. The page is a record of the theorem in action.*

The classical microstructure literature proves, with the rigor of an economics paper, that a marketplace containing informed and uninformed participants will set a spread that *must* extract from the uninformed in order to compensate the dealer for being adversely selected against by the informed. The uninformed trader's loss is not a bug. It is a structural requirement of the market's continued operation.

---

## 1 · Glosten-Milgrom (1985) — the foundational paper

**Citation**: Glosten, Lawrence R., and Paul R. Milgrom. *"Bid, Ask, and Transaction Prices in a Specialist Market with Heterogeneously Informed Traders."* Journal of Financial Economics 14, no. 1 (March 1985): 71–100.

URL: `https://www.sciencedirect.com/science/article/pii/0304405X85900441`

**The setup**: A market maker quotes bid and ask prices. The flow it sees is a mix of *informed* traders (who know something the market maker does not) and *uninformed* traders (who do not). The market maker cannot tell which is which when an order arrives.

**The key result**:

The market maker must set the bid below and the ask above the true expected value of the asset by an amount sufficient to break even *across the full mix of informed and uninformed flow*. The informed traders pick off the market maker on every trade. The uninformed traders pay the spread that compensates for that picking-off.

**In plain English**: the uninformed trader pays positive expected cost on every single round-trip. Not sometimes. Always. *In expectation, the uninformed trader's PnL contribution is negative by construction.*

**The article quote**: this is the closest classical microstructure has to a theorem stating retail must lose.

---

## 2 · Kyle (1985) — the continuous-auction version

**Citation**: Kyle, Albert S. *"Continuous Auctions and Insider Trading."* Econometrica 53, no. 6 (November 1985): 1315–1335.

URL: `https://www.jstor.org/stable/1913210`

**The setup**: A single informed trader, a continuous stream of noise traders (the uninformed), and a market maker who clears.

**The key result**: The informed trader optimally trades at a rate proportional to the *square root of the noise trader volume*. The price impact ("Kyle's lambda") is the cost of trading. Noise traders pay all the costs. The informed trader extracts all the value.

**In plain English**: the same conclusion via a different mathematical apparatus. *The presence of an informed trader requires the noise traders to fund both the market maker and the informed extractor.*

**The article quote**: Kyle's framework names the very-fast-trading version of the same outcome.

---

## 3 · Easley & O'Hara — PIN (Probability of Informed Trading)

**Citation**: Easley, David, Nicholas M. Kiefer, Maureen O'Hara, and Joseph B. Paperman. *"Liquidity, Information, and Infrequently Traded Stocks."* Journal of Finance 51, no. 4 (September 1996): 1405–1436.

URL: `https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.1996.tb04074.x`

**The result**: PIN measures the fraction of order flow that is informed. PIN is positively correlated with the bid-ask spread. **More informed flow → wider spreads → worse outcomes for the uninformed.**

PIN literature has spawned dozens of follow-ups measuring informed-flow intensity across venues, time periods, and instruments.

---

## 4 · VPIN — the high-frequency version

**Citation**: Easley, David, Marcos M. López de Prado, and Maureen O'Hara. *"Flow Toxicity and Liquidity in a High-Frequency World."* Review of Financial Studies 25, no. 5 (May 2012): 1457–1493.

URL: `https://academic.oup.com/rfs/article/25/5/1457/1593138`

**The result**: VPIN (Volume-synchronized PIN) is a high-frequency measure of order-flow toxicity. Predicts liquidity withdrawals. Spiked dramatically in the lead-up to the **May 6, 2010 Flash Crash**.

**In plain English**: in the modern HFT-dominated market, toxicity is measurable in real time. When toxicity rises, market makers withdraw liquidity faster than ever — and the uninformed pay both the wider spread and the consequences of the withdrawal.

---

## 5 · Budish-Cramton-Shim — the latency arms race is welfare-destroying

**Citation**: Budish, Eric, Peter Cramton, and John Shim. *"The High-Frequency Trading Arms Race: Frequent Batch Auctions as a Market Design Response."* Quarterly Journal of Economics 130, no. 4 (November 2015): 1547–1621.

URL: `https://academic.oup.com/qje/article/130/4/1547/1916141`

**The setup**: A continuous limit order book in the presence of HFTs. HFTs race to react to news; the firm with the fastest connection picks off stale quotes from slower firms.

**The key result**: The continuous order book is a fundamentally flawed design. The arms race for speed is *socially wasteful*: HFTs spend billions on infrastructure to capture a finite "sniping" rent. The total surplus extracted is divided among the fastest few; everyone else pays.

**The proposed fix**: replace continuous matching with *frequent batch auctions* — discrete intervals (e.g., one batch per second) where all orders in the batch are matched at a single clearing price. The sniping rent vanishes. The speed arms race ends.

**The relevance to General Market**: GM's parimutuel-pool / per-minute-resolution design is the **engineering realization of the Budish-Cramton-Shim proposal**. The mathematical justification for what GM built is in the QJE.

**The article quote**: this is the paper that names the cure as well as the disease.

---

## 6 · Aquilina-Budish-O'Neill (2022) — the empirical measurement

**Citation**: Aquilina, Matteo, Eric Budish, and Peter O'Neill. *"Quantifying the High-Frequency Trading 'Arms Race'."* Quarterly Journal of Economics 137, no. 1 (February 2022): 493–564.

URL: `https://academic.oup.com/qje/article/137/1/493/6368348`

**The result**: Using LSE order-level data, measured the latency-arbitrage tax at approximately **0.5 basis points of trading volume**, or roughly **$5 billion per year** on world equities. The number is the size of the rent.

This is the empirical confirmation of the Budish-Cramton-Shim theoretical claim. The arms race extracts a measurable cost that the rest of the market pays.

Already cited in `/anticheat-flags` `data-edge-ways.ts` `colocation` row.

---

## 7 · Schwarz et al. — adverse selection applied to retail (2025)

**Citation**: Schwarz, Christopher, Brad M. Barber, Xing Huang, Philippe Jorion, and Terrance Odean. *"The 'Actual Retail Price' of Equity Trades."* Journal of Finance 80, no. 1 (February 2025) (forthcoming).

URL (SSRN): `https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4198855`

**The result**: Measured the round-trip effective spread paid by retail traders across six US retail brokers. Range: **7–46 basis points round-trip**. The midpoint (17 bps) is the figure used in `/anticheat-flags` `data-edge-ways.ts` for the PFOF mechanism.

**Why this matters for the inevitability claim**: this paper *empirically validates* the Glosten-Milgrom theorem for the modern retail-broker era. The PFOF model is the modern wholesaler-mediated incarnation of the dealer in the 1985 paper. The spread is what it must be.

---

## 8 · The winner's curse — auctions against the informed

**Citation**: Capen, E.C., R.V. Clapp, and W.M. Campbell. *"Competitive Bidding in High-Risk Situations."* Journal of Petroleum Technology 23, no. 6 (1971): 641–653.

**Citation**: Vickrey, William. *"Counterspeculation, Auctions, and Competitive Sealed Tenders."* Journal of Finance 16, no. 1 (1961): 8–37.

**The setup**: In any one-shot bid against a counterparty with private information, the uninformed bidder is structurally cursed. Winning means having bid more than the informed party thought it was worth.

**The relevance**: every retail buy of a memecoin is, in this framing, a winner's-curse outcome. The seller (insider, sniper, MM) knew something the buyer did not. The buyer "won" the trade. The buyer lost.

---

## 9 · Glosten — small-trader optimal venue choice

**Citation**: Glosten, Lawrence R. *"Is the Electronic Open Limit Order Book Inevitable?"* Journal of Finance 49, no. 4 (September 1994): 1127–1161.

**The result**: Under fairly general conditions, an open limit order book is **the optimal market structure for sufficiently small trades**. *But* informed traders prefer the LOB; uninformed traders are better off in a sealed mechanism.

**The relevance to GM**: this is one of the academic supports for *why a sealed-bet, parimutuel pool is theoretically better for uninformed traders*. The math agrees with what `data-edge-ways.ts` already encodes.

---

## 10 · The sealed-bid / parimutuel literature

The article's closing claim — that GM's mechanism *breaks the adverse-selection trap* — needs theoretical support.

### Relevant papers

- **Levin** and various — parimutuel betting and information aggregation. The classical result: when bettors pool into a single liability shared among winners, the information advantage is **diluted across the pool** rather than concentrated in a counterparty.
- **Wolfers and Zitzewitz (2004)**, "Prediction Markets" (Journal of Economic Perspectives). Survey paper on how parimutuel and similar mechanisms aggregate information.
- **Hanson — Logarithmic Market Scoring Rules**. Robin Hanson's 2003 work on prediction-market mechanisms (LMSR is the underlying mechanism for many prediction markets). Not strictly parimutuel but the same family.

### The structural claim

In a parimutuel pool, the counterparty is *the pool itself*, not a dealer. There is no entity whose business model depends on adversely selecting the uninformed. The informed and uninformed bet against each other directly. **The Glosten-Milgrom spread vanishes.**

This is not a hand-wave. It is the well-understood difference between dealer markets and parimutuel markets. `[VERIFY]` — pull the canonical citation for this result before publishing.

---

## 11 · The single quotable line

Across all the above papers, the single most quotable line is from **Easley, López de Prado, O'Hara (2012)**:

> *"In a market dominated by high-frequency activity, the only meaningful question is who is being adversely selected against and by how much. Liquidity is a property of the second-most-informed trader's willingness to remain in the market."*

`[VERIFY]` — exact wording. Paraphrasing.

If we can't get an exact quote, the article's own knife sentence can do the work:

> *"It is not that markets are unfair. It is that, in any market with informed traders and uninformed traders, the uninformed must lose in expectation by an amount equal to the cost of compensating the dealer for being picked off by the informed. The theorem is from 1985. The page is the receipt."*

---

## 12 · Bibliography (papers in citation order)

1. Glosten & Milgrom (1985) — *JFE* — `https://www.sciencedirect.com/science/article/pii/0304405X85900441`
2. Kyle (1985) — *Econometrica* — `https://www.jstor.org/stable/1913210`
3. Easley, Kiefer, O'Hara, Paperman (1996) — *J. Finance*
4. Easley, López de Prado, O'Hara (2012) — *RFS* — `https://academic.oup.com/rfs/article/25/5/1457/1593138`
5. Budish, Cramton, Shim (2015) — *QJE* — `https://academic.oup.com/qje/article/130/4/1547/1916141`
6. Aquilina, Budish, O'Neill (2022) — *QJE* — `https://academic.oup.com/qje/article/137/1/493/6368348`
7. Schwarz, Barber, Huang, Jorion, Odean (2025 forthcoming) — *J. Finance*
8. Capen, Clapp, Campbell (1971) — Winner's curse
9. Vickrey (1961) — Auctions
10. Glosten (1994) — *J. Finance*
11. Wolfers & Zitzewitz (2004) — *JEP* — prediction markets
12. Hanson (2003) — LMSR mechanism design

---

## 13 · How this angle would frame the page

If the article uses the **mathematical inevitability** as its spine:

- **H1**: *The Dead Financial Market Theory. A theorem from 1985 explains it.*
- **Lead**: introduce Glosten-Milgrom, note its forty years of empirical confirmation, name the implication: the uninformed must lose by construction. Then pivot: it has gotten **worse** because the asymmetry has grown — informed traders now have GPUs, microseconds, PhD armies. The theorem held even when the asymmetry was small. With this asymmetry, it is no longer a theorem about a stable rent. It is a theorem about an exponential rent.
- **Body sections**: the same compounding-clock data, but each section is *the empirical surface of the theorem*.
- **Closer**: General Market's parimutuel pool removes the dealer. The theorem no longer applies, because there is no counterparty paid to be adversely selected against. The uninformed and informed bet against each other directly. *This is what Budish, Cramton, and Shim proposed in 2015. We implemented it.*

The page becomes both *evidence-dense* and *theoretically grounded*. The casual reader sees the bleed; the credentialed reader sees the theorem.

---

## 14 · What's missing / `[VERIFY]`

1. Exact wording of the Easley-López de Prado-O'Hara quote.
2. Canonical citation for "parimutuel pool eliminates dealer-mediated adverse selection." There's an established literature; pull the canonical reference.
3. The Hanson LMSR / sealed-bid mechanism design literature has more entries than listed; deeper pull recommended.

---

End of file.
