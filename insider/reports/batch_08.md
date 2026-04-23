# Batch 08 — Foundational Market Microstructure & Prediction Market Theory

## PM086 — Kyle (1985), "Continuous Auctions and Insider Trading"

**Core model:** Single risk-neutral insider with monopoly on private information (knows liquidation value v), noise traders (Brownian motion with variance sigma_u^2), competitive risk-neutral market makers who earn zero profits. Market makers observe only aggregate order flow (insider + noise), not individual trades.

**Insider profit formula (single auction):** Expected profits E(pi) = (1/2)(Sigma_0 * sigma_u)^{1/2}, where Sigma_0 = var(v). Profits are proportional to the standard deviations of both the asset value AND noise trading volume — more noise = more camouflage = more profit.

**Key result — half of information revealed per auction:** In the single-auction equilibrium, Sigma_1 = (1/2)*Sigma_0 — exactly one-half of the insider's private information is incorporated into prices. The insider deliberately trades at intensity beta = (sigma_0^2 / sigma_u)^{1/2}, optimally balancing price impact against information revelation.

**Continuous equilibrium profits:** E(pi) = (1/2)(Sigma_0 * sigma_u)^{1/2} — exactly double the single-auction profits. Market depth A(t) = (Sigma_0/sigma_u^2)^{1/2} is constant. Depth is proportional to noise trading and inversely proportional to private information remaining. All private information is incorporated into prices by end of trading: Sigma(1) = 0.

**Scaling with noise trading:** Doubling noise trader volume doubles insider profits, doubles market depth, but leaves price informativeness unchanged. Noise traders bear all insider profits.

**Insider trading strategy:** dx(t) = B(t)[v - p(t)]dt — trades proportionally to the gap between true value and current price. B(t) = sigma_u * A(t)/Sigma(t) increases over time, so the insider trades more aggressively as the end of trading approaches, becoming infinitely resilient near t=1.

**Adverse selection = 1/A:** Market depth 1/A measures the order flow needed to move price by $1. Small 1/A (illiquid market) means high adverse selection. Market makers compensate for insider losses by reducing liquidity (Bagehot intuition formalized).

---

## PM087 — Glosten & Milgrom (1985), "Bid, Ask and Transaction Prices in a Specialist Market with Heterogeneously Informed Traders"

**Core model:** Risk-neutral, zero-profit specialist facing heterogeneously informed traders. Specialist sets bid B and ask A such that: A = E[V | customer buys], B = E[V | customer sells]. The spread exists purely from adverse selection — no inventory costs, no monopoly power.

**Fundamental result — spread equals adverse selection cost:** Bid-ask spread = adverse selection component. The specialist loses to informed traders on every trade, recoups losses from uninformed/liquidity traders. Ask > E[V] > Bid, with strict inequality when insider trading is possible.

**Spread formula (symmetric case):** Spread = mu * delta, where mu = fraction of informed traders, delta = range of asset value uncertainty (v_H - v_L). Spread increases linearly in both the proportion of insiders and the quality of their information.

**Convergence result (Prop 3):** Average squared spread over first k trades bounded by Var(V)/(alpha*beta*k), where alpha, beta are lower bounds on buy/sell probabilities. Root-mean-square spread decreases as 1/sqrt(k) — i.e., spread converges to zero as O(1/sqrt(n)) in the number of trades.

**Information revelation:** Transaction prices form a martingale relative to specialist's information (Prop 2). As number of trades grows, E[V|specialist info] - E[V|insider info] converges to zero in probability (Prop 4) — insiders' information advantage evaporates.

**Comparative statics (Prop 5):** Spread increases when: (i) insider information gets finer/better, (ii) ratio of informed to uninformed arrival rates increases, (iii) dispersion of uninformed liquidity preferences decreases. Market can shut down entirely (Akerlof lemons problem) if insider advantage is too large relative to liquidity trading.

**Observed vs. realizable returns:** r_t = i + (n+1)/(T-t) * log(k_t), where the second term is "what uninformed anticipate losing to informed" — a positive premium. Observed transaction-price returns overstate realizable returns by exactly the expected loss to insiders. For small/ignored firms with more insiders, this excess return is larger — a microstructure explanation for the "small firm effect."

**Market maker worst-case:** If insiders' informational advantage is large relative to liquidity trading motivation, the specialist must set the spread so wide that it precludes all trade — complete market breakdown. This is the adverse selection bound on market viability.

---

## PM067 — Ostrovsky (2012), "Information Aggregation in Dynamic Markets with Strategic Traders"

**Setting:** Prediction markets using Market Scoring Rules (MSR), specifically Hanson's automated market maker. Finite number of partially informed strategic traders, no noise traders. Market maker losses are deterministically bounded.

**Main result — separability determines aggregation:** If a security is "separable" (Arrow-Debreu securities, additive payoffs, monotone transformations thereof), then in ANY perfect Bayesian equilibrium, the market price converges in probability to the true expected value conditional on ALL traders' pooled information. This holds for any prior, any scoring rule, any discount factor.

**Non-separable securities:** There exist priors under which information does NOT get aggregated — traders can get "stuck" at incorrect prices. Example: two players each flip a coin privately; payoff = 1 if both match, -1 otherwise. With fair coins, neither player's forecast is informative and the price stays at 0 forever.

**Mechanism of extraction:** In MSR prediction markets, the market maker is the guaranteed loser — its losses are bounded but inevitable. Informed traders extract value by revising forecasts. Each player can guarantee zero payoff by not revising (the "no-trade" option). Positive expected payoff comes from moving the forecast closer to the truth.

**Profit structure:** Payoff from revision k: beta^k * [s(y_k, x*) - s(y_{k-1}, x*)], where s is a strictly proper scoring rule. The market maker's total expected loss funds ALL trader profits. There is no explicit % extraction from uninformed (since there are no noise traders in this model) — the market maker is the sole liquidity provider and loss-bearer.

**Relevance to prediction markets:** This is the theoretical foundation for automated market makers in prediction markets (Hanson LMSR). Key insight: for binary outcome contracts (Arrow-Debreu = separable), information ALWAYS aggregates regardless of strategic behavior. For more exotic multi-dimensional contracts, aggregation may fail.

---

## PM071 — Das (2005), "A Learning Market-Maker in the Glosten-Milgrom Model"

**Extension:** Computational implementation of Glosten-Milgrom with dynamic true value (jump process), noisy informed traders, and explicit density estimation by the market maker.

**Adverse selection dynamics around jumps:** Immediately after a true-value jump, information asymmetry is extreme — spreads spike to 40-80 cents (jump sigma=50-100 cents). Within ~30 trades, the asymmetry is resolved regardless of jump size, spreads return to baseline (~2 cents). This two-regime behavior (high-spread/high-info-asymmetry vs. low-spread/symmetric-info) is the dominant feature.

**Market maker profit by informed trader proportion (Table/Fig 4):**
- 50% noisy informed, shift=1: ~3.5 cents/period profit
- 70% noisy informed, shift=1: ~1.17 cents/period, avg spread 2.28 cents
- 90% noisy informed, shift=1: ~1.0 cents/period (peaks then declines)
- 70% perfectly informed: profit rises monotonically with spread (all profit from uninformed)
- At zero-profit condition (shift=0), 70% noisy informed: -0.06 cents/period, spread 0.35 cents

**Profit source decomposition:** With low spreads, market maker profits come from the noise component in informed traders' signals. With high spreads, profits come from uninformed traders. With perfectly informed traders (no noise), ALL market maker profit comes from uninformed — the informed extract maximum value.

**Volatility and spread (Table 2):**
- sigma=50, p=0.001: spread 0.35c (shift=0), 2.31c (shift=1)
- sigma=100, p=0.005: spread 3.07c (shift=0), 5.00c (shift=1)
- Higher volatility and jump frequency both increase spreads and informed trader extraction.

**Key quantitative insight:** With known jumps, avg MM profit = 0.77 cents/period, spread = 2.33c. With unknown jumps, avg MM LOSS = -0.66 cents/period, spread = 4.37c, and "loss of expectation" jumps from 0.75 to 4.56. When the market maker cannot detect regime changes, informed traders extract dramatically more.

---

## PM088 — Madhavan (2000), "Market Microstructure: A Survey"

**Canonical adverse selection model:** Price impact of trade = s + lambda, where s = half-spread (order processing), lambda = information asymmetry parameter. For unit purchase: p_t - k_t = s + lambda. In Glosten-Milgrom: spread = mu * delta (fraction informed times value uncertainty). In Kyle: p = k_{t-1} + lambda * q_t (linear price impact).

**Empirical estimates of information vs. inventory effects:**
- French & Roll (1986): At most 12% of daily return variance caused by trading process (mispricing); remaining 88% attributable to information factors. Variance during trading hours is 5x close-to-open, 20x+ on hourly basis.
- Glosten & Harris (1988): Adverse selection component is not economically significant for small trades but increases with trade size.
- Hasbrouck (1988, 1991): After extracting inventory autocorrelation, trade innovations still have positive impact on quote revisions — "information effect dominates inventory control."
- Madhavan & Smidt (1991, 1993): Asymmetric information is important element of intraday price dynamics; specialist inventories mean-revert with half-life of 49 days (7.3 after controlling for target shifts).

**Block trade price impacts (Keim & Madhavan 1996):**
- Seller-initiated: -4.3% when benchmark = prior day close; -10.2% when benchmark = 3 weeks prior (difference = information leakage during upstairs "shopping")
- For stocks with market cap < $25M: market impact of large block > 15% (Loeb 1983)
- For large liquid stocks: impact as low as 1%
- Both permanent (information) and transitory (inventory/liquidity) components significant for small caps.

**Multiple insiders effect (Holden & Subrahmanyam 1992):** Competition among multiple risk-averse insiders leads to much higher trading volumes, rapid revelation of private information, and MUCH lower insider profits vs. Kyle's single-insider model. Whether insider trading is a policy concern depends critically on whether insiders compete.

**Informed trader strategy (Barclay & Warner 1993):** Informed traders concentrate orders on medium-sized trades — not the largest trades. Stealth trading.

**Commonality in order flows (Hasbrouck & Seppi 1999):** Common factors in order flows account for 50% of commonality in returns — systemic informed trading patterns exist across stocks.

**Key survey conclusion on adverse selection:** The spread contains an informational component that represents the expected loss of uninformed traders to informed traders. This is distinct from inventory costs and order processing costs. Empirical evidence consistently shows the information effect dominates inventory effects in explaining short-run price dynamics.
