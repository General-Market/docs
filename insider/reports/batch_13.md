# Batch 13 — Prediction Markets Papers

## PM191: Smith, Paton & Vaughan Williams (2006) — "Market Efficiency in Person-to-Person Betting"

**Core finding:** Betting exchanges (Betfair) exhibit significantly lower insider trading and favourite-longshot bias than traditional bookmakers, explained by lower transaction/information costs rather than risk preferences.

- **Shin z (insider trading measure):** Mean bookmaker prices z = 2.17%, outlier bookmaker z = 1.19%, Betfair exchange z = 0.90%. Interpretation: z represents the percentage of betting turnover attributable to insiders.
- **Shin's original estimate (1993):** z = 2.5% from 178 races. This paper's bookmaker estimate (2.17%) is comparable; the exchange estimate (0.90%) is dramatically lower.
- **By information class (exchange prices):** Class 1 (least info) z = 1.82%, Class 2 z = 1.24%, Class 3 z = 0.52%, Class 4 (most info) z = 0.38%. Monotonically decreasing — more public information means less insider advantage.
- **Bookmaker mean z by class:** Class 1 = 2.58%, Class 2 = 2.61%, Class 3 = 1.86%, Class 4 = 1.73%. Always higher than exchange.
- **Paradox noted:** Although exchanges offer insiders the greatest opportunity to exploit knowledge (e.g., laying against non-triers), insider trading is less prevalent overall. However, standard errors of Shin z are highest for exchange data — meaning individual insider events are more exaggerated when they occur, just less frequent.
- **Information model fit:** The Sobel-Raines information model (linear: rho = alpha + beta*pi) fits the data with R^2 = 0.9998; the risk model (log-log) fits with R^2 = 0.9976. Information model crossing point at pi = 0.0849, virtually identical to theoretical 1/N = 0.0847 (N = 11.8 runners). Strong evidence that the favourite-longshot bias is information-driven, not risk-preference-driven.
- **Transaction cost mechanism:** Bookmaker over-round averages 25.63% across 700 races; Betfair commission is max 5% of winnings. Lower costs attract more informed bettors, reducing bias.
- **Shin's model of bookmaker behavior:** Bookmakers engineer the favourite-longshot bias to pass the cost of losses from insider activity onto outsiders (casual bettors).

## PM192: Debnath, Pennock, Giles & Lawrence (2003) — "Information Incorporation in Online In-Game Sports Betting Markets"

**Core finding:** In-game prediction market prices efficiently incorporate information in near-real-time, consistent with strong-form market efficiency. No direct data on insider extraction.

- **Average price reaction delay to goals:** 31.6 seconds (conservative estimate, thresholded for communication delays) across 74 goals in 34 World Cup 2002 soccer games.
- **Average percentage change in log score per goal:** 111.34%. Distribution is extremely spiky — late goals in close games move prices far more than early goals or goals in blowouts.
- **Basketball uncertainty:** AE (Average Entropy) remains > 0.8 for 55.5% of game time, > 0.7 for 77%. Price-score correlation = 0.93 in individual games, average 0.61 across 18 NBA games.
- **Soccer vs. basketball:** Soccer has infrequent but dramatic price changes; basketball has frequent but smaller price changes. Both consistent with efficient incorporation.
- **ALS (Average Logarithmic Score):** Increases roughly monotonically over time — prices converge toward correct outcome. Superlinear increase near game end as uncertainty dissolves.
- **No quantitative data on:** Insider extraction %, adverse selection costs, market maker losses, or informed vs. uninformed trader returns. Paper is purely about price efficiency and information incorporation speed.

## PM195: Dudik, Lahaie, Pennock & Rothschild (2017) — "A Decomposition of Forecast Error in Prediction Markets"

**Core finding:** Forecast error in cost-function-based prediction markets decomposes into three components — sampling error, market-maker bias, and convergence error — with explicit tradeoffs governed by the liquidity parameter b.

- **Error decomposition:** mu_true - mu_t = (mu_true - mu_bar) + (mu_bar - mu*) + (mu* - mu_t), i.e., Sampling Error + Market-Maker Bias + Convergence Error.
- **Market-maker bias:** Equals cb +/- O(b^2) as b -> 0, where b is the liquidity parameter. Bias increases linearly with liquidity — more liquid markets are more biased but converge faster.
- **Convergence error:** Decreases as gamma^t where gamma = 1 - Theta(b). So convergence worsens as b -> 0. Explicit tradeoff: lower b reduces bias but slows convergence.
- **Sampling error:** Vanishes as O(1/sqrt(N)) as number of traders N grows, under standard assumptions about bounded risk aversion and independent noisy beliefs.
- **LMSR vs. IND comparison:** At the same market-maker bias level, independent markets (IND) require between 0.5x and 2x as many trades as LMSR (Logarithmic Market Scoring Rule) for the same convergence error. Surprisingly small difference despite LMSR enforcing price coherence.
- **Worst-case market maker loss:** LMSR = b*log(K); IND = b'*K*log(2). LMSR is always better, and the advantage grows with K securities. For K=5, LMSR loss is ~1.6b vs. IND loss of ~1.7b' (where b' <= b).
- **Liquidity scaling rule:** To maintain fixed bias as trader population changes, set b proportional to N/a_bar (total cash available among traders), where a_bar is harmonic mean of risk aversion coefficients.
- **No data on:** Insider extraction, informed vs. uninformed trader returns, adverse selection. Paper is about structural forecast accuracy, not about information asymmetry between trader types.

## PM199: Posner & Weyl (2017) — "Property Is Only Another Name for Monopoly"

**NO RELEVANT DATA.** This paper proposes a Harberger tax on property to resolve the tension between allocative efficiency and investment efficiency. It concerns property rights, monopoly pricing, common ownership, and mechanism design. The only mention of market makers is a passing reference to Glosten & Milgrom (1985) showing market makers guard against exploitation by informed traders — used as an analogy for Harberger tax self-assessment mechanics. No prediction market data, no insider trading quantification, no adverse selection costs.

## PM200: Tziralis & Tatsiopoulos (2007) — "Prediction Markets: An Extended Literature Review"

**NO RELEVANT DATA.** This is a bibliometric survey cataloguing 155 prediction market articles published 1990-2006. It classifies papers into description (23%), theoretical work (17%), applications (47%), and law/policy (13%). It cites Smith et al. (2005) — the PM191 paper above — and Snowberg, Wolfers & Zitzewitz's "Information (in)efficiency in prediction markets" in its reference list. However, the review itself contains no quantitative data on insider extraction, adverse selection costs, informed trader returns, or market maker losses. It is a map of the field, not a contribution to any of the four extraction questions.
