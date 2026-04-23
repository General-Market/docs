# Batch AC -- Prediction Markets: Insider Trading, Adverse Selection, Market Microstructure

## PM026 -- Servan-Schreiber, Wolfers, Pennock, Galebach (2004) "Does Money Matter?"
NO RELEVANT DATA. Compares predictive accuracy of real-money (TradeSports) vs play-money (NewsFutures) markets for NFL outcomes. Finds both are accurate; play-money performs as well as real-money. No data on informed/insider trading, adverse selection costs, or market maker losses.

## PM027 -- Rosenbloom & Notz (2006) "Real-Money vs Play-Money Prediction Markets"
NO RELEVANT DATA. Statistical comparison (SPRT test) of real-money vs play-money market accuracy. Finds real-money markets significantly more accurate for non-sports events. No mention of informed traders, insider extraction, or adverse selection.

## PM028 -- Sunstein (2005) "Group Judgments: Statistical Means, Deliberation, and Information Markets"
NO RELEVANT DATA. Legal/institutional analysis of group decision-making mechanisms: statistical means, deliberation, and information markets. Argues information markets correct rather than amplify individual errors via incentive alignment. Theoretical discussion of market advantages over deliberation. No empirical data on insider trading or adverse selection.

## PM030 -- Page (2007) "Making the Difference: Applying a Logic of Diversity"
NO RELEVANT DATA. Organizational diversity theory -- how diverse collections of problem-solvers outperform high-ability homogeneous groups via superadditivity. No prediction market microstructure, no trading data.

## PM031 -- Tetlock (2008) "Liquidity and Prediction Market Efficiency"
RELEVANT. Uses 3 years of intraday TradeSports data (one-day binary outcome securities on sports/financial events). Key findings on adverse selection and naive liquidity provision:
- Limit orders that passively execute during informative time periods have **negative expected returns** -- limit order traders are systematically picked off by informed traders exploiting the favorite-longshot bias.
- Liquidity does NOT improve pricing efficiency -- and sometimes worsens it. Liquid securities exhibit **poorer resolution** (worse discrimination between events with different probabilities) than illiquid ones.
- Naivete mechanism: limit order traders place near-market orders with insufficient regard for future information release, unwittingly subsidizing informed traders and slowing price adjustment.
- Over 95% of orders in TradeSports daily Dow options are program trading (automated arbitrage). Professional financial traders from NYC, Chicago, London wager thousands.
- The paper formalizes that excessive liquidity provision by naive agents can cause market underreaction -- informed traders profit from slow price adjustment at the expense of passive liquidity providers.

## PM032 -- Tetlock, Lu, Mellers (2022) "False Dichotomy Alert: Improving Subjective-Probability Estimates vs. Raising Awareness of Systemic Risk"
NO RELEVANT DATA. A response to Taleb et al. defending superforecasting methodology. Discusses Brier scores, IARPA tournaments, calibration of geopolitical forecasts. No trading data, no market microstructure, no insider/adverse selection analysis.

## PM033 -- Cowgill, Wolfers, Zitzewitz (2009) "Using Prediction Markets to Track Information Flows: Evidence from Google"
PARTIALLY RELEVANT. Google's internal prediction markets (play-money "Goobles"), 1,463 active traders out of 6,425 accounts. Key findings:
- **Optimistic bias**: securities tied to optimistic outcomes overpriced by **10 percentage points**. Newly hired employees drive the optimistic side. Bias is significantly greater on days when Google stock appreciates.
- Physical proximity is the strongest predictor of correlated trading positions -- employees sharing an office trade similarly. Social/professional networks are secondary.
- Pricing biases declined over the sample period as collective experience increased.
- No direct quantification of informed trader extraction or adverse selection costs. The bias data is relevant as evidence that insiders (employees with project knowledge) may trade optimistically on their own projects, but paper does not isolate insider profit/loss.

## PM034 -- Cowgill & Zitzewitz (2015) "Corporate Prediction Markets: Evidence from Google, Ford, and Firm X"
RELEVANT. Examines insider trading directly in corporate prediction markets. Key findings:
- **Insiders account for ~10% of trades** (defined narrowly as team members on the project being predicted, or friends of team members).
- Insiders are **more likely to be on the optimistic side** of markets on their own projects.
- **Insiders' trades are NOT systematically profitable or unprofitable** -- their optimism cancels out informationally.
- Broadly-defined insiders (experienced, central software engineers at HQ with longer tenure) are **less optimistic and more profitable** than other traders. They trade against identified inefficiencies.
- Market-based forecasts outperform expert forecasts by as much as **25% reduction in mean squared error** (Ford vehicle sales).
- More experienced traders and those with higher past performance trade against inefficiencies (optimism bias, favorite-longshot bias) and earn higher returns -- consistent with skilled traders extracting from naive/biased ones.
- Inefficiencies disappear over time as experienced traders accumulate and unskilled traders exit.

## PM035 -- Rothschild (2009) "Forecasting Elections: Comparing Prediction Markets, Polls, and Their Biases"
NO RELEVANT DATA. Compares prediction market (Intrade) and poll-based forecasts for 2008 US elections. Documents the **favorite-longshot bias** in prediction markets (a mean probability of 95% translates to a price of ~85). Demonstrates that debiased prediction market forecasts are more accurate than debiased poll-based forecasts early in the cycle. No insider trading or adverse selection analysis.

## PM036 -- Rothschild & Sethi (2016) "Trading Strategies and Market Microstructure: Evidence from a Prediction Market"
HIGHLY RELEVANT. Transaction-level data from Intrade's 2012 presidential market: $230M wagered, 6,300 accounts, ~287,000 transactions, 12.9M contracts. The richest microstructure data in this batch:
- **87% of traders (32% of volume) never change direction** -- they are permanently long one candidate. Another 7% (37% of volume) are strongly biased one direction. Only ~6% of accounts (15% of volume) behave like canonical "information traders" willing to take either side.
- A single large trader (Trader B) accumulated ~$6.9M in directional Romney exposure, accounting for **>1/3 of all Romney bets and ~1/5 of all Obama sell orders**. This created a price "firewall" preventing Intrade from reflecting incoming information. On Election Day, removal of these orders caused immediate convergence to Betfair prices.
- The top 1% of traders (63 accounts) accounted for **67% of total volume**.
- Trader A (largest by volume, ~4M contracts in 70K transactions) was a pure arbitrageur: median holding period of 0 seconds (reversed within same millisecond), minimal directional exposure, earned $61,871.
- Trader D (largest profit): $867K profit on $2.1M margin, consistent Obama long, held to expiration.
- Trader B (largest loss): -$6.88M, all on Romney, held to expiration. Possible manipulation motive: boost fundraising, morale, turnout rather than financial gain.
- Price discovery occurs primarily through biased traders with heterogeneous priors who disagree about public information -- NOT through canonical informed-vs-uninformed dynamics. Supports Miller (1977) / Harrison-Kreps (1978) heterogeneous beliefs models over Kyle (1985) informed/noise paradigm.
