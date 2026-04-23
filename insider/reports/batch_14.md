# Batch 14 — Prediction Markets Papers

## PM046 — Gjerstad (2005) "Risk Aversion, Beliefs, and Prediction Market Equilibrium"

NO RELEVANT DATA.

This is a pure theory paper on how risk aversion and belief distributions determine equilibrium prices in prediction markets. It extends Manski (2004) by showing that with CRRA utility and coefficient theta = 1 (logarithmic utility), the equilibrium price exactly equals the mean belief E[pi], regardless of belief distribution (Theorem 1). For theta in [0.5, 1), prices lie between the mean belief and 0.5; for theta > 1, prices overshoot the mean belief away from 0.5. With empirical risk aversion estimates (theta in [0.68, 0.97] per Hansen & Singleton 1982), equilibrium prices are within $0.008 of the mean belief for Beta(2,2) distributions.

The paper contains no data on informed/insider trading, adverse selection costs, market maker losses, or insider strategies. It deals exclusively with how heterogeneous beliefs aggregate into prices under different risk preferences. The favorite-longshot bias is shown to be consistent with risk aversion (theta < 1) rather than requiring risk-seeking bettors.

---

## PM049 — Atanasov, Witkowski, Mellers, Tetlock (2017/2024) "Crowd Prediction Systems: Markets, Polls, and Elite Forecasters"

**Relevant to informed trader advantage and market structure, though not directly about insider extraction.**

- **Elite (top 2%) vs. sub-elite crowds**: Small elite crowds (n=122-139) outperform large sub-elite crowds (n=404-430) by ~0.05 Brier score points (21% improvement), with p < .001. This holds across both LMSR prediction markets and team prediction polls.
- **Elite advantage is entirely from discrimination, not calibration**: Brier decomposition shows calibration error is similar (0.009 for Superpolls vs. 0.008 for sub-elite polls), but elite crowds have far superior discrimination (0.44 vs. 0.37).
- **LMSR markets outperform CDA markets by 14%** (Brier score 0.211 vs. 0.245, paired t = 2.28, p = 0.024). CDA underperformance is concentrated on low-activity questions (< 100 traders) and early periods within questions.
- **Market earnings reliability is lower than poll accuracy reliability**: Cross-season rank correlation for prediction markets = 0.20, vs. prediction polls = 0.38 (p < .001). A single large bet can dominate a trader's P&L, making market earnings noisier as a skill signal.
- **Even 24-28 elite forecasters outperform 300+ sub-elite forecasters**: Subsampling shows elite crowds maintain accuracy advantage even at forecaster-to-question ratios of 1:5.
- **Market price extremization helps**: Applying extremization (a = 1.32) to Supermarket prices improved Brier score from 0.173 to 0.161. Hindsight-optimal (a = 1.75) reached 0.158, matching Superpolls at 0.156.
- **Insider knowledge concern noted**: Google's chief economist Hal Varian stated that data sensitivity killed one Google prediction market project because "anybody who looks at the auction is now an insider" — the market itself creates insider information.

No direct quantification of % trade value extracted by informed traders, adverse selection costs, or market maker worst-case loss.

---

## PM050 — Dreber, Pfeiffer, Almenberg et al. (2015) "Using Prediction Markets to Estimate the Reproducibility of Scientific Research"

NO RELEVANT DATA on insider/informed trading extraction.

This paper uses prediction markets to forecast whether 44 psychology studies will replicate. Key findings on market accuracy:
- Markets correctly predicted 71% of replication outcomes (29/41), significantly above 50% (p = 0.012).
- Market prices can be interpreted as replication probabilities: coefficient of market price on replication outcome = 0.995 (not different from 1, p = 0.987).
- Markets outperform surveys: absolute prediction error significantly lower for markets vs. surveys (paired t = -2.558, p = 0.015).
- Bayesian inference from market prices: median prior probability of tested hypotheses being true = 8.8%; after initial positive publication = 56%; after successful replication = 98%; after failed replication = 6.3%.
- 43% of statistically significant findings in top psychology journals estimated to be false positives.
- LMSR market maker used with b = 100; investing 1/10 of endowment moves price from 50% to ~55%.

The paper demonstrates prediction market accuracy but contains no data on informed trader extraction, adverse selection, or insider trading strategies.

---

## PM052 — Wolfers & Zitzewitz (2009) "Using Markets to Inform Policy: The Case of the Iraq War"

**Contains quantitative estimates of prediction market information content and price impact, but not insider extraction per se.**

- **Saddam Security**: Traded on Tradesports.com, a continuous double auction with 0.4% commission. ~$1.2 million total volume over the market's life. Monthly volumes ~$10,000 during ex-ante period.
- **Price impact estimates**: A 10 percentage point increase in war probability was associated with:
  - $1/barrel increase in spot oil price (5-day difference specification: coefficient = 11.24, SE = 2.08)
  - 1.5% decline in S&P 500 (5-day difference: coefficient = -0.145, SE = 0.057)
- **War explained 30%+ of S&P variation and 75% of oil price variation** (Sept 2002 - Feb 2003, based on R-squared from longest difference regressions).
- **Distribution of expected war effects** (from S&P options, assuming CRRA = 1): 70% probability of 0 to -15% S&P decline, 20% probability of -15% to -30% decline, 10% probability of even larger decline. Mean = -15%, median = -12%, mode = -10%.
- **Prediction market efficiency**: Saddam Security prices followed a random walk; regressing June Saddam on Saddameter (expert assessment) yielded coefficient = 0.9 (SE = 0.08, R-squared = 0.81), suggesting <10% bias from prediction market participants responding to financial market movements.
- **Bid-ask bounce and slow information incorporation**: Negative first-order autocorrelation in price changes. Some information incorporated with 1-2 day lag. IV estimation using Saddameter addresses attenuation bias.
- **Strumpf (2004) finding cited**: Price impact from random $500 trades on Iowa markets dissipated within 24 hours.

No quantification of informed trader percentage extraction, adverse selection costs, or market maker worst-case loss. The paper uses prediction markets as an instrument for policy analysis, not to study trading dynamics.

---

## PM055 — Horn, Ohneberg, Ivens, Brem (2014) "Prediction Markets — A Literature Review 2014"

NO RELEVANT DATA.

This is a bibliographic literature review cataloguing 316 prediction market articles published 2007-2013. Classification: 54% applications, 24% descriptive, 16% theoretical, 6% law & policy. Within applications: 33% functionality/accuracy, 35% comparisons, 21% errors (bias, manipulation, illiquidity, arbitrage), 11% participants.

The review mentions relevant subcategories — errors (favorite-longshot bias, over/underpricing, momentum, manipulation, illiquidity, arbitrage) and participants (structure, behavior, background) — but provides no original quantitative data. It is a catalogue of 318 citations with no extraction of insider trading metrics, adverse selection costs, or informed trader returns from the underlying papers. The bibliography references papers by Borghesi on price biases, Ottaviani & Sorensen on outcome manipulation, Hanson & Oprea on manipulation aiding accuracy, Veiga & Vorsatz on price manipulation experiments, and Jian & Sami on aggregation and manipulation — but the review itself contains no numerical findings.
