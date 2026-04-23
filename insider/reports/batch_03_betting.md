# Batch 03b -- Parimutuel & Fixed-Odds Betting: Insider Extraction Models

## PM011: Ottaviani & Sorensen (2009) "Surprised by the Parimutuel Odds?"

**Core mechanism:** In parimutuel markets, privately informed bettors place simultaneous bets before knowing final odds. The realized market probability contains information about the true outcome -- but bettors cannot revise positions after seeing this "surprise." This generates the favorite-longshot bias (FLB): favorites underpriced, longshots overpriced.

**Key quantitative result:** In the limit as N (number of bettors) -> infinity, the posterior probability associated with any realized market probability converges to either 0 or 1 -- the bets of infinitely many i.i.d. informed bettors fully reveal the outcome. The switching market probability pi* (equation 4) separates the region where the posterior jumps to 1 vs. 0:
  pi* = log[(1-c(1|1))/c(2|2)] / {log[(1-c(1|1))/c(2|2)] + log[(1-c(2|2))/c(1|1)]}
where c(k|k) is the fraction of bets on outcome k when k is the true outcome.

**Informed trader extraction:** The paper does not directly quantify % extraction. Rather, it shows that the equilibrium structure guarantees informed bettors systematically outperform: their bets are correlated with the true outcome (c(1|1) > 1 - c(2|2)), meaning they capture disproportionate payouts. The FLB -- favorites winning more often than market odds imply -- is the empirical signature of this information advantage.

**Scaling:** The bias is extreme with many bettors (full revelation in the limit), less extreme with correlated signals or unpredictable outcome components. A "substantial amount of money is wagered just before post time" -- the simultaneous last-minute game is the empirically relevant case.

---

## PM012: Ottaviani & Sorensen (2010) "Noise, Information, and the Favorite-Longshot Bias"

**Core contribution:** Unifies FLB and its reverse (in lotteries) as a single phenomenon driven by the ratio of information to noise in parimutuel equilibrium. High information/noise ratio -> FLB (horse racing). Low ratio -> reverse FLB (Lotto).

**Quantitative framework -- Proposition 4 (equation 3-4):** The neutral market probability pi* separates FLB from reverse-FLB regions. FLB arises for a given market probability pi when:
  (1/(1-2*pi)) * log((1-pi)/pi) < N * log(sigma(k|k)/sigma(k|l))
where sigma(k|k) is the probability any bettor bets on the winner. The RHS grows with N (more bettors) and with signal informativeness.

**Numerical examples (Dirichlet signal, K=2):**
- sigma(k|k) = 0.588 (low info, delta=10): reverse FLB dominates
- sigma(k|k) = 0.75 (moderate info, delta=1): FLB emerges at N >= 4
- sigma(k|k) = 0.942 (high info, delta=0.1): strong FLB even at small N

**Key comparative statics on informed trader impact:**
1. **More bettors (N):** More information, stronger FLB. At N -> infinity, bets fully reveal outcome.
2. **Better private information (Blackwell sense):** Stronger FLB. Likelihood ratio sigma(k|k)/sigma(k|l) increases.
3. **More outcomes (K):** Higher K = more noise per outcome -> weaker FLB or reverse. In Lotto (K >> N, no information), reverse FLB always holds. Exotic bets (exacta, pick-six) have reduced FLB vs. win pool.
4. **Reduced participation (higher takeout):** Poorly-informed bettors exit first, remaining bets are more informative -> stronger FLB.
5. **Common error (sigma < 1):** Residual uncertainty flattens the expected return curve for intermediate market probabilities.

**Expected return pattern (Figure 4, K=9, N=10):** For asymmetric prior q = (0.29, 0.21, ..., 0.01), expected returns are flatter for intermediate market probabilities -- consistent with empirical racetrack data (Snowberg & Wolfers 2005).

**Extraction estimate (indirect):** With N=4, K=2, delta=1 (moderate info), a market probability of 0.7 for the favorite corresponds to a posterior probability ~0.85 -- the 15pp gap represents the information not priced in. The gap between market probability and posterior probability IS the adverse selection cost borne by uninformed bettors.

---

## PM013: Ottaviani & Sorensen (2003/2005) "Noise, Information and the Favorite-Longshot Bias" (working paper)

**Same model as PM012 but earlier version with cleaner exposition.**

**Equilibrium cutoff (Proposition 2, equation 4):** With N bettors, the symmetric equilibrium has all bettors with belief p >= p-hat bet on outcome 1, others on outcome -1. In the limit N -> infinity:
  p-hat / (1 - p-hat) = (1 - G(p-hat|1)) / G(p-hat|-1)
The cutoff is biased toward the ex-ante less likely outcome (contrarian incentive from winner's curse in parimutuel markets).

**FLB turning point (Proposition 3, equation 5):**
  pi* = log[(1-G(p-hat|1))/(1-G(p-hat|-1))] / {log[(1-G(p-hat|1))/(1-G(p-hat|-1))] + log[G(p-hat|-1)/G(p-hat|1)]}

**Proposition 4 (symmetric case, q=1/2):** FLB arises when:
  (1/(1-2*pi)) * log((1-pi)/pi) < N * log(G(1/2|-1)/G(1/2|1))

**Numerical example (a=1, eta_1 = 3/4, N=4):** Expected return vs. log market odds (Figure 3) reproduces Thaler & Ziemba (1988) empirical pattern. Longshots earn strongly negative returns (-60% at extreme odds), favorites earn near-zero returns.

**Abstention effect (Propositions 6-7):** As recreational value decreases or takeout increases, poorly-informed bettors exit first. Remaining bets are more informative relative to noise -> stronger FLB -> higher informed trader advantage. The participation margin is a lever on information content.

**Parimutuel vs. fixed-odds:** "The parimutuel payout structure has a built-in insurance against adverse selection. In parimutuel markets, an increase in the number of informed bettors drives market odds to be more extreme and so reduces the FLB. In fixed-odds markets, an increase in the fraction of informed bettors strengthens the FLB, because adverse selection is worsened." This is a fundamental structural difference for market design.

---

## PM014: Whelan (2024) "On Estimates of Insider Trading in Sports Betting"

**Core argument:** The standard Shin z measure (fraction of insider money) is fundamentally flawed -- it produces positive insider estimates even when there are NO insiders, because it assumes zero bookmaker profits.

**Quantitative critique of Shin z estimates:**
- **Soccer (84,230 matches, 22 European leagues):** Average estimated z = 3.5%. English Premier League: z = 2.4%. Scottish League 2: z = 4.7%.
- **Tennis (58,112 matches, ATP/WTA 2011-2022):** Average z = 5.9%. Grand Slam: z = 5.6%. Non-Grand Slam: z = 5.9%.
- **Correlation between z and overround:** 0.99 for soccer, 0.97 for tennis. The z estimate is essentially a proxy for the bookmaker's margin, not insider activity.

**Why z overestimates insiders (Section 2.2):**
For a 50/50 event, estimated z exactly equals beta - 1 (overround minus 1). E.g., beta = 1.05 -> z = 5%. beta = 1.07 -> z = 7%. Higher overround -> higher estimated insider fraction -- regardless of actual insider presence.

**Shin (1991) model with realistic beliefs (Section 3):**
Bookmaker maximizes profit. Non-insiders have beliefs p-tilde ~ Uniform[p-sigma, p+sigma]. Even with z = 0 (no insiders):
- Positive z estimates from Cain-Law-Peel method
- Favorite-longshot bias: pO_F > (1-p)O_L, bias increasing in sigma (bettor disagreement)
- Market collapses when true z exceeds ~5-10%

**Returns to hypothetical insiders (Section 4.3):**
- Perfect insider (always wins): average return = 176% per bet (soccer dataset)
- $1 reinvested -> $1.3M after 25 bets
- Partial insider (wins 1/5, random rest): ~30% avg return
- Partial insider (wins 1/10, random rest): ~11% avg return
- Real-world best bettor (Tony Bloom / StarLizard): targets 1-3% margins
- Average return across ALL soccer bettors: -7.8%

**Key conclusion:** z estimates track bookmaker margins driven by: administrative costs (mu), competition intensity, bettor disagreement (sigma), risk aversion -- NOT insider activity. Bookmakers limit insider damage through price discovery periods, customer profiling, stake limits/bans. Betting exchanges (Betfair) absorb most informed money.

---

## PM014b: Fingleton & Waldron (1999) "Optimal Determination of Bookmakers' Betting Odds"

**Extension of Shin (1991-1993):** Adds risk-averse bookmakers, operating costs, monopoly rents. Tests risk-neutral vs. infinitely-risk-averse (balanced books) behavior.

**Key parameter z:** z = alpha * z*, where z* = insider fraction, alpha = info precision (alpha=1 = perfect foresight). Allows weaker interpretation: "x% of wealth held by punters with perfect foresight, or more wealth held by less informed punters."

**Empirical estimates -- 1,696 Irish races (1993):**
- Balanced books: z = 3.7% (R=0, no margin) down to 2.5% (R=8% margin). See Table 3.
- Profit-maximizing: z = 4.0% (R=0) to 2.7% (R=8%). See Table 4.
- "Cannot distinguish between inside information and operating costs. Combined they account for up to 3.7% of turnover."

**British data (136 races, Shin 1993):**
- Irish over-round per runner: 3.33%. British: 1.86%.
- British z: 2.2% (balanced books, R=0) to 1.1% (R=8%). ~Half the Irish level.
- Jullien & Salanie (1994) estimated z = 2.3% for same British data.

**Risk aversion finding:** "We reject risk-neutral bookmaker behavior" and "cannot reject infinitely risk-averse." Irish bookmakers balance their books -- equalize liabilities across horses.

**FLB formulas:**
- Risk-neutral (eq. 12-13): pi_i = y_i * beta / sum(y_j), where y_i = sqrt(z*p_i + (1-z)*p_i^2). Non-linearity generates FLB.
- Balanced books (eq. 21): pi_i = [p_i(1-z) + z] / (1-R). Uninformed expected return = (1-R)*p_i / [p_i(1-z) + z], increasing in p_i -> confirms FLB.
- Negative inside info (doping to lose): NO FLB. "The clear presence of FLB suggests positive inside information is much closer to reality."

**Overround-runners relationship:**
- Balanced books optimal total percent: beta = [(n-1)z + 1] / (1-R), linear in n.
- More runners = higher overround: confirmed empirically.

**APOR test (Tables 7-9):**
- Raw odds: strong FLB. Coefficient on probability = 98.4, R^2 = 0.423.
- Adjusted probabilities at R=2% (balanced books): coefficient = 0.5, P=0.972 -- FLB eliminated. Model validated.
- Profit-maximizing model cannot eliminate FLB at any R -> supports balanced books.
