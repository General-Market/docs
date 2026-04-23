# Batch 09 — Prediction Markets: Insider Trading, Adverse Selection, and Market Maker Loss

## PM095 — Levitt & Logan (2010), "Betting Markets and Market Efficiency: Evidence from College Football"

**Focus:** Market inefficiency in college football point-spread betting (11,000+ games, 1985-2003). Not directly about insider trading, but about how bookmakers misprice to counteract bettor behavioral biases.

- **Favorites systematically overpriced:** Favorites are 1.86% less likely to beat the spread in the full sample; 6.38% less likely in the Logan sample (25 most prominent programs). Away favorites are 4.35% less likely to beat the spread.
- **Profitable strategy magnitude:** Betting $1,000 against favorites in the Logan sample yields $1,116.99 in expectation (before vigorish); betting $1,000 against favorites in the total sample yields $1,016.99 after vigorish ($100 cut on a winning bet).
- **Vigorish (transaction cost):** Standard vigorish is ~4.76% (bettor needs 52.4% win rate to break even).
- **Mechanism of inefficiency:** Betting houses inflate lines for "hot" teams (those who beat the spread in consecutive weeks) to counteract the "hot hand" bias among bettors. Beating the spread adds ~2.25 points to next week's line; beating it 3 consecutive weeks adds 7.5+ points. This over-correction creates exploitable inefficiency elsewhere.
- **Informed vs. uninformed extraction:** No direct insider trading measurement, but the paper shows market makers (bookmakers) sacrifice accurate pricing on some dimensions (home teams, favorites) to defend against a behavioral bias they believe is more dangerous to their risk. The cost is borne by sophisticated bettors who could exploit the resulting mispricing.

**Relevance:** Demonstrates how market makers' defensive responses to one class of informed/biased bettors create exploitable inefficiencies for other informed traders. The transfer is indirect but quantified.

---

## PM097 — Berkowitz, Depken & Gandar (2016), "The Conversion of Money Lines into Win Probabilities"

**Focus:** Methodological paper reconciling seven methods for converting money lines into win probabilities, reducing them to three distinct approaches: Knowles/Woodland-Woodland, Standard Normalization, and Rascher/Shin.

- **Key finding on Shin probabilities:** The Shin (1992, 1993) model explains the favorite-longshot bias (FLB) as a bookmaker response to insider trading. Shin's z parameter measures the proportion of betting revenue attributable to insiders. The paper shows that in the two-outcome case, Shin probabilities reduce exactly to the Rascher (1999) averaging method — a complete algebraic equivalence.
- **Shin's z values (from referenced literature):** Shin (1993) estimated z = 0.025 (2.5% of turnover from insiders) in horse racing. The paper references this figure but does not estimate new z values.
- **Bookmaker margin examples (Table 1):**
  - Money line (-110, +100): commission = 2.33% (modified WW) / margin = 2.38% (standard normalization)
  - Money line (-450, +390): commission = 2.18% / margin = 2.23%
  - Money line (-1150, +890): commission = 2.06% / margin = 2.10% (vs. WW's inflated 11.61%)
- **FLB in college basketball (Table 3, 21,792 games, 2006-2013):** Favorite actual returns = -0.97%, significantly higher than expected returns of -2.45%. Underdog actual returns = -10.69%. The FLB is pronounced at high favorite probabilities (>0.90), where actual win frequencies exceed predicted by 3-5 percentage points.
- **Shin probabilities reduce but do not eliminate the FLB** in college basketball — 4 of 25 probability intervals remain significantly biased (vs. 8 for standard normalization).
- **Interpretation of FLB as insider cost:** Shin (1992) frames FLB as the bookmaker's mechanism for passing insider trading losses to uninformed bettors. Books engineer the bias — overcharging longshot bettors, undercharging favorite bettors — to recoup losses from insiders who bet selectively on outcomes they know.

**Relevance:** Provides the mathematical framework connecting insider presence to observable market pricing distortions. The Shin z parameter is a direct measure of % of trade value extracted by insiders.

---

## PM099 — Smith, Paton & Vaughan Williams (2005), "Market Efficiency in Person-to-Person Betting"

**Focus:** Compares the favorite-longshot bias across betting exchanges (Betfair) and traditional bookmakers using 700 UK horse races in 2002, employing Shin's z methodology to measure insider trading incidence.

- **Shin z estimates (insider trading proportion of turnover):**
  - Mean bookmaker prices: z = 2.17% (comparable to Shin's original 2.5% estimate)
  - Outlier (best available) bookmaker prices: z = 1.19%
  - Betfair exchange prices: z = 0.9%
  - Differences are statistically significant (SUR methodology with formal equality tests)
- **Transaction cost explanation:** Betfair commission is max 5% of winnings vs. bookmaker over-round averaging 25.63% in the sample. Lower transaction costs on exchanges produce lower bias, consistent with the Hurley-McDonough cost-based model.
- **Information class decomposition (by betting volume as proxy for public information availability):**
  - Class 1 (low info): highest Shin z across all price formats
  - Class 4 (high info): lowest Shin z
  - Monotonically decreasing z across information classes holds strictly for exchange data; overall trend is decreasing for bookmaker data
- **Information model vs. risk preference model:** The Sobel-Raines functional form test shows the information model fits the data "almost perfectly" (Figure 3). The crossing point of subjective and objective probability functions is at pi = 0.0849, virtually identical to the predicted 1/N = 1/11.8 = 0.0847.
- **Insider impact on exchanges:** Although exchange z is lower overall, standard errors of Shin z estimates are higher for exchanges, indicating "the impact of specific items of insider information is likely to be more evident and exaggerated in particular races" — isolated insider activity creates larger price distortions per event even though aggregate insider activity is lower.
- **Uninformed bettor subsidy:** In the Hurley-McDonough model, uninformed bettors in the limit bet equal amounts on each outcome (1/N), creating the bias. The bias magnitude is a direct function of information costs — higher costs mean more uninformed money, more bias, more extraction.

**Relevance:** The most directly relevant paper. Quantifies insider extraction at 0.9-2.17% of turnover depending on market structure. Shows exchanges reduce but do not eliminate insider advantage. Demonstrates that lower transaction costs reduce the bias (and thus the subsidy from uninformed to informed).

---

## PM101 — Angeris & Chitra (2020), "Improved Price Oracles: Constant Function Market Makers"

**Focus:** Mathematical framework for analyzing constant function market makers (CFMMs) — Uniswap, Balancer, Curve. Optimization-theoretic analysis of arbitrage, price reporting, reserve value, and path deficiency.

- **Market maker worst-case loss (LMSR):** For a logarithmic market scoring rule with liquidity parameter b and m outcomes, worst-case loss = b * log(m). This is the maximum the market maker can lose when traders drive the probability of the realized outcome to 1.
- **CFMM reserve value lower bounds:** For constant mean markets (Balancer) with weights w_i and initial reserves satisfying product k = product(R_i^{w_i}), total reserve value = n * k * product(c_i^{w_i}), where c_i are external market prices. For Uniswap (n=2, equal weights): total value = 2k * sqrt(c_2).
- **Arbitrageur incentive:** The paper proves that arbitrageurs are always incentivized to make CFMM prices match external reference market prices. The optimal arbitrage trade is a convex optimization problem. Path deficiency guarantees no multi-step strategy can extract more than a single optimal trade.
- **Path deficiency as anti-drain guarantee:** Strictly path deficient CFMMs (all practical CFMMs with fees) ensure total reserves never decrease — no agent can drain the reserves by any sequence of trades. This is the formal version of "market maker can't be emptied."
- **Fees turn path independence into path deficiency:** A fee (1-gamma) makes the CFMM strictly path deficient, meaning every trade strictly shrinks the reachable reserve set. The market maker accumulates value with each trade.
- **No direct insider/informed trader quantification.** The paper does not model information asymmetry or adverse selection. It treats all traders as arbitrageurs optimizing against a reference market. The implicit assumption is that the reference market price is the "true" price.
- **Comparison to prediction market scoring rules:** The paper explicitly notes CFMMs and LMSR prediction markets diverge — a CFMM always prices at the current reference market, while a prediction market prices at the expected future value. "Sending p2 - p1 to infinity then shows that these two AMMs can diverge by any desired amount."

**Relevance:** Provides the formal worst-case loss bounds for automated market makers (b * log(m) for LMSR) and proves reserves can't be drained. Useful for market maker design but contains no empirical data on informed trading extraction.

---

## PM110 — Chen & Pennock (2010), "Designing Markets for Prediction"

**Focus:** Survey of prediction mechanism design — scoring rules, market scoring rules (MSR), automated market makers, incentive compatibility, manipulation, combinatorial markets, peer prediction.

- **Market maker worst-case loss (formal):** For an MSR with scoring rule {s_i(r)} and initial market probability r_0, worst-case loss = max_i [s_i(e_i) - s_i(r_0)], where e_i is the unit vector (certainty on outcome i). For LMSR with uniform initial probability: worst-case loss = b * log(m).
- **Kyle model of informed trading:** The paper references Kyle (1985) as the foundational model — two types of traders (rational informed + noisy uninformed). Noisy traders make CDA a positive-sum game for rational traders. Without noisy traders, the no-trade theorem applies.
- **Monopolist information holder behavior:** "Monopolist information holders will not fully reveal their information right away: instead, they will leak their information into the market gradually over time to obtain a greater profit" (citing Chakraborty & Yilmaz 2004). This is the informed trader timing strategy — gradual information leakage maximizes extraction.
- **Myopic incentive compatibility of MSRs:** MSRs are myopically incentive compatible — a risk-neutral agent participating once will report truthfully. But forward-looking agents can "bluff" — mislead others to profit from correcting the mistakes later.
- **Information aggregation conditions (Ostrovsky 2009):** If the contract + information structure satisfies a "separability" condition, information aggregates at any Perfect Bayesian Equilibrium even if traders don't reveal truthfully at first. If separability fails, there exist priors where information never aggregates.
- **Manipulation via outcome influence:** When traders can take actions to affect the underlying event (e.g., a developer betting on a software delivery date and then deliberately delaying), "principal-aligned" scoring rules are needed. Cost: the principal must pay O(n) times what they'd pay without alignment constraints.
- **No-trade theorem paradox:** "Rational risk-neutral traders will never trade, each reasoning roughly that any willing trading partner must know something that he or she doesn't know." The market maker's loss is the traders' gain, turning the mechanism into a positive-sum game. This frames the market maker subsidy as the explicit cost of information aggregation.
- **Discounted LMSR for information aggregation:** When signals are unconditionally independent (not conditionally independent given outcome), information never aggregates in finite trades. A discounted LMSR (decreasing b over time) ensures convergence in the limit.

**Relevance:** Provides the theoretical framework for understanding how informed traders interact with automated market makers. The market maker's bounded loss (b * log(m)) is the maximum subsidy paid to informed traders for information. The Kyle model reference frames informed traders as extracting value from noisy traders, with the market maker as intermediary.
