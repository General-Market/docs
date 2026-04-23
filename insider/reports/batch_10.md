# Batch 10 — Prediction Market Efficiency, Liquidity, and Informed Trading

## PM026 — Servan-Schreiber, Wolfers, Pennock & Galebach (2004) "Prediction Markets: Does Money Matter?"

NO RELEVANT DATA on insider/informed trader extraction, adverse selection costs, or market maker losses. The paper compares forecast accuracy of real-money (TradeSports) vs. play-money (NewsFutures) prediction markets over 208 NFL games. Both markets performed statistically indistinguishably across four accuracy metrics (MAE, RMSE, quadratic score, log score). Both ranked in the top 1% against 1,947 individual forecasters. The one tangential observation: in play-money markets, wealth accumulates only via prior predictive accuracy, potentially giving informed traders more weight than in real-money markets where wealth may reflect inheritance or non-predictive skill. But no quantification of informed-vs-uninformed extraction.

---

## PM031 — Tetlock (2008) "Liquidity and Prediction Market Efficiency"

**Highly relevant.** This paper directly quantifies how informed (market order) traders extract from uninformed (limit order) traders on TradeSports, using 3 years of intraday data on binary-outcome securities.

- **Limit order traders lose >1% per trade during informative periods.** During clustered in-event trading (proxy for information arrival), limit orders that execute have negative expected returns exceeding -1% (value-weighted), statistically significant for both sports and financial securities. Market order traders earn >+1% in these same periods.
- **During non-informative (pre-event) periods, the pattern reverses:** limit order traders earn ~+1%, market order traders lose >-1%. Limit orders are beneficial for efficiency during quiet periods but harmful during informative ones.
- **Naive liquidity provision mechanism:** Limit order traders fail to withdraw orders when adverse selection spikes. They "leave their orders in the order book, effectively supplying liquidity in excessive amounts and leading to systematic losses." This is inconsistent with rational Glosten-Milgrom/Kyle models where market makers break even.
- **Limit orders sustain the favorite-longshot bias:** Executed limit orders passively buy overpriced longshots and sell underpriced favorites. In sports securities, purchases account for 55.6% of trades in low-price quantile 2 vs. 43.7% in high-price quantile 4. Financial securities: 54.1% vs. 46.3%.
- **Market order traders exploit the favorite-longshot bias:** They sell longshots (overpriced) and buy favorites (underpriced), earning positive expected returns in most pricing quantiles.
- **Liquidity does not improve — and sometimes worsens — pricing efficiency.** The favorite-longshot bias is 2.13 percentage points on average. Liquid markets show the same or slightly larger bias than illiquid ones. IV regressions confirm: exogenous liquidity increases lead to *less* informative prices (higher CondVar by 200-600 squared points per 1 SD liquidity increase; range 0-2500, mean 1540).
- **Lagged exploitation:** A strategy of simply following the direction of the previous market order's trade initiation earns strongly positive returns, confirming that prices underreact to informed order flow due to standing limit orders.
- **Round-trip transaction cost is max $0.08 on $10 contract (0.8%).** Informed trader returns of >1% exceed this, confirming genuine profit extraction net of fees.

---

## PM033 — Cowgill, Wolfers & Zitzewitz (2009) "Using Prediction Markets to Track Information Flows: Evidence from Google"

**Partially relevant.** Google's internal prediction markets (2005-2007) with ~1,463 traders and 270 markets reveal how insiders with different information trade, though the "insiders" here are corporate employees, not traditional informed traders.

- **Optimism bias = 10 percentage points.** Optimistic securities (good for Google) are overpriced by 10 pp on average. In 2-outcome markets, the optimistic outcome trades at 46% but earns returns to expiry of -26 pp. The pessimistic outcome is underpriced by a similar magnitude.
- **New employees drive the bias:** Newly hired are significantly more likely to take optimistic positions. More experienced traders profit from optimism, favorite, and short aversion biases.
- **Information flows via physical proximity:** Colleagues within ~10 feet show 12-20% higher probability of correlated trading positions. This is causal — exploiting office moves confirms the effect. Social/work networks play a smaller secondary role.
- **Biases declined over time** as collective experience increased, suggesting learning effects among the informed population.
- **Experienced traders as "insiders":** More experienced traders trade *against* the biases (sell optimistic securities, buy longshots), extracting from newer/biased traders. Quantified as: returns from purchasing securities are negative and statistically significant on average (short aversion + optimism bias combined).
- **Favorite bias (reverse of typical):** In Google's markets, favorites are overpriced and longshots underpriced — opposite of public markets. Liquidity-constrained play-money setting inverts the usual Ali/Manski prediction.

---

## PM035 — Rothschild (2009) "Forecasting Elections: Comparing Prediction Markets, Polls, and Their Biases"

NO RELEVANT DATA on insider trading extraction, adverse selection, or market maker losses. The paper compares accuracy of debiased Intrade prediction market prices vs. debiased poll-based forecasts (FiveThirtyEight, Poll_EW, Poll_Debiased) for 74 races in the 2008 US elections. Key finding: debiased prediction markets are more accurate and contain more unique information than debiased polls, especially early in the cycle and in uncertain races. The favorite-longshot bias in Intrade is documented (price of 85 corresponds to probability of 95; correction factor 1.64 in probit transformation, with optimal 2008 value being 2.72). The paper mentions that prediction markets can incorporate "dispersed and unpublished information" (including brewing scandals known to a few investors) faster than polls, which is tangentially relevant to informed trading advantage, but no quantification of extraction or adverse selection.

---

## PM037 — Chen, Fine & Huberman (2004) "Eliminating Public Knowledge Biases in Small Group Predictions"

NO RELEVANT DATA on insider/informed trader extraction or adverse selection costs. The paper develops a two-stage mechanism (information market + coordination game) to separate public from private information in small-group prediction settings (9-11 participants at HP Labs). The mechanism uses nonlinear Bayesian aggregation with individual risk-attitude weights (beta_i). It outperforms both the market prediction and the best individual. Relevant only in that it demonstrates private information holders can be identified and weighted — but no quantification of how much informed traders extract from uninformed, no adverse selection costs, no market maker losses. The paper's concern is aggregation accuracy, not adversarial extraction.
