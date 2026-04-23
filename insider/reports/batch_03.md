# Batch 03 — Prediction Markets: Insider Extraction & Informed Trading

## PM050 — Dreber et al. (2015) "Using Prediction Markets to Estimate Reproducibility"
**No relevant data.** This paper uses prediction markets to forecast whether psychology studies will replicate. It describes a logarithmic market scoring rule with 47-52 traders each endowed with $100. No discussion of insider trading, adverse selection, extraction rates, or informed trader advantage. The market correctly predicted 71% of replication outcomes, outperforming surveys, but the focus is entirely on scientific reproducibility — not on informational asymmetry or its costs.

## PM051 — Wolfers & Zitzewitz (2006) "Prediction Markets in Theory and Practice"
**Marginal relevance — theoretical framing only.** This survey chapter for the New Palgrave Dictionary describes a Kyle-model adaptation where trade is driven by "uninformed outsiders with either hedging- or entertainment-driven demand." It notes the Grossman-Stiglitz (1976) impossibility: if prices fully reflect information, nobody has incentive to gather it — equilibrium requires "inefficiency in pricing just sufficient to induce a proportion of traders to become informed." This is the theoretical foundation of the informed trader tax, but no quantitative estimates are provided. The paper also notes that manipulation attempts (Rhode & Strumpf, Camerer) had no discernible effect on prices except during short transition phases.

## PM052 — Wolfers & Zitzewitz (2009) "Using Markets to Inform Policy: The Case of the Iraq War"
**No relevant data on insider extraction.** The paper exploits the Tradesports "Saddam Security" to estimate the economic effects of the 2003 Iraq war. The methodology correlates prediction market prices with oil/equity movements. A 10pp increase in war probability raised spot oil ~$1 and lowered S&P 500 ~1.5%. Monthly trading volumes were ~$10,000 initially, rising to $1.2M total. The paper discusses bid-ask bounce and slow information incorporation in the Saddam Security, and notes that IV estimation (using Saletan's "Saddameter") suggests bias from prediction market traders responding to financial markets is <10%. But there is no analysis of informed vs. uninformed trader flows or extraction rates.

## PM053 — Berg, Forsythe, Nelson & Rietz (2001) "Results from a Dozen Years of Election Futures Markets Research"
**Moderate relevance — marginal trader theory.** The key finding: individual traders in the Iowa Electronic Markets display "considerable biases and often make mistakes," but the market remains accurate because a core group of "marginal traders" (those who regularly trade near the top of order queues) are less biased and error-prone. "Market makers" who set best bids/asks make mistakes much less often than typical traders. This is the canonical evidence that informed marginal traders drive prediction market accuracy. However, no quantitative measure is given of how much uninformed traders lose to this informed margin. The paper notes that in 1996, "a large cash influx by new traders late in the campaign" drove prices away from the correct outcome — a rare case where uninformed flow dominated.

## PM054 — Tziralis & Tatsiopoulos (2007) "Prediction Markets: An Extended Literature Review"
**No relevant data.** A bibliometric classification of 155 prediction market papers (1990–2006) into four categories: description, theory, applications, and law/policy. No original empirical findings on insider trading, adverse selection, or extraction rates.

## PM055 — Horn et al. (2014) "Prediction Markets — A Literature Review 2014"
**No relevant data.** Continuation of Tziralis & Tatsiopoulos, classifying 316 papers (2007–2013). Purely bibliometric — no original empirical or theoretical content on informed trading or extraction costs.

## PM056 — Luckner (2008) "Prediction Markets: Fundamentals, Key Design Elements, and Applications"
**Minor relevance — design considerations around insiders.** Notes that "one should avoid running markets on topics where insiders may possess substantially superior information or where information is concentrated on very few people. Such markets have historically attracted very little attention" (citing Wolfers & Zitzewitz 2004). Also notes that overconfident traders and noise trading "should actually improve the accuracy of trading prices because this increases the rewards to informed trading — provided informed traders have deep pockets relative to the volume of noise trading." Discusses pari-mutuel timing incentives: in standard pari-mutuel markets "it is the best strategy to wait until the last possible moment to buy," which is the canonical late-betting insider strategy. Pennock's Dynamic Pari-Mutuel Market was designed to counter this by offering price-changing continuous trading. No quantitative estimates of extraction.

## PM057 — Graefe et al. (2017) "Combining Forecasts: An Application to Elections"
**No relevant data.** Compares combined forecasts (polls, models, experts, IEM prediction markets) for US presidential elections 1992–2012. Combining reduced error 16–59% vs. individual methods. No discussion of informed trading, adverse selection, or extraction.

## PM058 — Gillen, Plott & Shum (2017) "A Pari-Mutuel Like Mechanism for Information Aggregation: A Field Test Inside Intel"
**Significant relevance — insider selection and information aggregation.** This is a long-running field test of an Information Aggregation Mechanism (IAM) inside Intel. Key findings relevant to informed trading:
- Participants were classified by information level: (i) Street, (ii) Intel general, (iii) Intel specific, (iv) Intel technical. "Prediction groups typically consisted of 5-10 people from (iii) and (iv)." Groups with too many uninformed participants "(i) or (ii) tended to produce predictions that mirrored public knowledge, drowning out the informed signals from insiders."
- Ticket prices increase over time to incentivize early revelation — countering the pari-mutuel incentive to wait and free-ride on others' information.
- IAM outperformed Intel's official forecast in 63% of runs. The ex-post optimal combination assigns positive weight to IAM and **negative weight** to the official forecast — meaning insiders' aggregated information was not just additive but corrective.
- Forecasts were more accurate at shorter horizons (1-3 months) and for direct sales channels where Intel has "reliable and accurate information." At longer horizons (>4 months), the IAM overstated expected sales, consistent with a "reverse favorite-longshot bias."
- No direct measurement of uninformed participant losses, but the design explicitly acknowledges that uninformed participants degrade signal quality.

## PM059 — Othman, Sandholm, Pennock & Reeves (2013) "A Practical Liquidity-Sensitive Automated Market Maker"
**Relevant — market maker losses to informed traders.** The paper states that "an LMSR operator can expect to lose money in proportion to the liquidity it provides" and that "a translation invariant rule shrinks the size of the spread to zero, leaving the market maker exposed to the negative downside risk of offering prices without any upside." This is the formal statement that automated market makers in prediction markets pay a subsidy that is effectively captured by informed traders. The proposed liquidity-sensitive market maker breaks translation invariance so prices sum to >$1, creating a "vig" — the first prediction market mechanism explicitly designed to let the market maker profit rather than subsidize informed traders. Key theorem: no market maker can simultaneously be path-independent, translation-invariant, and liquidity-sensitive. Real-world market makers run at profit precisely by abandoning translation invariance (charging a spread). The LMSR's worst-case loss is b*ln(n) where b is the liquidity parameter and n is the number of outcomes.

## PM060 — Abernethy, Chen & Vaughan (2013) "Efficient Market Making via Convex Optimization"
**Minor relevance.** Extends automated market maker theory to combinatorial/infinite outcome spaces via convex optimization. Notes that LMSR worst-case loss is b*log|O|. The paper focuses on computational tractability rather than informed trading dynamics, but reinforces the point that cost-function-based market makers always subsidize informed traders (bounded loss = bounded subsidy for information extraction).

## PM061 — Pennock & Sami (2007) "Computational Aspects of Prediction Markets"
**Moderate relevance — marginal traders and no-trade theorems.** Reviews the theoretical underpinnings:
- In IEM: "accuracy derives not from average traders, but from marginal traders. Marginal traders are more active, less biased, more successful, and are price makers rather than price takers." This is the canonical statement of how informed traders dominate pricing.
- No-trade theorem: in fully-revealing rational expectations equilibrium, "all agents are conditioning their beliefs on identical information... there will not be any trade in equilibrium." In practice, trade occurs because of "irrational traders, traders who are trading to hedge risks, traders who trade for liquidity reasons, or a market-maker who is subsidizing the market." Each of these is a source of extraction for informed traders.
- The LMSR market maker's loss is rationalized as "payment for traders' information" — an explicit acknowledgment that the market maker subsidizes informed extraction.

## PM062 — Goel, Reeves, Watts & Pennock (2010) "Prediction Without Markets"
**Relevant — surprisingly small informed advantage.** Compares prediction markets (Las Vegas, Tradesports, Hollywood Stock Exchange) to polls and simple statistical models across >27,000 events. Key quantitative finding: "the Las Vegas market for professional football is only 3% more accurate in predicting final game scores than a simple, three-parameter statistical model, and the market is only 1% better than a poll of football enthusiasts." This implies the informational edge that prediction markets aggregate from informed traders is remarkably small in mature, well-functioning markets. "Nearly all the predictive power [is] captured by only two or three parameters." The implication for extraction: in deep, mature markets, the marginal value of private information is very low, which limits how much informed traders can extract.

## PM063 — Gruca, Berg & Cipriano (2005) "Consensus and Differences of Opinion in Electronic Prediction Markets"
**Minor relevance.** Studies IEM movie box office prediction markets where student traders submitted forecasts before trading. Markets "do an excellent job revealing the consensus forecast" and prices are consistent with the distribution of private forecasts. Markets with wider trader pools produced superior forecasts. Self-selection is noted: "only those traders who believe that they have superior information will join the market." No quantitative extraction rates, but confirms the theoretical point that prediction markets attract self-selected informed traders.

## PM066 — Gillen, Plott & Shum (2017) — duplicate of PM058 entry above (same paper, different numbering)
See PM058 analysis above.

## PM067 — Ostrovsky (2012) "Information Aggregation in Dynamic Markets with Strategic Traders"
**Relevant — strategic information withholding.** Proves that "separable" securities always aggregate information in dynamic markets even with strategic traders, while non-separable ones may not. The paper models a market scoring rule game where an automated market maker subsidizes trading (bounded loss). Key insight for insider extraction:
- The market maker's losses are "deterministically bounded" — this is the maximum subsidy available for informed traders to extract.
- Strategic traders can always guarantee zero payoff by not trading, so any positive payoff comes from informational advantage.
- Information aggregation relies on the fact that if price is wrong, "an informed trader will have an incentive to buy or sell this security, thus bringing the price closer to the correct value." The profit from doing so is the extraction.
- Arrow-Debreu securities, additive securities, and monotone transformations thereof are all separable — meaning information always aggregates in these markets. This has direct implications for prediction market contract design.

## PM068 — Iyer, Johari & Moallemi (2014) "Information Aggregation and Allocative Efficiency in Smooth Markets"
**Moderate relevance.** Shows that "asymptotic smoothness" (vanishing bid-ask spread for infinitesimal trades) is sufficient for information aggregation among risk-averse strategic traders. Key points:
- Without smoothness, "prices may be set in a manner that completely precludes trading and thus the dissemination of information" (Glosten & Milgrom 1985). Wide spreads are the market maker's defense against informed traders — but they also prevent information aggregation.
- With risk-averse traders, the no-trade theorem is relaxed: "traders may trade purely on the motive of hedging." This hedging flow is exactly what informed traders extract from.
- Final portfolios are ex-post Pareto efficient, and prices are "risk-adjusted probabilities." Only if at least one trader is risk-neutral do prices equal true posterior probabilities.
- The tension: a prediction market maker wants smooth prices to aggregate information (its primary goal), but this smoothness means accepting losses to informed traders.

## PM069 — Dimitrov & Sami (2008) "Non-Myopic Strategies in Prediction Markets"
**Highly relevant — strategic bluffing and manipulation.** Proves that under generic conditions, the myopically optimal (truthful) strategy is NOT a sequential equilibrium in logarithmic market scoring rule markets. Key findings:
- In a two-player prediction market, a trader can profit by first misleading the other trader through a dishonest trade, then correcting in a later round. "Moves towards the true probability have a positive profit, and moves away from the true probability have a negative profit" — but the corrective move profits can exceed the bluffing cost.
- For "many instances" of point configurations, the myopic strategy is not optimal for ALL values of signal probability q. "No finite sequence of moves by the two players leading to the optimal values can be an equilibrium."
- **Discounting solves the problem:** introducing a discount factor delta on future payoffs can stabilize the myopic equilibrium. Even delta = 0.99 is sufficient in some configurations. The ratio m (cost of misleading / payoff of correcting) determines the minimum discount factor needed.
- This is direct evidence that informed traders in prediction markets can and will use strategic timing — bluffing early to profit from correction later. The extraction is the difference between the corrective profit and the bluffing cost.

## PM070 — Brahma et al. (2012) "A Bayesian Market Maker"
**Relevant — market maker losses and informed trader dynamics.** Proposes a Bayesian Market Maker (BMM) as alternative to LMSR. Key quantitative points:
- LMSR's worst-case loss is b*ln(2) for a binary market. This is the maximum subsidy available for informed extraction.
- "Without uninformed traders to exploit, informed traders will not trade (the No-Trade theorem of Milgrom and Stokey 1982). Automated market makers are a means of creating 'uninformed' (or less informed) trades that can provide liquidity." — The market maker IS the uninformed counterparty. Its losses are the informed traders' profits.
- "A computer program with less than human intelligence that attempts to make markets runs the risk of being out-smarted by human traders" (Hanson 2009). This is the extraction mechanism stated plainly.
- The paper identifies an inherent tradeoff: "there is an inherent tradeoff between adaptability to market shocks and convergence during market equilibrium." Adaptive market makers (small b in LMSR) have wider spreads and less liquidity. Convergent market makers become "overconfident" and slow to adapt to value jumps — creating exploitation windows for informed traders.
- The information disadvantage of the market maker is formalized as ρ = σ_mm / σ_trader. Larger ρ means more extraction potential.
- BMM "quickly adapts and generally does not lose money" but sacrifices the bounded-loss guarantee — meaning in worst case, informed traders could extract more.
