# Batch 05 — Prediction Market Insider Trading & Manipulation

---

## PM036 — Rothschild & Sethi (2016), "Trading Strategies and Market Microstructure: Evidence from a Prediction Market"

**Source:** Intrade 2012 US presidential election market. 6,300 accounts, ~287,000 transactions, 12.9 million contracts, $230M+ wagered.

**Informed/insider extraction:**
- Trader B (identified manipulator) accumulated >1/3 of all Romney bets and ~1/5 of all Obama-to-lose bets. Lost ~$6.88M holding to expiration — the largest single loss in the dataset. Spent >$375,000 holding prices in place during a single 90-minute window on Election Day.
- Trader D (most profitable) earned $867,059 betting on Obama, with bias of 0.92 and margin of $2.1M. Held to expiry.
- Arbitrageurs (Traders A, C, E, F): near-zero risk. Trader A: 3.96M contracts, $9,877 max margin, $61,871 profit. Trader C: 29,134 trades using only $737 margin, netting $11,921 guaranteed profit.

**Directional bias dominates:**
- 87% of traders (32% of volume) NEVER change direction of exposure — pure unidirectional bets.
- 89% of traders (58% of volume) have bias >0.9.
- Only 6% of accounts (15% of volume) are moderate/low-bias "information traders" resembling canonical models.
- Arbitrageurs: <1% of traders but 16% of volume.
- Biased strategies (unidirectional + extreme + high bias) account for 69% of total volume.

**Manipulation mechanics:**
- Trader B placed large limit orders creating a "firewall" — floor of ~30 on Romney, ceiling of ~70 on Obama. Held for hours on Election Day while Betfair moved freely.
- Intrade-Betfair spread: persistent 5-10 percentage point disparity (Obama cheaper on Intrade) for months.
- Firewall collapsed at 9pm ET when orders were pulled; Intrade prices instantly converged to Betfair.
- Cost of manipulation: "less than that of a primetime television commercial" relative to the $2.6B presidential campaign cycle.

**Adverse selection / market maker relevance:**
- Paper notes the party with resting orders on Election Day "stands to lose a great deal in transactions with more informed traders."
- Prices skew toward beliefs of best-funded traders, not best-informed. Budgets vary dramatically.
- Wishful thinking prevalent: >80% of each candidate's supporters expected their candidate to win (citing Uhlaner & Grofman 1986).

---

## PM041 — Rhode & Strumpf (2007), "Manipulating Political Stock Markets: A Field Experiment and a Century of Observational Data"

**Source:** Three markets — (1) Historical NY Wall Street betting 1880-1944, (2) IEM 2000 presidential election field experiment, (3) TradeSports 2004 presidential election.

**Field experiment (IEM 2000):**
- Authors invested $3,116 total across 11 planned manipulation episodes (~2% of total IEM trade volume).
- Trades moved prices significantly on impact: average price change of 2.5 cents for WTA contracts (vs. 0.5 cent average hourly range) and 0.3 cents for VS contracts.
- Price changes were roughly 60% of the typical intraday range.
- Prices typically reverted to pre-attack levels within a few hours. Control market (non-attacked market) did not move during single-market attacks.

**Historical NY markets (1880-1944):**
- 46 manipulation/wash-sale/bluffing episodes identified from newspaper records across 52 contests.
- Only 19 were full manipulation charges (11 Democratic, 8 Republican). Average manipulation occurs 7.8 days before election (median: 4 days).
- Regression: Republican manipulation moved Democrat odds price by -3.06 cents on day 0 (SE=0.73). Democratic manipulation moved Democrat odds price by +5.94 cents on day 0 (SE=2.35). Both revert within days.

**TradeSports 2004 attacks:**
- Attack 1 (Sept 13): 14-minute attack dropped Bush price 12.8 points. Volume: 6,887 shares ($40,247). Upper bound profit: $1,635.
- Attack 2 (Oct 15): 2-minute attack dropped Bush price 44 points (from 55 to 10). Volume: 4,416 shares ($21,000). Upper bound LOSS: -$2,736.
- Both reverted fully within minutes to an hour. Oct 15 attack cost $21K but received widespread press coverage (vs. $200K for a WSJ full-page ad).

**Insider trading examples documented:**
- Rumsfeld resignation (Intrade 2006): price spiked 15 points days before announcement.
- Edwards VP nomination (TradeSports 2004): price spiked 40 points over 5 hours before official announcement.
- Summers resignation (Intrade): price rose 20 points, 6 hours before first public announcement.
- Alito SCOTUS nomination (Intrade 2005): two 20-point jumps, 30 points total, 3 days before official selection.

**Key finding:** Manipulation creates short-lived price distortions. Insider trades create permanent price level shifts. Market participants distinguish between the two.

---

## PM044 — Rhode & Strumpf (2004), "Historical Presidential Betting Markets"

**Source:** US presidential election betting markets 1868-1940. $165M wagered (2002 dollars) in peak year 1916. ~4,300 daily odds prices.

**Predictive accuracy:**
- Mid-October favorite won 11 of 15 elections (73%). Underdog won only once (1916 Wilson upset).
- Betting odds possessed "much better predictive power than other generally available information" in the pre-polling era.

**Manipulation and insider activity:**
- Political operatives (Tammany Hall Democrats, Wall Street Republicans) actively and openly bet. Betting commissioners maintained statistical departments and sent analysts to campaign speeches.
- Republican managers in 1892 went to Democratic hangout at midnight offering large bets at favorable odds; manipulation was cheap because big Democratic money was absent.
- 1916: West coast investors wagered $60,000 on Wilson winning California — moved odds price by ~10 percentage points. They proved correct. This is insider information (superior local knowledge), not manipulation.

**Market efficiency:**
- Arbitrage-free pricing held in most cases (violations in only 25 of 807 observations).
- Random walk hypothesis not rejected for daily odds prices (N=236).
- Simple trading rules yielded small positive returns but not robust across sub-periods.
- Strong-form efficiency rejected: insiders with local/state information could profit.
- 5% commission standard, collected by betting commissioner on winnings.
- Favorite-longshot bias present: favorites slightly underpriced.

**No explicit adverse selection cost estimates or informed trader return percentages.**

---

## PM045 — Rhode & Strumpf (2008), "Manipulating Political Stock Markets" (updated version)

**Source:** Updated version of PM041 with same three markets. Additional quantitative detail.

**IEM 2000 field experiment — detailed mechanics:**
- 11 trading episodes, $3,116 total (~2% of market volume).
- Each episode: $160 initial WTA + $160 supporting limits; $80 initial VS + $80 limits.
- Trades = ~2x average daily VS volume and ~1/3 of daily WTA volume.
- Maximum single trade: 3.0% of VS market cap, 2.7% of WTA market cap.
- Timing: always at night (8pm or 11:15pm) to mimic insider plausibility.

**Control market validation:**
- FX (Foresight Exchange) as control: IEM-FX R²=0.77.
- During manipulation hour: pro-Democrat trade raised IEM DEM price 3.3 cents relative to FX (statistically significant). No corresponding move in control market.
- Centrebet and Intertops bookmaker prices also showed IEM-specific deviations during manipulation hours.

**Historical market regressions (expanded 4,302 observations, 142 candidate-race-years):**
- Republican manipulation on Democrat odds price, day 0: coeff = -0.0306 (SE=0.0073) presidential; -0.0284 (SE=0.0071) all races. Significant.
- Democratic manipulation on Democrat odds price, day 0: coeff = +0.0594 (SE=0.0235) presidential; +0.0103 (SE=0.0112) all races.
- Wash/bluff Republican day 0: -0.0533 (SE=0.0077) presidential. Democratic: -0.0219 (SE=0.0052).
- All effects revert by day +5 to baseline levels.

**Insider vs. manipulator framework:**
- Framed as signal extraction: "Market participants must determine whether a sudden price move is due to an uninformed manipulator or an insider with private information."
- Google internal market manipulator: "lost lots of money to people who really did have information."
- IEM 1996 Buchanan Brigade: single trader boosted Buchanan price by $0.04 in one day; price completely reverted same day.

---

## PM048 — Fountain & Harrison (2011), "What Do Prediction Markets Predict?"

**Source:** Theoretical/simulation paper. 1,000 simulated agents with Log and CRRA utility.

**Core finding:** Prediction markets recover mean aggregate beliefs only under restrictive homogeneity. When participants differ in wealth, risk aversion, patience, or beliefs, prices diverge from mean beliefs.

**Simulation results:**
- Homogeneous agents, Log utility, unimodal beliefs (mean=0.30): equilibrium price = 0.30 (perfect).
- Adding discounting (1-25%): price = 0.28 (Log) or 0.32 (CRRA) vs. belief 0.30.
- Adding bias (optimists +100 wealth, halved discount, lower CRRA): price = 0.34 (Log) / 0.35-0.36 (CRRA) vs. belief 0.30. Deviation of 4-6 cents.
- Bimodal beliefs + CRRA + bias: price = 0.50-0.52 vs. belief 0.42. Deviation of 8-10 cents.
- Diffuse beliefs + CRRA + bias: price = 0.60 vs. belief 0.50. Deviation of 10 cents.

**Relevance to informed trading:**
- Wealthier, more patient, less risk-averse traders permanently skew prices toward their beliefs. This is structural adverse selection, not manipulation.
- The paper provides formal derivations: CRRA demand xo(s) = {m * [b(s)/p(s)]^(1/r)} / {sum_s b(s) * [b(s)/p(s)]^((1-r)/r)}. Wealth m directly scales position size.

**NO RELEVANT DATA on:** % extraction by informed traders, insider strategies/timing/size, quantitative adverse selection costs, market maker worst-case losses. Purely theoretical demonstration that prediction market prices need not equal mean beliefs.
