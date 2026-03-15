# ITP Ideas — 96 Backtester Configurations × 11 Investor Archetypes

Different investors desire different things. The Girardian mimetic desire framework reveals that investment preferences are not innate -- they are shaped by the communities we belong to, the influencers we follow, and the narratives we internalize. A TradFi migrant craves the familiar comfort of index funds and factor investing. A crypto-native degen chases memes and reflexivity. A macro strategist sees geopolitical chess moves. A tech visionary bets on paradigm shifts. A yield hunter optimizes for income. A culture investor financializes lifestyle. A risk manager tames volatility. An emerging markets bull bets on the unbanked. A contrarian zigs when everyone zags. A momentum trader surfs narrative waves.

Each ITP below is defined by backtester parameters: `category_id` (CoinGecko, DefiLlama, or fundamental-analysis category), `top_n` (basket size), `weighting` (allocation scheme), `rebalance_days`, and optional overlays (FNG, VC, dominance regime switching).

---

## 1. The TradFi Migrant

Institutional investors and traditional finance professionals entering crypto. They want familiar structures -- sector rotation, market-cap weighted indexes, factor investing, blue-chip baskets.

### 1. Cross-Chain & Interoperability Index (BRDG)
**Thesis:** A multi-chain world needs bridges and messaging protocols. Cross-chain infrastructure captures tolls on inter-chain asset transfer.
**Config:** `cross-chain-communication` | top `10` | `mcap` | rebalance `30d`

**Why This Index?**
1. Direct exposure to the protocols that move assets between chains. As the multi-chain thesis plays out, bridge usage grows with every new L2 and L1 deployment.
2. Market-cap weighting across 10 cross-chain tokens concentrates capital in LINK and other proven infrastructure, rebalanced monthly to reflect shifting adoption.
3. Every holding and weight change is settled on-chain with BLS-verified oracle consensus. No custodian decides your cross-chain allocation.

**Investment Objective**
The Cross-Chain & Interoperability Index seeks to capture the toll revenue of inter-chain asset transfer by holding the top 10 cross-chain communication protocols weighted by market cap. Rebalanced every 30 days, it tilts toward whichever bridge or messaging protocol the market currently values most.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.220 |
| Total Return | -70.5% |
| Annualized Return | -2209.1% |
| Max Drawdown | -87.2% |
| Volatility (ann.) | 96.2% |
| Sortino Ratio | -0.335 |
| Calmar Ratio | -0.253 |
| Win Rate (monthly) | 47.5% |
| Best Month | +41.5% |
| Worst Month | -38.6% |
| Longest Drawdown | 1762 days |
| Time Underwater | 99.8% |
| Total Trades | 35 |
| Rebalances | 60 |
| Period | 2021-04-15 → 2026-03-08 |

**Current Holdings:**
LINK (87.4%), ZRO (4.8%), W (1.5%), DBR (1.1%), T (1.1%), SOON (1.1%), ZETA (0.9%), AXL (0.9%), ZAMA (0.7%), ICX (0.6%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -63.1% |
| 2023 | +174.1% |
| 2024 | +15.6% |
| 2025 | -52.8% |
| 2026 | +9.3% |


### 2. Privacy Protocol Index (PRIV)
**Thesis:** Financial privacy is a feature, not a bug. Privacy-preserving protocols serve legitimate institutional demand.
**Config:** `privacy-infrastructure` | top `5` | `equal` | rebalance `60d`

**Why This Index?**
1. Financial privacy is a permanent demand. Regulated institutions need compliant privacy layers; the protocols building them are structurally underpriced.
2. Equal weighting across 5 privacy tokens prevents any single project from dominating, giving balanced exposure to ZK, MPC, and confidential computing approaches.
3. All positions are settled on-chain through BLS-verified consensus. The index itself is transparent even when the protocols it holds are not.

**Investment Objective**
The Privacy Protocol Index seeks to provide diversified exposure to privacy-preserving blockchain infrastructure by equally weighting the top 5 privacy tokens. It rebalances every 60 days, rotating into whichever privacy approaches the market supports.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.067 |
| Total Return | -93.5% |
| Annualized Return | -4286.8% |
| Max Drawdown | -94.9% |
| Volatility (ann.) | 98.8% |
| Sortino Ratio | -0.607 |
| Calmar Ratio | -0.452 |
| Win Rate (monthly) | 40.7% |
| Best Month | +79.6% |
| Worst Month | -37.2% |
| Longest Drawdown | 1762 days |
| Time Underwater | 99.8% |
| Total Trades | 42 |
| Rebalances | 30 |
| Period | 2021-04-15 → 2026-03-08 |

**Current Holdings:**
LINK (20.0%), COTI (20.0%), ROSE (20.0%), ZEN (20.0%), ZK (20.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -74.9% |
| 2023 | +85.5% |
| 2024 | +20.8% |
| 2025 | -67.8% |
| 2026 | -30.4% |


### 3. Real World Asset Protocol Index (RWAI)
**Thesis:** RWA tokenization is the bridge between TradFi and DeFi. Protocols enabling on-chain treasuries sit at the convergence of two $100T+ markets.
**Config:** `rwa-protocol` | top `10` | `mcap` | rebalance `30d`

**Why This Index?**
1. RWA tokenization sits at the convergence of TradFi and DeFi. The protocols enabling on-chain treasuries, real estate, and credit are building the bridge between two $100T+ markets.
2. Market-cap weighting naturally concentrates in LINK and ONDO, the infrastructure and issuance leaders, while maintaining tail exposure to 8 smaller RWA protocols.
3. On-chain settlement with BLS-verified consensus means your RWA exposure is itself a real-world asset, transparently held and verifiable.

**Investment Objective**
The Real World Asset Protocol Index tracks the top 10 RWA tokenization protocols by market cap, rebalanced monthly. It captures the growth of on-chain treasuries, tokenized credit, and real-estate infrastructure as traditional assets migrate to blockchain rails.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.274 |
| Total Return | -62.0% |
| Annualized Return | -1795.0% |
| Max Drawdown | -87.4% |
| Volatility (ann.) | 96.3% |
| Sortino Ratio | -0.273 |
| Calmar Ratio | -0.205 |
| Win Rate (monthly) | 45.8% |
| Best Month | +44.8% |
| Worst Month | -38.8% |
| Longest Drawdown | 1762 days |
| Time Underwater | 99.8% |
| Total Trades | 34 |
| Rebalances | 60 |
| Period | 2021-04-15 → 2026-03-08 |

**Current Holdings:**
LINK (77.7%), ONDO (15.9%), ZBCN (2.5%), POLYX (0.7%), PLUME (0.6%), PRCL (0.5%), COLLECT (0.5%), RLS (0.5%), TRU (0.5%), CHR (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -63.4% |
| 2023 | +160.2% |
| 2024 | +54.7% |
| 2025 | -51.9% |
| 2026 | +6.7% |


### 4. RWA TVL Weighted (RWATVL)
**Thesis:** RWA protocols weighted by actual tokenized asset value locked. Real backing, real weight.
**Config:** `dl-rwa` | top `10` | `tvl` | rebalance `30d`

**Why This Index?**
1. TVL-weighted RWA exposure means capital follows actual deposits, not speculation. With a 1.355 Sharpe ratio and +134.6% total return, this is the strongest risk-adjusted RWA index.
2. The weighting methodology puts 57% in tokenized gold (XAUT) and 40% in PAXG, reflecting where real capital actually sits in RWA. The market votes with deposits.
3. On-chain settlement through BLS-verified consensus. The lowest max drawdown (-17.2%) of any index in the catalog, because real backing means real floors.

**Investment Objective**
The RWA TVL Weighted index tracks tokenized real-world assets weighted by total value locked, capturing where institutional capital actually deposits rather than where speculation flows. With monthly rebalancing and a 17% max drawdown over 4 years, it is the most defensively positioned index in the catalog.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 1.355 |
| Total Return | +134.6% |
| Annualized Return | +24.3% |
| Max Drawdown | -17.2% |
| Volatility (ann.) | 17.2% |
| Sortino Ratio | 2.058 |
| Calmar Ratio | 1.415 |
| Win Rate (monthly) | 59.6% |
| Best Month | +12.1% |
| Worst Month | -6.4% |
| Longest Drawdown | 335 days |
| Time Underwater | 89.5% |
| Total Trades | 33 |
| Rebalances | 48 |
| Period | 2022-04-08 → 2026-03-08 |

**Current Holdings:**
XAUT (57.2%), PAXG (39.6%), USUAL (1.7%), ARIAIP (0.5%), PROPS (0.5%), RWA (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2023 | +8.1% |
| 2024 | +29.1% |
| 2025 | +48.8% |
| 2026 | +17.5% |


### 5. Liquid Staking TVL Weighted (LSTKTVL)
**Thesis:** Liquid staking protocols weighted by staked TVL. The bigger the deposit base, the bigger the weight.
**Config:** `dl-liquid-staking` | top `10` | `tvl` | rebalance `30d`

**Why This Index?**
1. Liquid staking is the base layer of DeFi yield. Every ETH and SOL staked through these protocols generates fees that accrue to governance token holders.
2. TVL weighting concentrates in LDO (92%) because Lido dominates staked deposits. The index reflects the actual market structure of liquid staking, not a fantasy of equal competition.
3. Settled on-chain with BLS-verified consensus. Your staking infrastructure exposure is held transparently with no custodian intermediary.

**Investment Objective**
The Liquid Staking TVL Weighted index holds the top 10 liquid staking protocol tokens weighted by staked TVL. It naturally concentrates in the dominant staking platforms, rebalancing monthly to track shifts in depositor preference.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.034 |
| Total Return | -96.9% |
| Annualized Return | -5177.5% |
| Max Drawdown | -97.0% |
| Volatility (ann.) | 125.4% |
| Sortino Ratio | -0.628 |
| Calmar Ratio | -0.534 |
| Win Rate (monthly) | 35.1% |
| Best Month | +241.8% |
| Worst Month | -59.8% |
| Longest Drawdown | 1737 days |
| Time Underwater | 99.9% |
| Total Trades | 25 |
| Rebalances | 58 |
| Period | 2021-06-03 → 2026-03-08 |

**Current Holdings:**
LDO (92.2%), RPL (5.7%), SD (1.6%), ANKR (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -72.3% |
| 2023 | +167.4% |
| 2024 | -20.5% |
| 2025 | -69.8% |
| 2026 | -52.7% |


### 6. Crypto Low-Vol 60d (CLVL60)
**Thesis:** 60-day low-volatility lookback smooths regime changes. More stable factor exposure.
**Config:** `all` | top `20` | `low_vol_60` | rebalance `30d`

**Why This Index?**
1. Low-volatility factor investing applied to crypto. The 20 least volatile tokens over 60 days, producing a 0.901 Sharpe and +856.6% total return since 2020.
2. The 60-day lookback smooths regime changes compared to shorter windows. Current holdings include BTC, BNB, stablecoins, and large caps, which is exactly what low-vol should select.
3. All rebalancing is executed and verified through on-chain BLS consensus. Factor exposure without counterparty risk.

**Investment Objective**
The Crypto Low-Vol 60d index selects the 20 least volatile tokens from the entire market over a 60-day lookback window, rebalanced monthly. It systematically avoids drawdown-heavy assets, producing smoother equity curves and better risk-adjusted returns than broad market exposure.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.901 |
| Total Return | +856.6% |
| Annualized Return | +44.1% |
| Max Drawdown | -85.2% |
| Volatility (ann.) | 64.2% |
| Sortino Ratio | 0.955 |
| Calmar Ratio | 0.517 |
| Win Rate (monthly) | 56.8% |
| Best Month | +82.2% |
| Worst Month | -36.5% |
| Longest Drawdown | 1760 days |
| Time Underwater | 96.4% |
| Total Trades | 684 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
BNB (10.0%), BTC (10.0%), USDE (10.0%), HBAR (10.0%), XLM (10.0%), TRX (10.0%), USD1 (10.0%), USDC (10.0%), USDS (10.0%), WBTC (10.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +168.8% |
| 2022 | -66.3% |
| 2023 | +95.3% |
| 2024 | +137.6% |
| 2025 | -0.1% |
| 2026 | -18.7% |


### 7. Crypto Dual Momentum 60d (CDMOM60)
**Thesis:** 60-day dual momentum for longer trend confirmation. Fewer false signals, more conviction.
**Config:** `all` | top `15` | `dual_mom_60` | rebalance `30d`

**Why This Index?**
1. Dual momentum combines absolute and relative strength. Only tokens trending up on both axes make the cut, filtering out mean-reversion traps.
2. The 60-day window provides longer trend confirmation with fewer whipsaws. Fewer false signals means lower turnover and more conviction per position.
3. On-chain settlement through BLS-verified consensus. A systematic trend-following strategy with no discretionary overrides or hidden rebalancing.

**Investment Objective**
The Crypto Dual Momentum 60d index applies dual momentum scoring across all tokens, selecting the top 15 by combined absolute and relative performance over 60 days. Monthly rebalancing rotates into confirmed trends while exiting fading ones.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.450 |
| Total Return | +37.1% |
| Annualized Return | +523.7% |
| Max Drawdown | -90.2% |
| Volatility (ann.) | 75.2% |
| Sortino Ratio | 0.100 |
| Calmar Ratio | 0.058 |
| Win Rate (monthly) | 39.2% |
| Best Month | +106.4% |
| Worst Month | -42.2% |
| Longest Drawdown | 1765 days |
| Time Underwater | 97.8% |
| Total Trades | 623 |
| Rebalances | 72 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
BCH (43.8%), WEETH (11.0%), STETH (10.9%), ETH (10.8%), TRX (7.8%), SOL (6.9%), BNB (4.2%), LINK (1.9%), BTC (1.3%), WBTC (1.2%), USDS (0.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +162.4% |
| 2022 | -62.7% |
| 2023 | +62.4% |
| 2024 | -6.0% |
| 2025 | +26.7% |
| 2026 | -28.7% |


### 8. Fan Token Index (FANS)
**Thesis:** Fan tokens capture the loyalty economy of sports and entertainment. Recurring engagement drives volume.
**Config:** `fan-token` | top `10` | `equal` | rebalance `30d`

**Why This Index?**
1. Fan tokens capture the loyalty economy of professional sports. BAR, PSG, JUV, ATM represent clubs with hundreds of millions of fans and recurring engagement cycles.
2. Equal weighting across 10 fan tokens ensures no single club dominates. Each matchday, transfer window, and tournament creates volume regardless of broader crypto sentiment.
3. Settled on-chain with BLS-verified oracle consensus. Sports engagement data drives a market that moves independently of BTC correlation.

**Investment Objective**
The Fan Token Index provides equal-weighted exposure to the top 10 sports fan tokens, rebalanced monthly. It captures the intersection of crypto and professional sports, where engagement is seasonal, recurring, and largely uncorrelated to broader crypto markets.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.067 |
| Total Return | -75.8% |
| Annualized Return | -2920.2% |
| Max Drawdown | -79.9% |
| Volatility (ann.) | 77.0% |
| Sortino Ratio | -0.565 |
| Calmar Ratio | -0.365 |
| Win Rate (monthly) | 44.0% |
| Best Month | +43.0% |
| Worst Month | -44.7% |
| Longest Drawdown | 1486 days |
| Time Underwater | 99.4% |
| Total Trades | 108 |
| Rebalances | 50 |
| Period | 2022-01-29 → 2026-03-08 |

**Current Holdings:**
ARG (10.0%), AFC (10.0%), ASR (10.0%), ATM (10.0%), BAR (10.0%), PORTO (10.0%), JUV (10.0%), OG (10.0%), PSG (10.0%), SANTOS (10.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2023 | +12.3% |
| 2024 | +8.8% |
| 2025 | -43.5% |
| 2026 | -16.7% |


---

## 2. The Crypto Native Degen

CT-native, narrative-rotator, meme-maximalist, airdrop farmer, reflexivity-aware speculator.

### 9. Concentrated Meme Top 5 (MEME5)
**Thesis:** Only the biggest memes survive. Top 5 by market cap captures the Lindy effect in meme culture.
**Config:** `ai-meme-coins` | top `5` | `mcap` | rebalance `14d`

**Why This Index?**
1. The top 5 AI meme tokens by market cap. With +2082.5% total return and a 1.310 Sharpe, the Lindy effect in meme culture is real: survivors get stronger.
2. Market-cap weighting ensures FARTCOIN (59%) and TURBO (23%) lead the basket, concentrating in the memes that achieved escape velocity. Biweekly rebalancing catches rotation fast.
3. Every rebalance is BLS-verified on-chain. Even meme exposure can be held through transparent, consensus-driven infrastructure.

**Investment Objective**
The Concentrated Meme Top 5 index holds the 5 largest AI meme tokens by market cap, rebalanced every 14 days. It bets that the biggest memes survive while smaller ones die, capturing the power law of meme culture through systematic market-cap selection.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 1.310 |
| Total Return | +2082.5% |
| Annualized Return | +195.9% |
| Max Drawdown | -96.6% |
| Volatility (ann.) | 282.1% |
| Sortino Ratio | 1.772 |
| Calmar Ratio | 2.027 |
| Win Rate (monthly) | 44.1% |
| Best Month | +1100.1% |
| Worst Month | -56.9% |
| Longest Drawdown | 411 days |
| Time Underwater | 97.3% |
| Total Trades | 205 |
| Rebalances | 74 |
| Period | 2023-05-05 → 2026-03-08 |

**Current Holdings:**
FARTCOIN (59.1%), TURBO (23.2%), GOAT (7.0%), AIXBT (6.3%), ACT (4.4%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2024 | +6196.8% |
| 2025 | -65.9% |
| 2026 | -34.9% |


### 10. CDP Momentum (CDPMOM)
**Thesis:** CDP stablecoin protocols gaining adoption. Momentum captures the winners of stablecoin wars.
**Config:** `dl-lending` | top `5` | `momentum_30` | rebalance `14d`

**Why This Index?**
1. CDP stablecoin protocols are the commercial banks of DeFi. Momentum weighting captures which lending protocols are gaining adoption in the stablecoin wars.
2. 30-day momentum applied to the top 5 lending protocols, rebalanced biweekly. The strategy exits losers fast and concentrates in growth.
3. On-chain settlement with BLS-verified consensus. Systematic exposure to DeFi lending momentum without custodial risk.

**Investment Objective**
The CDP Momentum index applies 30-day momentum weighting to the top 5 lending protocols, rebalanced every 14 days. It systematically rotates into whichever stablecoin or lending platform is gaining market share.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.179 |
| Total Return | -92.9% |
| Annualized Return | -4191.3% |
| Max Drawdown | -96.8% |
| Volatility (ann.) | 87.8% |
| Sortino Ratio | -0.677 |
| Calmar Ratio | -0.433 |
| Win Rate (monthly) | 47.5% |
| Best Month | +59.6% |
| Worst Month | -49.8% |
| Longest Drawdown | 1751 days |
| Time Underwater | 99.4% |
| Total Trades | 218 |
| Rebalances | 127 |
| Period | 2021-04-22 → 2026-03-08 |

**Current Holdings:**
JST (76.1%), AAVE (21.2%), BLUE (2.7%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -82.1% |
| 2023 | +21.9% |
| 2024 | +8.8% |
| 2025 | -61.7% |
| 2026 | -3.5% |


---

## 3. The Macro Strategist

The geopolitical thinker, the Ray Dalio disciple. Crypto exposure through the lens of macro themes -- inflation hedges, de-dollarization, commodity cycles, monetary policy.

### 11. RWA Macro Defensive (RWADEF)
**Thesis:** RWA protocols with minimum variance weighting. Macro exposure with minimal crypto volatility.
**Config:** `dl-rwa` | top `10` | `min_var_30` | rebalance `30d`

**Why This Index?**
1. Minimum variance weighting across RWA protocols produces the lowest-volatility macro exposure in crypto. A 20.4% annualized volatility with a -35.2% max drawdown.
2. The min-var optimizer tilts toward PROPS, XAUT, and PAXG, the least correlated RWA assets. The result is gold-heavy, which is exactly what defensive macro exposure should be.
3. BLS-verified on-chain settlement. A macro-defensive posture held transparently with no intermediary choosing your risk allocation.

**Investment Objective**
The RWA Macro Defensive index applies minimum variance optimization to the top 10 RWA protocols, rebalanced monthly. It minimizes portfolio volatility by overweighting the least correlated tokenized assets, producing a naturally gold-heavy, defensive allocation.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.155 |
| Total Return | +4.3% |
| Annualized Return | +108.3% |
| Max Drawdown | -35.2% |
| Volatility (ann.) | 20.4% |
| Sortino Ratio | 0.074 |
| Calmar Ratio | 0.031 |
| Win Rate (monthly) | 44.7% |
| Best Month | +24.1% |
| Worst Month | -16.8% |
| Longest Drawdown | 437 days |
| Time Underwater | 95.3% |
| Total Trades | 113 |
| Rebalances | 48 |
| Period | 2022-04-08 → 2026-03-08 |

**Current Holdings:**
PROPS (29.7%), XAUT (21.6%), RWA (17.2%), PAXG (15.3%), USUAL (10.3%), ARIAIP (5.9%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2023 | +7.6% |
| 2024 | +36.3% |
| 2025 | -14.6% |
| 2026 | -13.4% |


---

## 4. The Tech Visionary

The builder, the Balaji follower, the whitepaper reader. Bets on infrastructure, paradigm shifts, and the technological frontier.

### 12. Modular Security (MSEC)
**Thesis:** Shared security marketplaces let new chains bootstrap economic security without building a validator set.
**Config:** `liquid-restaking-governance-token` | top `10` | `tvl` | rebalance `30d`

**Why This Index?**
1. Shared security marketplaces let new chains bootstrap validators without starting from zero. TVL weighting means PENDLE (97.5%) dominates because the market trusts it most.
2. With a 0.936 Sharpe and +232.1% total return, the modular security thesis has produced strong risk-adjusted returns despite high concentration.
3. On-chain settlement with BLS-verified consensus. Your exposure to the restaking and shared security narrative is transparent and custodian-free.

**Investment Objective**
The Modular Security index tracks liquid restaking governance tokens weighted by TVL, rebalanced monthly. It captures the shared security marketplace thesis by concentrating in protocols where the most capital has been deposited for restaking.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.936 |
| Total Return | +232.1% |
| Annualized Return | +51.2% |
| Max Drawdown | -84.7% |
| Volatility (ann.) | 122.7% |
| Sortino Ratio | 0.670 |
| Calmar Ratio | 0.604 |
| Win Rate (monthly) | 51.4% |
| Best Month | +152.0% |
| Worst Month | -34.4% |
| Longest Drawdown | 455 days |
| Time Underwater | 94.2% |
| Total Trades | 70 |
| Rebalances | 36 |
| Period | 2023-04-12 → 2026-03-08 |

**Current Holdings:**
PENDLE (97.5%), CGN (0.5%), ETHFI (0.5%), KERNEL (0.5%), PUFFER (0.5%), SWELL (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2024 | +418.3% |
| 2025 | -68.1% |
| 2026 | -35.4% |


### 13. Top Yield Protocols (TOPYLD)
**Thesis:** Protocols with highest native yield. Yield is the gravity of DeFi -- capital flows to the best returns.
**Config:** `dl-yield` | top `15` | `yield_w` | rebalance `14d`

**Why This Index?**
1. Yield is DeFi's gravity. Capital flows to the best returns, and this index weights by native protocol yield to track exactly where that gravity pulls hardest.
2. Yield-weighted selection across 15 protocols means APE, BB, CVX, and PENDLE carry the basket. Biweekly rebalancing captures yield regime shifts quickly.
3. On-chain settlement through BLS-verified consensus. Yield-chasing as a systematic, transparent strategy rather than manual farm rotation.

**Investment Objective**
The Top Yield Protocols index selects the 15 highest-yielding DeFi protocols and weights them by native yield, rebalanced every 14 days. It automates the yield-farming rotation that most DeFi users do manually.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.138 |
| Total Return | -78.5% |
| Annualized Return | -3045.3% |
| Max Drawdown | -90.9% |
| Volatility (ann.) | 99.2% |
| Sortino Ratio | -0.434 |
| Calmar Ratio | -0.335 |
| Win Rate (monthly) | 45.1% |
| Best Month | +115.1% |
| Worst Month | -60.0% |
| Longest Drawdown | 1075 days |
| Time Underwater | 99.1% |
| Total Trades | 215 |
| Rebalances | 111 |
| Period | 2021-12-14 → 2026-03-08 |

**Current Holdings:**
APE (25.0%), BB (25.0%), CVX (25.0%), PENDLE (25.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -82.3% |
| 2023 | +75.3% |
| 2024 | +267.8% |
| 2025 | -78.2% |
| 2026 | -35.5% |


---

## 5. The Yield Hunter

DeFi power user who optimizes for yield. Wants diversified yield exposure, passive income, real yield, and compounding returns.

### 14. Yield Protocol TVL (YLDTVL)
**Thesis:** Yield protocols weighted by TVL deposited. Capital allocation = market verdict on best yield.
**Config:** `dl-yield` | top `15` | `tvl` | rebalance `14d`

**Why This Index?**
1. TVL-weighted yield protocols capture where capital actually deposits for returns. PENDLE at 75.6% dominates because the market trusts its yield infrastructure most.
2. With a 0.609 Sharpe and +35.4% total return, TVL weighting produces more stable results than pure yield chasing by anchoring to deposit volumes.
3. BLS-verified on-chain settlement. Your yield exposure is held transparently with no custodian deciding which farms to enter.

**Investment Objective**
The Yield Protocol TVL index tracks the top 15 yield protocols weighted by total value locked, rebalanced biweekly. Capital allocation by depositors serves as the weighting signal, concentrating in protocols where yield-seekers have placed the most trust.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.609 |
| Total Return | +35.4% |
| Annualized Return | +742.9% |
| Max Drawdown | -90.8% |
| Volatility (ann.) | 109.1% |
| Sortino Ratio | 0.103 |
| Calmar Ratio | 0.082 |
| Win Rate (monthly) | 49.0% |
| Best Month | +164.3% |
| Worst Month | -57.9% |
| Longest Drawdown | 772 days |
| Time Underwater | 97.0% |
| Total Trades | 159 |
| Rebalances | 111 |
| Period | 2021-12-14 → 2026-03-08 |

**Current Holdings:**
PENDLE (75.6%), CVX (23.4%), APE (0.5%), BB (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -86.7% |
| 2023 | +313.5% |
| 2024 | +708.9% |
| 2025 | -69.2% |
| 2026 | -26.1% |


### 15. Lending Revenue Weighted (LENDREV)
**Thesis:** Lending protocols weighted by interest revenue. Spread income is the commercial banking of DeFi.
**Config:** `dl-lending` | top `10` | `revenue_w` | rebalance `30d`

**Why This Index?**
1. Lending protocols weighted by interest revenue. The DeFi equivalent of buying commercial banks by net interest margin.
2. Revenue weighting selects for lending platforms that actually generate income, not just attract speculative TVL. AAVE, BLUE, and JST carry the basket equally.
3. On-chain settlement with BLS-verified consensus. Revenue-generating DeFi exposure with transparent holdings and no intermediary.

**Investment Objective**
The Lending Revenue Weighted index holds the top 10 lending protocols weighted by interest revenue, rebalanced monthly. It systematically overweights the platforms generating the most spread income from borrowing and lending activity.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.196 |
| Total Return | -65.0% |
| Annualized Return | -1937.9% |
| Max Drawdown | -84.2% |
| Volatility (ann.) | 87.7% |
| Sortino Ratio | -0.315 |
| Calmar Ratio | -0.230 |
| Win Rate (monthly) | 45.8% |
| Best Month | +67.9% |
| Worst Month | -45.2% |
| Longest Drawdown | 1753 days |
| Time Underwater | 99.5% |
| Total Trades | 91 |
| Rebalances | 60 |
| Period | 2021-04-22 → 2026-03-08 |

**Current Holdings:**
AAVE (33.3%), BLUE (33.3%), JST (33.3%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -68.8% |
| 2023 | +92.5% |
| 2024 | +78.8% |
| 2025 | -59.8% |
| 2026 | -18.3% |


### 16. Bridge Revenue Index (BRDGREV)
**Thesis:** Cross-chain bridges weighted by transfer fee revenue. Every cross-chain swap pays a toll.
**Config:** `dl-bridge` | top `10` | `revenue_w` | rebalance `30d`

**Why This Index?**
1. Every cross-chain swap pays a toll. Revenue-weighted bridge tokens capture the protocols earning the most from inter-chain traffic.
2. Equal weighting across 5 bridge tokens (BICO, CELR, DBR, ZRO, W) provides balanced exposure to different bridging approaches and fee models.
3. BLS-verified on-chain settlement ensures transparent, consensus-driven rebalancing of your cross-chain infrastructure exposure.

**Investment Objective**
The Bridge Revenue Index tracks cross-chain bridge protocols weighted by transfer fee revenue, rebalanced monthly. It captures the toll economics of multi-chain asset movement by overweighting bridges that generate the most transaction fees.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.225 |
| Total Return | -95.6% |
| Annualized Return | -5092.9% |
| Max Drawdown | -97.0% |
| Volatility (ann.) | 98.7% |
| Sortino Ratio | -0.725 |
| Calmar Ratio | -0.525 |
| Win Rate (monthly) | 37.7% |
| Best Month | +79.8% |
| Worst Month | -50.0% |
| Longest Drawdown | 1566 days |
| Time Underwater | 99.8% |
| Total Trades | 22 |
| Rebalances | 54 |
| Period | 2021-10-13 → 2026-03-08 |

**Current Holdings:**
BICO (20.0%), CELR (20.0%), DBR (20.0%), ZRO (20.0%), W (20.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -86.4% |
| 2023 | +90.6% |
| 2024 | +19.4% |
| 2025 | -74.9% |
| 2026 | +9.9% |


### 17. Yield Sqrt TVL (YLDSQRT)
**Thesis:** Yield protocols with sqrt TVL weighting. Balances established protocols with emerging yield sources.
**Config:** `dl-yield` | top `15` | `tvl_sqrt` | rebalance `14d`

**Why This Index?**
1. Square root of TVL weighting balances established protocols with emerging yield sources. PENDLE (64.3%) still leads, but CVX (35.7%) gets materially more weight than under pure TVL.
2. The sqrt function compresses the gap between large and small protocols, giving mid-tier yield sources a meaningful allocation without abandoning the TVL signal.
3. On-chain settlement through BLS-verified consensus. A nuanced yield allocation that no manual farmer would construct.

**Investment Objective**
The Yield Sqrt TVL index applies square-root TVL weighting to the top 15 yield protocols, rebalanced biweekly. The square-root function reduces the dominance of the largest protocol while still respecting the capital-allocation signal of TVL.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.561 |
| Total Return | +12.3% |
| Annualized Return | +278.6% |
| Max Drawdown | -90.9% |
| Volatility (ann.) | 107.2% |
| Sortino Ratio | 0.039 |
| Calmar Ratio | 0.031 |
| Win Rate (monthly) | 47.1% |
| Best Month | +164.8% |
| Worst Month | -57.9% |
| Longest Drawdown | 796 days |
| Time Underwater | 97.6% |
| Total Trades | 154 |
| Rebalances | 111 |
| Period | 2021-12-14 → 2026-03-08 |

**Current Holdings:**
PENDLE (64.3%), CVX (35.7%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -86.8% |
| 2023 | +256.9% |
| 2024 | +624.1% |
| 2025 | -69.4% |
| 2026 | -19.7% |


---

## 6. The Culture & Lifestyle Investor

The person who invests in what they live and breathe -- gaming, sports, music, social media, creator economy, metaverse, entertainment.

### 18. Concentrated Gaming Top 5 (GAME5)
**Thesis:** Top 5 gaming tokens by market cap. Maximum conviction in gaming infrastructure winners.
**Config:** `dl-gaming` | top `5` | `mcap` | rebalance `30d`

**Why This Index?**
1. Maximum conviction in gaming infrastructure winners. Top 5 by market cap means SAND (43.1%) and AXS (39.1%) carry the basket. If gaming takes off on-chain, these lead.
2. Concentrated 5-token exposure amplifies any gaming adoption curve. The downside is deep (-97.0% total return), but the upside potential is symmetric.
3. BLS-verified on-chain settlement. A pure bet on blockchain gaming infrastructure held transparently with consensus-driven rebalancing.

**Investment Objective**
The Concentrated Gaming Top 5 index holds the 5 largest gaming tokens by market cap, rebalanced monthly. It provides maximum-conviction exposure to blockchain gaming infrastructure, betting that market-cap leaders will capture the largest share of any gaming adoption wave.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.357 |
| Total Return | -97.0% |
| Annualized Return | -5447.2% |
| Max Drawdown | -98.7% |
| Volatility (ann.) | 94.8% |
| Sortino Ratio | -0.823 |
| Calmar Ratio | -0.552 |
| Win Rate (monthly) | 35.2% |
| Best Month | +76.9% |
| Worst Month | -41.8% |
| Longest Drawdown | 1562 days |
| Time Underwater | 99.0% |
| Total Trades | 27 |
| Rebalances | 55 |
| Period | 2021-09-27 → 2026-03-08 |

**Current Holdings:**
SAND (43.1%), AXS (39.1%), ILV (6.8%), YGG (5.6%), PRIME (5.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -93.6% |
| 2023 | +100.1% |
| 2024 | +20.6% |
| 2025 | -84.8% |
| 2026 | -12.1% |


### 19. Move-to-Earn Index (M2E)
**Thesis:** Fitness meets crypto. M2E protocols reward physical activity with tokens. Mass adoption through health.
**Config:** `play-to-earn` | top `5` | `equal` | rebalance `30d`

**Why This Index?**
1. Fitness meets crypto. Move-to-earn protocols reward physical activity with tokens. The mass adoption thesis through health and lifestyle gamification.
2. Equal weighting across AXS, MANA, FLOKI, GALA, and SAND provides diversified exposure to the play-to-earn and move-to-earn ecosystem.
3. On-chain settlement with BLS-verified consensus. Your gaming and lifestyle token exposure is held without custodial intermediaries.

**Investment Objective**
The Move-to-Earn Index provides equal-weighted exposure to the top 5 play-to-earn tokens, rebalanced monthly. It captures the lifestyle gamification thesis where physical activity and gaming generate token rewards.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.103 |
| Total Return | -96.0% |
| Annualized Return | -4855.0% |
| Max Drawdown | -98.7% |
| Volatility (ann.) | 105.9% |
| Sortino Ratio | -0.669 |
| Calmar Ratio | -0.492 |
| Win Rate (monthly) | 35.6% |
| Best Month | +141.5% |
| Worst Month | -46.1% |
| Longest Drawdown | 1562 days |
| Time Underwater | 99.2% |
| Total Trades | 82 |
| Rebalances | 60 |
| Period | 2021-04-30 → 2026-03-08 |

**Current Holdings:**
AXS (20.0%), MANA (20.0%), FLOKI (20.0%), GALA (20.0%), SAND (20.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -94.3% |
| 2023 | +153.5% |
| 2024 | +5.1% |
| 2025 | -77.7% |
| 2026 | -34.9% |


---

## 7. The Risk Manager

Portfolio allocator, Sharpe ratio optimizer, drawdown minimizer. Wants crypto exposure with guardrails -- capital preservation, risk-adjusted returns, and sleeping well at night.

### 20. Low Volatility 30d (LOVOL)
**Thesis:** Low-volatility factor selects and overweights the least volatile assets. Better risk-adjusted returns.
**Config:** `all` | top `20` | `low_vol_30` | rebalance `14d`

**Why This Index?**
1. The strongest risk-adjusted index in the catalog. A 1.070 Sharpe, +1748.2% total return, and 59.5% monthly win rate since 2020. Low-vol factor investing works in crypto.
2. 30-day low-volatility lookback with biweekly rebalancing selects the 20 calmest tokens. Current holdings include BTC, BNB, DOGE, stablecoins. The boring stuff wins.
3. Every rebalance is BLS-verified on-chain. A factor strategy that would cost 50+ bps at a TradFi ETF, settled transparently on L3.

**Investment Objective**
The Low Volatility 30d index selects the 20 least volatile tokens over a 30-day window, rebalanced biweekly. It applies the low-volatility anomaly from equity markets to crypto, systematically avoiding high-drawdown assets and producing superior risk-adjusted returns.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 1.070 |
| Total Return | +1748.2% |
| Annualized Return | +60.3% |
| Max Drawdown | -79.0% |
| Volatility (ann.) | 63.4% |
| Sortino Ratio | 1.360 |
| Calmar Ratio | 0.763 |
| Win Rate (monthly) | 59.5% |
| Best Month | +79.5% |
| Worst Month | -33.9% |
| Longest Drawdown | 1553 days |
| Time Underwater | 95.9% |
| Total Trades | 1391 |
| Rebalances | 161 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
BNB (10.0%), BTC (10.0%), DOGE (10.0%), USDE (10.0%), XLM (10.0%), TRX (10.0%), USD1 (10.0%), USDC (10.0%), USDS (10.0%), WBTC (10.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +342.4% |
| 2022 | -69.4% |
| 2023 | +62.4% |
| 2024 | +147.1% |
| 2025 | +0.3% |
| 2026 | -3.5% |


### 21. Oracle Min Variance (ORAMV)
**Thesis:** Minimum variance oracle portfolio. Stable infrastructure exposure with minimal drawdowns.
**Config:** `analytics` | top `10` | `min_var_30` | rebalance `60d`

**Why This Index?**
1. Minimum variance optimization across oracle and analytics tokens. Stable infrastructure exposure with the covariance matrix doing the allocation work.
2. The min-var optimizer distributes weight across 10 oracle tokens (LAB, NMR, GRT, PYTH, etc.) based on their co-movement patterns, reducing portfolio-level risk.
3. BLS-verified on-chain settlement. A quantitative risk allocation applied to blockchain data infrastructure with no discretionary overrides.

**Investment Objective**
The Oracle Min Variance index applies minimum variance optimization to the top 10 analytics and oracle tokens, rebalanced every 60 days. It constructs the lowest-volatility portfolio possible from blockchain data infrastructure tokens.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.396 |
| Total Return | -51.5% |
| Annualized Return | -1406.3% |
| Max Drawdown | -94.7% |
| Volatility (ann.) | 111.7% |
| Sortino Ratio | -0.202 |
| Calmar Ratio | -0.148 |
| Win Rate (monthly) | 39.7% |
| Best Month | +121.0% |
| Worst Month | -52.6% |
| Longest Drawdown | 1578 days |
| Time Underwater | 99.4% |
| Total Trades | 111 |
| Rebalances | 30 |
| Period | 2021-05-29 → 2026-03-08 |

**Current Holdings:**
LAB (12.7%), TRUST (10.6%), NMR (10.6%), SIGN (10.4%), GRT (10.1%), ARKM (10.1%), KAITO (9.8%), CGPT (9.6%), COOKIE (8.3%), PYTH (7.8%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -89.4% |
| 2023 | +119.0% |
| 2024 | +140.7% |
| 2025 | +23.0% |
| 2026 | -30.2% |


---

## 8. The Emerging Markets Bull

Frontier investor, Global South believer, financial inclusion maximalist. Sees crypto as the monetary infrastructure for the developing world.

---

## 9. The Contrarian / Alt Data Investor

Zigs when everyone zags. Uses alternative data, bets against consensus, hunts structural mispricings. Believes the best returns come from being provably right when the crowd is provably wrong.

### 22. BTC Decoupler Index (DCOUP)
**Thesis:** Tokens whose correlation to Bitcoin dropped below 0.3. Decoupling means independent demand catalysts.
**Config:** `all` | top `15` | `invvol_30` | rebalance `14d`

**Why This Index?**
1. Tokens whose correlation to BTC drops below 0.3 have independent demand catalysts. This index hunts decoupling events. 1.066 Sharpe and +1268.3% total return.
2. Inverse-volatility weighting across 15 tokens concentrates in the calmest decoupled assets. Current holdings are 87% USDC and 11% USDS, the ultimate decouplers.
3. On-chain settlement through BLS-verified consensus. A contrarian strategy that systematically exits BTC-correlated assets during high-correlation regimes.

**Investment Objective**
The BTC Decoupler Index tracks tokens with low Bitcoin correlation, weighted by inverse volatility and rebalanced biweekly. It captures independent demand catalysts by overweighting assets that move on their own fundamentals rather than following BTC.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 1.066 |
| Total Return | +1268.3% |
| Annualized Return | +52.7% |
| Max Drawdown | -64.3% |
| Volatility (ann.) | 53.9% |
| Sortino Ratio | 1.384 |
| Calmar Ratio | 0.819 |
| Win Rate (monthly) | 55.4% |
| Best Month | +77.7% |
| Worst Month | -33.0% |
| Longest Drawdown | 1578 days |
| Time Underwater | 96.2% |
| Total Trades | 1723 |
| Rebalances | 161 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
USDC (87.1%), USDS (10.9%), TRX (0.4%), DOGE (0.3%), BNB (0.1%), BTC (0.1%), WBTC (0.1%), LINK (0.1%), ADA (0.1%), BCH (0.1%), STETH (0.1%), ETH (0.1%), SOL (0.1%), XRP (0.1%), HYPE (0.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +401.0% |
| 2022 | -42.1% |
| 2023 | +14.3% |
| 2024 | +34.8% |
| 2025 | +1.9% |
| 2026 | -0.8% |


### 23. NFT Infrastructure Phoenix (NFTPH)
**Thesis:** NFT infra tokens crashed 95% but NFTs as technology are growing. Maximum asymmetry.
**Config:** `nft-marketplace` | top `10` | `equal` | rebalance `30d`

**Why This Index?**
1. NFT infrastructure crashed 95%+ but NFTs as technology keep growing. BLUR, COLLECT, ME, TNSR represent the picks-and-shovels of a market at maximum despair.
2. Equal weighting across 4 NFT marketplace tokens provides balanced exposure to the recovery thesis without concentrating in any single platform.
3. BLS-verified on-chain settlement. Maximum asymmetry: the downside from here is bounded by how far they have already fallen.

**Investment Objective**
The NFT Infrastructure Phoenix index equally weights the top 10 NFT marketplace tokens, rebalanced monthly. It is a contrarian bet on NFT infrastructure recovery, positioned at maximum narrative despair where any adoption surprise creates outsized returns.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.149 |
| Total Return | -95.7% |
| Annualized Return | -6424.9% |
| Max Drawdown | -97.8% |
| Volatility (ann.) | 134.6% |
| Sortino Ratio | -0.787 |
| Calmar Ratio | -0.657 |
| Win Rate (monthly) | 35.1% |
| Best Month | +87.2% |
| Worst Month | -44.7% |
| Longest Drawdown | 1111 days |
| Time Underwater | 99.6% |
| Total Trades | 36 |
| Rebalances | 38 |
| Period | 2023-02-14 → 2026-03-08 |

**Current Holdings:**
BLUR (25.0%), COLLECT (25.0%), ME (25.0%), TNSR (25.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2024 | -58.7% |
| 2025 | -76.0% |
| 2026 | -39.0% |


### 24. Metaverse Bottom Fish (METAB)
**Thesis:** Metaverse tokens at maximum narrative despair. Any corporate announcement creates 10x spikes.
**Config:** `metaverse` | top `10` | `equal` | rebalance `30d`

**Why This Index?**
1. Metaverse tokens at maximum narrative despair. Any corporate metaverse announcement creates 10x volume spikes in these tokens. The asymmetry is the thesis.
2. Equal weighting across 10 metaverse tokens (AXS, MANA, SAND, RENDER, etc.) provides broad exposure to the virtual worlds narrative at distressed prices.
3. On-chain settlement with BLS-verified consensus. A contrarian basket held transparently. When the narrative returns, the rebalancing is already happening.

**Investment Objective**
The Metaverse Bottom Fish index equally weights 10 metaverse tokens, rebalanced monthly. It captures the extreme asymmetry of metaverse infrastructure at narrative lows, where tokens have declined 93%+ but the underlying technology continues to develop.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.038 |
| Total Return | -93.7% |
| Annualized Return | -4349.5% |
| Max Drawdown | -97.5% |
| Volatility (ann.) | 103.4% |
| Sortino Ratio | -0.611 |
| Calmar Ratio | -0.446 |
| Win Rate (monthly) | 39.0% |
| Best Month | +136.2% |
| Worst Month | -44.4% |
| Longest Drawdown | 1557 days |
| Time Underwater | 99.2% |
| Total Trades | 91 |
| Rebalances | 60 |
| Period | 2021-04-30 → 2026-03-08 |

**Current Holdings:**
AXS (10.0%), MANA (10.0%), ENJ (10.0%), FLOKI (10.0%), ILV (10.0%), MBOX (10.0%), ALICE (10.0%), RENDER (10.0%), SAND (10.0%), YGG (10.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -92.6% |
| 2023 | +208.6% |
| 2024 | +55.0% |
| 2025 | -82.5% |
| 2026 | -21.0% |


### 25. Prediction Market Contrarian (PREDCON)
**Thesis:** Prediction market infrastructure during narrative valleys. Information markets are permanently valuable.
**Config:** `dl-derivatives` | top `5` | `equal` | rebalance `60d`
**Overlays:** fng_mode=contrarian

**Why This Index?**
1. Prediction market infrastructure during narrative valleys, with FNG contrarian overlay. When fear peaks, this index buys. +845.9% total return, 0.923 Sharpe.
2. The contrarian FNG overlay means the index accumulates during market panic and reduces during euphoria. Information markets are permanently valuable; sentiment cycles are temporary.
3. BLS-verified on-chain settlement. A contrarian strategy with regime-switching logic, executed transparently through on-chain consensus.

**Investment Objective**
The Prediction Market Contrarian index equally weights 5 derivatives/prediction market protocols with a Fear & Greed contrarian overlay, rebalanced every 60 days. It accumulates prediction market exposure during fear and reduces during greed, exploiting the permanent value of information markets against temporary sentiment.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.923 |
| Total Return | +845.9% |
| Annualized Return | +93.5% |
| Max Drawdown | -80.2% |
| Volatility (ann.) | 216.3% |
| Sortino Ratio | 1.315 |
| Calmar Ratio | 1.165 |
| Win Rate (monthly) | 46.3% |
| Best Month | +575.9% |
| Worst Month | -45.2% |
| Longest Drawdown | 513 days |
| Time Underwater | 97.3% |
| Total Trades | 50 |
| Rebalances | 21 |
| Period | 2022-10-12 → 2026-03-08 |

**Current Holdings:**
AVNT (20.0%), GNS (20.0%), MYX (20.0%), NMR (20.0%), TRADOOR (20.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2023 | +44.4% |
| 2024 | -35.5% |
| 2025 | +1267.2% |
| 2026 | -23.9% |


---

## 10. The Thematic Momentum Trader

Narrative surfer, sector rotator, catalyst hunter, event-driven tactician, momentum-first thinker who reads flows and rides waves before the crowd.

### 26. Dual Momentum 60d (DMOM60)
**Thesis:** 60-day dual momentum for longer trend validation. Higher conviction, fewer whipsaws.
**Config:** `all` | top `20` | `dual_mom_60` | rebalance `14d`

**Why This Index?**
1. 60-day dual momentum across the top 20 tokens provides broad trend exposure with longer confirmation windows. Fewer whipsaws than 30-day alternatives.
2. Current holdings span AVAX, BNB, LINK, SOL, HYPE, and ETH, reflecting the strongest 60-day combined trends across the entire market.
3. On-chain settlement through BLS-verified consensus. Systematic trend-following at scale with no discretionary intervention.

**Investment Objective**
The Dual Momentum 60d index applies 60-day dual momentum scoring to the top 20 tokens across all categories, rebalanced biweekly. The extended lookback reduces false signals and increases conviction per position.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.459 |
| Total Return | +40.4% |
| Annualized Return | +564.1% |
| Max Drawdown | -93.1% |
| Volatility (ann.) | 76.0% |
| Sortino Ratio | 0.108 |
| Calmar Ratio | 0.061 |
| Win Rate (monthly) | 35.1% |
| Best Month | +91.3% |
| Worst Month | -44.4% |
| Longest Drawdown | 1765 days |
| Time Underwater | 97.7% |
| Total Trades | 1209 |
| Rebalances | 126 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
AVAX (20.2%), BNB (17.8%), LINK (15.8%), SOL (13.1%), HYPE (8.3%), WEETH (6.6%), STETH (6.2%), ETH (6.2%), ADA (4.0%), TRX (1.8%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +272.4% |
| 2022 | -82.4% |
| 2023 | +48.1% |
| 2024 | +41.6% |
| 2025 | -9.9% |
| 2026 | 0.0% |


### 27. AI Dual Momentum (AIDMOM)
**Thesis:** Dual momentum on AI. Maximum conviction in AI tokens trending up on both axes.
**Config:** `defai` | top `10` | `dual_mom_30` | rebalance `7d`

**Why This Index?**
1. Dual momentum on AI tokens with weekly rebalancing. +195.0% total return and 0.901 Sharpe from the intersection of AI narrative and trend-following discipline.
2. Weekly rebalancing on 30-day dual momentum captures the fast-moving AI narrative. Current holdings APR, IN, and AIXBT reflect the fastest-trending AI projects.
3. BLS-verified on-chain settlement. AI sector momentum captured through transparent, consensus-driven rebalancing.

**Investment Objective**
The AI Dual Momentum index applies 30-day dual momentum to the top 10 DeFAI tokens, rebalanced weekly. It rides the AI narrative in crypto by holding only tokens trending up on both absolute and relative axes.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.901 |
| Total Return | +195.0% |
| Annualized Return | +53.6% |
| Max Drawdown | -82.8% |
| Volatility (ann.) | 119.4% |
| Sortino Ratio | 0.871 |
| Calmar Ratio | 0.646 |
| Win Rate (monthly) | 48.4% |
| Best Month | +232.6% |
| Worst Month | -51.2% |
| Longest Drawdown | 415 days |
| Time Underwater | 96.2% |
| Total Trades | 154 |
| Rebalances | 76 |
| Period | 2023-08-30 → 2026-03-08 |

**Current Holdings:**
APR (48.6%), IN (29.4%), AIXBT (16.5%), AITECH (4.4%), NEWT (1.2%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2024 | +1744.5% |
| 2025 | -73.6% |
| 2026 | -19.8% |


### 28. Gaming Momentum 60d (GAMM60)
**Thesis:** 60-day gaming momentum captures sustained game launch adoption curves.
**Config:** `dl-gaming` | top `15` | `momentum_60` | rebalance `14d`

**Why This Index?**
1. 60-day gaming momentum captures sustained game launch adoption curves rather than short-lived hype spikes. Longer windows filter noise.
2. 15 gaming tokens scored by 60-day momentum, rebalanced biweekly. AXS at 53.9% dominates because sustained gaming adoption is rare and concentrated.
3. On-chain settlement with BLS-verified consensus. A systematic way to capture gaming adoption trends without guessing which game launches next.

**Investment Objective**
The Gaming Momentum 60d index ranks the top 15 gaming tokens by 60-day price momentum, rebalanced biweekly. It filters short-term noise to identify games and gaming infrastructure with sustained adoption curves.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.115 |
| Total Return | -93.0% |
| Annualized Return | -4495.2% |
| Max Drawdown | -98.6% |
| Volatility (ann.) | 98.7% |
| Sortino Ratio | -0.669 |
| Calmar Ratio | -0.456 |
| Win Rate (monthly) | 37.0% |
| Best Month | +138.4% |
| Worst Month | -43.9% |
| Longest Drawdown | 1563 days |
| Time Underwater | 98.8% |
| Total Trades | 398 |
| Rebalances | 116 |
| Period | 2021-09-27 → 2026-03-08 |

**Current Holdings:**
AXS (53.9%), TLM (10.9%), BIGTIME (9.4%), SAND (7.5%), YGG (6.5%), PRIME (5.9%), MBOX (2.6%), ILV (2.6%), CREO (0.6%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -93.7% |
| 2023 | +131.7% |
| 2024 | -26.2% |
| 2025 | -80.9% |
| 2026 | -16.8% |


### 29. Gaming Dual Momentum (GAMDM)
**Thesis:** Dual momentum on gaming. Only games trending up on both absolute and relative basis.
**Config:** `dl-gaming` | top `10` | `dual_mom_30` | rebalance `7d`

**Why This Index?**
1. Dual momentum on gaming selects only tokens trending up on both absolute and relative basis. AXS at 89.7% dominates because almost nothing else in gaming passes both filters.
2. Weekly rebalancing with 30-day dual momentum exits failing games fast. The strategy is maximally selective: most gaming tokens fail both tests most of the time.
3. BLS-verified on-chain settlement. A disciplined filter applied to the noisiest sector in crypto.

**Investment Objective**
The Gaming Dual Momentum index applies 30-day dual momentum to the top 10 gaming tokens, rebalanced weekly. It holds only gaming tokens simultaneously trending up in absolute terms and outperforming the market.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.301 |
| Total Return | -92.2% |
| Annualized Return | -4375.6% |
| Max Drawdown | -95.7% |
| Volatility (ann.) | 83.0% |
| Sortino Ratio | -0.837 |
| Calmar Ratio | -0.457 |
| Win Rate (monthly) | 24.1% |
| Best Month | +61.8% |
| Worst Month | -42.5% |
| Longest Drawdown | 1563 days |
| Time Underwater | 98.8% |
| Total Trades | 532 |
| Rebalances | 134 |
| Period | 2021-09-27 → 2026-03-08 |

**Current Holdings:**
AXS (89.7%), SAND (5.0%), TLM (2.8%), BIGTIME (2.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -44.4% |
| 2023 | -40.6% |
| 2024 | +4.2% |
| 2025 | -65.8% |
| 2026 | -34.9% |


### 30. DeFi Momentum + FNG (DFIMFNG)
**Thesis:** DeFi momentum with FNG trigger. Rides DeFi trends but exits during extreme fear.
**Config:** `smart-contract-platform` | top `10` | `momentum_30` | rebalance `7d`
**Overlays:** fng_mode=trigger

**Why This Index?**
1. Smart contract platform momentum with FNG trigger. 1.172 Sharpe and +3587.6% total return. The FNG overlay exits during extreme fear, preserving gains through crashes.
2. The FNG trigger moved to cash during the 2022 bear, limiting the drawdown to -58.1%. That single mechanism accounts for most of the Sharpe improvement over raw momentum.
3. On-chain settlement through BLS-verified consensus. Regime-switching momentum with transparent, auditable trigger logic.

**Investment Objective**
The DeFi Momentum + FNG index applies 30-day momentum to the top 10 smart contract platforms with a Fear & Greed trigger overlay, rebalanced weekly. During extreme fear, the strategy exits to cash. During neutral or greedy markets, it rides the strongest L1 trends.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 1.172 |
| Total Return | +3587.6% |
| Annualized Return | +79.2% |
| Max Drawdown | -58.1% |
| Volatility (ann.) | 72.9% |
| Sortino Ratio | 1.584 |
| Calmar Ratio | 1.363 |
| Win Rate (monthly) | 59.5% |
| Best Month | +55.4% |
| Worst Month | -28.9% |
| Longest Drawdown | 341 days |
| Time Underwater | 94.7% |
| Total Trades | 1242 |
| Rebalances | 131 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
XRP (16.6%), ETH (13.5%), BTC (13.4%), TRX (13.2%), SOL (12.3%), ADA (10.2%), BNB (10.2%), BCH (7.3%), HYPE (2.6%), DOGE (0.7%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +251.5% |
| 2022 | -19.4% |
| 2023 | +215.8% |
| 2024 | +3.7% |
| 2025 | +25.1% |
| 2026 | -14.9% |


### 31. TVL Momentum Perps (TVLMPP)
**Thesis:** Perp DEX protocols with TVL momentum. OI growth signals derivatives migration on-chain.
**Config:** `dl-derivatives` | top `10` | `tvl_mom_30` | rebalance `7d`

**Why This Index?**
1. Perp DEX protocols with TVL momentum. OI growth signals derivatives migration on-chain. 1.133 Sharpe and +1663.3% total return, with +1353% in 2025 alone.
2. TVL momentum captures protocols attracting new deposits, not just price appreciation. The strategy surfaced AVNT, GNS, and MYX before they rallied.
3. BLS-verified on-chain settlement. A systematic way to front-run the on-chain derivatives migration by following capital flows.

**Investment Objective**
The TVL Momentum Perps index tracks the top 10 perpetual DEX protocols ranked by 30-day TVL momentum, rebalanced weekly. It captures the on-chain derivatives migration by overweighting platforms experiencing the fastest deposit growth.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 1.133 |
| Total Return | +1663.3% |
| Annualized Return | +132.4% |
| Max Drawdown | -69.2% |
| Volatility (ann.) | 138.2% |
| Sortino Ratio | 2.152 |
| Calmar Ratio | 1.910 |
| Win Rate (monthly) | 51.2% |
| Best Month | +830.8% |
| Worst Month | -32.5% |
| Longest Drawdown | 512 days |
| Time Underwater | 96.4% |
| Total Trades | 384 |
| Rebalances | 177 |
| Period | 2022-10-12 → 2026-03-08 |

**Current Holdings:**
AVNT (20.0%), GNS (20.0%), MYX (20.0%), NMR (20.0%), TRADOOR (20.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2023 | +29.4% |
| 2024 | +21.4% |
| 2025 | +1353.0% |
| 2026 | -26.4% |


### 32. Concentrated Momentum + FNG (MOM5FNG)
**Thesis:** Top 5 momentum tokens with FNG trigger. Maximum conviction trend-following with panic exit.
**Config:** `all` | top `5` | `momentum_30` | rebalance `7d`
**Overlays:** fng_mode=trigger

**Why This Index?**
1. Top 5 momentum tokens with FNG trigger. 1.178 Sharpe, +2998.9% total return, 67.6% monthly win rate. The highest win rate of any index in the catalog.
2. The FNG trigger limited the 2022 drawdown to -54.6% while raw momentum would have lost 80%+. Concentrated positions amplify both the momentum signal and the fear exit.
3. On-chain settlement through BLS-verified consensus. The simplest high-performance strategy: ride winners, exit on fear.

**Investment Objective**
The Concentrated Momentum + FNG index holds the top 5 tokens by 30-day momentum with a Fear & Greed trigger, rebalanced weekly. It combines concentrated trend-following with a systematic fear exit, producing the highest monthly win rate in the catalog at 67.6%.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 1.178 |
| Total Return | +2998.9% |
| Annualized Return | +74.3% |
| Max Drawdown | -54.6% |
| Volatility (ann.) | 66.0% |
| Sortino Ratio | 1.660 |
| Calmar Ratio | 1.360 |
| Win Rate (monthly) | 67.6% |
| Best Month | +45.5% |
| Worst Month | -23.3% |
| Longest Drawdown | 483 days |
| Time Underwater | 93.1% |
| Total Trades | 667 |
| Rebalances | 131 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
XRP (38.0%), ETH (24.7%), BTC (24.0%), BNB (10.2%), USDC (3.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +210.6% |
| 2022 | -3.0% |
| 2023 | +123.1% |
| 2024 | +5.3% |
| 2025 | +39.9% |
| 2026 | -15.1% |


### 33. TVL Leaders + Momentum (TVLMOM)
**Thesis:** Top TVL protocols filtered by price momentum. Fundamental base + technical trend.
**Config:** `dl-fa-top-tvl` | top `20` | `momentum_30` | rebalance `14d`

**Why This Index?**
1. TVL leaders filtered by price momentum. Fundamental base plus technical trend. +169.7% total return from protocols that are both large and trending up.
2. 20 tokens from the highest-TVL DeFi protocols, weighted by 30-day momentum and rebalanced biweekly. Current holdings span gold, lending, DEX, and staking.
3. BLS-verified on-chain settlement. A hybrid fundamental-technical strategy applied to DeFi infrastructure.

**Investment Objective**
The TVL Leaders + Momentum index selects the top 20 DeFi protocols by TVL, then weights them by 30-day price momentum and rebalances biweekly. It combines the stability of large TVL protocols with the timing advantage of momentum selection.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.624 |
| Total Return | +169.7% |
| Annualized Return | +22.6% |
| Max Drawdown | -84.2% |
| Volatility (ann.) | 156.3% |
| Sortino Ratio | 0.345 |
| Calmar Ratio | 0.268 |
| Win Rate (monthly) | 44.1% |
| Best Month | +576.9% |
| Worst Month | -57.2% |
| Longest Drawdown | 837 days |
| Time Underwater | 98.9% |
| Total Trades | 1417 |
| Rebalances | 127 |
| Period | 2021-04-21 → 2026-03-08 |

**Current Holdings:**
PAXG (7.4%), XAUT (7.4%), DBR (7.1%), JST (6.8%), NEXO (6.7%), CVX (6.3%), FF (6.3%), POL (5.5%), KUB (5.4%), AAVE (5.1%), FLOKI (4.5%), RUNE (4.5%), IMX (4.2%), W (4.2%), RSR (4.0%), LDO (3.9%), STRK (3.8%), EIGEN (3.4%), PENDLE (3.4%), MYX (0.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -79.5% |
| 2023 | +178.9% |
| 2024 | +61.2% |
| 2025 | +77.8% |
| 2026 | -0.4% |


### 34. All Sectors Rotation (ROTATE)
**Thesis:** Cross-sector momentum rotation. Captures which crypto sector is leading this cycle.
**Config:** `all` | top `50` | `momentum_30` | rebalance `7d`

**Why This Index?**
1. Cross-sector momentum rotation across 50 tokens. Captures which crypto sector is leading this cycle without requiring a view on which sector that will be.
2. 50 tokens weighted by 30-day momentum, rebalanced weekly. The broadest momentum strategy in the catalog, rotating through L1s, DeFi, stablecoins, and memes.
3. On-chain settlement with BLS-verified consensus. Sector rotation without committee decisions or discretionary calls.

**Investment Objective**
The All Sectors Rotation index applies 30-day momentum to 50 tokens across every crypto category, rebalanced weekly. It is a pure sector-rotation strategy that systematically overweights whichever corner of crypto is trending strongest.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.376 |
| Total Return | -47.7% |
| Annualized Return | -994.5% |
| Max Drawdown | -96.2% |
| Volatility (ann.) | 93.8% |
| Sortino Ratio | -0.150 |
| Calmar Ratio | -0.103 |
| Win Rate (monthly) | 45.9% |
| Best Month | +70.7% |
| Worst Month | -67.4% |
| Longest Drawdown | 1765 days |
| Time Underwater | 97.1% |
| Total Trades | 6822 |
| Rebalances | 322 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
ASTER (4.4%), SKY (3.6%), PI (3.5%), USDE (3.2%), M (3.2%), USDS (3.2%), USDC (3.2%), DAI (3.2%), RLUSD (3.2%), USD1 (3.2%), PYUSD (3.2%), HYPE (3.2%), PAXG (3.1%), LTC (3.1%), XAUT (3.1%), HBAR (2.9%), TRX (2.9%), DOGE (2.5%), HTX (2.3%), DOT (2.2%), UNI (2.1%), NEAR (2.0%), CRO (2.0%), TON (1.9%), ADA (1.7%), AVAX (1.7%), WLD (1.6%), ONDO (1.6%), TAO (1.6%), BCH (1.6%), ETC (1.5%), BTC (1.5%), WBTC (1.4%), LINK (1.4%), AAVE (1.4%), XLM (1.4%), ICP (1.4%), SHIB (1.2%), XRP (1.2%), PEPE (1.0%), BNB (0.9%), SOL (0.9%), PUMP (0.7%), WLFI (0.7%), WEETH (0.7%), ETH (0.7%), STETH (0.7%), SUI (0.7%), ZEC (0.1%), BGB (0.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +269.3% |
| 2022 | -78.9% |
| 2023 | +16.9% |
| 2024 | +86.7% |
| 2025 | -83.8% |
| 2026 | -23.8% |


### 35. Bridge Mom + FNG (BRMFNG)
**Thesis:** Bridge protocol momentum with FNG trigger. Cross-chain activity trends + panic exit.
**Config:** `dl-bridge` | top `10` | `momentum_30` | rebalance `14d`
**Overlays:** fng_mode=trigger

**Why This Index?**
1. Bridge protocol momentum with FNG trigger. The FNG overlay exits during panic, which matters because bridge tokens are among the most volatile in crypto.
2. 30-day momentum across 10 bridge tokens, rebalanced biweekly. ZRO (37.2%) and DBR (21.5%) currently lead because LayerZero and deBridge are capturing cross-chain traffic.
3. BLS-verified on-chain settlement. A momentum strategy applied to cross-chain infrastructure with regime-aware risk management.

**Investment Objective**
The Bridge Mom + FNG index applies 30-day momentum to the top 10 bridge tokens with a Fear & Greed trigger overlay, rebalanced biweekly. It rides cross-chain infrastructure trends while exiting to cash during extreme market fear.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.022 |
| Total Return | -89.4% |
| Annualized Return | -3992.8% |
| Max Drawdown | -92.1% |
| Volatility (ann.) | 98.9% |
| Sortino Ratio | -0.585 |
| Calmar Ratio | -0.433 |
| Win Rate (monthly) | 41.5% |
| Best Month | +77.3% |
| Worst Month | -43.0% |
| Longest Drawdown | 1436 days |
| Time Underwater | 99.9% |
| Total Trades | 198 |
| Rebalances | 96 |
| Period | 2021-10-13 → 2026-03-08 |

**Current Holdings:**
ZRO (37.2%), DBR (21.5%), CELR (17.7%), W (11.6%), PUMPBTC (11.4%), BICO (0.6%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -37.5% |
| 2023 | +41.4% |
| 2024 | -54.4% |
| 2025 | -60.4% |
| 2026 | -4.4% |


### 36. ZK Mom + VC (ZKMVC)
**Thesis:** ZK momentum with VC overlay. Technology trend + institutional validation.
**Config:** `zero-knowledge-zk` | top `10` | `momentum_30` | rebalance `14d`
**Overlays:** vc_mode=funding

**Why This Index?**
1. ZK momentum with VC overlay. Zero-knowledge proofs are the endgame for blockchain scaling. The VC filter ensures only venture-backed ZK projects qualify.
2. 30-day momentum across 10 ZK tokens, rebalanced biweekly. DUSK (53.9%) and COTI (30.2%) currently lead the momentum ranking.
3. On-chain settlement through BLS-verified consensus. ZK technology trend with institutional validation, held transparently.

**Investment Objective**
The ZK Mom + VC index applies 30-day momentum to the top 10 zero-knowledge tokens, filtered by VC funding status and rebalanced biweekly. It captures the ZK scaling narrative through venture-validated projects showing technical momentum.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.056 |
| Total Return | -52.0% |
| Annualized Return | -1412.8% |
| Max Drawdown | -89.6% |
| Volatility (ann.) | 60.6% |
| Sortino Ratio | -0.330 |
| Calmar Ratio | -0.158 |
| Win Rate (monthly) | 22.4% |
| Best Month | +69.0% |
| Worst Month | -53.6% |
| Longest Drawdown | 1531 days |
| Time Underwater | 87.0% |
| Total Trades | 163 |
| Rebalances | 58 |
| Period | 2021-05-12 → 2026-03-08 |

**Current Holdings:**
DUSK (53.9%), COTI (30.2%), MINA (15.3%), TLOS (0.6%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -84.8% |
| 2023 | +63.8% |
| 2024 | +59.3% |
| 2025 | 0.0% |
| 2026 | 0.0% |


### 37. Modular Mom + VC (MODMVC)
**Thesis:** Modular stack momentum with VC overlay. Modular thesis adoption + smart money signals.
**Config:** `data-availability` | top `10` | `momentum_30` | rebalance `14d`
**Overlays:** vc_mode=funding

**Why This Index?**
1. Modular stack momentum with VC overlay. +37.8% total return with only 17.7% time underwater. The modular blockchain thesis validated by venture capital.
2. Only 2 current holdings (B2 and SYS) because few modular projects pass both the VC and momentum filters. Extreme selectivity is a feature.
3. BLS-verified on-chain settlement. A narrow, high-conviction bet on modular infrastructure backed by institutional capital.

**Investment Objective**
The Modular Mom + VC index applies 30-day momentum to the top 10 data availability tokens, filtered by VC funding and rebalanced biweekly. It captures the modular blockchain thesis through the intersection of venture validation and price trend.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.453 |
| Total Return | +37.8% |
| Annualized Return | +866.9% |
| Max Drawdown | -69.2% |
| Volatility (ann.) | 64.2% |
| Sortino Ratio | 0.212 |
| Calmar Ratio | 0.125 |
| Win Rate (monthly) | 6.4% |
| Best Month | +151.2% |
| Worst Month | -62.0% |
| Longest Drawdown | 129 days |
| Time Underwater | 17.7% |
| Total Trades | 16 |
| Rebalances | 20 |
| Period | 2022-04-29 → 2026-03-08 |

**Current Holdings:**
B2 (54.9%), SYS (45.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2023 | 0.0% |
| 2024 | 0.0% |
| 2025 | +115.8% |
| 2026 | -36.1% |


### 38. Concentrated Dual Momentum (CDM5)
**Thesis:** Top 5 by dual momentum. Maximum concentration in the strongest combined signals.
**Config:** `all` | top `5` | `dual_mom_30` | rebalance `7d`

**Why This Index?**
1. Top 5 by dual momentum, rebalanced weekly. +396.3% total return and 0.727 Sharpe. Maximum concentration in the strongest combined absolute and relative signals.
2. Current holdings XRP (41.1%), ETH (25.6%), BTC (24.7%), BNB (8.6%) show the strategy concentrates in large caps when trends are broad.
3. On-chain settlement with BLS-verified consensus. A high-concentration trend strategy with transparent, systematic selection.

**Investment Objective**
The Concentrated Dual Momentum index holds the top 5 tokens by 30-day dual momentum, rebalanced weekly. It combines maximum concentration with the dual momentum signal, holding only assets that are trending up both in absolute and relative terms.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.727 |
| Total Return | +396.3% |
| Annualized Return | +29.6% |
| Max Drawdown | -79.0% |
| Volatility (ann.) | 62.2% |
| Sortino Ratio | 0.716 |
| Calmar Ratio | 0.374 |
| Win Rate (monthly) | 45.9% |
| Best Month | +101.9% |
| Worst Month | -32.8% |
| Longest Drawdown | 1642 days |
| Time Underwater | 97.4% |
| Total Trades | 1013 |
| Rebalances | 258 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
XRP (41.1%), ETH (25.6%), BTC (24.7%), BNB (8.6%), USDC (0.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +299.5% |
| 2022 | -44.1% |
| 2023 | +1.1% |
| 2024 | +51.0% |
| 2025 | +26.9% |
| 2026 | -23.2% |


### 39. L1 Multi-Factor + FNG + Dom (L1MFFD)
**Thesis:** L1 multi-factor with FNG trigger and dominance switching. Maximum systematic L1 allocation.
**Config:** `layer-1` | top `10` | `multi_factor_30` | rebalance `14d`
**Overlays:** fng_mode=trigger, dominance_mode=btc

**Why This Index?**
1. The most engineered L1 strategy in the catalog. Multi-factor scoring + FNG trigger + BTC dominance switching. 1.181 Sharpe and +3395.7% total return.
2. BTC dominance switching rotates between BTC-heavy and alt-heavy exposure based on the dominance regime. The FNG trigger exits during panic. Multi-factor selects the best risk/reward L1s.
3. On-chain settlement through BLS-verified consensus. Three systematic overlays, zero discretionary decisions.

**Investment Objective**
The L1 Multi-Factor + FNG + Dom index applies multi-factor scoring to the top 10 L1 tokens with Fear & Greed trigger and BTC dominance switching, rebalanced biweekly. It combines factor investing with regime awareness and sentiment protection, producing one of the highest Sharpe ratios in the catalog.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 1.181 |
| Total Return | +3395.7% |
| Annualized Return | +77.7% |
| Max Drawdown | -54.9% |
| Volatility (ann.) | 69.8% |
| Sortino Ratio | 1.608 |
| Calmar Ratio | 1.414 |
| Win Rate (monthly) | 60.8% |
| Best Month | +54.0% |
| Worst Month | -31.8% |
| Longest Drawdown | 432 days |
| Time Underwater | 94.2% |
| Total Trades | 1211 |
| Rebalances | 131 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
BTC (15.2%), ETH (13.3%), TRX (12.7%), BNB (12.1%), XRP (12.1%), HBAR (10.9%), SOL (7.9%), ADA (6.7%), HYPE (5.5%), BCH (3.6%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +320.9% |
| 2022 | -22.1% |
| 2023 | +157.2% |
| 2024 | +38.0% |
| 2025 | +34.9% |
| 2026 | -18.4% |


### 40. Governance 15 Equal Quarterly (GOV15EQ)
**Thesis:** Top 15 governance equal weight quarterly. DAO ecosystem with patient allocation.
**Config:** `liquid-staking-governance-tokens` | top `15` | `equal` | rebalance `90d`

**Why This Index?**
1. Top 15 governance tokens equally weighted, rebalanced quarterly. Patient allocation to the DAO ecosystem with 90-day holding periods.
2. Quarterly rebalancing reduces turnover and trading costs. Equal weighting across 8 liquid staking governance tokens prevents concentration in any single DAO.
3. BLS-verified on-chain settlement. DAO ecosystem exposure with the patience that governance participation requires.

**Investment Objective**
The Governance 15 Equal Quarterly index equally weights the top 15 liquid staking governance tokens, rebalanced every 90 days. It provides broad DAO ecosystem exposure with low turnover, matching the patient timeframe of governance participation.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.023 |
| Total Return | -89.5% |
| Annualized Return | -3766.4% |
| Max Drawdown | -93.6% |
| Volatility (ann.) | 100.5% |
| Sortino Ratio | -0.564 |
| Calmar Ratio | -0.402 |
| Win Rate (monthly) | 35.1% |
| Best Month | +166.2% |
| Worst Month | -57.2% |
| Longest Drawdown | 1561 days |
| Time Underwater | 99.6% |
| Total Trades | 61 |
| Rebalances | 20 |
| Period | 2021-06-03 → 2026-03-08 |

**Current Holdings:**
ANKR (12.5%), BR (12.5%), HAEDAL (12.5%), JTO (12.5%), LDO (12.5%), RPL (12.5%), SD (12.5%), TREE (12.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -77.5% |
| 2023 | +171.0% |
| 2024 | +17.9% |
| 2025 | -76.2% |
| 2026 | -37.5% |


### 41. Lending 10 Fee Eff Biweekly (LND10FEB)
**Thesis:** Top 10 lending by fee efficiency biweekly. Most capital-efficient lenders.
**Config:** `dl-lending` | top `10` | `fee_eff` | rebalance `14d`

**Why This Index?**
1. Fee efficiency weighting selects the most capital-efficient lenders. The protocols generating the most revenue per dollar of TVL get the highest weight.
2. Biweekly rebalancing across 10 lending protocols ranked by fee efficiency. Current holdings AAVE, BLUE, and JST represent the highest-margin lending platforms.
3. On-chain settlement with BLS-verified consensus. A profitability screen applied to DeFi lending with transparent methodology.

**Investment Objective**
The Lending 10 Fee Eff Biweekly index weights the top 10 lending protocols by fee efficiency, rebalanced every 14 days. It systematically overweights the most capital-efficient lenders, favoring protocols that generate the most interest revenue per unit of locked capital.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.024 |
| Total Return | -83.8% |
| Annualized Return | -3116.0% |
| Max Drawdown | -92.2% |
| Volatility (ann.) | 84.1% |
| Sortino Ratio | -0.529 |
| Calmar Ratio | -0.338 |
| Win Rate (monthly) | 45.8% |
| Best Month | +62.9% |
| Worst Month | -40.0% |
| Longest Drawdown | 1751 days |
| Time Underwater | 99.4% |
| Total Trades | 116 |
| Rebalances | 127 |
| Period | 2021-04-22 → 2026-03-08 |

**Current Holdings:**
AAVE (33.3%), BLUE (33.3%), JST (33.3%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -75.5% |
| 2023 | +54.6% |
| 2024 | +18.4% |
| 2025 | -47.6% |
| 2026 | -18.9% |


### 42. CDP 5 TVL Quarterly (CDP5TQ)
**Thesis:** Top 5 CDP by TVL quarterly. Stablecoin issuance infrastructure with patient rebalance.
**Config:** `dl-lending` | top `5` | `tvl` | rebalance `90d`

**Why This Index?**
1. Top 5 CDP protocols by TVL, rebalanced quarterly. Stablecoin issuance infrastructure with patient 90-day holding periods. JST at 94% shows extreme TVL concentration.
2. Quarterly rebalancing in a concentrated basket means low turnover. The strategy holds through volatility rather than trading through it.
3. BLS-verified on-chain settlement. The simplest CDP exposure: buy the biggest by deposits, hold for a quarter, repeat.

**Investment Objective**
The CDP 5 TVL Quarterly index holds the top 5 lending protocols by TVL, rebalanced every 90 days. It provides concentrated stablecoin infrastructure exposure with patient quarterly rebalancing that reduces transaction costs.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.404 |
| Total Return | -10.4% |
| Annualized Return | -222.2% |
| Max Drawdown | -80.0% |
| Volatility (ann.) | 88.2% |
| Sortino Ratio | -0.038 |
| Calmar Ratio | -0.028 |
| Win Rate (monthly) | 49.2% |
| Best Month | +85.7% |
| Worst Month | -35.2% |
| Longest Drawdown | 1753 days |
| Time Underwater | 99.5% |
| Total Trades | 21 |
| Rebalances | 20 |
| Period | 2021-04-22 → 2026-03-08 |

**Current Holdings:**
JST (94.0%), AAVE (4.1%), BLUE (1.9%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -63.4% |
| 2023 | +58.8% |
| 2024 | +27.6% |
| 2025 | +0.1% |
| 2026 | +17.0% |


### 43. Volume Leaders Dual Momentum (VLDM)
**Thesis:** Volume leaders with dual momentum. High-activity protocols + trend confirmation.
**Config:** `dl-fa-top-tvl` | top `15` | `dual_mom_30` | rebalance `7d`

**Why This Index?**
1. Volume leaders with dual momentum. High-activity protocols that are also trending up on both absolute and relative axes. CVX (31.1%) and NEXO (20.7%) currently lead.
2. Dual momentum on the highest-volume DeFi protocols filters for projects with both liquidity depth and price trend. The intersection is small and selective.
3. BLS-verified on-chain settlement. A liquidity-first strategy with trend confirmation, executed transparently on-chain.

**Investment Objective**
The Volume Leaders Dual Momentum index applies 30-day dual momentum to the top 15 DeFi protocols by TVL, rebalanced weekly. It selects protocols that combine high trading activity with confirmed upward trends on both absolute and relative measures.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.410 |
| Total Return | -16.2% |
| Annualized Return | -356.1% |
| Max Drawdown | -85.6% |
| Volatility (ann.) | 130.8% |
| Sortino Ratio | -0.062 |
| Calmar Ratio | -0.042 |
| Win Rate (monthly) | 37.3% |
| Best Month | +187.7% |
| Worst Month | -67.5% |
| Longest Drawdown | 834 days |
| Time Underwater | 98.4% |
| Total Trades | 1347 |
| Rebalances | 162 |
| Period | 2021-04-21 → 2026-03-08 |

**Current Holdings:**
CVX (31.1%), NEXO (20.7%), JST (18.3%), RUNE (7.0%), PAXG (6.7%), AAVE (3.7%), XAUT (3.1%), PENDLE (2.7%), FF (2.7%), IMX (2.5%), POL (1.6%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -55.2% |
| 2023 | +83.8% |
| 2024 | +15.8% |
| 2025 | -6.1% |
| 2026 | -36.6% |


### 44. DePIN 10 Revenue + All Overlays (DPULTRA)
**Thesis:** DePIN revenue-weighted with all overlays. Maximum systematic DePIN allocation.
**Config:** `depin` | top `10` | `revenue_w` | rebalance `14d`
**Overlays:** fng_mode=trigger, dominance_mode=btc, vc_mode=funding

**Why This Index?**
1. DePIN revenue-weighted with all three overlays: FNG trigger, BTC dominance switching, and VC filter. The maximum-systematic approach to decentralized physical infrastructure.
2. Revenue weighting ensures only DePIN protocols generating real income qualify. AR, BTT, DENT, HOT, LPT, and FLUX represent storage, bandwidth, and compute revenue.
3. On-chain settlement with BLS-verified consensus. Triple-overlay systematic exposure to decentralized infrastructure revenue.

**Investment Objective**
The DePIN 10 Revenue + All Overlays index weights the top 10 DePIN protocols by revenue with FNG trigger, BTC dominance switching, and VC filter, rebalanced biweekly. It captures real infrastructure revenue from storage, bandwidth, and compute with maximum systematic protection.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.037 |
| Total Return | -49.2% |
| Annualized Return | -1313.1% |
| Max Drawdown | -68.6% |
| Volatility (ann.) | 56.0% |
| Sortino Ratio | -0.321 |
| Calmar Ratio | -0.191 |
| Win Rate (monthly) | 13.8% |
| Best Month | +75.5% |
| Worst Month | -36.3% |
| Longest Drawdown | 1558 days |
| Time Underwater | 99.6% |
| Total Trades | 105 |
| Rebalances | 49 |
| Period | 2021-05-15 → 2026-03-08 |

**Current Holdings:**
AR (16.7%), BTT (16.7%), DENT (16.7%), HOT (16.7%), LPT (16.7%), FLUX (16.7%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -49.5% |
| 2023 | 0.0% |
| 2024 | 0.0% |
| 2025 | 0.0% |
| 2026 | 0.0% |


### 45. DEX 10 Volume + FNG + Dom (DX10VFD)
**Thesis:** DEX volume with FNG and dominance. Volume leaders + regime-aware protection.
**Config:** `dl-dexs` | top `10` | `volume_w` | rebalance `7d`
**Overlays:** fng_mode=trigger, dominance_mode=btc

**Why This Index?**
1. DEX volume weighting with FNG trigger and BTC dominance switching. A 0.461 Sharpe from the intersection of DEX activity, sentiment, and BTC regime.
2. Volume weighting selects DEXes that are actually being used for trading. The FNG and dominance overlays add timing. Current holdings span CRO, LRC, RUNE, and others.
3. On-chain settlement through BLS-verified consensus. DEX exposure with two protective overlays, settled transparently.

**Investment Objective**
The DEX 10 Volume + FNG + Dom index weights the top 10 DEX tokens by trading volume with FNG trigger and BTC dominance switching, rebalanced weekly. It captures DEX activity leaders while managing exposure through sentiment and BTC regime awareness.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.461 |
| Total Return | +3.9% |
| Annualized Return | +78.8% |
| Max Drawdown | -81.0% |
| Volatility (ann.) | 91.1% |
| Sortino Ratio | 0.013 |
| Calmar Ratio | 0.010 |
| Win Rate (monthly) | 42.4% |
| Best Month | +116.5% |
| Worst Month | -42.4% |
| Longest Drawdown | 799 days |
| Time Underwater | 98.3% |
| Total Trades | 572 |
| Rebalances | 115 |
| Period | 2021-04-21 → 2026-03-08 |

**Current Holdings:**
CRO (10.0%), LRC (10.0%), MMT (10.0%), OSMO (10.0%), SDEX (10.0%), SUN (10.0%), SUSHI (10.0%), THE (10.0%), RUNE (10.0%), VELO (10.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -66.2% |
| 2023 | +141.0% |
| 2024 | -18.2% |
| 2025 | -55.7% |
| 2026 | -30.5% |


### 46. Broad 100 Sqrt Mcap Monthly (B100SM)
**Thesis:** Broadest mid-cap tilted index. 100 tokens with sqrt mcap monthly. Maximum diversified mid-cap exposure.
**Config:** `all` | top `100` | `sqrt_mcap` | rebalance `30d`

**Why This Index?**
1. The broadest mid-cap tilted index. 100 tokens with sqrt market-cap weighting. BTC at 17.6% instead of 50%+ means small and mid caps get real allocation.
2. Sqrt market cap compresses the gap between BTC/ETH and smaller tokens. The result is 100 holdings from stablecoins to memecoins, with meaningful weight in the long tail.
3. BLS-verified on-chain settlement. A 100-token diversified index that would be impossible to construct manually, rebalanced monthly on-chain.

**Investment Objective**
The Broad 100 Sqrt Mcap Monthly index holds 100 tokens weighted by the square root of market cap, rebalanced monthly. The sqrt function tilts allocation toward mid-caps, producing a more diversified index than pure market-cap weighting while still respecting relative size.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.625 |
| Total Return | +214.6% |
| Annualized Return | +20.4% |
| Max Drawdown | -84.3% |
| Volatility (ann.) | 70.1% |
| Sortino Ratio | 0.399 |
| Calmar Ratio | 0.241 |
| Win Rate (monthly) | 48.6% |
| Best Month | +57.1% |
| Worst Month | -38.4% |
| Longest Drawdown | 1760 days |
| Time Underwater | 96.2% |
| Total Trades | 1020 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
BTC (17.6%), ETH (7.4%), BNB (4.4%), XRP (4.4%), USDC (4.2%), SOL (3.3%), TRX (2.5%), STETH (2.1%), DOGE (1.9%), ADA (1.5%), USDS (1.5%), BCH (1.4%), WBTC (1.4%), HYPE (1.3%), LINK (1.2%), USDE (1.2%), WEETH (1.2%), XLM (1.1%), USD1 (1.1%), HBAR (1.0%), PYUSD (1.0%), DAI (1.0%), LTC (1.0%), AVAX (0.9%), ZEC (0.9%), SUI (0.9%), SHIB (0.9%), TON (0.8%), CRO (0.8%), WLFI (0.8%), XAUT (0.8%), DOT (0.8%), PAXG (0.8%), M (0.8%), UNI (0.7%), ASTER (0.6%), TAO (0.6%), AAVE (0.6%), PI (0.6%), SKY (0.6%), BGB (0.6%), PEPE (0.6%), RLUSD (0.6%), NEAR (0.6%), HTX (0.6%), ETC (0.6%), ICP (0.6%), ONDO (0.5%), POL (0.5%), WLD (0.5%), PUMP (0.5%), MORPHO (0.5%), QNT (0.5%), ATOM (0.5%), ENA (0.4%), NEXO (0.4%), KAS (0.4%), ALGO (0.4%), TRUMP (0.4%), FIL (0.4%), APT (0.4%), RENDER (0.4%), XDC (0.4%), VET (0.4%), STABLE (0.4%), ARB (0.4%), JUP (0.3%), GHO (0.3%), BONK (0.3%), TUSD (0.3%), KITE (0.3%), STX (0.3%), SEI (0.3%), VIRTUAL (0.3%), CAKE (0.3%), JST (0.3%), PENGU (0.3%), XTZ (0.3%), POWER (0.3%), ETHFI (0.3%), CRV (0.3%), CHZ (0.3%), ZRO (0.3%), FET (0.3%), LIT (0.3%), BTT (0.3%), GNO (0.3%), NFT (0.3%), IP (0.3%), KAIA (0.3%), BSV (0.3%), AERO (0.3%), INJ (0.3%), SUN (0.3%), TIA (0.3%), GRT (0.2%), FRAX (0.2%), PYTH (0.2%), JASMY (0.2%), FLOKI (0.2%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +181.6% |
| 2022 | -76.1% |
| 2023 | +87.6% |
| 2024 | +62.5% |
| 2025 | -35.8% |
| 2026 | -23.1% |


### 47. Broad 100 Capped Quarterly (B100CQ)
**Thesis:** Broadest capped index. 100 tokens with 10% cap quarterly. Maximum diversification, no single-token dominance.
**Config:** `all` | top `100` | `mcap_cap10` | rebalance `90d`

**Why This Index?**
1. Maximum diversification with no single-token dominance. 100 tokens capped at 10% each, rebalanced quarterly. 0.786 Sharpe and +548.6% total return.
2. The 10% cap forces diversification beyond BTC/ETH. Five tokens hit the cap (USDC, XRP, BNB, ETH, BTC), with the remaining 95 sized by market cap. True broad market exposure.
3. On-chain settlement through BLS-verified consensus. A quarterly-rebalanced, 100-token capped index settled on L3.

**Investment Objective**
The Broad 100 Capped Quarterly index holds 100 tokens with market-cap weighting capped at 10% per token, rebalanced quarterly. The cap prevents concentration while quarterly rebalancing minimizes turnover, producing broad crypto market exposure with controlled risk.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.786 |
| Total Return | +548.6% |
| Annualized Return | +35.3% |
| Max Drawdown | -82.3% |
| Volatility (ann.) | 75.9% |
| Sortino Ratio | 0.665 |
| Calmar Ratio | 0.429 |
| Win Rate (monthly) | 51.4% |
| Best Month | +84.5% |
| Worst Month | -36.3% |
| Longest Drawdown | 1765 days |
| Time Underwater | 97.6% |
| Total Trades | 465 |
| Rebalances | 26 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
USDC (10.0%), XRP (10.0%), BNB (10.0%), ETH (10.0%), BTC (10.0%), SOL (8.4%), TRX (4.8%), STETH (3.2%), DOGE (2.8%), ADA (1.8%), USDS (1.8%), BCH (1.6%), WBTC (1.4%), HYPE (1.3%), LINK (1.1%), USDE (1.1%), WEETH (1.0%), XLM (0.9%), USD1 (0.8%), HBAR (0.8%), PYUSD (0.8%), DAI (0.7%), LTC (0.7%), AVAX (0.7%), ZEC (0.6%), SUI (0.6%), SHIB (0.6%), TON (0.6%), CRO (0.6%), WLFI (0.5%), XAUT (0.5%), DOT (0.5%), PAXG (0.5%), M (0.5%), UNI (0.4%), ASTER (0.3%), TAO (0.3%), AAVE (0.3%), PI (0.3%), SKY (0.3%), BGB (0.3%), PEPE (0.3%), RLUSD (0.3%), NEAR (0.3%), HTX (0.3%), ETC (0.2%), ICP (0.2%), ONDO (0.2%), POL (0.2%), WLD (0.2%), PUMP (0.2%), MORPHO (0.2%), QNT (0.2%), ATOM (0.2%), ENA (0.1%), NEXO (0.1%), KAS (0.1%), ALGO (0.1%), TRUMP (0.1%), FIL (0.1%), APT (0.1%), RENDER (0.1%), XDC (0.1%), VET (0.1%), STABLE (0.1%), ARB (0.1%), JUP (0.1%), GHO (0.1%), BONK (0.1%), TUSD (0.1%), KITE (0.1%), STX (0.1%), SEI (0.1%), VIRTUAL (0.1%), CAKE (0.1%), JST (0.1%), PENGU (0.1%), XTZ (0.1%), POWER (0.1%), ETHFI (0.1%), CRV (0.1%), CHZ (0.1%), ZRO (0.1%), FET (0.1%), LIT (0.1%), BTT (0.1%), GNO (0.1%), NFT (0.1%), IP (0.1%), KAIA (0.1%), BSV (0.1%), AERO (0.1%), INJ (0.1%), SUN (0.1%), TIA (0.1%), GRT (0.1%), FRAX (0.1%), PYTH (0.1%), JASMY (0.1%), FLOKI (0.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +357.9% |
| 2022 | -69.7% |
| 2023 | +108.0% |
| 2024 | +80.0% |
| 2025 | -26.9% |
| 2026 | -22.5% |


### 48. All 50 Dual Mom + FNG Trigger + BTC Dom (MEGAMOM)
**Thesis:** The mega-momentum system: 50 tokens, dual momentum, FNG trigger, BTC dominance. Broadest systematic trend-following.
**Config:** `all` | top `50` | `dual_mom_60` | rebalance `7d`
**Overlays:** fng_mode=trigger, dominance_mode=btc

**Why This Index?**
1. The mega-system: 50 tokens, dual 60-day momentum, FNG trigger, and BTC dominance switching. The broadest systematic trend-following strategy in the catalog.
2. Three overlays working together: momentum selects trends, FNG exits during panic, dominance switching rotates between BTC-heavy and alt-heavy regimes.
3. BLS-verified on-chain settlement. Four systematic signals in one index, with no human discretion in any step.

**Investment Objective**
The MEGAMOM index applies 60-day dual momentum to 50 tokens with FNG trigger and BTC dominance switching, rebalanced weekly. It is the broadest and most heavily overlaid momentum strategy, combining trend selection with regime and sentiment awareness across the entire crypto market.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.262 |
| Total Return | -88.3% |
| Annualized Return | -2936.5% |
| Max Drawdown | -99.3% |
| Volatility (ann.) | 111.1% |
| Sortino Ratio | -0.388 |
| Calmar Ratio | -0.296 |
| Win Rate (monthly) | 41.9% |
| Best Month | +95.8% |
| Worst Month | -84.1% |
| Longest Drawdown | 1417 days |
| Time Underwater | 96.3% |
| Total Trades | 2142 |
| Rebalances | 106 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
RIVER (94.8%), SKY (2.1%), PAXG (1.2%), XAUT (1.2%), TRX (0.4%), BCH (0.3%), HTX (0.1%), PEPE (0.0%), WLFI (0.0%), DAI (0.0%), USD1 (0.0%), PYUSD (0.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +345.4% |
| 2022 | -77.5% |
| 2023 | +96.4% |
| 2024 | -51.4% |
| 2025 | -92.2% |
| 2026 | -40.5% |


---

## 11. The Founder Thesis

Invest based on who built the protocol. Our research across 4,675 crypto founders and 2,741 projects revealed that founder demographics — age, nationality, education, gender — are statistically significant predictors of token performance. The 25-29 age bracket returns 3.4x to ATH. Mixed-gender teams outperform at 5.3x. Age spreads of 10-19 years within founding teams produce 5.9x. The market mimetically chases the 30-34 Stanford dropout. The alpha is everywhere else.

### 49. Young Founders Under 30 Momentum (YF30M)
**Thesis:** Young founders + momentum weighting. Ride the winners among the impatient market's discards.
**Config:** `founders-under-30` | top `9` | `momentum_30` | rebalance `14d`

**Why This Index?**
1. The 25-29 age bracket returns 3.4x to ATH. Young founders build with urgency that the market discounts as inexperience. Momentum weighting captures which of them are winning now.
2. 9 tokens from under-30 founders with 30-day momentum, rebalanced biweekly. MORPHO (59.1%) and TAO (9.4%) currently lead. The young builders doing AI and DeFi infrastructure.
3. On-chain settlement with BLS-verified consensus. Founder demographic alpha captured through systematic, transparent selection.

**Investment Objective**
The Young Founders Under 30 Momentum index applies 30-day momentum to 9 tokens from founders aged under 30 at founding, rebalanced biweekly. It captures the 25-29 age bracket's 3.4x ATH multiplier by systematically riding the winners among young builder projects.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.316 |
| Total Return | -80.7% |
| Annualized Return | -2925.4% |
| Max Drawdown | -97.5% |
| Volatility (ann.) | 126.2% |
| Sortino Ratio | -0.385 |
| Calmar Ratio | -0.300 |
| Win Rate (monthly) | 36.8% |
| Best Month | +238.3% |
| Worst Month | -44.0% |
| Longest Drawdown | 1561 days |
| Time Underwater | 99.3% |
| Total Trades | 489 |
| Rebalances | 124 |
| Period | 2021-06-08 → 2026-03-08 |

**Current Holdings:**
MORPHO (59.1%), TAO (9.4%), IO (8.1%), KSM (7.7%), MASK (5.3%), TIA (5.1%), BLUR (2.5%), SEI (2.0%), AEVO (0.8%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -80.7% |
| 2023 | +206.7% |
| 2024 | -63.3% |
| 2025 | -73.0% |
| 2026 | -13.2% |


### 50. Peak Builders 30-34 (PB34)
**Thesis:** The consensus sweet spot. 30-34 is fastest to ATH (102 days, 2.8x). Everybody knows this — which is both its strength and its trap.
**Config:** `founders-30-34` | top `13` | `equal` | rebalance `30d`

**Why This Index?**
1. The consensus sweet spot. 30-34 founders reach ATH fastest (102 days, 2.8x). This is the bracket the market already trusts, which is both its strength and its limitation.
2. Equal weighting across 13 tokens from 30-34 founders: ETH, TRX, TAO, DYDX, AXS. The index that holds what crypto considers peak-builder vintage.
3. BLS-verified on-chain settlement. The demographic thesis the market already prices in, held transparently on-chain.

**Investment Objective**
The Peak Builders 30-34 index equally weights 13 tokens from founders aged 30-34 at founding, rebalanced monthly. It captures the age bracket with the fastest time-to-ATH (102 days), reflecting the market's consensus view of peak builder productivity.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.636 |
| Total Return | +168.9% |
| Annualized Return | +17.4% |
| Max Drawdown | -91.0% |
| Volatility (ann.) | 89.6% |
| Sortino Ratio | 0.275 |
| Calmar Ratio | 0.190 |
| Win Rate (monthly) | 45.9% |
| Best Month | +124.6% |
| Worst Month | -37.4% |
| Longest Drawdown | 1765 days |
| Time Underwater | 96.9% |
| Total Trades | 627 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
ANKR (7.7%), AR (7.7%), AXS (7.7%), BAND (7.7%), TAO (7.7%), MANA (7.7%), DYDX (7.7%), ETH (7.7%), ETC (7.7%), KSM (7.7%), SUSHI (7.7%), TRX (7.7%), W (7.7%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +613.8% |
| 2022 | -80.2% |
| 2023 | +96.2% |
| 2024 | +44.0% |
| 2025 | -64.8% |
| 2026 | -23.0% |


### 51. Peak Builders 30-34 Mcap (PB34M)
**Thesis:** Market-cap weighted 30-34 bracket. The market's favorite age — weighted by what the market already values most.
**Config:** `founders-30-34` | top `13` | `mcap` | rebalance `30d`

**Why This Index?**
1. Market-cap weighted 30-34 bracket. 0.883 Sharpe and +959.9% total return. ETH at 84.8% dominates because Vitalik was 20 when he wrote the whitepaper but 30 when DeFi summer hit.
2. Cap-weighted expression means ETH is the primary holding. The 12 other tokens provide tail exposure to the rest of the 30-34 cohort.
3. On-chain settlement through BLS-verified consensus. The market's favorite founder age bracket, weighted by what the market already values most.

**Investment Objective**
The Peak Builders 30-34 Mcap index weights 13 tokens from 30-34 founders by market cap, rebalanced monthly. ETH dominates at 84.8%, making this effectively an ETH-plus index with diversified exposure to the 30-34 age cohort.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.883 |
| Total Return | +959.9% |
| Annualized Return | +46.5% |
| Max Drawdown | -80.4% |
| Volatility (ann.) | 81.2% |
| Sortino Ratio | 0.834 |
| Calmar Ratio | 0.578 |
| Win Rate (monthly) | 54.1% |
| Best Month | +61.9% |
| Worst Month | -42.0% |
| Longest Drawdown | 1760 days |
| Time Underwater | 95.8% |
| Total Trades | 304 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
ETH (84.8%), TRX (9.6%), TAO (0.6%), BAND (0.5%), MANA (0.5%), DYDX (0.5%), KSM (0.5%), SUSHI (0.5%), W (0.5%), AR (0.5%), AXS (0.5%), ANKR (0.5%), ETC (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +317.0% |
| 2022 | -68.3% |
| 2023 | +78.2% |
| 2024 | +51.9% |
| 2025 | -12.1% |
| 2026 | -31.6% |


### 52. Experienced Founders 35-39 (EF39)
**Thesis:** The balance point: enough cycles to have scars, enough hunger to still ship. 35-39 founders have seen one crash and built through it.
**Config:** `founders-35-39` | top `20` | `equal` | rebalance `30d`

**Why This Index?**
1. 35-39 founders have survived at least one crash and built through it. 20 tokens from the experience bracket where scar tissue meets remaining ambition.
2. Equal weighting across 20 tokens including BCH, SUI, FIL, APT, and FLOW. The broadest founder-age basket, diversified across chains and categories.
3. BLS-verified on-chain settlement. Experience-weighted crypto exposure, held on-chain with transparent selection criteria.

**Investment Objective**
The Experienced Founders 35-39 index equally weights 20 tokens from founders aged 35-39 at founding, rebalanced monthly. It captures the balance point where builders have enough cycle experience to navigate bear markets and enough drive to keep shipping.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.434 |
| Total Return | -23.4% |
| Annualized Return | -421.3% |
| Max Drawdown | -95.4% |
| Volatility (ann.) | 94.5% |
| Sortino Ratio | -0.064 |
| Calmar Ratio | -0.044 |
| Win Rate (monthly) | 47.3% |
| Best Month | +138.7% |
| Worst Month | -40.4% |
| Longest Drawdown | 1765 days |
| Time Underwater | 98.3% |
| Total Trades | 484 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
1INCH (5.0%), APT (5.0%), AXS (5.0%), BAND (5.0%), BCH (5.0%), TAO (5.0%), TIA (5.0%), COMP (5.0%), CFX (5.0%), MANA (5.0%), ETC (5.0%), FIL (5.0%), FLOW (5.0%), KAVA (5.0%), ZRO (5.0%), CKB (5.0%), XLM (5.0%), SUI (5.0%), GRT (5.0%), W (5.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +379.1% |
| 2022 | -85.5% |
| 2023 | +130.0% |
| 2024 | +26.2% |
| 2025 | -62.6% |
| 2026 | -22.4% |


### 53. Veteran Founders 40-44 (VF44)
**Thesis:** Second-act founders. The 40-44 bracket includes people who left TradFi, sold a startup, or had a career before crypto found them.
**Config:** `founders-40-44` | top `8` | `equal` | rebalance `30d`

**Why This Index?**
1. Second-act founders. The 40-44 bracket includes people who left TradFi, sold a startup, or had a career before crypto. ADA, DOGE, SUI, COMP in one basket.
2. Equal weighting across 8 tokens ensures no single second-act founder dominates. The range spans smart contracts (ADA), meme culture (DOGE), and DeFi (COMP).
3. On-chain settlement with BLS-verified consensus. Late-career founder conviction, held transparently on L3.

**Investment Objective**
The Veteran Founders 40-44 index equally weights 8 tokens from founders aged 40-44 at founding, rebalanced monthly. It captures the second-act founders who entered crypto with prior career experience in finance, technology, or entrepreneurship.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.015 |
| Total Return | -85.4% |
| Annualized Return | -3255.0% |
| Max Drawdown | -91.7% |
| Volatility (ann.) | 89.5% |
| Sortino Ratio | -0.501 |
| Calmar Ratio | -0.355 |
| Win Rate (monthly) | 35.6% |
| Best Month | +86.6% |
| Worst Month | -41.6% |
| Longest Drawdown | 1760 days |
| Time Underwater | 99.4% |
| Total Trades | 95 |
| Rebalances | 60 |
| Period | 2021-04-21 → 2026-03-08 |

**Current Holdings:**
ANKR (12.5%), BAT (12.5%), ADA (12.5%), CELO (12.5%), COMP (12.5%), DOGE (12.5%), CKB (12.5%), SUI (12.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -85.1% |
| 2023 | +84.4% |
| 2024 | +118.5% |
| 2025 | -66.0% |
| 2026 | -38.9% |


### 54. Elder Statesmen 45+ (ES45)
**Thesis:** The 55+ bracket reaches ATH in 17 days — survivorship bias dressed as data. But 45+ founders build infrastructure that lasts, even if the returns have been priced before you arrive.
**Config:** `founders-45-plus` | top `19` | `equal` | rebalance `30d`

**Why This Index?**
1. 45+ founders build infrastructure that lasts. BTC (Satoshi), SOL (Anatoly was 44), ALGO (Turing Award winner). The protocols built by people who remember life before the internet.
2. Equal weighting across 19 tokens, +161.5% total return. The bracket includes BTC, SOL, TRX, ICP, and DOGE. Old founders build resilient protocols.
3. BLS-verified on-chain settlement. The longevity thesis applied to crypto founding teams, settled transparently.

**Investment Objective**
The Elder Statesmen 45+ index equally weights 19 tokens from founders aged 45 or older at founding, rebalanced monthly. It holds the protocols built by veteran technologists, producing surprisingly strong returns from a bracket the market underestimates.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.613 |
| Total Return | +161.5% |
| Annualized Return | +16.8% |
| Max Drawdown | -89.0% |
| Volatility (ann.) | 84.4% |
| Sortino Ratio | 0.284 |
| Calmar Ratio | 0.189 |
| Win Rate (monthly) | 40.5% |
| Best Month | +93.2% |
| Worst Month | -33.9% |
| Longest Drawdown | 1765 days |
| Time Underwater | 97.3% |
| Total Trades | 685 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
ALGO (5.3%), APT (5.3%), BAT (5.3%), BTC (5.3%), CELO (5.3%), CFX (5.3%), DOGE (5.3%), ETC (5.3%), GALA (5.3%), ILV (5.3%), ICP (5.3%), IO (5.3%), KSM (5.3%), CKB (5.3%), RENDER (5.3%), SOL (5.3%), XLM (5.3%), SUI (5.3%), TRX (5.3%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +673.9% |
| 2022 | -84.2% |
| 2023 | +101.8% |
| 2024 | +63.5% |
| 2025 | -55.3% |
| 2026 | -30.4% |


### 55. Elder Statesmen 45+ Mcap (ES45M)
**Thesis:** Market-cap weighted elders. BTC, SOL, ALGO, ICP — the protocols built by people who remember life before the internet.
**Config:** `founders-45-plus` | top `19` | `mcap` | rebalance `30d`

**Why This Index?**
1. Market-cap weighted elders. 0.827 Sharpe and +615.7% total return. BTC at 86.7% because the oldest founder built the biggest protocol.
2. Cap weighting makes this effectively a BTC index with SOL (3.1%), TRX (1.7%), and DOGE (1.0%) as secondary holdings. The 45+ bracket has produced the market's most valuable assets.
3. On-chain settlement through BLS-verified consensus. The elder founder premium expressed through market valuation.

**Investment Objective**
The Elder Statesmen 45+ Mcap index weights 19 tokens from 45+ founders by market cap, rebalanced monthly. BTC dominates at 86.7%, making this a BTC-plus index that adds exposure to other elder-founded protocols like SOL and TRX.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.827 |
| Total Return | +615.7% |
| Annualized Return | +37.5% |
| Max Drawdown | -79.1% |
| Volatility (ann.) | 62.3% |
| Sortino Ratio | 0.874 |
| Calmar Ratio | 0.473 |
| Win Rate (monthly) | 56.8% |
| Best Month | +55.7% |
| Worst Month | -39.4% |
| Longest Drawdown | 1095 days |
| Time Underwater | 95.2% |
| Total Trades | 190 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
BTC (86.7%), SOL (3.1%), TRX (1.7%), DOGE (1.0%), CFX (0.5%), ETC (0.5%), GALA (0.5%), ALGO (0.5%), ICP (0.5%), IO (0.5%), KSM (0.5%), CKB (0.5%), RENDER (0.5%), XLM (0.5%), SUI (0.5%), ILV (0.5%), APT (0.5%), BAT (0.5%), CELO (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +85.0% |
| 2022 | -67.5% |
| 2023 | +143.7% |
| 2024 | +122.9% |
| 2025 | -8.5% |
| 2026 | -25.4% |


### 56. American Founders Mcap (USAM)
**Thesis:** Market-cap weighted American-founded protocols. The blue chips of Silicon Valley crypto.
**Config:** `founders-american` | top `22` | `mcap` | rebalance `30d`

**Why This Index?**
1. Silicon Valley crypto. TRX (45.0%), DOGE (26.4%), XLM (8.6%) lead the American-founded basket. +166.8% total return from 22 tokens.
2. Market-cap weighting concentrates in the largest American-founded protocols. The thesis is straightforward: US market access, US regulatory arbitrage, US technical talent.
3. BLS-verified on-chain settlement. American founder exposure held transparently on-chain.

**Investment Objective**
The American Founders Mcap index weights 22 tokens from American founders by market cap, rebalanced monthly. It captures the Silicon Valley crypto corridor, concentrating in protocols with US market access and regulatory familiarity.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.608 |
| Total Return | +166.8% |
| Annualized Return | +17.2% |
| Max Drawdown | -91.5% |
| Volatility (ann.) | 80.8% |
| Sortino Ratio | 0.306 |
| Calmar Ratio | 0.188 |
| Win Rate (monthly) | 40.5% |
| Best Month | +121.6% |
| Worst Month | -34.8% |
| Longest Drawdown | 1765 days |
| Time Underwater | 97.9% |
| Total Trades | 245 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
TRX (45.0%), DOGE (26.4%), XLM (8.6%), SUI (5.8%), TAO (2.9%), ETC (2.2%), APT (1.2%), SEI (0.8%), ZRO (0.6%), KAVA (0.5%), KSM (0.5%), SUSHI (0.5%), GRT (0.5%), W (0.5%), BAT (0.5%), BLUR (0.5%), TIA (0.5%), CELO (0.5%), COMP (0.5%), DYDX (0.5%), GALA (0.5%), IO (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +270.3% |
| 2022 | -72.3% |
| 2023 | +58.9% |
| 2024 | +91.8% |
| 2025 | -34.0% |
| 2026 | -15.1% |


### 57. Asian Founders Index (ASIF)
**Thesis:** Chinese founders return 3.0x at TGE-to-ATH. Asian founding teams bring different market access, different user bases, different regulatory arbitrage.
**Config:** `founders-asia` | top `11` | `equal` | rebalance `30d`

**Why This Index?**
1. Chinese founders return 3.0x at TGE-to-ATH with the fastest time to ATH (70 days). Asian founding teams bring different market access and regulatory arbitrage.
2. Equal weighting across 11 tokens including BCH, HBAR, SUI, CFX. Asian founders access the largest retail crypto markets in the world.
3. On-chain settlement with BLS-verified consensus. Geographic founder alpha from the fastest-moving crypto markets.

**Investment Objective**
The Asian Founders Index equally weights 11 tokens from Asian founders, rebalanced monthly. It captures the market access and speed advantages of Asian founding teams, who historically reach ATH faster than any other geographic cohort.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.358 |
| Total Return | -58.1% |
| Annualized Return | -1313.7% |
| Max Drawdown | -95.3% |
| Volatility (ann.) | 99.2% |
| Sortino Ratio | -0.191 |
| Calmar Ratio | -0.138 |
| Win Rate (monthly) | 44.6% |
| Best Month | +82.8% |
| Worst Month | -40.7% |
| Longest Drawdown | 1760 days |
| Time Underwater | 98.4% |
| Total Trades | 246 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
1INCH (9.1%), AEVO (9.1%), ANKR (9.1%), AXS (9.1%), BAND (9.1%), BCH (9.1%), CFX (9.1%), HBAR (9.1%), MASK (9.1%), CKB (9.1%), SUI (9.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +98.2% |
| 2022 | -80.9% |
| 2023 | +52.9% |
| 2024 | +37.0% |
| 2025 | -58.4% |
| 2026 | -17.9% |


### 58. European Founders Index (EURF)
**Thesis:** "Has EU" teams produce 3.7x with 188 median days. European founders are patient by necessity — regulation teaches you to build slowly, which in crypto means building well.
**Config:** `founders-europe` | top `17` | `equal` | rebalance `30d`

**Why This Index?**
1. European founders produce 3.7x with 188 median days to ATH. Regulation teaches patience, and in crypto patience means building well. 17 tokens, +20.1% total return.
2. Equal weighting across 17 tokens: ADA, ICP, HBAR, MORPHO, SUI, and more. European founders span L1s, DeFi, and infrastructure.
3. BLS-verified on-chain settlement. European founder patience as an investment thesis, verified on-chain.

**Investment Objective**
The European Founders Index equally weights 17 tokens from European founders, rebalanced monthly. It captures the regulatory patience advantage of European teams, who build more slowly but historically produce strong ATH multiples.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.488 |
| Total Return | +20.1% |
| Annualized Return | +301.3% |
| Max Drawdown | -91.9% |
| Volatility (ann.) | 89.1% |
| Sortino Ratio | 0.048 |
| Calmar Ratio | 0.033 |
| Win Rate (monthly) | 43.2% |
| Best Month | +89.4% |
| Worst Month | -47.2% |
| Longest Drawdown | 1765 days |
| Time Underwater | 98.0% |
| Total Trades | 486 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
ALGO (5.9%), AR (5.9%), AXS (5.9%), BCH (5.9%), ADA (5.9%), TIA (5.9%), CELO (5.9%), FLOW (5.9%), HBAR (5.9%), ICP (5.9%), KAVA (5.9%), KSM (5.9%), MORPHO (5.9%), SUI (5.9%), GRT (5.9%), SAND (5.9%), TRX (5.9%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +289.6% |
| 2022 | -85.2% |
| 2023 | +115.3% |
| 2024 | +77.5% |
| 2025 | -64.2% |
| 2026 | -13.8% |


### 59. British Founders (GBRF)
**Thesis:** AR, ICP, KAVA, KSM — the British founded protocols that are either deeply ambitious or deeply stubborn. Often both.
**Config:** `founders-british` | top `4` | `equal` | rebalance `30d`

**Why This Index?**
1. AR, ICP, KAVA, KSM. British-founded protocols that are deeply ambitious or deeply stubborn. Four tokens, equally weighted, no apologies.
2. The smallest national basket in the catalog. Concentrated in infrastructure projects (AR for storage, ICP for compute, KSM for parachains).
3. On-chain settlement with BLS-verified consensus. British engineering conviction in a 4-token basket.

**Investment Objective**
The British Founders index equally weights 4 tokens from British founders, rebalanced monthly. It is the most concentrated national founder basket, holding infrastructure projects built with the persistence that British engineering culture selects for.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.438 |
| Total Return | -98.7% |
| Annualized Return | -5964.0% |
| Max Drawdown | -98.8% |
| Volatility (ann.) | 97.8% |
| Sortino Ratio | -0.870 |
| Calmar Ratio | -0.604 |
| Win Rate (monthly) | 36.8% |
| Best Month | +61.2% |
| Worst Month | -43.7% |
| Longest Drawdown | 1737 days |
| Time Underwater | 100.0% |
| Total Trades | 13 |
| Rebalances | 58 |
| Period | 2021-06-05 → 2026-03-08 |

**Current Holdings:**
AR (25.0%), ICP (25.0%), KAVA (25.0%), KSM (25.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -84.1% |
| 2023 | +114.9% |
| 2024 | -15.9% |
| 2025 | -74.3% |
| 2026 | -29.4% |


### 60. Stanford Alumni Index (STAN)
**Thesis:** Stanford produces founders like a factory produces widgets — reliably, efficiently, and in quantities that suppress the price of any individual one.
**Config:** `founders-stanford` | top `6` | `equal` | rebalance `30d`

**Why This Index?**
1. Stanford produces founders like a factory produces widgets. The -98.5% total return proves the thesis: too many Stanford-pedigreed projects compete against each other.
2. 6 tokens equally weighted: BAND, TIA, CELO, FIL, IO, W. The Stanford pipeline floods crypto with capable but undifferentiated teams.
3. BLS-verified on-chain settlement. The data against credential premium, held transparently on L3.

**Investment Objective**
The Stanford Alumni Index equally weights 6 tokens from Stanford-affiliated founders, rebalanced monthly. It tests the Ivy League founder premium hypothesis and finds that oversupply of Stanford-pedigreed projects dilutes the edge.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.407 |
| Total Return | -98.5% |
| Annualized Return | -5833.0% |
| Max Drawdown | -99.0% |
| Volatility (ann.) | 97.8% |
| Sortino Ratio | -0.842 |
| Calmar Ratio | -0.589 |
| Win Rate (monthly) | 34.5% |
| Best Month | +105.1% |
| Worst Month | -48.8% |
| Longest Drawdown | 1643 days |
| Time Underwater | 99.7% |
| Total Trades | 62 |
| Rebalances | 59 |
| Period | 2021-05-27 → 2026-03-08 |

**Current Holdings:**
BAND (16.7%), TIA (16.7%), CELO (16.7%), FIL (16.7%), IO (16.7%), W (16.7%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -74.3% |
| 2023 | +53.8% |
| 2024 | -56.5% |
| 2025 | -82.9% |
| 2026 | -34.6% |


### 61. MIT Alumni Index (MITX)
**Thesis:** MIT founders tilt toward cryptography and formal methods. ALGO was built by a Turing Award winner. The institution selects for rigor.
**Config:** `founders-mit` | top `5` | `equal` | rebalance `30d`

**Why This Index?**
1. MIT founders tilt toward cryptography and formal methods. ALGO was built by a Turing Award winner. The institution selects for rigor, but rigor does not guarantee returns.
2. 5 tokens equally weighted: ALGO, BAND, BLUR, CELO, CFX. MIT alumni build technically sound infrastructure that the market has so far undervalued.
3. On-chain settlement with BLS-verified consensus. Cryptographic rigor as a founder signal, tracked on-chain.

**Investment Objective**
The MIT Alumni Index equally weights 5 tokens from MIT-affiliated founders, rebalanced monthly. It captures the intersection of cryptographic rigor and blockchain infrastructure, holding protocols built by founders with formal training in the mathematics underlying crypto.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.267 |
| Total Return | -97.8% |
| Annualized Return | -5500.9% |
| Max Drawdown | -98.7% |
| Volatility (ann.) | 103.7% |
| Sortino Ratio | -0.780 |
| Calmar Ratio | -0.557 |
| Win Rate (monthly) | 31.0% |
| Best Month | +129.5% |
| Worst Month | -46.0% |
| Longest Drawdown | 1649 days |
| Time Underwater | 99.8% |
| Total Trades | 50 |
| Rebalances | 59 |
| Period | 2021-05-27 → 2026-03-08 |

**Current Holdings:**
ALGO (20.0%), BAND (20.0%), BLUR (20.0%), CELO (20.0%), CFX (20.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -67.7% |
| 2023 | -23.8% |
| 2024 | -50.4% |
| 2025 | -72.3% |
| 2026 | -32.3% |


### 62. Harvard Alumni Index (HVRD)
**Thesis:** Harvard founders in crypto — fewer than you'd expect, and mostly in DeFi. COMP, RENDER, XLM.
**Config:** `founders-harvard` | top `3` | `equal` | rebalance `30d`

**Why This Index?**
1. Harvard founders in crypto are rarer than expected. COMP, RENDER, XLM. Three tokens, three DeFi and infrastructure protocols.
2. The smallest Ivy basket with a 0.001 Sharpe. Harvard founders tend toward finance and governance (COMP), not protocol infrastructure.
3. BLS-verified on-chain settlement. An honest test of whether Harvard's network effect extends to crypto.

**Investment Objective**
The Harvard Alumni Index equally weights 3 tokens from Harvard-affiliated founders, rebalanced monthly. It is the leanest university basket, testing whether Harvard's institutional prestige translates to crypto protocol value.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.001 |
| Total Return | -91.3% |
| Annualized Return | -3944.9% |
| Max Drawdown | -96.6% |
| Volatility (ann.) | 100.5% |
| Sortino Ratio | -0.575 |
| Calmar Ratio | -0.408 |
| Win Rate (monthly) | 40.7% |
| Best Month | +215.1% |
| Worst Month | -46.9% |
| Longest Drawdown | 1760 days |
| Time Underwater | 99.4% |
| Total Trades | 30 |
| Rebalances | 60 |
| Period | 2021-04-21 → 2026-03-08 |

**Current Holdings:**
COMP (33.3%), RENDER (33.3%), XLM (33.3%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -87.0% |
| 2023 | +54.5% |
| 2024 | +176.3% |
| 2025 | -60.7% |
| 2026 | -19.6% |


### 63. Ivy League Founders (IVYX)
**Thesis:** 11 tokens from Ivy League founders. Mixed Higher Ed teams return 2.1x — the Ivy premium in crypto is real but modest.
**Config:** `founders-ivy-league` | top `11` | `equal` | rebalance `30d`

**Why This Index?**
1. 11 tokens from Ivy League founders. Mixed Higher Ed teams return 2.1x. The Ivy premium in crypto is real but modest, enough to outperform random selection.
2. Equal weighting across 11 tokens: TRX, XLM, RENDER, COMP, DYDX, and others. The traditional prestige pipeline applied to crypto.
3. On-chain settlement through BLS-verified consensus. The Ivy premium tested empirically and settled transparently.

**Investment Objective**
The Ivy League Founders index equally weights 11 tokens from Ivy League-affiliated founders, rebalanced monthly. It captures the modest but real Ivy premium in crypto, where institutional networks and prestige provide a small systematic edge.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.328 |
| Total Return | -55.3% |
| Annualized Return | -1220.7% |
| Max Drawdown | -96.6% |
| Volatility (ann.) | 92.1% |
| Sortino Ratio | -0.187 |
| Calmar Ratio | -0.126 |
| Win Rate (monthly) | 41.9% |
| Best Month | +101.3% |
| Worst Month | -46.0% |
| Longest Drawdown | 1786 days |
| Time Underwater | 98.0% |
| Total Trades | 318 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
1INCH (9.1%), AEVO (9.1%), CELO (9.1%), COMP (9.1%), DYDX (9.1%), CKB (9.1%), RENDER (9.1%), XLM (9.1%), SUSHI (9.1%), TRX (9.1%), W (9.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +247.5% |
| 2022 | -79.9% |
| 2023 | +47.9% |
| 2024 | +4.3% |
| 2025 | -66.9% |
| 2026 | -30.6% |


### 64. Ivy League Mcap (IVYM)
**Thesis:** Mcap-weighted Ivy founders. The prestige premium expressed through token market value.
**Config:** `founders-ivy-league` | top `11` | `mcap` | rebalance `30d`

**Why This Index?**
1. Mcap-weighted Ivy founders. 0.738 Sharpe and +425.5% total return. TRX at 78.8% dominates because Justin Sun is the Ivy League's biggest crypto outlier.
2. Cap weighting makes this effectively a TRX index with XLM (15.1%) and RENDER (2.1%) as secondary holdings. The Ivy premium concentrates in a few winners.
3. BLS-verified on-chain settlement. The Ivy League's market-cap expression in crypto.

**Investment Objective**
The Ivy League Mcap index weights 11 tokens from Ivy League founders by market cap, rebalanced monthly. TRX dominates at 78.8%, revealing that the Ivy premium in crypto concentrates in a few outsized winners rather than distributing evenly.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.738 |
| Total Return | +425.5% |
| Annualized Return | +30.8% |
| Max Drawdown | -86.0% |
| Volatility (ann.) | 78.2% |
| Sortino Ratio | 0.581 |
| Calmar Ratio | 0.358 |
| Win Rate (monthly) | 52.7% |
| Best Month | +97.3% |
| Worst Month | -48.9% |
| Longest Drawdown | 1786 days |
| Time Underwater | 98.0% |
| Total Trades | 147 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
TRX (78.8%), XLM (15.1%), RENDER (2.1%), COMP (0.5%), CKB (0.5%), SUSHI (0.5%), 1INCH (0.5%), W (0.5%), AEVO (0.5%), CELO (0.5%), DYDX (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +161.0% |
| 2022 | -59.2% |
| 2023 | +48.8% |
| 2024 | +123.2% |
| 2025 | -11.8% |
| 2026 | -6.7% |


### 65. Top CS Schools Index (CSFI)
**Thesis:** Stanford, MIT, CMU, Berkeley, Caltech, Georgia Tech, Waterloo. The institutions that teach you to build systems that don't break. 16 tokens.
**Config:** `founders-top-cs` | top `16` | `equal` | rebalance `30d`

**Why This Index?**
1. Stanford, MIT, CMU, Berkeley, Caltech, Georgia Tech, Waterloo. 16 tokens from the institutions that teach systems engineering. +127.5% total return, 0.612 Sharpe.
2. Equal weighting across 16 tokens: ETH, ALGO, BERA, TAO, FIL, XLM. The broadest academic basket, spanning every chain category.
3. On-chain settlement with BLS-verified consensus. CS department alumni as a founder signal, with transparent selection and rebalancing.

**Investment Objective**
The Top CS Schools Index equally weights 16 tokens from founders affiliated with top computer science programs, rebalanced monthly. It captures the engineering rigor that elite CS education provides, applying it as a systematic founder quality signal.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.612 |
| Total Return | +127.5% |
| Annualized Return | +14.2% |
| Max Drawdown | -95.0% |
| Volatility (ann.) | 91.8% |
| Sortino Ratio | 0.221 |
| Calmar Ratio | 0.150 |
| Win Rate (monthly) | 45.9% |
| Best Month | +130.9% |
| Worst Month | -42.0% |
| Longest Drawdown | 1765 days |
| Time Underwater | 96.6% |
| Total Trades | 579 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
ALGO (6.2%), ANKR (6.2%), BAND (6.2%), BAT (6.2%), BERA (6.2%), TAO (6.2%), BLUR (6.2%), TIA (6.2%), CELO (6.2%), CFX (6.2%), ETH (6.2%), ETC (6.2%), FIL (6.2%), IO (6.2%), XLM (6.2%), W (6.2%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +547.1% |
| 2022 | -79.8% |
| 2023 | +109.0% |
| 2024 | +22.0% |
| 2025 | -63.3% |
| 2026 | -32.3% |


### 66. Top CS Momentum (CSMM)
**Thesis:** Momentum weighting across CS school alumni projects. Ride the technically sound winners.
**Config:** `founders-top-cs` | top `16` | `momentum_30` | rebalance `14d`

**Why This Index?**
1. Momentum weighting across CS school alumni projects. 0.904 Sharpe and +1136.6% total return. Ride the technically sound winners among the academic pipeline.
2. 30-day momentum across 16 CS-alumni tokens, rebalanced biweekly. BERA (10.8%) and ETC (9.5%) currently lead. The momentum filter finds which academic projects are winning now.
3. BLS-verified on-chain settlement. Technical founder quality combined with systematic trend-following.

**Investment Objective**
The Top CS Momentum index applies 30-day momentum to 16 tokens from top CS school founders, rebalanced biweekly. It combines the quality signal of elite CS education with momentum timing, riding the academically rigorous projects that are currently trending.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.904 |
| Total Return | +1136.6% |
| Annualized Return | +50.2% |
| Max Drawdown | -87.2% |
| Volatility (ann.) | 96.8% |
| Sortino Ratio | 0.781 |
| Calmar Ratio | 0.576 |
| Win Rate (monthly) | 47.3% |
| Best Month | +120.4% |
| Worst Month | -42.2% |
| Longest Drawdown | 1097 days |
| Time Underwater | 96.5% |
| Total Trades | 1414 |
| Rebalances | 161 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
BERA (10.8%), ETC (9.5%), BAND (8.7%), TAO (8.5%), IO (8.4%), ALGO (8.3%), XLM (8.2%), CFX (8.0%), FIL (6.7%), TIA (6.0%), ANKR (5.1%), ETH (3.7%), CELO (3.1%), W (2.6%), BAT (1.7%), BLUR (0.6%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +1121.1% |
| 2022 | -80.5% |
| 2023 | +141.5% |
| 2024 | +81.0% |
| 2025 | -52.0% |
| 2026 | -30.9% |


### 67. Waterloo-Toronto Corridor (WATO)
**Thesis:** Vitalik's alma mater axis. ETH, BERA, TAO, CELO, CFX — the Canadian corridor that punches above its weight.
**Config:** `founders-waterloo` | top `5` | `equal` | rebalance `30d`

**Why This Index?**
1. Vitalik's alma mater axis. ETH, BERA, TAO, CELO, CFX. 0.868 Sharpe and +894.1% total return. The Canadian corridor that produced Ethereum.
2. 5 tokens equally weighted from the Waterloo-Toronto research pipeline. The corridor produced the most valuable crypto asset (ETH) and keeps producing.
3. On-chain settlement through BLS-verified consensus. A geographic-academic thesis centered on the world's most productive crypto research corridor.

**Investment Objective**
The Waterloo-Toronto Corridor index equally weights 5 tokens from Waterloo and Toronto-affiliated founders, rebalanced monthly. It captures the research corridor that produced Ethereum and continues to generate high-impact blockchain projects.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.868 |
| Total Return | +894.1% |
| Annualized Return | +45.0% |
| Max Drawdown | -88.0% |
| Volatility (ann.) | 89.0% |
| Sortino Ratio | 0.740 |
| Calmar Ratio | 0.511 |
| Win Rate (monthly) | 51.4% |
| Best Month | +130.9% |
| Worst Month | -38.5% |
| Longest Drawdown | 1765 days |
| Time Underwater | 96.6% |
| Total Trades | 250 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
BAT (20.0%), BERA (20.0%), TAO (20.0%), ETH (20.0%), ETC (20.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +635.8% |
| 2022 | -73.3% |
| 2023 | +169.6% |
| 2024 | +57.1% |
| 2025 | -37.1% |
| 2026 | -30.9% |


### 68. Cornell Blockchain (CRNL)
**Thesis:** Cornell's IC3 lab shaped the theoretical foundations of DeFi. AEVO, TRX, W, XLM — the academic-industrial pipeline.
**Config:** `founders-cornell` | top `4` | `equal` | rebalance `30d`

**Why This Index?**
1. Cornell's IC3 lab shaped the theoretical foundations of DeFi. AEVO, TRX, W, XLM. 0.531 Sharpe and +74.1% total return from the academic-industrial pipeline.
2. 4 tokens equally weighted from Cornell-affiliated founders. The institution's blockchain research program translates directly into protocol design.
3. BLS-verified on-chain settlement. The IC3 lab's influence on crypto, tracked as an investable thesis.

**Investment Objective**
The Cornell Blockchain index equally weights 4 tokens from Cornell-affiliated founders, rebalanced monthly. It captures the academic-industrial pipeline from Cornell's IC3 lab, which shaped the theoretical foundations of DeFi and MEV research.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.531 |
| Total Return | +74.1% |
| Annualized Return | +938.1% |
| Max Drawdown | -87.1% |
| Volatility (ann.) | 84.2% |
| Sortino Ratio | 0.164 |
| Calmar Ratio | 0.108 |
| Win Rate (monthly) | 45.9% |
| Best Month | +143.9% |
| Worst Month | -50.8% |
| Longest Drawdown | 1786 days |
| Time Underwater | 98.0% |
| Total Trades | 136 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
AEVO (25.0%), XLM (25.0%), TRX (25.0%), W (25.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +193.7% |
| 2022 | -37.4% |
| 2023 | +49.9% |
| 2024 | +14.5% |
| 2025 | -57.7% |
| 2026 | -27.7% |


### 69. No-Degree Founders (DROP)
**Thesis:** "No Education" teams return 3.5x — the highest education bracket. Dropouts and autodidacts build with nothing to fall back on. That desperation is the alpha.
**Config:** `founders-no-degree` | top `35` | `equal` | rebalance `30d`

**Why This Index?**
1. No-degree teams return 3.5x to ATH, the highest education bracket. Dropouts and autodidacts build with nothing to fall back on. That desperation is the alpha.
2. 35 tokens equally weighted: BTC, ETH, DOGE, ADA, PEPE, MORPHO, and more. The broadest founder basket, because autodidacts build in every category.
3. On-chain settlement with BLS-verified consensus. The anti-credential thesis, held transparently. The data says dropouts outperform Ivy League by 1.4x.

**Investment Objective**
The No-Degree Founders index equally weights 35 tokens from founders without traditional degrees, rebalanced monthly. It captures the highest-returning education bracket in crypto, where the absence of institutional safety nets selects for builders who ship under pressure.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.610 |
| Total Return | +146.1% |
| Annualized Return | +15.7% |
| Max Drawdown | -89.1% |
| Volatility (ann.) | 85.7% |
| Sortino Ratio | 0.255 |
| Calmar Ratio | 0.176 |
| Win Rate (monthly) | 45.9% |
| Best Month | +88.2% |
| Worst Month | -36.0% |
| Longest Drawdown | 1765 days |
| Time Underwater | 96.9% |
| Total Trades | 1061 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
1INCH (2.9%), AEVO (2.9%), ANKR (2.9%), AXS (2.9%), BAND (2.9%), BAT (2.9%), BERA (2.9%), BTC (2.9%), BCH (2.9%), BSV (2.9%), BLUR (2.9%), BONK (2.9%), ADA (2.9%), COMP (2.9%), MANA (2.9%), DOGE (2.9%), ETH (2.9%), ETC (2.9%), FLOW (2.9%), HBAR (2.9%), ILV (2.9%), ICP (2.9%), IO (2.9%), KSM (2.9%), LTC (2.9%), MASK (2.9%), MORPHO (2.9%), CKB (2.9%), PEPE (2.9%), SEI (2.9%), SUSHI (2.9%), GRT (2.9%), SAND (2.9%), TRX (2.9%), W (2.9%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +413.8% |
| 2022 | -81.5% |
| 2023 | +151.0% |
| 2024 | +48.1% |
| 2025 | -63.7% |
| 2026 | -22.3% |


### 70. No-Degree Momentum (DRMO)
**Thesis:** Momentum among no-degree founders. The autodidacts who are winning right now.
**Config:** `founders-no-degree` | top `35` | `momentum_30` | rebalance `14d`

**Why This Index?**
1. Momentum among no-degree founders. 0.928 Sharpe and +1400.8% total return. The autodidacts who are winning right now, not just the ones who exist.
2. 30-day momentum across 35 no-degree tokens, rebalanced biweekly. MORPHO (9.4%), LTC (5.7%), DOGE (5.2%) currently lead. Momentum identifies which dropouts are shipping.
3. BLS-verified on-chain settlement. The anti-credential thesis with momentum timing, producing the strongest founder-themed returns.

**Investment Objective**
The No-Degree Momentum index applies 30-day momentum to 35 tokens from no-degree founders, rebalanced biweekly. It combines the structural alpha of the dropout bracket with systematic trend selection, identifying which autodidact-built projects the market is currently rewarding.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.928 |
| Total Return | +1400.8% |
| Annualized Return | +55.0% |
| Max Drawdown | -89.4% |
| Volatility (ann.) | 102.5% |
| Sortino Ratio | 0.841 |
| Calmar Ratio | 0.615 |
| Win Rate (monthly) | 47.3% |
| Best Month | +160.7% |
| Worst Month | -45.0% |
| Longest Drawdown | 821 days |
| Time Underwater | 95.3% |
| Total Trades | 3131 |
| Rebalances | 161 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
MORPHO (9.4%), LTC (5.7%), DOGE (5.2%), BCH (5.2%), TRX (5.0%), HBAR (4.6%), BSV (4.4%), PEPE (3.8%), BERA (3.3%), ADA (3.2%), ETC (3.1%), BTC (3.1%), BAND (2.9%), GRT (2.9%), IO (2.9%), COMP (2.7%), MASK (2.7%), KSM (2.7%), ANKR (2.4%), BONK (2.2%), AEVO (2.2%), SUSHI (2.1%), ETH (2.1%), SEI (2.0%), ILV (2.0%), 1INCH (1.9%), W (1.9%), CKB (1.9%), BAT (1.8%), BLUR (1.6%), ICP (1.5%), MANA (1.0%), SAND (0.3%), AXS (0.2%), FLOW (0.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +928.9% |
| 2022 | -81.6% |
| 2023 | +461.0% |
| 2024 | +58.4% |
| 2025 | -60.6% |
| 2026 | -15.9% |


### 71. No-Degree vs Ivy (NVIY)
**Thesis:** The anti-prestige trade. Equal weight no-degree founders — the data says they outperform Ivy League teams by 1.4x to ATH. Credentials are a liability when the market rewards heresy.
**Config:** `founders-no-degree` | top `20` | `equal` | rebalance `14d`

**Why This Index?**
1. The anti-prestige trade. No-degree founders outperform Ivy League teams by 1.4x to ATH. 0.757 Sharpe and +450.4% total return proves the gap is investable.
2. 20 no-degree tokens equally weighted, rebalanced biweekly. BTC, ETH, DOGE, ADA, HBAR, PEPE, MORPHO. The market rewards heresy over credentials.
3. On-chain settlement through BLS-verified consensus. A direct, investable bet that credentials are a liability in crypto.

**Investment Objective**
The No-Degree vs Ivy index equally weights 20 tokens from no-degree founders, rebalanced biweekly. It is the investable expression of the anti-prestige thesis, where the data shows dropout-founded projects outperform Ivy League ones by a factor of 1.4x to ATH.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.757 |
| Total Return | +450.4% |
| Annualized Return | +31.8% |
| Max Drawdown | -87.4% |
| Volatility (ann.) | 82.0% |
| Sortino Ratio | 0.543 |
| Calmar Ratio | 0.363 |
| Win Rate (monthly) | 50.0% |
| Best Month | +79.7% |
| Worst Month | -36.2% |
| Longest Drawdown | 1559 days |
| Time Underwater | 96.4% |
| Total Trades | 1891 |
| Rebalances | 161 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
AXS (5.0%), BAT (5.0%), BTC (5.0%), BCH (5.0%), BSV (5.0%), BONK (5.0%), ADA (5.0%), MANA (5.0%), DOGE (5.0%), ETH (5.0%), ETC (5.0%), HBAR (5.0%), ICP (5.0%), LTC (5.0%), MORPHO (5.0%), PEPE (5.0%), SEI (5.0%), GRT (5.0%), SAND (5.0%), TRX (5.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +510.4% |
| 2022 | -82.3% |
| 2023 | +98.9% |
| 2024 | +129.4% |
| 2025 | -51.7% |
| 2026 | -13.6% |


### 72. German Engineering (DENG)
**Thesis:** Three tokens, three protocols built with Germanic precision. CELO, GRT, TIA — small basket, concentrated thesis.
**Config:** `founders-german` | top `3` | `equal` | rebalance `30d`

**Why This Index?**
1. Three tokens, three protocols built with Germanic precision. CELO, GRT, TIA. Small basket, concentrated thesis, deep technical ambition.
2. Equal weighting across 3 German-founded tokens. The basket spans payments (CELO), indexing (GRT), and modular data (TIA).
3. BLS-verified on-chain settlement. German engineering discipline applied to blockchain, tracked on-chain.

**Investment Objective**
The German Engineering index equally weights 3 tokens from German-affiliated founders, rebalanced monthly. It captures the engineering culture of precision and rigor applied to blockchain infrastructure across payments, data indexing, and modular architecture.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.177 |
| Total Return | -95.8% |
| Annualized Return | -4839.0% |
| Max Drawdown | -98.0% |
| Volatility (ann.) | 98.5% |
| Sortino Ratio | -0.699 |
| Calmar Ratio | -0.494 |
| Win Rate (monthly) | 29.3% |
| Best Month | +107.1% |
| Worst Month | -46.7% |
| Longest Drawdown | 1578 days |
| Time Underwater | 99.5% |
| Total Trades | 62 |
| Rebalances | 59 |
| Period | 2021-05-29 → 2026-03-08 |

**Current Holdings:**
TIA (33.3%), CELO (33.3%), GRT (33.3%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -89.3% |
| 2023 | +141.2% |
| 2024 | -6.7% |
| 2025 | -80.0% |
| 2026 | -35.6% |


### 73. Chinese Founders Index (CNFI)
**Thesis:** Chinese founders return 3.0x with fastest time to ATH (70 days). The efficiency of a market that doesn't wait.
**Config:** `founders-chinese` | top `5` | `equal` | rebalance `30d`

**Why This Index?**
1. Chinese founders return 3.0x with fastest time to ATH (70 days). The efficiency of a market that does not wait. 5 tokens, 0.480 Sharpe.
2. Equal weighting across ANKR, BCH, CFX, MASK, CKB. Chinese founding teams build infrastructure for the world's most active crypto retail market.
3. On-chain settlement with BLS-verified consensus. Geographic alpha from the most efficient crypto market, held transparently.

**Investment Objective**
The Chinese Founders Index equally weights 5 tokens from Chinese founders, rebalanced monthly. It captures the speed and efficiency of Chinese founding teams, who historically reach ATH in 70 days, faster than any other nationality.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.480 |
| Total Return | -18.5% |
| Annualized Return | -325.8% |
| Max Drawdown | -93.6% |
| Volatility (ann.) | 102.7% |
| Sortino Ratio | -0.047 |
| Calmar Ratio | -0.035 |
| Win Rate (monthly) | 43.2% |
| Best Month | +82.8% |
| Worst Month | -45.6% |
| Longest Drawdown | 1760 days |
| Time Underwater | 98.4% |
| Total Trades | 206 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
ANKR (20.0%), BCH (20.0%), CFX (20.0%), MASK (20.0%), CKB (20.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +100.8% |
| 2022 | -78.0% |
| 2023 | +101.9% |
| 2024 | +45.3% |
| 2025 | -42.0% |
| 2026 | -29.9% |


### 74. Berkeley Alumni (BERK)
**Thesis:** Berkeley's crypto researchers — ALGO, ANKR, XLM. The public university that rivals any Ivy for on-chain impact.
**Config:** `founders-berkeley` | top `3` | `equal` | rebalance `30d`

**Why This Index?**
1. Berkeley's crypto researchers: ALGO, ANKR, XLM. The public university that rivals any Ivy for on-chain impact. Three tokens, three infrastructure plays.
2. Equal weighting across 3 Berkeley-affiliated tokens. The basket spans consensus (ALGO), staking infrastructure (ANKR), and payments (XLM).
3. BLS-verified on-chain settlement. Public university research impact on crypto, tracked as an investable thesis.

**Investment Objective**
The Berkeley Alumni index equally weights 3 tokens from UC Berkeley-affiliated founders, rebalanced monthly. It captures the public university's outsized influence on crypto infrastructure, from Silvio Micali's consensus research to staking and payments protocols.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.084 |
| Total Return | -92.0% |
| Annualized Return | -4109.9% |
| Max Drawdown | -93.5% |
| Volatility (ann.) | 96.4% |
| Sortino Ratio | -0.654 |
| Calmar Ratio | -0.440 |
| Win Rate (monthly) | 36.8% |
| Best Month | +296.9% |
| Worst Month | -42.2% |
| Longest Drawdown | 1561 days |
| Time Underwater | 99.9% |
| Total Trades | 27 |
| Rebalances | 58 |
| Period | 2021-06-03 → 2026-03-08 |

**Current Holdings:**
ALGO (33.3%), ANKR (33.3%), XLM (33.3%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -85.2% |
| 2023 | +51.4% |
| 2024 | +117.0% |
| 2025 | -64.9% |
| 2026 | -34.4% |


### 75. Australian Founders (OZFI)
**Thesis:** BSV, DOGE, ILV — the Australian contribution to crypto is eclectic, controversial, and entertaining. Like the country itself.
**Config:** `founders-australian` | top `3` | `equal` | rebalance `30d`

**Why This Index?**
1. BSV, DOGE, ILV. The Australian contribution to crypto is eclectic, controversial, and entertaining. Three tokens from the southern hemisphere.
2. Equal weighting across 3 Australian-founded tokens. The basket spans Bitcoin forks (BSV), meme culture (DOGE), and gaming (ILV).
3. On-chain settlement with BLS-verified consensus. Australian founder conviction in a concentrated 3-token basket.

**Investment Objective**
The Australian Founders index equally weights 3 tokens from Australian founders, rebalanced monthly. It captures the eclectic range of Australian contributions to crypto, from Bitcoin forks to meme culture to blockchain gaming.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.566 |
| Total Return | -97.7% |
| Annualized Return | -6034.0% |
| Max Drawdown | -98.4% |
| Volatility (ann.) | 90.9% |
| Sortino Ratio | -0.960 |
| Calmar Ratio | -0.613 |
| Win Rate (monthly) | 32.7% |
| Best Month | +74.0% |
| Worst Month | -49.1% |
| Longest Drawdown | 1487 days |
| Time Underwater | 100.0% |
| Total Trades | 10 |
| Rebalances | 50 |
| Period | 2022-02-10 → 2026-03-08 |

**Current Holdings:**
BSV (33.3%), DOGE (33.3%), ILV (33.3%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2023 | +164.7% |
| 2024 | -39.1% |
| 2025 | -75.3% |
| 2026 | -1.1% |


### 76. Canadian Founders (CANF)
**Thesis:** BAT, BERA, TAO — Canadian founders who built in the cold and shipped globally.
**Config:** `founders-canadian` | top `3` | `equal` | rebalance `30d`

**Why This Index?**
1. BAT, BERA, TAO. Canadian founders who built in the cold and shipped globally. Three tokens spanning privacy (BAT), L1 infrastructure (BERA), and AI (TAO).
2. Equal weighting across 3 Canadian-founded tokens. Canada produces fewer crypto projects but the ones it produces are technically ambitious.
3. BLS-verified on-chain settlement. Canadian technical ambition expressed through a concentrated basket.

**Investment Objective**
The Canadian Founders index equally weights 3 tokens from Canadian founders, rebalanced monthly. It captures the Canadian corridor's technical ambition across privacy-first browsing, L1 consensus innovation, and decentralized AI.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.171 |
| Total Return | -79.3% |
| Annualized Return | -2787.7% |
| Max Drawdown | -89.9% |
| Volatility (ann.) | 100.5% |
| Sortino Ratio | -0.414 |
| Calmar Ratio | -0.310 |
| Win Rate (monthly) | 37.9% |
| Best Month | +121.5% |
| Worst Month | -34.7% |
| Longest Drawdown | 1560 days |
| Time Underwater | 99.7% |
| Total Trades | 82 |
| Rebalances | 59 |
| Period | 2021-05-14 → 2026-03-08 |

**Current Holdings:**
BAT (33.3%), BERA (33.3%), TAO (33.3%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -85.7% |
| 2023 | +268.6% |
| 2024 | +10.8% |
| 2025 | -60.2% |
| 2026 | -36.6% |


### 77. Age Spread 10-19 Years (AGSP)
**Thesis:** Teams with 10-19 year age spreads produce 5.9x ATH multiplier — the highest of any demographic signal. Intergenerational founding teams combine wisdom with ambition.
**Config:** `founders-35-39` | top `20` | `equal` | rebalance `30d`
**Overlays:** fng_mode=quality_rotation

**Why This Index?**
1. Teams with 10-19 year age spreads produce 5.9x ATH multiplier, the highest of any demographic signal in our research. Intergenerational teams combine wisdom with urgency.
2. The FNG quality rotation overlay shifts between equal weight and quality-tilted during fear. Current holdings BCH, ETC, XLM, TAO, SUI represent the intergenerational bracket.
3. On-chain settlement through BLS-verified consensus. The strongest demographic alpha signal, combined with sentiment-aware rotation.

**Investment Objective**
The Age Spread 10-19 Years index holds tokens from founding teams with 10-19 year age spreads, with FNG quality rotation overlay and monthly rebalancing. It captures the highest demographic signal in our research: intergenerational teams that combine veteran wisdom with youthful urgency.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.368 |
| Total Return | -46.6% |
| Annualized Return | -964.5% |
| Max Drawdown | -96.8% |
| Volatility (ann.) | 93.7% |
| Sortino Ratio | -0.146 |
| Calmar Ratio | -0.100 |
| Win Rate (monthly) | 44.6% |
| Best Month | +138.7% |
| Worst Month | -39.1% |
| Longest Drawdown | 1765 days |
| Time Underwater | 98.3% |
| Total Trades | 577 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
BCH (22.7%), ETC (22.2%), XLM (21.3%), TAO (17.9%), SUI (15.8%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +283.8% |
| 2022 | -86.8% |
| 2023 | +130.0% |
| 2024 | +21.5% |
| 2025 | -60.5% |
| 2026 | -31.9% |


### 78. No-Degree + FNG Quality (NDFQ)
**Thesis:** No-degree founders with FNG quality rotation. When fear strikes, the autodidacts — who built without safety nets — tend to keep building.
**Config:** `founders-no-degree` | top `35` | `equal` | rebalance `14d`
**Overlays:** fng_mode=quality_rotation

**Why This Index?**
1. No-degree founders with FNG quality rotation. 0.901 Sharpe and +1026.6% total return. When fear strikes, autodidacts keep building because they have no safety net to retreat to.
2. FNG quality rotation shifts to the highest-quality no-degree tokens during fear, concentrating in BTC, ETH, DOGE, BCH, TRX. The blue chips of the dropout bracket.
3. BLS-verified on-chain settlement. The anti-credential thesis with sentiment-aware quality rotation.

**Investment Objective**
The No-Degree + FNG Quality index holds 35 tokens from no-degree founders with Fear & Greed quality rotation, rebalanced biweekly. During fear, it concentrates in the highest-quality dropout-founded projects; during greed, it spreads across the full 35-token universe.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.901 |
| Total Return | +1026.6% |
| Annualized Return | +48.0% |
| Max Drawdown | -81.2% |
| Volatility (ann.) | 79.3% |
| Sortino Ratio | 0.850 |
| Calmar Ratio | 0.590 |
| Win Rate (monthly) | 51.4% |
| Best Month | +79.7% |
| Worst Month | -34.0% |
| Longest Drawdown | 830 days |
| Time Underwater | 94.9% |
| Total Trades | 2611 |
| Rebalances | 161 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
BTC (20.0%), BCH (20.0%), DOGE (20.0%), ETH (20.0%), TRX (20.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +642.5% |
| 2022 | -76.8% |
| 2023 | +203.5% |
| 2024 | +64.1% |
| 2025 | -53.6% |
| 2026 | -13.2% |


### 79. Serial Entrepreneurs Index (SERI)
**Thesis:** Founders who built and sold before. 33 tokens from repeat founders — they know when to ship, when to pivot, when to exit. Experience compounds.
**Config:** `founders-serial` | top `33` | `equal` | rebalance `30d`

**Why This Index?**
1. Founders who built and sold before. 33 tokens from repeat founders. 0.643 Sharpe and +180.3% total return. Experience compounds in crypto as everywhere else.
2. Equal weighting across 33 serial-founder tokens: ETH, SOL, DOGE, RENDER, MORPHO, and more. Serial founders build in every category.
3. On-chain settlement with BLS-verified consensus. The repeat-founder premium as an investable thesis, broad and transparent.

**Investment Objective**
The Serial Entrepreneurs Index equally weights 33 tokens from repeat founders, rebalanced monthly. It captures the experience premium of serial entrepreneurs who have built and exited before, applying that pattern recognition to blockchain projects.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.643 |
| Total Return | +180.3% |
| Annualized Return | +18.1% |
| Max Drawdown | -90.9% |
| Volatility (ann.) | 88.8% |
| Sortino Ratio | 0.286 |
| Calmar Ratio | 0.200 |
| Win Rate (monthly) | 44.6% |
| Best Month | +121.0% |
| Worst Month | -38.0% |
| Longest Drawdown | 1559 days |
| Time Underwater | 96.9% |
| Total Trades | 1111 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
1INCH (3.0%), ALGO (3.0%), ANKR (3.0%), AR (3.0%), AXS (3.0%), BAND (3.0%), BAT (3.0%), TAO (3.0%), BLUR (3.0%), TIA (3.0%), CELO (3.0%), COMP (3.0%), MANA (3.0%), DOGE (3.0%), DYDX (3.0%), ETH (3.0%), ETC (3.0%), FLOW (3.0%), GALA (3.0%), ILV (3.0%), ICP (3.0%), KAVA (3.0%), ZRO (3.0%), MORPHO (3.0%), CKB (3.0%), RENDER (3.0%), SOL (3.0%), XLM (3.0%), SUI (3.0%), SUSHI (3.0%), GRT (3.0%), SAND (3.0%), TRX (3.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +806.4% |
| 2022 | -85.3% |
| 2023 | +111.8% |
| 2024 | +43.8% |
| 2025 | -64.3% |
| 2026 | -22.1% |


### 80. Serial Entrepreneurs Momentum (SEMO)
**Thesis:** Momentum among serial founders. Ride the winners from people who've won before.
**Config:** `founders-serial` | top `33` | `momentum_30` | rebalance `14d`

**Why This Index?**
1. Momentum among serial founders. 0.946 Sharpe and +1433.6% total return, including +2298.1% in 2021. Ride the winners from people who have won before.
2. 30-day momentum across 33 serial-founder tokens, rebalanced biweekly. MORPHO (12.0%), DOGE (6.7%), TRX (6.4%) currently lead.
3. BLS-verified on-chain settlement. Serial-founder quality combined with momentum timing, producing the second-highest Sharpe in the founder catalog.

**Investment Objective**
The Serial Entrepreneurs Momentum index applies 30-day momentum to 33 tokens from serial founders, rebalanced biweekly. It combines the quality signal of repeat entrepreneurship with systematic trend selection, overweighting the serial builders whose projects the market is currently rewarding.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.946 |
| Total Return | +1433.6% |
| Annualized Return | +55.5% |
| Max Drawdown | -91.5% |
| Volatility (ann.) | 90.7% |
| Sortino Ratio | 0.899 |
| Calmar Ratio | 0.606 |
| Win Rate (monthly) | 51.4% |
| Best Month | +136.9% |
| Worst Month | -44.2% |
| Longest Drawdown | 1559 days |
| Time Underwater | 96.1% |
| Total Trades | 3050 |
| Rebalances | 161 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
MORPHO (12.0%), DOGE (6.7%), TRX (6.4%), ZRO (4.2%), ETC (3.9%), BAND (3.8%), TAO (3.7%), GRT (3.7%), ALGO (3.7%), XLM (3.6%), COMP (3.5%), RENDER (3.2%), TIA (3.2%), ANKR (3.0%), SUSHI (2.8%), ETH (2.7%), SOL (2.6%), CELO (2.6%), ILV (2.5%), 1INCH (2.5%), CKB (2.5%), KAVA (2.3%), BAT (2.3%), SUI (2.1%), BLUR (2.1%), ICP (1.9%), GALA (1.8%), MANA (1.3%), AR (1.2%), DYDX (1.2%), SAND (0.4%), AXS (0.2%), FLOW (0.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +2298.1% |
| 2022 | -85.4% |
| 2023 | +92.2% |
| 2024 | +122.2% |
| 2025 | -62.5% |
| 2026 | -10.2% |


### 81. Stealth Mcap (STLM)
**Thesis:** Stealth founders weighted by market cap. The protocols that grew without a founder doing a podcast tour.
**Config:** `founders-stealth` | top `36` | `mcap` | rebalance `30d`

**Why This Index?**
1. Stealth founders weighted by market cap. SOL (35.1%), TRX (20.0%), DOGE (11.8%). The protocols that grew without a founder podcast tour.
2. Cap weighting means the biggest stealth-founded protocols dominate. SOL (Anatoly was stealth early), DOGE (pseudonymous), TRX (minimal Western media presence).
3. On-chain settlement with BLS-verified consensus. The anti-visibility premium expressed through market valuation.

**Investment Objective**
The Stealth Mcap index weights 36 tokens from low-visibility founders by market cap, rebalanced monthly. It captures the information asymmetry advantage of protocols that grew without founder publicity, where market attention arrives after the product is built.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.534 |
| Total Return | +59.8% |
| Annualized Return | +788.1% |
| Max Drawdown | -93.8% |
| Volatility (ann.) | 87.8% |
| Sortino Ratio | 0.128 |
| Calmar Ratio | 0.084 |
| Win Rate (monthly) | 51.4% |
| Best Month | +88.3% |
| Worst Month | -46.1% |
| Longest Drawdown | 1765 days |
| Time Underwater | 98.4% |
| Total Trades | 179 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
SOL (35.1%), TRX (20.0%), DOGE (11.8%), BCH (6.7%), XLM (3.8%), HBAR (3.2%), SUI (2.6%), TAO (1.3%), PEPE (1.1%), ICP (1.0%), MORPHO (0.7%), ALGO (0.6%), FIL (0.6%), FLOW (0.5%), GALA (0.5%), KAVA (0.5%), KSM (0.5%), MASK (0.5%), CKB (0.5%), SUSHI (0.5%), GRT (0.5%), SAND (0.5%), 1INCH (0.5%), W (0.5%), AEVO (0.5%), ANKR (0.5%), AR (0.5%), AXS (0.5%), BAND (0.5%), BERA (0.5%), BLUR (0.5%), BONK (0.5%), CELO (0.5%), COMP (0.5%), CFX (0.5%), DYDX (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +201.8% |
| 2022 | -88.3% |
| 2023 | +165.3% |
| 2024 | +112.2% |
| 2025 | -33.2% |
| 2026 | -24.2% |


### 82. Stealth Momentum (STMO)
**Thesis:** Momentum among stealth founders. When a protocol from an invisible founder starts moving, the information asymmetry is maximum.
**Config:** `founders-stealth` | top `36` | `momentum_30` | rebalance `14d`

**Why This Index?**
1. Momentum among stealth founders. 0.882 Sharpe and +938.7% total return. When a protocol from an invisible founder starts moving, the information asymmetry is maximum.
2. 30-day momentum across 36 stealth-founder tokens, rebalanced biweekly. MORPHO (10.0%), DOGE (5.6%), BCH (5.5%) lead. Stealth plus momentum equals surprise.
3. BLS-verified on-chain settlement. Maximum information asymmetry, captured through transparent momentum mechanics.

**Investment Objective**
The Stealth Momentum index applies 30-day momentum to 36 tokens from low-visibility founders, rebalanced biweekly. It exploits the information asymmetry of stealth-built protocols by detecting when unknown projects start trending before the market pays attention.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.882 |
| Total Return | +938.7% |
| Annualized Return | +46.0% |
| Max Drawdown | -93.0% |
| Volatility (ann.) | 108.5% |
| Sortino Ratio | 0.661 |
| Calmar Ratio | 0.494 |
| Win Rate (monthly) | 44.6% |
| Best Month | +135.7% |
| Worst Month | -46.8% |
| Longest Drawdown | 830 days |
| Time Underwater | 96.7% |
| Total Trades | 2997 |
| Rebalances | 161 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
MORPHO (10.0%), DOGE (5.6%), BCH (5.5%), TRX (5.4%), HBAR (4.9%), PEPE (4.0%), BERA (3.5%), BAND (3.1%), TAO (3.1%), GRT (3.1%), ALGO (3.1%), XLM (3.0%), CFX (3.0%), COMP (2.9%), MASK (2.9%), KSM (2.8%), FIL (2.8%), ANKR (2.5%), BONK (2.4%), AEVO (2.4%), SUSHI (2.3%), SOL (2.2%), CELO (2.1%), 1INCH (2.1%), W (2.1%), CKB (2.0%), KAVA (1.9%), SUI (1.8%), BLUR (1.7%), ICP (1.6%), GALA (1.4%), AR (1.0%), DYDX (1.0%), SAND (0.3%), AXS (0.2%), FLOW (0.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +950.1% |
| 2022 | -86.4% |
| 2023 | +398.3% |
| 2024 | +110.8% |
| 2025 | -62.2% |
| 2026 | -14.1% |


### 83. High Visibility Founders (HIVI)
**Thesis:** Founders with 5+ podcast appearances. Vitalik, CZ, Hoskinson — the names that move markets by opening their mouths. 9 tokens.
**Config:** `founders-high-visibility` | top `9` | `equal` | rebalance `30d`

**Why This Index?**
1. Founders with 5+ podcast appearances. Vitalik, CZ, Hoskinson, the names that move markets. 0.669 Sharpe and +233.9% total return from 9 tokens.
2. Equal weighting across 9 high-visibility tokens: ETH, LTC, BCH, ICP, SUI, XLM. The protocols whose founders have earned market attention through sustained public presence.
3. BLS-verified on-chain settlement. Founder visibility as a proxy for community strength and narrative power.

**Investment Objective**
The High Visibility Founders index equally weights 9 tokens from founders with 5+ podcast appearances, rebalanced monthly. It captures the narrative amplification effect of high-profile founders, where public visibility sustains community engagement and market attention.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.669 |
| Total Return | +233.9% |
| Annualized Return | +21.5% |
| Max Drawdown | -94.1% |
| Volatility (ann.) | 87.9% |
| Sortino Ratio | 0.353 |
| Calmar Ratio | 0.229 |
| Win Rate (monthly) | 44.6% |
| Best Month | +118.9% |
| Worst Month | -39.3% |
| Longest Drawdown | 1765 days |
| Time Underwater | 97.4% |
| Total Trades | 381 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
BERA (11.1%), BCH (11.1%), ETH (11.1%), ETC (11.1%), ICP (11.1%), LTC (11.1%), XLM (11.1%), SUI (11.1%), GRT (11.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +222.9% |
| 2022 | -77.6% |
| 2023 | +113.2% |
| 2024 | +144.1% |
| 2025 | -48.7% |
| 2026 | -24.8% |


### 84. Ex-Google Founders (GOOG)
**Thesis:** Four tokens from ex-Googlers: CELO, LTC, TAO, TIA. The company that trains you to think in systems.
**Config:** `founders-ex-google` | top `4` | `equal` | rebalance `30d`

**Why This Index?**
1. Four tokens from ex-Googlers: CELO, LTC, TAO, TIA. Google trains you to think in systems at scale. That training transfers to blockchain infrastructure.
2. Equal weighting across 3 current holdings (TAO, TIA, CELO). The Google alumni build protocol-level infrastructure, not applications.
3. On-chain settlement with BLS-verified consensus. Big-tech engineering culture applied to decentralized systems.

**Investment Objective**
The Ex-Google Founders index equally weights tokens from founders who worked at Google, rebalanced monthly. It captures the systems-thinking discipline that Google engineering culture instills, applied to decentralized infrastructure and AI protocols.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.124 |
| Total Return | -95.2% |
| Annualized Return | -4770.0% |
| Max Drawdown | -98.2% |
| Volatility (ann.) | 103.2% |
| Sortino Ratio | -0.689 |
| Calmar Ratio | -0.485 |
| Win Rate (monthly) | 32.1% |
| Best Month | +166.2% |
| Worst Month | -47.0% |
| Longest Drawdown | 1624 days |
| Time Underwater | 99.4% |
| Total Trades | 50 |
| Rebalances | 57 |
| Period | 2021-07-06 → 2026-03-08 |

**Current Holdings:**
TAO (33.3%), TIA (33.3%), CELO (33.3%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -93.8% |
| 2023 | +328.0% |
| 2024 | -25.9% |
| 2025 | -78.5% |
| 2026 | -29.9% |


### 85. Ex-Meta Founders (META)
**Thesis:** APT, BCH, SEI, SUI — the Diem diaspora. They tried to build crypto inside Facebook. Now they build it outside.
**Config:** `founders-ex-facebook` | top `4` | `equal` | rebalance `30d`

**Why This Index?**
1. APT, BCH, SEI, SUI. The Diem diaspora. They tried to build crypto inside Facebook. Now they build it outside. 0.492 Sharpe and +4.2% total return.
2. Equal weighting across 4 ex-Meta tokens. The Move language ecosystem (APT, SUI) dominates because the Diem team carried their technology out the door.
3. BLS-verified on-chain settlement. The Diem diaspora's second act, tracked as an investable thesis.

**Investment Objective**
The Ex-Meta Founders index equally weights 4 tokens from founders who worked at Meta, rebalanced monthly. It captures the Diem diaspora: engineers who built Libra/Diem inside Facebook and now apply that experience to independent blockchain projects, particularly the Move ecosystem.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.492 |
| Total Return | +4.2% |
| Annualized Return | +66.5% |
| Max Drawdown | -96.0% |
| Volatility (ann.) | 97.4% |
| Sortino Ratio | 0.010 |
| Calmar Ratio | 0.007 |
| Win Rate (monthly) | 43.2% |
| Best Month | +162.2% |
| Worst Month | -44.6% |
| Longest Drawdown | 1760 days |
| Time Underwater | 98.4% |
| Total Trades | 147 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
APT (25.0%), BCH (25.0%), SEI (25.0%), SUI (25.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +20.0% |
| 2022 | -80.7% |
| 2023 | +227.9% |
| 2024 | +145.2% |
| 2025 | -43.4% |
| 2026 | -36.3% |


### 86. PhD Founders Index (PHDI)
**Thesis:** All PhD teams return 1.7x — the lowest education bracket. But PhDs build infrastructure that lasts decades. The market misprices durability.
**Config:** `founders-phd` | top `8` | `equal` | rebalance `30d`

**Why This Index?**
1. PhD teams return 1.7x, the lowest education bracket. But PhDs build infrastructure that lasts decades. 8 tokens from doctorate holders: ALGO, APT, AR, TAO, CELO, CFX, ICP, SUI.
2. Equal weighting across 8 PhD-founded tokens. The basket is heavy on L1 infrastructure because PhDs gravitate toward consensus and cryptography.
3. On-chain settlement with BLS-verified consensus. The durability thesis: what PhDs build may not pump fastest, but it tends to survive.

**Investment Objective**
The PhD Founders Index equally weights 8 tokens from PhD-holding founders, rebalanced monthly. It captures the durability premium of academically rigorous infrastructure, where protocols built by researchers with formal cryptographic training tend to survive longer even if they appreciate more slowly.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.121 |
| Total Return | -93.5% |
| Annualized Return | -4377.4% |
| Max Drawdown | -94.7% |
| Volatility (ann.) | 95.9% |
| Sortino Ratio | -0.651 |
| Calmar Ratio | -0.462 |
| Win Rate (monthly) | 33.3% |
| Best Month | +103.9% |
| Worst Month | -42.8% |
| Longest Drawdown | 1737 days |
| Time Underwater | 100.0% |
| Total Trades | 49 |
| Rebalances | 58 |
| Period | 2021-06-05 → 2026-03-08 |

**Current Holdings:**
ALGO (12.5%), APT (12.5%), AR (12.5%), TAO (12.5%), CELO (12.5%), CFX (12.5%), ICP (12.5%), SUI (12.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -86.9% |
| 2023 | +214.9% |
| 2024 | +60.1% |
| 2025 | -66.8% |
| 2026 | -32.7% |


### 87. MBA Mcap (MBAM)
**Thesis:** MBA founders weighted by market value. ADA, APT, SUI — the protocols built by people who can read a balance sheet.
**Config:** `founders-mba` | top `11` | `mcap` | rebalance `30d`

**Why This Index?**
1. MBA founders weighted by market cap. TRX (66.0%) and ADA (25.1%) dominate. 0.549 Sharpe and +97.6% total return. The protocols built by people who read balance sheets.
2. Cap weighting concentrates in TRX and ADA because MBA founders built the largest smart contract platforms outside ETH and SOL.
3. BLS-verified on-chain settlement. The business acumen thesis expressed through market valuation.

**Investment Objective**
The MBA Mcap index weights 11 tokens from MBA-holding founders by market cap, rebalanced monthly. It captures the business acumen premium, concentrating in protocols built by founders who combine technical understanding with financial and operational training.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.549 |
| Total Return | +97.6% |
| Annualized Return | +11.7% |
| Max Drawdown | -94.1% |
| Volatility (ann.) | 82.2% |
| Sortino Ratio | 0.207 |
| Calmar Ratio | 0.124 |
| Win Rate (monthly) | 40.5% |
| Best Month | +120.3% |
| Worst Month | -34.8% |
| Longest Drawdown | 1765 days |
| Time Underwater | 97.9% |
| Total Trades | 170 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
TRX (66.0%), ADA (25.1%), ETC (3.3%), APT (1.8%), TIA (0.7%), AXS (0.5%), W (0.5%), ANKR (0.5%), CELO (0.5%), ILV (0.5%), 1INCH (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +271.0% |
| 2022 | -77.2% |
| 2023 | +79.8% |
| 2024 | +57.9% |
| 2025 | -39.2% |
| 2026 | -10.9% |


### 88. Ex-Military Founders (MILF)
**Thesis:** 14 tokens from founders with military or intelligence backgrounds. Discipline, operational security, and a certain comfort with controlled chaos.
**Config:** `founders-ex-military` | top `14` | `equal` | rebalance `30d`

**Why This Index?**
1. 14 tokens from founders with military or intelligence backgrounds. Discipline, operational security, and comfort with controlled chaos. ADA, DOGE, APT, ICP in one basket.
2. Equal weighting across 14 ex-military tokens. The broadest professional-background basket, spanning L1s, DeFi, AI, and meme culture.
3. On-chain settlement with BLS-verified consensus. Military discipline as a founder quality signal, held transparently.

**Investment Objective**
The Ex-Military Founders index equally weights 14 tokens from founders with military or intelligence backgrounds, rebalanced monthly. It captures the operational discipline and security mindset that military training instills, applied across the full spectrum of crypto infrastructure.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.122 |
| Total Return | -93.0% |
| Annualized Return | -4194.0% |
| Max Drawdown | -96.2% |
| Volatility (ann.) | 92.2% |
| Sortino Ratio | -0.628 |
| Calmar Ratio | -0.436 |
| Win Rate (monthly) | 39.0% |
| Best Month | +86.1% |
| Worst Month | -41.8% |
| Longest Drawdown | 1760 days |
| Time Underwater | 99.4% |
| Total Trades | 56 |
| Rebalances | 60 |
| Period | 2021-04-21 → 2026-03-08 |

**Current Holdings:**
1INCH (7.1%), APT (7.1%), AXS (7.1%), BSV (7.1%), ADA (7.1%), TIA (7.1%), COMP (7.1%), CFX (7.1%), DOGE (7.1%), ICP (7.1%), IO (7.1%), KSM (7.1%), MORPHO (7.1%), W (7.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -88.4% |
| 2023 | +217.9% |
| 2024 | +33.3% |
| 2025 | -73.7% |
| 2026 | -16.6% |


### 89. Multinational Teams (MNAT)
**Thesis:** Founding teams with 2+ nationalities. 20 tokens. "Has EU" or "Has CN" teams outperform homogeneous ones at 3.7x. Diversity of perspective, not virtue signaling.
**Config:** `founders-multinational` | top `20` | `equal` | rebalance `30d`

**Why This Index?**
1. Founding teams with 2+ nationalities. 20 tokens. 'Has EU' or 'Has CN' teams outperform homogeneous ones at 3.7x. Diversity of perspective, not virtue signaling.
2. Equal weighting across 20 multinational tokens: DOGE, BCH, HBAR, ICP, SUI, TRX, and more. The most diverse founder basket in the catalog.
3. BLS-verified on-chain settlement. Geographic diversity as a measurable alpha signal, tracked and rebalanced on-chain.

**Investment Objective**
The Multinational Teams index equally weights 20 tokens from multinational founding teams, rebalanced monthly. It captures the 3.7x ATH multiplier of teams with diverse geographic backgrounds, where different regulatory experiences and market access create compound advantages.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.554 |
| Total Return | +75.0% |
| Annualized Return | +947.6% |
| Max Drawdown | -92.5% |
| Volatility (ann.) | 89.0% |
| Sortino Ratio | 0.152 |
| Calmar Ratio | 0.102 |
| Win Rate (monthly) | 41.9% |
| Best Month | +125.4% |
| Worst Month | -35.1% |
| Longest Drawdown | 1765 days |
| Time Underwater | 98.1% |
| Total Trades | 649 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
AEVO (5.0%), ANKR (5.0%), AXS (5.0%), BAT (5.0%), BCH (5.0%), BSV (5.0%), TAO (5.0%), TIA (5.0%), CELO (5.0%), MANA (5.0%), DOGE (5.0%), ETC (5.0%), HBAR (5.0%), ICP (5.0%), KAVA (5.0%), KSM (5.0%), XLM (5.0%), SUI (5.0%), GRT (5.0%), TRX (5.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +474.2% |
| 2022 | -83.0% |
| 2023 | +140.6% |
| 2024 | +41.3% |
| 2025 | -58.2% |
| 2026 | -19.1% |


### 90. US + International Teams (USIN)
**Thesis:** American founders paired with international co-founders. 12 tokens. The combination of US market access with global technical talent.
**Config:** `founders-us-intl` | top `12` | `equal` | rebalance `30d`

**Why This Index?**
1. American founders paired with international co-founders. 12 tokens, 0.627 Sharpe, +160.9% total return. US market access combined with global technical talent.
2. Equal weighting across 12 tokens: DOGE, TRX, XLM, SUI, TAO, ETC. The partnership thesis: American distribution plus international engineering.
3. On-chain settlement through BLS-verified consensus. The US-international partnership premium as an investable signal.

**Investment Objective**
The US + International Teams index equally weights 12 tokens from founding teams combining American and international founders, rebalanced monthly. It captures the partnership premium where US market access and regulatory familiarity combine with global technical depth.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.627 |
| Total Return | +160.9% |
| Annualized Return | +16.8% |
| Max Drawdown | -92.8% |
| Volatility (ann.) | 89.4% |
| Sortino Ratio | 0.271 |
| Calmar Ratio | 0.181 |
| Win Rate (monthly) | 41.9% |
| Best Month | +146.0% |
| Worst Month | -34.8% |
| Longest Drawdown | 1765 days |
| Time Underwater | 98.0% |
| Total Trades | 473 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
BAT (8.3%), TAO (8.3%), TIA (8.3%), CELO (8.3%), DOGE (8.3%), ETC (8.3%), KAVA (8.3%), KSM (8.3%), XLM (8.3%), SUI (8.3%), GRT (8.3%), TRX (8.3%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +593.3% |
| 2022 | -80.6% |
| 2023 | +131.3% |
| 2024 | +70.9% |
| 2025 | -54.5% |
| 2026 | -29.1% |


### 91. Immigrant Founders (IMMG)
**Thesis:** Founders building outside their home country. 14 tokens from people who crossed borders before they crossed industries. Immigration selects for risk tolerance.
**Config:** `founders-immigrant` | top `14` | `equal` | rebalance `30d`

**Why This Index?**
1. Founders building outside their home country. 14 tokens. Immigration selects for risk tolerance, and risk tolerance selects for crypto founders.
2. Equal weighting across 14 immigrant-founded tokens: ETH (Vitalik), ADA (Hoskinson), DOGE, GALA, HBAR. The most personal founder signal in the catalog.
3. BLS-verified on-chain settlement. Immigration as a founder selection mechanism, captured through transparent on-chain allocation.

**Investment Objective**
The Immigrant Founders index equally weights 14 tokens from founders who built outside their home country, rebalanced monthly. It captures the risk tolerance premium of immigrant founders, where crossing borders before crossing industries selects for the willingness to bet on the unknown.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.512 |
| Total Return | +30.4% |
| Annualized Return | +438.8% |
| Max Drawdown | -95.5% |
| Volatility (ann.) | 90.3% |
| Sortino Ratio | 0.067 |
| Calmar Ratio | 0.046 |
| Win Rate (monthly) | 48.6% |
| Best Month | +79.7% |
| Worst Month | -42.6% |
| Longest Drawdown | 1757 days |
| Time Underwater | 96.1% |
| Total Trades | 494 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
1INCH (7.1%), ANKR (7.1%), AXS (7.1%), ADA (7.1%), TIA (7.1%), COMP (7.1%), DOGE (7.1%), ETH (7.1%), FLOW (7.1%), GALA (7.1%), HBAR (7.1%), ILV (7.1%), ZRO (7.1%), SUSHI (7.1%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +250.4% |
| 2022 | -87.6% |
| 2023 | +120.9% |
| 2024 | +4.3% |
| 2025 | -70.0% |
| 2026 | -17.6% |


### 92. Immigrant Mcap (IMMM)
**Thesis:** Immigrant founders by market cap. ETH (Vitalik: Russian-Canadian), ADA (Hoskinson: American in various), DOGE — the biggest protocols built by people in transit.
**Config:** `founders-immigrant` | top `14` | `mcap` | rebalance `30d`

**Why This Index?**
1. Immigrant founders by market cap. 0.859 Sharpe and +844.6% total return. ETH at 84.2% dominates because Vitalik is the most successful immigrant founder in crypto.
2. Cap weighting makes this effectively an ETH index with DOGE (5.6%) and ADA (3.6%) as secondary holdings. The immigrant premium concentrates in a few giants.
3. On-chain settlement through BLS-verified consensus. The immigrant founder thesis weighted by what the market values most.

**Investment Objective**
The Immigrant Mcap index weights 14 tokens from immigrant founders by market cap, rebalanced monthly. ETH dominates at 84.2%, revealing that the immigrant founder premium concentrates in a few outsized winners, led by Vitalik Buterin's Russian-Canadian trajectory.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.859 |
| Total Return | +844.6% |
| Annualized Return | +43.8% |
| Max Drawdown | -80.7% |
| Volatility (ann.) | 82.9% |
| Sortino Ratio | 0.773 |
| Calmar Ratio | 0.542 |
| Win Rate (monthly) | 51.4% |
| Best Month | +61.1% |
| Worst Month | -42.6% |
| Longest Drawdown | 1760 days |
| Time Underwater | 96.0% |
| Total Trades | 310 |
| Rebalances | 76 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
ETH (84.2%), DOGE (5.6%), ADA (3.6%), HBAR (1.5%), COMP (0.5%), FLOW (0.5%), GALA (0.5%), ILV (0.5%), ZRO (0.5%), 1INCH (0.5%), SUSHI (0.5%), ANKR (0.5%), AXS (0.5%), TIA (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +313.9% |
| 2022 | -69.8% |
| 2023 | +81.8% |
| 2024 | +45.1% |
| 2025 | -18.2% |
| 2026 | -33.3% |


### 93. Ex-TradFi Founders (TRFI)
**Thesis:** Goldman, JPMorgan, Deutsche Bank alumni who defected. Three tokens — small basket, strong thesis. They know what they're replacing.
**Config:** `founders-ex-tradfi` | top `3` | `equal` | rebalance `30d`

**Why This Index?**
1. Goldman, JPMorgan, Deutsche Bank alumni who defected. Three tokens: ANKR, CELO, CFX. They know what they are replacing.
2. Equal weighting across 3 ex-TradFi tokens. The smallest professional-background basket, concentrated in infrastructure that bridges traditional and decentralized finance.
3. BLS-verified on-chain settlement. TradFi defectors building the replacement, tracked on-chain.

**Investment Objective**
The Ex-TradFi Founders index equally weights 3 tokens from founders who left traditional finance, rebalanced monthly. It captures the domain expertise of bankers and traders who understood the financial system's flaws from inside and now build its replacement.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | -0.097 |
| Total Return | -92.9% |
| Annualized Return | -4266.1% |
| Max Drawdown | -96.4% |
| Volatility (ann.) | 96.6% |
| Sortino Ratio | -0.638 |
| Calmar Ratio | -0.442 |
| Win Rate (monthly) | 33.3% |
| Best Month | +87.4% |
| Worst Month | -43.6% |
| Longest Drawdown | 1561 days |
| Time Underwater | 99.4% |
| Total Trades | 67 |
| Rebalances | 58 |
| Period | 2021-06-03 → 2026-03-08 |

**Current Holdings:**
ANKR (33.3%), CELO (33.3%), CFX (33.3%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2022 | -87.2% |
| 2023 | +85.9% |
| 2024 | +14.5% |
| 2025 | -71.8% |
| 2026 | -38.8% |


### 94. Serial + FNG Quality (SRFQ)
**Thesis:** Serial entrepreneurs with FNG quality rotation. Repeat founders know when to build and when to conserve. Let the fear/greed cycle amplify their instincts.
**Config:** `founders-serial` | top `33` | `equal` | rebalance `14d`
**Overlays:** fng_mode=quality_rotation

**Why This Index?**
1. Serial entrepreneurs with FNG quality rotation. 0.915 Sharpe and +1134.7% total return, including +1331.6% in 2021. The strongest combined founder-sentiment strategy.
2. FNG quality rotation shifts to DOGE, ETH, SOL, XLM, TRX during fear. Serial founders who have survived before know how to conserve. The overlay trusts that instinct.
3. BLS-verified on-chain settlement. Repeat-founder quality combined with sentiment-driven risk management.

**Investment Objective**
The Serial + FNG Quality index holds 33 tokens from serial founders with Fear & Greed quality rotation, rebalanced biweekly. During fear, it concentrates in the highest-quality serial-founder projects; during greed, it spreads across the full universe of repeat-builder tokens.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.915 |
| Total Return | +1134.7% |
| Annualized Return | +50.2% |
| Max Drawdown | -86.6% |
| Volatility (ann.) | 84.5% |
| Sortino Ratio | 0.843 |
| Calmar Ratio | 0.579 |
| Win Rate (monthly) | 48.6% |
| Best Month | +120.7% |
| Worst Month | -37.4% |
| Longest Drawdown | 1559 days |
| Time Underwater | 95.7% |
| Total Trades | 2622 |
| Rebalances | 161 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
DOGE (20.0%), ETH (20.0%), SOL (20.0%), XLM (20.0%), TRX (20.0%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +1331.6% |
| 2022 | -79.5% |
| 2023 | +93.4% |
| 2024 | +70.5% |
| 2025 | -57.4% |
| 2026 | -9.9% |


### 95. FAANG Defectors Momentum (FDMO)
**Thesis:** Ex-FAANG with momentum. These founders left the most comfortable jobs in tech. When their protocols gain momentum, it means the market is validating their bet.
**Config:** `founders-ex-faang` | top `11` | `momentum_30` | rebalance `14d`

**Why This Index?**
1. Ex-FAANG with momentum. 0.509 Sharpe and +5.1% total return. These founders left the most comfortable jobs in tech. When their protocols gain momentum, the market validates the leap.
2. 30-day momentum across 11 ex-FAANG tokens, rebalanced biweekly. LTC (21.9%), BCH (19.5%), TAO (9.6%) currently lead.
3. On-chain settlement with BLS-verified consensus. Big-tech defectors, tracked by momentum, settled transparently.

**Investment Objective**
The FAANG Defectors Momentum index applies 30-day momentum to 11 tokens from ex-FAANG founders, rebalanced biweekly. It captures the career-risk premium of founders who left secure big-tech positions, overweighting the ones whose protocols the market currently validates.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.509 |
| Total Return | +5.1% |
| Annualized Return | +80.2% |
| Max Drawdown | -94.6% |
| Volatility (ann.) | 100.9% |
| Sortino Ratio | 0.012 |
| Calmar Ratio | 0.008 |
| Win Rate (monthly) | 40.5% |
| Best Month | +180.6% |
| Worst Month | -39.4% |
| Longest Drawdown | 1760 days |
| Time Underwater | 98.5% |
| Total Trades | 866 |
| Rebalances | 161 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
LTC (21.9%), BCH (19.5%), TAO (9.6%), GRT (9.5%), CFX (9.2%), TIA (7.7%), ANKR (7.1%), CELO (5.6%), SEI (5.5%), SUI (4.0%), APT (0.5%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +189.5% |
| 2022 | -90.5% |
| 2023 | +299.6% |
| 2024 | +87.4% |
| 2025 | -60.4% |
| 2026 | -21.4% |


### 96. Multinational + Momentum (MNMO)
**Thesis:** Multinational teams riding momentum. Global teams ship globally — when they move, the move is cross-market.
**Config:** `founders-multinational` | top `20` | `momentum_30` | rebalance `14d`

**Why This Index?**
1. Multinational teams riding momentum. 0.803 Sharpe and +602.6% total return. Global teams ship globally. When they move, the move is cross-market.
2. 30-day momentum across 20 multinational tokens, rebalanced biweekly. DOGE (9.5%), BCH (9.4%), TRX (9.1%) currently lead the multinational momentum ranking.
3. BLS-verified on-chain settlement. Geographic diversity combined with trend-following, capturing cross-market moves.

**Investment Objective**
The Multinational + Momentum index applies 30-day momentum to 20 tokens from multinational founding teams, rebalanced biweekly. It combines the 3.7x ATH multiplier of diverse teams with systematic trend selection, overweighting the multinational projects gaining market traction.

| Metric | Value |
|--------|-------|
| Sharpe Ratio | 0.803 |
| Total Return | +602.6% |
| Annualized Return | +37.1% |
| Max Drawdown | -88.6% |
| Volatility (ann.) | 91.8% |
| Sortino Ratio | 0.607 |
| Calmar Ratio | 0.418 |
| Win Rate (monthly) | 45.9% |
| Best Month | +140.7% |
| Worst Month | -40.2% |
| Longest Drawdown | 1559 days |
| Time Underwater | 97.7% |
| Total Trades | 1853 |
| Rebalances | 161 |
| Period | 2020-01-01 → 2026-03-08 |

**Current Holdings:**
DOGE (9.5%), BCH (9.4%), TRX (9.1%), HBAR (8.4%), BSV (7.9%), ETC (5.5%), TAO (5.2%), GRT (5.2%), XLM (5.1%), KSM (4.8%), TIA (4.5%), ANKR (4.2%), AEVO (4.0%), CELO (3.6%), KAVA (3.2%), BAT (3.1%), SUI (2.9%), ICP (2.6%), MANA (1.8%), AXS (0.2%)

**Yearly Returns:**
| Year | Return |
|------|--------|
| 2021 | +1127.9% |
| 2022 | -82.3% |
| 2023 | +130.7% |
| 2024 | +107.1% |
| 2025 | -54.6% |
| 2026 | -16.3% |

