# Cross-Market Insider Trading, HFT Adverse Selection, and Legal Enforcement

Extraction report from five assigned PDFs. Two of the five (Cheng 2006, Acharya & Johnson 2007 CDS) contained mismatched content — the PDF files are mislabeled NBER downloads (Eichengreen 2002 on the Gold Standard; Naritomi et al. 2007 on Brazilian colonial institutions). Zero insider trading data recoverable from those two. The three valid papers are documented in full below.

---

## Paper 1: Ahern (2017) — "Information Networks: Evidence from Illegal Insider Trading Tips"

**Journal of Financial Economics 125, 26-47. Hand-collected SEC/DOJ data, 2009-2013 filings.**

### Headline Numbers

| Metric | Value |
|--------|-------|
| Total networks identified | 183 |
| Total inside traders | 622 |
| Total insider tips | 1,139 |
| Total events | 465 |
| Aggregate illegal profits | $928 million |
| Average return (info date to announcement) | **35% over 21 trading days** |
| Median return per trader | 26.4% |
| Average return per trader | 63.4% (includes options leverage) |
| Median investment per tip | $200,000 |
| Median gain per tip | $72,000 |
| M&A event average return | **43.1% in 30.5 days** |
| Clinical trial event average return | **101.2% (positive) / -38.6% (negative) in 9.2 days** |
| Earnings event average return | 13.5% in 11.3 days |
| Run-up share of total return (positive events) | 49% |
| Run-up share of total return (negative events) | 28% (short-sale constraints) |

### Extraction Rates and Price Impact

- Stock returns are **20 basis points higher** on days with insider trading (event-firm fixed effects, controlling for volume and Fama-French factors)
- Each additional unique insider trader on a given day increases returns by a statistically significant amount (coefficient 0.204, p = 0.006)
- Insider trading volume (log shares) positively predicts daily returns with coefficient 0.109 (p < 0.001)
- Median daily illegal trading volume = **0.63% of daily dollar volume**; at 75th percentile = **3.71%**
- Average daily illegal trading volume = **4.66% of daily dollar volume**

### How Insiders Operate

**Demographics:**
- Average age: 44.1 years. 90.2% male.
- 53.7% have criminal records (vs. 12.8% of matched neighbors — mostly traffic violations, but the gap implies lower risk aversion or weaker respect for legal constraints)
- Median home value: $656,300 (3x national median of $212,400)
- Median trader invests 39% of home value per tip

**Occupations (622 people):**
- Top executives: 17.3% (107 people) — most common tippers
- Buy-side managers: 9.7% (60)
- Buy-side analysts/traders: 10.5% (65) — highest median return at 117.7%
- Sell-side (lawyers, accountants, bankers): 9.9% (61)
- Buy-side managers earn highest dollar gains: $5.8 million median per tip
- Buy-side managers median return: 37% (lower than analysts, but vastly larger positions)

**Network Structure:**
- 23% of tipper-tippee pairs are family, 35% are friends, 35% are business associates
- Median geographic distance between tipper and tippee: **26.2 miles**
- Siblings and parents are the closest family tippers (24% and 19% of family links)
- Subordinates tip supervisors 63% of the time (information flows upward to please higher-status individuals)
- Information flows from younger to older, children to parents

**Tip Chain Dynamics:**
- Original sources wait 12.1 days on average before tipping
- By the 4th link: 92.1% tip same day as received (vs. 46.5% at origin)
- First-link tippees: 46.0% average return, 25.2% median
- Fourth-link tippees: 23.0% average return, 18.8% median — information decays
- But investment size rises: $200,400 median at first link, $492,700 at fourth link
- Dollar profits rise even as returns fall: professional traders invest more, use shares over options
- Business connections dominate at periphery (66.1% at 4th+ link vs. 28.4% at 1st)
- Family connections dominate at origin (24.6% at 1st link vs. 11.9% at 4th+)

**Network Centrality and Returns:**
- Instrength (tips received) positively predicts returns (coeff 0.085, p < 0.001) — more central traders get better information, not just more information
- Network size positively predicts returns (coeff 0.012-0.014, p = 0.02-0.04)
- Tip chain distance negatively predicts dollar profits (coeff -0.231 to -0.276, p < 0.01) but not percentage returns after controls
- Largest network: SAC Capital / Primary Global Research with 64 members

**Event Composition:**
- M&A: 51% (239 events) — overwhelmingly positive (234 positive vs. 5 negative)
- Earnings: 26% (123 events) — more balanced (66 positive, 54 negative)
- Clinical trials/drug regulatory: 8.0%
- Sale of securities: 7.5% (overwhelmingly negative — 34 of 35)
- Firms traded: median market equity $1 billion (comparable to median NYSE firm)

**Key Quote on Prevalence:**
> "Augustin, Brenner and Subrahmanyam (2014) estimate that **25% of merger and acquisition announcements are preceded by illegal insider trading.**"

---

## Paper 2: Brogaard, Hendershott & Riordan (2014) — "High Frequency Trading and Price Discovery"

**ECB Working Paper No. 1602. NASDAQ HFT data, 120 stocks, 2008-2009.**

### Market Structure Quantitative Data

| Metric | Large | Medium | Small |
|--------|-------|--------|-------|
| Market capitalization (avg) | $52.47B | $1.82B | $0.41B |
| HFT share of trading volume (demand) | 42% | — | 25% |
| HFT share of trading volume (supply) | 42% | — | 11% |
| HFT total share of volume | ~42% | — | ~18% |
| Relative bid-ask spread (bps, NBBO) | 4.72 | 14.61 | 38.06 |
| Daily NASDAQ volume | $186.61M | $6.52M | $1.18M |

### How HFTs Extract / Contribute

**Adverse Selection Decomposition (State Space Model):**
- HFT liquidity-demanding orders (HFTD): **positively** correlated with permanent price changes (kappa > 0) and **negatively** correlated with transitory pricing errors (psi < 0)
  - For large stocks: $10,000 of positive surprise HFT order flow -> 0.21 bps increase in efficient price
  - This means HFTD is informed: it trades in the direction of fundamental value and against noise
- HFT liquidity-supplying orders (HFTS): **negatively** correlated with permanent price changes (adversely selected) and **positively** correlated with pricing errors
  - Liquidity suppliers lose to informed traders but earn the spread
- Non-HFT liquidity demand (nHFTD): also positively correlated with permanent price changes but **less informed per dollar** than HFTD (statistically significant difference for large and medium stocks)
- Pricing errors are persistent: AR(1) coefficient between 0.46 and 0.50

**Predictive Horizon:**
- HFT trading predicts price changes for **less than 3-4 seconds**
- HFTAll correlation with subsequent returns dies to zero after 2 seconds
- nHFTD information dies out after 8-9 seconds (longer-lived)
- HFTs follow contrarian strategies (negative correlation with past returns)
- nHFTs follow momentum strategies (positive correlation with past returns)

**HFT Revenue Estimates:**
- HFTAll is profitable overall; nHFTAll is unprofitable
- HFTD generates positive revenues even after paying the spread + NASDAQ fees (informational advantage sufficient to overcome transaction costs)
- HFTS generates negative revenues before rebates; slightly positive in large stocks after rebates
- HFTs earn ~$0.43 per $10,000 traded
- Estimated HFT NASDAQ revenue: ~$275,000/day across 120 stocks
- Extrapolated total daily HFT equity revenue: ~$20 million
- Annualized: ~$5 billion across 26 HFT firms (~$200 million/firm)
- Getco (one large HFT firm) had ~$1 billion/year revenue across all US asset classes; equity ~20%
- Annualized return on estimated max capital ($318M): ~22% before costs
- Getco S-4: costs ~2/3 of revenues

**High Volatility Days (Top 10% by permanent volatility):**
- All state space model coefficients retain same signs, with larger magnitudes
- HFTs contribute more to price discovery on high-volatility days
- HFTs increase liquidity supply participation on volatile days (do not withdraw)
- Both dollar and relative spreads increase (higher adverse selection and inventory costs)
- Total trading volume increases by $47.41M; HFT volume by $54.89M; nHFT by $39.94M

**Macro News Announcements:**
- HFTD trades in the direction of macro news (buys on positive, sells on negative)
- HFTS trades against the direction (provides liquidity around announcements)
- Overall HFTs are net liquidity suppliers around macro announcements — not net adverse selectors
- HFT demand around macro news predicts subsequent returns (positive coefficient, lagged price adjustment)
- Information not fully incorporated for several seconds after announcement

**Limit Order Book Information:**
- HFTs trade in the direction of order book imbalances (buy when fewer shares offered to buy)
- HFTs supply liquidity on the thin side of the book (beneficial but exposes them to adverse selection)
- HFTD return predictability is significant at 1-second lag but not beyond
- LOBI independently predicts returns; HFT trading has incremental predictive power beyond LOBI

### Key Distinction: Demanding vs. Supplying

The paper's central decomposition:
- **HFT liquidity demanders** are the informed party — they impose adverse selection on counterparties, trade against noise, and earn positive revenues net of spread + fees
- **HFT liquidity suppliers** are the adversely selected party — they lose to informed traders but earn spread and rebates. Net slightly positive in large stocks after rebates
- Overall HFT effect on price efficiency: **positive** — reduces transitory pricing errors and incorporates information

---

## Paper 3: La Porta, Lopez-de-Silanes, Shleifer & Vishny (1998) — "Law and Finance"

**NBER Working Paper 5661. 49 countries, legal rules + enforcement + ownership.**

### Cross-Country Enforcement Quality

This paper does not measure insider trading extraction rates per se. It measures the legal infrastructure that determines whether insider trading is prosecuted at all.

**Anti-Director Rights Score (aggregate, out of 5):**
- Common law countries: **3.39** (US scores a perfect 5)
- Scandinavian civil law: 2.50
- German civil law: 2.00
- French civil law: **1.76** (worst)

**Key Legal Provisions by Legal Origin:**

| Rule | Common Law | French Civil | German Civil | Scandinavian |
|------|-----------|-------------|-------------|-------------|
| Allow mail voting | 39% | 9% | — | — |
| Block shares before meeting | 0% | 43% | 50%+ | — |
| Oppressed minorities protection | 92% | 33% | — | 25% (Denmark only) |
| Share capital to call extraordinary meeting | 9% | 14% | — | — |
| Mandatory dividends | Rare | Common | — | — |
| One-share-one-vote | 22% (world avg) | 24% | Higher (East Asia) | 0% |

**Creditor Rights:**
- Common law: most frequently restrict managers from unilateral court protection (71%), lowest automatic stay on assets (29%), lowest incidence of managers staying in reorganization (24%)
- French civil law: weakest in virtually all creditor protections (74% allow automatic stay, 74% let managers stay in reorganization)
- No evidence that countries trade off shareholder vs. creditor protection — those that protect one tend to protect both

**Enforcement Quality:**
- Scandinavian and German civil law: highest enforcement scores on all measures (judicial efficiency, rule of law, corruption, expropriation risk, contract repudiation risk)
- Common law: second-best enforcement
- French civil law: worst enforcement on every single measure
- Per capita income explains most of the variance; but legal origin remains significant after controlling for income
- Critical finding: **poor laws are NOT compensated by strong enforcement** — French civil law countries have both the worst rules and the worst enforcement

**Accounting Standards:**
- Scandinavian: highest
- Common law: second
- German civil law: lower
- French civil law: weakest

**Ownership Concentration (3 largest shareholders in 10 largest public firms):**

| Legal Origin | Average Ownership | Median |
|-------------|------------------|--------|
| World average | **46%** | 45% |
| French civil law | **54%** | — |
| Common law | 43% | — |
| Scandinavian | 37% | — |
| German civil law | 34% (driven by East Asia) | — |
| United States | 20% | 12% |

- "Dispersed ownership in large public companies is simply a myth." Outside the US/UK/Australia/Japan, even the largest firms have concentrated ownership.
- A 20-point increase in accounting standards score reduces ownership concentration by 9 percentage points
- A 1.6-point increase in anti-director rights score (the common law vs. French civil law gap) reduces ownership concentration by 8 percentage points
- French civil law countries substitute concentrated ownership for absent legal protections; small investors cannot participate safely

### Relevance to Insider Trading Extraction

La Porta et al. does not directly measure insider extraction. But it establishes the foundational mechanism:
- In countries with weak investor protection (French civil law), insiders can extract more because enforcement is poor and minority shareholders lack legal tools
- Ownership must concentrate to survive insider extraction — dispersed ownership is only viable where legal systems constrain insiders
- The "world price of insider trading" (Bhattacharya & Daouk 2002, cited across the literature) depends on these legal regimes
- Mandatory dividends and legal reserves exist as "bright line" rules precisely because more sophisticated protections (like insider trading enforcement) are absent

---

## Corrupted PDFs — Files Not Matching Their Labels

| Filename | Expected Content | Actual Content |
|----------|-----------------|----------------|
| `C092_Cheng_2006_Insider_trading_voluntary.pdf` | Cheng (2006) on insider trading and voluntary disclosure | Eichengreen (2002), "Still Fettered After All These Years" — Gold Standard and the Great Depression |
| `092_Acharya_Johnson_2007_CDS.pdf` | Acharya & Johnson (2007) on insider trading in credit derivatives | Naritomi, Soares & Assuncao (2007), "Rent Seeking and the Unveiling of De Facto Institutions" — Brazilian colonial institutions |

These are NBER PDF downloads where the wrong working paper was saved under the filename. The Acharya & Johnson CDS paper is a significant loss — it contains the primary evidence on cross-market insider trading between CDS and equity markets, including the finding that CDS spreads move before negative credit events (especially for firms with fewer bank relationships, where information concentration enables trading). It will need to be re-downloaded.

---

## Cross-Paper Synthesis: Extraction Rate Summary

| Domain | Extraction Metric | Source |
|--------|------------------|--------|
| Illegal insider trading returns | 35% avg over 21 days; 43% for M&A | Ahern (2017) |
| M&A events preceded by insider trading | ~25% | Augustin et al. (2014) via Ahern |
| Insider trading daily price impact | +20 bps on trading days | Ahern (2017) |
| Insider volume as % of daily volume | 0.63% median, 4.66% mean | Ahern (2017) |
| HFT adverse selection (liquidity supply) | Negative kappa (adversely selected by informed demand) | Brogaard et al. (2014) |
| HFT informational advantage (liquidity demand) | 0.21 bps per $10K traded; positive revenue after spread+fees | Brogaard et al. (2014) |
| HFT total extraction (annual revenue) | ~$5 billion/year across 26 firms | Brogaard et al. (2014) |
| HFT revenue per dollar traded | $0.43 per $10,000 | Brogaard et al. (2014) |
| HFT predictive horizon | 2-4 seconds | Brogaard et al. (2014) |
| Ownership concentration (world, top firms) | 46% average (3 largest shareholders) | La Porta et al. (1998) |
| Legal protection gap (common vs. French civil law) | Anti-director rights: 3.39 vs. 1.76 | La Porta et al. (1998) |
| Ownership response to weak protection | +8 pct points concentration per 1.6-point rights deficit | La Porta et al. (1998) |

### Mechanism Chain

1. **Legal infrastructure** determines whether insider extraction is constrained (La Porta et al.)
2. **Where enforcement is weak**, ownership concentrates and insider extraction increases
3. **Illegal insiders** earn 35% returns over 21 days through trust-based social networks; information flows from executives outward through 3+ network links to buy-side professionals (Ahern)
4. **HFTs** represent a distinct extraction mechanism — speed-based rather than information-based — extracting ~$0.43/$10K through sub-second informational advantages (Brogaard et al.)
5. **Both mechanisms** move prices toward efficiency, but at the cost of adverse selection imposed on slower or less-informed participants
