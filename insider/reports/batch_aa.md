# Batch AA — Prediction Markets (PM001–PM010)

Extraction targets: (1) % of trade value informed/insiders extract from uninformed, (2) scaling of insider impact across repeated trades, (3) insider trading strategies in prediction/betting markets, (4) quantitative adverse selection costs or market maker losses to informed flow.

---

## PM001 — Wolfers & Zitzewitz 2004, "Prediction Markets"

Survey paper on prediction market design and accuracy. Notes that "a cadre of highly informed traders can easily drive out the partly informed, repressing trade to the point that the market barely exists." Markets on topics with concentrated insider information (e.g., Supreme Court retirement, papal succession) have failed due to lack of counterparty willingness. Several known manipulation attempts (random $500 bets on IEM, candidates betting on themselves at long odds, canceling large horse race wagers) had no lasting price effect. References Plott & Sunder (1982, 1988) lab experiments on insider information aggregation. References Poteshman (2004) finding little evidence of unusual options trading before 9/11. No quantitative extraction percentages or adverse selection cost estimates provided.

## PM002 — Arrow et al. 2008, "The Promise of Prediction Markets"

Short Science policy forum piece (22 authors including Arrow, Hanson, Shiller, Sunstein). Advocates for regulatory reform to permit prediction markets. Mentions need to keep markets "free from fraud and manipulation" and references "manipulation, liquidity requirements" as design concerns. No data whatsoever on informed trading, adverse selection costs, or insider extraction rates.
NO RELEVANT DATA.

## PM003 — Hanson 2003, "Combinatorial Information Market Design"

Introduces market scoring rules (MSR) for combinatorial prediction markets. Notes that in standard info markets, "offers that wait long before being accepted suffer adverse selection from new public information." Identifies the thin-market problem: if a single person has private info and everyone else knows they know nothing, standard markets cannot extract that person's information. Discusses irrational participation problem (Milgrom-Stokey no-trade theorem). No quantitative measures of insider extraction, adverse selection costs, or informed trader strategies.
NO RELEVANT DATA.

## PM004 — Hanson 2007, "Logarithmic Market Scoring Rules"

Theoretical paper on LMSR properties (modularity, conditional independence preservation). Contains one key passage on adverse selection: the MSR inference rule should satisfy a condition that compensates for "expected adverse selection in trades — people buying suggests that the market maker's price is probably too low, and people selling suggests the price is too high." This is a design principle, not a measured quantity. No empirical data on informed trader impact, extraction rates, or strategy.
NO RELEVANT DATA.

## PM005 — Berg, Nelson & Rietz 2008, "Prediction Market Accuracy in the Long Run"

Compares IEM presidential election markets to polls (1988–2004). Markets closer to outcome 74% of the time across 964 poll comparisons. On manipulation: IEM individual accounts limited to $500; "known deliberate attempts to manipulate prices have little discernable transient effect and no apparent long term effect." Unit portfolio issuance (must drive all candidates' prices simultaneously) makes manipulation costly. No data on informed trader extraction, adverse selection costs, or insider strategies.
NO RELEVANT DATA.

## PM006 — Manski 2006, "Interpreting the Predictions of Prediction Markets"

Theoretical paper on what prediction market prices reveal about trader beliefs. Shows that under risk-neutral price-taking with heterogeneous beliefs, the price partially identifies the central tendency of beliefs but reveals nothing about dispersion. No discussion of informed vs. uninformed traders, insider strategies, adverse selection, or extraction rates.
NO RELEVANT DATA.

## PM007 — Wolfers & Zitzewitz 2006, "Interpreting Prediction Market Prices as Probabilities"

Response to Manski (2006). Derives conditions under which prediction market prices approximate mean beliefs (log utility sufficient; CRRA with dispersed beliefs close enough). Analyzes "fixed bet size" model vs. proportional betting. Simulates divergence between price and mean belief under various CRRA parameters using field data on belief distributions. No discussion of informed/uninformed trader dynamics, adverse selection costs, or insider extraction.
NO RELEVANT DATA.

## PM008 — Snowberg, Wolfers & Zitzewitz 2007, "Partisan Impacts on the Economy"

Uses prediction market price movements on Election Day 2004 (exit poll leak drove Bush reelection contract from $5.5 to $3, then back to $9.5 by midnight) to estimate partisan economic effects. Finds Republican president raises equity valuations 2-3%. References "Informed and Uninformed Voters" (Baron) in bibliography only. No analysis of informed trading in prediction markets per se — the paper uses prediction markets as instruments, not as objects of study regarding insider behavior.
NO RELEVANT DATA.

## PM009 — Pennock 2004, "Dynamic Pari-Mutuel Market"

Introduces DPM as a hybrid between pari-mutuel and continuous double auction. Key property: infinite buy-in liquidity with zero risk for the market institution (pure redistribution). Market maker's maximum loss is bounded. Discusses allowing traders to "lock in gains or limit losses" before event resolution (impossible in standard pari-mutuel). References Gandar et al. 1998 "Informed traders and price variations in the betting market for professional basketball games" in bibliography. No quantitative data on informed trader extraction, adverse selection, or insider strategies within the paper itself.
NO RELEVANT DATA.

## PM010 — Chen & Pennock 2007, "A Utility Framework for Bounded-Loss Market Makers"

Theoretical paper on automated market makers with provably bounded worst-case loss. Key result: for logarithmic scoring rule, maximum market maker loss is b*log(N) where N is number of outcomes and b is the liquidity parameter. This loss occurs when the final estimate assigns probability 1 to the true outcome (i.e., informed traders fully correct the price). Frames market maker loss as "the cost of gathering information for more accurate forecasts." Proves no market maker can have uniformly greater liquidity across all price regimes for a fixed loss bound. No empirical measurement of how much informed traders actually extract, but the bounded-loss framework implicitly caps the maximum extraction at b*log(N).
