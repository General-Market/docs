# Batch 02 — Prediction Market Theory (PM006–PM010)

Research questions: insider extraction rate, cumulative impact scaling, how insiders trade in prediction/betting markets, quantitative estimates of informed trader advantage.

---

## PM006: Manski (2006) — "Interpreting the Predictions of Prediction Markets"

**Core thesis:** Prediction market prices are NOT "market probabilities." Under risk-neutral, price-taking traders with heterogeneous beliefs, prices reveal surprisingly little about the distribution of beliefs.

**Key results:**
- Equilibrium price solves: `B_m = P(q_m > B_m)` — price equals the fraction of traders whose belief exceeds price. This is NOT the mean belief.
- Mean belief is bounded: `E(q_m) in (B_m^2, 2*B_m - B_m^2)`. Interval has midpoint B_m and width `2*B_m*(1 - B_m)`.
- **Worked example (Saddam Security):** Price = 0.75. This means 75% of traders believed ouster probability > 0.75. Mean subjective probability lay in (0.5625, 0.9375) — a range of 37.5 percentage points.
- Price reveals NOTHING about dispersion of beliefs. Same price is consistent with near-unanimous beliefs or extreme bimodality.
- If budgets correlate with beliefs, price reflects budget-weighted beliefs, not beliefs alone.
- If traders are risk-averse, price depends on the joint distribution of (beliefs, budgets, risk preferences): `B_m = E[x(q,y,r;B)*1(q>B)] * P(q>B) / E[x(q,y,r;B)]`.

**Relevance to insider/informed trading:** Manski's framework implies that wealthier or more confident traders (who bet larger) can shift prices disproportionately. The independence assumption (budgets orthogonal to beliefs) is critical — if insiders have both better information AND larger budgets, they dominate price. The model provides no direct quantification of insider extraction rates.

NO RELEVANT DATA on insider extraction percentages, adverse selection costs, or informed trader returns. Theoretical framework only.

---

## PM007: Wolfers & Zitzewitz (2006) — "Interpreting Prediction Market Prices as Probabilities"

**Core thesis:** Responds to Manski — shows that under reasonable assumptions, prediction market prices ARE close to mean beliefs. Manski's worst case (risk-neutral fixed-bet-size) is empirically implausible.

**Key results:**
- With log utility: individual demand is `x_j = y * (q_j - pi) / (pi * (1-pi))`, linear in beliefs. Equilibrium price exactly equals mean belief: `pi = E[q]`.
- With wealth-belief correlation: `pi = E[q * y/y_bar]` — wealth-weighted average of beliefs. If historically accurate traders grow wealthier, this improves prediction accuracy.
- For CRRA utility, divergence between price and mean belief is typically within 1 percentage point for beliefs within 10pp of price (moderate dispersion).
- **Empirical calibration (2004 Bush reelection):** Price $0.55, polls showed 62% thought Bush more likely to win. Table 2 shows implied mean beliefs across utility functions and distributions all fall between 0.542 and 0.586 — close to the market price regardless of assumptions.
- **Probability Football data (1.4M observations):** Beliefs roughly normal. Prediction market prices closely approximate mean/median beliefs. Best fit: CRRA = 5.
- **Michigan Survey data:** Beliefs highly dispersed (mean 31%, SD 25%). Best fit: CRRA = 1-2.
- Manski's risk-neutral model: price = (1-pi)th percentile of beliefs. For pi=0.33, requires twice as many sellers as buyers — empirically counterfactual.
- **Bounds analysis:** For log utility, price always equals mean belief. For other utility functions, bounds on mean belief given price are tighter than Manski's (B_m^2, 2B_m - B_m^2).

**Relevance to insider/informed trading:** The wealth-weighting result (equation 5) is directly relevant: if informed traders accumulate wealth over time, their beliefs dominate market prices. This is an information aggregation benefit, not a cost. No adverse selection decomposition or insider extraction estimates.

NO RELEVANT DATA on insider extraction percentages, adverse selection costs, or informed trader returns. Calibration of price-belief mapping only.

---

## PM008: Snowberg, Wolfers & Zitzewitz (2007) — "Partisan Impacts on the Economy: Evidence from Prediction Markets and Close Elections"

**Core thesis:** Uses prediction market prices as instruments to identify causal effects of election outcomes on financial markets. Not about insider trading.

**Key quantitative results (for context only):**
- Bush reelection raised S&P 500 by 1.5-2.1%, Nasdaq 100 by 1.7-2.4%, 10-year yields by 11-12bp, oil by $0.60-$1.60/barrel.
- Pre-election time-series estimates were ~10x larger (confounded by reverse causation: economy affects election odds).
- Historical analysis (1880-2004): electing a Republican raises equity valuations by 2-3% on average. Coefficient on partisan shock: 0.0242-0.0297 (significant at 1%).
- Prediction market on 2004 Election Day: $3.5M traded in 13,366 trades. Average bid-ask spread: 0.5% of contract value.
- Iowa Electronic Markets 2000: Election Day volume < $20,000 (much thinner).

**Relevance to insider/informed trading:** Demonstrates that prediction markets respond to genuine information shocks (exit polls, vote counts), confirming information incorporation. The narrow bid-ask spread (0.5%) on Tradesports during high-volume events gives a benchmark for transaction costs. No analysis of informed vs. uninformed trader behavior.

NO RELEVANT DATA on insider extraction, adverse selection, or informed trading strategies.

---

## PM009: Pennock (2004) — "A Dynamic Pari-Mutuel Market for Hedging, Wagering, and Information Aggregation"

**Core thesis:** Introduces the Dynamic Pari-Mutuel Market (DPM) — a hybrid between standard pari-mutuel and continuous double auction. Zero risk for market institution, infinite buy-side liquidity, continuous price discovery.

**Mechanism design details (relevant to market maker loss):**
- Standard pari-mutuel: racetrack takes ~20% of total wagered (US). All remaining money redistributed to winners proportionally.
- DPM market institution has ZERO risk — it only redistributes money. No market-maker loss.
- CDAwMM (market maker): "exposed to significant risk of large monetary losses."
- Hanson's Market Scoring Rule: patron's maximum loss is bounded. For logarithmic scoring rule: max loss = `b * log(N)` where N = number of outcomes, b = liquidity parameter.
- DPM Price function I (losing money redistributed): `p1(n) = (M1/N2) * e^(n/N2)` — exponential in shares purchased. Market probability: `MPr(A) = M1*N1 / (M1*N1 + M2*N2)`.
- DPM Price function II (price proportional to money wagered): `p1/p2 = M1/M2`. Market probability same formula.
- Key assumption: payoff per share follows unbiased random walk (`E[P1|A] = P1`). Under this, `MPr(A) = p1 / (p1 + E[P1|A])`.
- **Informed trader incentive:** "If E[epsilon shares]/epsilon > 0, a risk-neutral trader should purchase shares of A... continue purchasing until E[epsilon shares]/epsilon = 0." Optimal quantity found by driving expected marginal value to zero.
- **Aftermarket:** Traders can cash out early (lock gains / limit losses) — unlike standard pari-mutuel. Critical for informed traders who want to trade on information and exit.

**Relevance to insider/informed trading:** The DPM framework describes HOW informed traders optimally buy (drive expected value to zero), and that the market institution bears no risk. All risk is borne by other traders — informed traders extract entirely from uninformed in a zero-sum redistribution. But no quantitative estimates of extraction rates.

NO QUANTITATIVE DATA on insider extraction percentages or adverse selection costs. Mechanism design showing zero-sum redistribution structure (informed gain = uninformed loss, by construction).

---

## PM010: Chen & Pennock (2007) — "A Utility Framework for Bounded-Loss Market Makers"

**Core thesis:** Develops utility-based automated market makers with provably bounded worst-case loss. Establishes equivalence between HARA utility market makers and weighted pseudospherical scoring rule market makers.

**Key results on market maker loss:**
- **Bounded loss theorem (Theorem 2):** Necessary and sufficient condition for bounded loss: either (1) domain of u(m) is bounded below, or (2) range of u(m) is bounded above but not below. Linear (risk-neutral) and strictly convex utility on (-inf, +inf) do NOT guarantee bounded loss.
- **All non-linear HARA utility functions guarantee bounded loss.** Includes CRRA, CARA, logarithmic.
- **Logarithmic scoring rule market maker:** Max loss = `b * log(N)` (N outcomes, b = liquidity parameter). For binary market: max loss ~ `0.693 * b`.
- **Quadratic scoring rule:** Max loss = `(N-1) * b / N`.
- **Worst-case loss formula (Lemma 7):** `L_max = integral_0^inf (1 - p_i(q^i)) dq_i` — area between price curve and p=1 line.
- **Liquidity-loss tradeoff (Theorem 8):** No market maker can have uniformly higher instantaneous liquidity than another for a fixed worst-case loss bound. Some have more liquidity near p=0.5, others near extreme prices.
- **Minimum worst-case loss for given liquidity (Theorem 9):** For minimum instantaneous liquidity rho across N outcomes: `L_min = (N-1)^2 * rho / (2*N^2)`. For N=2: `L_min = rho/8`. Matches Schwarz (2005) for step-wise price functions with bid-ask spread s: `L_min = 1/(8s)`.
- **Log MSR vs. log utility market maker:** Log MSR has greater liquidity near p=0.5; log utility market maker has greater liquidity near extreme prices. Both have worst-case loss = 50 in the paper's example (Figure 2).
- **Equivalence theorem (Theorem 3):** HARA utility with gamma is equivalent to weighted pseudospherical scoring rule with beta = 1 - 1/gamma. Negative exponential utility (CARA) = logarithmic scoring rule. Logarithmic utility = atypical scoring rule (equation 9).

**Relevance to insider/informed trading:** Quantifies the MAXIMUM the market maker can lose to informed traders — the subsidy budget. The `b*log(N)` bound for logarithmic scoring rules is the worst-case extraction by an omniscient trader from the market maker. The liquidity-loss tradeoff: more liquid markets (narrower effective spreads) require larger maximum subsidies, meaning more potential extraction by informed traders. For a fixed minimum liquidity rho, the floor on informed extraction is `(N-1)^2 * rho / (2N^2)`.

QUANTITATIVE BOUNDS on market maker worst-case loss (= maximum informed trader extraction from market maker subsidy). No empirical data on actual extraction rates or adverse selection decomposition.

---

## Summary: Batch 02 Yield

| Paper | Insider % Extraction | Scaling Across Trades | Insider Strategies | Quantitative Estimates |
|-------|---------------------|----------------------|-------------------|----------------------|
| PM006 Manski | None | None | None | Mean belief bounds only |
| PM007 Wolfers/Zitzewitz | None | None | None | Price-belief calibration only |
| PM008 Snowberg et al. | None | None | None | Election event study; bid-ask 0.5% |
| PM009 Pennock DPM | None (zero-sum noted) | None | Optimal buy: drive E[marginal] to 0 | None |
| PM010 Chen/Pennock | MM max loss: b*log(N) | None | None | Worst-case loss bounds; liquidity floor: (N-1)^2*rho/(2N^2) |

These five papers are theoretical/mechanism-design works on prediction market price formation and market maker design. None contain empirical measurements of insider extraction rates, adverse selection costs, or spread decomposition. The most actionable result for market design is Chen & Pennock's bounded-loss framework: the market maker's worst-case loss IS the upper bound on what any informed trader can extract from the subsidy, quantified as `b*log(N)` for logarithmic scoring rules with liquidity parameter b.
