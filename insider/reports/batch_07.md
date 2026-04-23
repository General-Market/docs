# Batch 07 — Prediction Market Mechanisms & Information Aggregation (Replacement)

Previous batch_07 content moved; this file now covers the five assigned papers.

## PM051 — Wolfers & Zitzewitz (2006) "Prediction Markets in Theory and Practice"

Survey/encyclopedia entry on prediction markets. Theoretical and empirical overview.

- **Grossman-Stiglitz impossibility**: Prices can never be fully efficient — if they were, no trader would bother gathering information. In equilibrium, pricing inefficiency is "just sufficient to induce a proportion of traders to become informed." This is the fundamental tension for any prediction market: the market maker's loss IS the payment for information.
- **Informed vs. uninformed trade drivers**: Trade is driven by "uninformed outsiders with either hedging- or entertainment-driven demand," or by "manipulators attempting to influence market prices" (adaptation of Kyle model, Wolfers & Zitzewitz 2006).
- **Manipulation fails**: Camerer (1998) tried to manipulate pari-mutuel horse racing with $500 last-second bet cancellations — no discernible effect. Rhode & Strumpf (2005) found no lasting manipulation effects in political markets. Manipulation attempts had effect only during "a short transition phase."
- **Favorite-longshot bias**: Systematic tendency to overprice low-probability events documented across horse racing (5M+ starts, 611K races, 1992-2002 US data). Longshots at 100/1 odds show ~60% negative returns; favorites near even odds show ~15% negative returns.
- **No quantitative estimates** of informed trader extraction rates, adverse selection costs, or market maker worst-case loss from insider trading specifically.

**RELEVANCE**: Low-moderate. Establishes theoretical framework (Grossman-Stiglitz inefficiency as payment for information) but no quantitative insider extraction data.

---

## PM054 — Tziralis & Tatsiopoulos (2007) "Prediction Markets: An Extended Literature Review"

Pure literature classification exercise covering 155 PM articles (1990-2006).

- Classifies papers into four categories: description (23%), theoretical (17%), applications (47%), law/policy (13%).
- 16 of 27 theoretical papers address market modeling/design; 9 address information aggregation convergence/equilibrium.
- References Hanson & Oprea (2004) "Manipulators increase information market accuracy" and Hansen, Schmidt & Strobel (2004) "Manipulation in political stock markets" but does not extract or report quantitative findings from either.
- No original data, no empirical analysis, no quantitative estimates of any kind.

**RELEVANCE**: NO RELEVANT DATA. This is a classification index, not a source of insider trading metrics.

---

## PM058 / PM066 — Gillen, Plott & Shum (2017) "A Pari-mutuel like Mechanism for Information Aggregation: A Field Test Inside Intel"

NOTE: PM058 and PM066 are identical files (same MD5 hash). This is the Gillen/Plott/Shum 2017 paper, not the Chen & Plott 2002 paper the PM058 filename suggests.

Long-running field experiment (2006-2013) using a pari-mutuel Information Aggregation Mechanism (IAM) to forecast Intel product sales across 5 product lines, 979 market instances.

- **Insider classification system**: Participants classified into four tiers: (i) Street, (ii) Intel general, (iii) Intel specific, (iv) Intel technical. Prediction groups "typically consisted of 5-10 people from (iii) and (iv)." When groups contained many participants from (i) or (ii), predictions "mirrored public knowledge, drowning out the informed signals from insiders."
- **Informed vs. uninformed dilution**: Groups with too many uninformed participants drowned out insider signals. The mechanism worked best with 10-25 curated participants who had specific operational knowledge.
- **IAM outperforms official forecasts**: IAM delivered lower forecast error in 63% of runs. RMSFE ~8% lower than official forecast overall. At 1-month horizon: IAM outperformed 65% of the time.
- **Optimal forecast combination weights**: Regression assigns IAM weight of +111% and official forecast weight of -48%. The official forecast is negatively weighted — it adds noise, not signal. By horizon: 1-month (IAM +116%, official -20%), 2-3 months (IAM +131%, official -50%), 7-9 months (IAM +107%, official -65%).
- **Information-rich vs. information-scarce settings**: At short horizons (1-3 months), IAM quantiles match uniform distribution almost perfectly (KS p-value = 72% for last-month run, mean abs deviation 3.4%). At long horizons (7-9 months), systematic "reverse favorite-longshot bias" — tail probabilities understated (mean abs deviation 12.8%, KS p-value = 0%).
- **Direct vs. indirect channels**: Direct sales forecasts more accurate (mean abs deviation 5.4% vs. 9% for indirect at short horizons). Reverse-FLB present in both channels at long horizons.
- **Timing incentive design**: Ticket prices increase at 1 Franc/minute after 15-minute flat period. Combats free-riding where participants wait to observe others' bets. Plott et al. (2003) showed last-second buying "contributed to the creation of bubbles and retarded successful information aggregation."
- **Pari-mutuel strategic bias (Ottaviani & Sorensen 2010)**: In simultaneous pari-mutuel systems, reverse-FLB arises when privately-held information is diffuse relative to noise. FLB arises when private info is precise. The direction of the bias depends on the ratio of signal to noise.
- **No direct extraction measurement**: Synthetic currency means no P&L per trader type. Cannot measure how much insiders extract from uninformed.

**RELEVANCE**: Moderate. Demonstrates that insiders with specific operational knowledge dominate forecast accuracy, that diluting them with uninformed participants destroys signal, and quantifies the information value gap (8% RMSFE). Does not measure extraction rates.

---

## PM059 — Othman, Sandholm, Pennock & Reeves (2013) "A Practical Liquidity-Sensitive Automated Market Maker"

Theoretical/design paper constructing a liquidity-sensitive variant of Hanson's LMSR.

- **LMSR worst-case loss**: `b * log(n)` where b = liquidity parameter, n = number of outcomes. "This loss is rationalized as payment for traders' information."
- **Market maker loss is tautological under translation invariance**: "A translation invariant pricing rule ensures that the market maker will take a loss as long as the final market prices are more accurate than the initial market prices, a condition that is essentially tautological."
- **Real-world market makers profit**: "In the real world, the vast majority of market makers run at a profit. It is no coincidence that most examples of LMSR in practice are games based on virtual currency rather than real money."
- **Impossibility theorem (Theorem 2.9)**: No market maker can simultaneously satisfy path independence, translation invariance, AND liquidity sensitivity. Must sacrifice one.
- **Their variant**: Uses variable liquidity `b(q) = alpha * sum(qi)`. Key properties:
  - Bounded loss = C(q0), approaching zero as initial quantities approach zero
  - Sum of prices in range `[1, 1 + alpha*n*log(n)]` — the spread above 1 is the market maker's commission
  - Commission parameter: to emulate v% commission, set `alpha = v / (n * log(n))`
  - Cost function is positive homogeneous of degree 1, so prices scale proportionately with market volume
- **Outcome-independent profit region**: For balanced markets (high entropy of final prices), market maker books profit regardless of outcome. Loses only when final prices are extremely lopsided (one outcome near certainty — which is precisely when an informed trader has won).
- **Real-world commission range**: "Market makers generally operate with a commission of somewhere between 2 and 20 percent."
- **Revenue comparison vs. LMSR**: For same worst-case loss bound, their market maker collects significantly more revenue than LMSR in lopsided states (where informed traders have pushed prices).

**RELEVANCE**: Low for insider extraction specifically. High for market maker design constraints. The key quantitative takeaway: LMSR worst-case loss = `b*log(n)`, real-world commissions = 2-20%, and the market maker's loss is structurally what informed traders collectively extract. The impossibility theorem constrains what any AMM can achieve.
