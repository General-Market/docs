# Batch 01 — Prediction Market Foundations

## PM001: Wolfers & Zitzewitz (2004) "Prediction Markets" (NBER WP 10504)

**Insider/informed trader impact:** Paper explicitly discusses insider information advantages. Notes that "a cadre of highly informed traders can easily drive out the partly informed, repressing trade to the point that the market barely exists." Cites Tradesports contracts on Supreme Court retirement and papacy as examples where large insider information asymmetry killed liquidity entirely — "generated very little trade despite the inherent interest in these questions." This is the adverse selection death spiral: insiders extract so much expected value that uninformed refuse to participate.

**Quantitative data on adverse selection costs:** No direct % extraction estimates. However, documents the favorite-longshot bias as a measurable mispricing pattern: extreme longshots are systematically overpriced on smaller exchanges. Table 4 shows Tradesports vs. CME S&P options — tail contracts (S&P <600) priced at 5-8 on Tradesports vs. 1 from actual options, implying ~5-7x overpricing of extreme outcomes on thin markets. This persistent arbitrage opportunity implies informed traders could extract the spread.

**Manipulation resistance:** Random $500 bets on Iowa Electronic Markets by Strumpf (2004) had little discernible effect. Candidates betting on themselves at long odds created only temporary "buzz." Camerer (1998) attempted horse race manipulation with large wager cancellations — little effect. Markets appear resilient to manipulation when sufficiently liquid, but "the extent to which markets are manipulable depends — at least in part — on how thin the markets are."

**Market maker structure:** HP internal markets used 20-60 traders with subsidized participation — still produced accurate forecasts. IEM limited to $500 positions per trader. Goldman Sachs/Deutsche Bank economic derivatives operated at hundreds of millions in turnover — correlation with actual outcomes: 0.22-0.91 depending on variable. Market-implied standard errors closely matched statistical agencies' own standard errors.

**Key for our research:** The paper's central insight is that private information concentration kills prediction markets. Adverse selection is the binding constraint on market design, not manipulation.

---

## PM002: Arrow et al. (2008) "The Promise of Prediction Markets" (Science)

**Insider/informed trader impact:** NO RELEVANT DATA. This is a 2-page policy advocacy letter signed by 20 economists (Arrow, Hanson, Shiller, Varian, Wolfers, etc.) arguing for CFTC safe harbor rules for small-stakes prediction markets. Contains no quantitative analysis of insider trading, adverse selection costs, or informed trader strategies.

**Relevant context only:** IEM presidential markets erred by average 1.5 percentage points in final week vs. 2.1 for Gallup. Proposes $2,000/year per participant cap. Markets "limited to small-stakes contracts." Self-regulated exchanges would be "responsible to make reasonable efforts to keep markets free from fraud and manipulation."

---

## PM003: Hanson (2003) "Combinatorial Information Market Design" (ISF)

**Adverse selection in market scoring rules:** The paper's core mechanism design insight directly addresses adverse selection. In standard information markets, "once rational agents have hedged their risks regarding the events covered by an information market, they should not want to trade with each other" (Milgrom-Stokey no-trade theorem). The irrational participation problem means informed traders extract from noise traders who have no rational reason to participate.

**Market maker worst-case loss (explicit formula):** For a logarithmic market scoring rule with subsidy parameter beta and initial distribution q, the patron's worst-case expected loss is: `S = sum_i q_i * (s_i(1_i) - s_i(q))`. For the logarithmic rule specifically, this equals `beta * H(q)` where H(q) is the entropy of the initial distribution. This is the maximum that informed traders can collectively extract from the market maker. With N binary variables, the worst-case cost to fund the full combinatorial space is bounded by the sum of marginal entropies — "it costs no more to fund an automated market maker to trade in the entire state space than it costs to fund automated market makers limited to each variable."

**Thin market death from informed traders:** "When one person knows something about an event, and everyone else knows that they know nothing about that event, standard information markets based on that event simply cannot acquire this person's information." This is adverse selection at its limit — 100% information asymmetry collapses the market to zero volume. Market scoring rules solve this by converting the problem from bilateral trade to a subsidized scoring rule, where the subsidy IS the adverse selection cost, paid by the patron.

**Modularity and information leakage:** Logarithmic rules uniquely preserve conditional independence — a bet on A|B does not change p(B). All other rules leak information across unrelated dimensions, creating unintended adverse selection exposure for the market maker.

---

## PM004: Hanson (2007) "Logarithmic Market Scoring Rules for Modular Combinatorial Information Aggregation"

**Market maker loss bounds (formal):** The total cost to pay for T reports is `x_i = s_i(r_T) - s_i(r_0)` — depends ONLY on initial and final reports, independent of number of traders or interactions. For logarithmic rules, the maximum expected payment is `−b * sum_i pi_i * log(pi_i)` = b times the entropy of the initial distribution pi. This is the theoretical ceiling on informed trader extraction. In less extreme cases, the expected payment is "proportional to the difference between the entropies of the initial and final distributions."

**Adverse selection inference rule:** The market maker's inference rule satisfies `partial_i m_j < 0` — "to compensate for an expected adverse selection in trades. That is, people buying suggests that the market maker's price is probably too low, and people selling suggests the price is too high." This is the formal statement that every trade carries adverse selection signal.

**Fair bet characterization:** The first-order condition is a "local fair bet condition, saying that the assets exchanged as one changes one's report are locally a fair (i.e., zero expected value) bet at the current market prices r." This means informed traders profit exactly to the extent that their beliefs diverge from market prices — their expected gain equals the KL divergence between their beliefs and market prices, scaled by b.

**Spread decomposition:** The market scoring rule has "a zero bid-ask spread, at least for infinitesimal trades" — but finite trades move prices, creating effective spread. The spread is entirely adverse-selection-driven (no inventory or order-processing component). The cost function for the quadratic rule's maximum expected payment is `b - b * sum_i pi_i^2`.

**Key result for our research:** Theorem 2 proves logarithmic rules are UNIQUE in having local inference — the only rule where a bet on A|B preserves p(B). All other market scoring rules leak information, creating additional adverse selection pathways. The total extraction by informed traders is bounded by b * entropy, which is the market maker's maximum subsidy.

---

## PM005: Berg, Nelson & Rietz (2008) "Prediction Market Accuracy in the Long Run" (IJF)

**Insider/informed trader impact:** NO RELEVANT DATA on insider extraction percentages or adverse selection costs. Paper is purely about forecasting accuracy comparison between IEM presidential vote-share markets and polls across 1988-2004.

**Accuracy data (context for information aggregation efficiency):** Across 964 polls from 5 presidential elections, IEM markets were closer to the eventual outcome 74% of the time. Mean poll error: 3.37 percentage points. Mean market error: 1.82 percentage points. More than 100 days before election: poll error 4.49 pp, market error 2.65 pp. Last 5 days: poll error 1.62 pp, market error 1.11 pp. Election eve average absolute error: 1.33 percentage points across 6 markets / 14 contracts.

**Market structure (thin market data):** IEM had 155-790 active traders per election. Total investments ranged from $4,976 (1988) to $355,281 (2004). Individual accounts limited to $500. Dollar volume ranged from $3,628 to $46,237 per election. These are extremely thin markets by financial standards, yet still outperformed polls.

**Manipulation attempts:** Berg & Rietz (2006) documented that "known deliberate attempts to manipulate prices have little discernable transient effect and no apparent long term effect." Unit portfolio design makes manipulation harder — "it is not enough to drive one candidate's price up, one must also drive down the prices of all other candidates."

**Convention bounce as noise trading:** Markets showed no convention bounce while polls showed large swings during party conventions. This suggests market prices filter noise more effectively — informed traders (or at least rational traders) dominate marginal price-setting despite the tiny market size.
