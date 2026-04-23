# Batch 12 — Prediction Markets: Information Efficiency, Forecasting, and Market Structure

---

## PM173 — Murr, "The Wisdom of Crowds: Applying Condorcet's Jury Theorem to Forecasting U.S. Presidential Elections" (2014)

**Note:** File labeled as Croxson & Reade but contains Murr's Condorcet paper.

**Relevance to insider/informed trading:** MINIMAL — indirect only.

- Paper studies citizen election forecasting, not betting or trading markets. Tests whether delegating forecasts to "most competent" citizens and weighting by competence improves group accuracy.
- Delegated + weighted citizen forecasting correctly predicts 87% of states vs. 82% for naive (equal-weight) forecasting. At individual level: 76% vs. 69% correct.
- Model correctly predicts 8 of 9 U.S. presidencies.
- The paper's relevance is purely structural: heterogeneous competence among forecasters matters. "Competent" forecasters (analogous to informed traders) systematically outperform, and their signal can be identified from past performance.
- No quantitative data on adverse selection, insider extraction, or market maker losses.

**Verdict:** NO RELEVANT DATA on insider trading costs, informed trader extraction, or market maker losses.

---

## PM174 — Reade, Singleton & Vaughan Williams, "Betting markets for English Premier League results and scorelines: evaluating a forecasting model" (2020)

**Note:** File labeled as Forrest-Goddard-Simmons but contains Reade et al.

**Relevance to insider/informed trading:** LOW — focuses on forecast accuracy, not informed trader behavior.

- Compares bivariate Poisson statistical model forecasts against bookmaker odds for 760 EPL matches (2016/17 and 2017/18).
- Bookmaker overround: ~4% for match results, ~12% for exact scorelines. The 12% scoreline overround is the implicit cost to bettors (including any informed traders attempting to exploit scoreline markets).
- The statistical model encompasses bookmaker scoreline forecasts — i.e., the model contains information not reflected in bookmaker prices. However, this informational advantage does not translate into consistent positive ROI due to the 12% overround.
- Favourite-longshot bias is significant for scoreline markets but not for match result markets: bookmakers overestimate the likelihood of rare scorelines (e.g., 4-4) relative to common ones (1-0, 1-1).
- For every GBP 1.00 bet on match results, approximately GBP 0.20 is bet on exact scorelines — scoreline markets are thinner and more vulnerable to informed trading.
- No direct measurement of insider proportion, adverse selection costs, or informed trader returns.

**Verdict:** The 12% scoreline overround and 4% result overround quantify the margin within which informed traders must operate. No direct insider extraction estimates.

---

## PM176 — Ostrovsky, "Information Aggregation in Dynamic Markets with Strategic Traders" (Econometrica 2012)

**Relevance to insider/informed trading:** HIGH — theoretical framework for how informed traders aggregate information through prices.

- Proves that for "separable" securities (including Arrow-Debreu contracts and additive securities — the building blocks of prediction markets), information ALWAYS gets aggregated in every equilibrium, even with a finite number of large strategic traders.
- Key result (Theorem 1): In any equilibrium, as time approaches the end of the trading interval, the market price of a separable security converges in probability to its expected value conditional on traders' pooled information.
- Mechanism: If prices are "wrong" (not reflecting pooled information), at least one informed trader can make non-vanishing positive profits by trading, contradicting equilibrium. The arbitrage opportunity persists until prices correct.
- Extends Kyle (1985) to multiple partially informed traders. In Kyle's single-insider model, the insider gradually reveals information; Ostrovsky shows this extends to N partially informed traders with arbitrary information structures.
- Market Scoring Rule (MSR) model — directly applicable to prediction markets (used by Consensus Point, Inkling Markets, etc.): automated market maker loses at most a bounded, known amount. Informed traders extract profits from this "subsidy" plus from noise traders.
- Critical constraint: the worst-case loss of an automated market maker (MSR) is bounded and can be controlled by adjusting parameters. This is the total pool available for informed trader extraction.
- Non-separable securities can sustain equilibria where information is NOT aggregated — prices stay wrong permanently. This is the theoretical basis for markets that fail.
- The paper does NOT provide quantitative estimates of extraction rates, but establishes that informed traders WILL extract profits until prices are correct — the question is only how fast.

**Key quantitative insight for market design:** In the MSR framework, the market maker's expected loss equals the total informed trader profit. If you cap the market maker's subsidy (as in LMSR with a liquidity parameter b), you cap the total extraction.

---

## PM185 — Goddard & Asimakopoulos, "Forecasting Football Results and the Efficiency of Fixed-odds Betting" (J. Forecasting, 2004)

**Relevance to insider/informed trading:** MODERATE — quantifies weak-form inefficiency and exploitable margins.

- Ordered probit model estimated on 10 years of English league data (19,744 matches). Used to test weak-form efficiency of a high street bookmaker's odds.
- The forecasting model contains significant information NOT impounded in bookmaker odds: coefficients on (p_model - f_bookmaker) are significant at 1% level for home wins and draws, 5% for away wins. This is direct evidence of exploitable information asymmetry.
- **Quantitative returns from informed strategy:**
  - End-of-season bets (April/May): +8% gross return in both 1999 and 2000 seasons.
  - Start-of-season bets (August): +3.1% (1999) and +1.5% (2000) gross return.
  - Full-season strategy: roughly breakeven (+0.3% in 1999, -5.5% in 2000).
- The inefficiency is concentrated at season end, when the model's advantage (incorporating championship/relegation significance, cup elimination effects, recent form) is greatest vs. bookmaker's static assessment.
- Bookmaker's margin (overround): approximately the difference between gross returns of ~-10.5% on all bets and the breakeven threshold. The paper implies margins of roughly 5-12%.
- Longshot bias is referenced: "bets on strong favourites may offer limited profitable betting opportunities" (citing Cain et al. 2000). Longshot bias may arise from insider trading (Shin 1991, 1992, 1993) — bookmakers widen margins on longshots specifically as a defense against informed bettors.
- The paper explicitly references Shin's model: "longshot bias may be a consequence of insiders trading on the basis of private information."
- Informed traders (those with access to the model's information) could extract +8% at specific times — but this is gross, before transaction costs.

---

## PM186 — Franck, Verbeek & Nuesch, "Prediction accuracy of different market structures — bookmakers versus a betting exchange" (IJF 2010)

**Relevance to insider/informed trading:** MODERATE-HIGH — quantifies information edge of exchange over bookmakers and exploitable returns.

- Dataset: 5,478 matches across Big Five European leagues, 3 seasons (2004/05-2006/07). Compares 8 bookmakers against Betfair exchange.
- **Core finding:** Betfair exchange prices predict outcomes more accurately than any individual bookmaker or the average of 8 bookmakers. McFadden's R-squared: Betfair = 0.082 vs. best bookmaker = 0.082 (VC Bet, but generally 0.077-0.080 for others) for home wins; gap wider for away wins (0.088 vs. 0.082-0.084).
- **Longshot bias:** Marginal effects of implied probabilities on actual outcomes: Betfair = 1.124 for home wins (closer to the ideal 1.0) vs. bookmakers ranging 1.194-1.318. Bookmakers systematically overweight longshots. This is consistent with Shin's insider-trading explanation of longshot bias.
- **Quantitative extraction via simple strategy:**
  - Betting when Betfair probability > average bookmaker probability yields above-average returns in ALL cases.
  - Away win bets following this strategy: positive returns for most bookmakers (e.g., +1.9% to +8.2% for top R* quantile bets).
  - Top 5% quantile of R* (Betfair/bookmaker ratio): average return of **+10%** across all events (821 bets).
  - Top 10% home win bets: **+3%** return (547 bets).
  - Top 10% away win bets: **+7%** return (547 bets).
  - Random betting yields about **-12.4%** return (the bookmaker margin).
- **Self-selection of informed traders:** "Bettors with more accurate information and beliefs may self-select into the exchange market while less skilled bettors may place their bets in the bookmaker setting." This is the adverse selection mechanism — exchanges attract informed traders, bookmakers attract noise.
- **Bookmaker response to demand bias:** Bookmakers "actively shade prices to attract betting volume evoked by sentiment" (Levitt 2004, Forrest & Simmons 2008). Bookmaker odds reflect both true probabilities AND biased demand. The exchange, being order-driven, is more purely informational.
- Betfair weekly turnover >$50M, 2M+ registered users, 90% of all exchange betting worldwide, 5M trades/day.
- The ~12.4% bookmaker margin is the maximum theoretical extraction by perfectly informed traders betting against bookmakers. The exchange commission (lower than overround) reduces this ceiling.

---

## Cross-Paper Synthesis

| Metric | Value | Source |
|--------|-------|--------|
| Bookmaker overround (match results) | ~4-5% | PM174, PM185 |
| Bookmaker overround (exact scorelines) | ~12% | PM174 |
| Random bettor expected return | -12.4% | PM186 |
| Informed strategy return (season-end) | +8% gross | PM185 |
| Informed strategy return (Betfair edge, top 5%) | +10% gross | PM186 |
| Informed strategy return (away wins, top 10%) | +7% gross | PM186 |
| Longshot bias magnitude (marginal effect deviation from 1.0) | 0.12-0.32 for bookmakers vs. 0.12 for Betfair | PM186 |
| Information aggregation guarantee | Theorem: all equilibria converge to pooled-information price for separable securities | PM176 |
| MSR market maker worst-case loss | Bounded, controllable via liquidity parameter | PM176 |

**Key takeaway for market design:** Informed traders in prediction/betting markets can extract 7-10% gross returns when they identify price discrepancies between information sources. The bookmaker's 4-12% overround is the defense — but it bleeds uninformed bettors rather than stopping informed ones. Exchange markets aggregate information more efficiently (Betfair > bookmakers) but this means informed traders converge there, making the exchange the "true price" and the bookmaker the exploitable venue. Ostrovsky's theorem guarantees that in any well-designed market with separable securities, prices WILL eventually reflect all information — the only design question is how much the market maker loses in the process.
