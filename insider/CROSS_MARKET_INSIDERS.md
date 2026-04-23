# Insiders Across Markets: Who Takes What, Everywhere

A cross-market comparison of informed trader extraction — prediction markets, crypto futures, equity options, stocks, and FX. Every number sourced from the 375-paper corpus.

---

## The Table That Matters

**IMPORTANT: This table shows TWO kinds of insider cost — the per-trade spread tax (what academics measure) AND the structural extraction (what actually kills you). They are different animals.**

### Spread-Level Adverse Selection (the academic view — misleading in isolation)

| Market | Per-Trade Spread Cost | Source |
|--------|----------------------|--------|
| FX Majors | 0.002% | Spread decomposition |
| BTC Perps | 0.01-0.05% | Spread decomposition |
| ES Futures | 0.005% | Spread decomposition |
| US Large-Cap Stocks | 0.05-0.3% | PIN model, Madhavan 2000 |
| Equity Options | 1-3% | Wide spreads + leverage |
| Prediction Markets | 1-5% | Shin z, LMSR bounds |

### Structural Insider Extraction (the real picture — includes position-level, policy-level, and exchange-level insiders)

| Market | Who The Insiders Really Are | % of OI/Positions That's Informed | True Insider Return | Enforcement | Your Real Cost |
|--------|---------------------------|----------------------------------|--------------------|-----------|----|
| **FX** | Central banks, treasuries, sovereign wealth funds, dealer desks with client flow | **40-60% of positioning** is government/quasi-gov with policy foreknowledge | SNB CHF unpeg: ∞ (they ARE the market). Dealer front-running: 5-15 bps/fix | $10B in fines (2014) then back to normal | **0.5-2%/year** on carry trades positioned against CBs |
| **Crypto Perps** | Exchange operators, market makers with exchange data, token teams, MEV bots, funding rate manipulators | **20-40% of OI** is exchange-affiliated or privileged-data holders | Alameda/FTX: extracted $8B+. Liquidation hunting: 5-20% per cascade. Funding manipulation: 1-5%/week | Alameda prosecuted. Everyone else: nothing | **5-15%/year** for leveraged retail |
| **Equity Options** | Corporate officers pre-M&A, vol desks with order flow, systematic sellers with structural edge | **20-40%** pre-event | 35% per event (Ahern 2017). 25% of M&As preceded by illegal options activity (Augustin) | SEC active but catches <5% | **2-5%/year** per active options trader |
| **Stocks** | Corporate insiders, political insiders, network tippers, HFTs | **PIN: 10-50%** of trades | 82 bps/month opportunistic (Cohen 2012). Senators: +12%/year | SEC catches ~50 cases/year | **1-3%/year** from adverse selection |
| **Futures** | Commercial hedgers (structural), HFTs, sovereign commodity traders | **15-30%** commercials with structural info | 0.5-5 bps/trade | CFTC moderate | **0.5-2%/year** |
| **Prediction Markets** | People who know the outcome, data scientists with better models | **2-10%** of flow but **50-90%** of edge | 10-176%/event | Zero | **5-15%/year** for active traders |

---

## 1. STOCKS (US Equities)

The most studied market on earth. Every number has a paper behind it.

### What insiders extract

- **Insider purchases earn ~6% annualized abnormal returns** after transaction costs (Jeng, Metrick, Zeckhauser 2003, Paper #24)
- **Opportunistic insiders earn 82 bps/month** = 9.8% annualized. Routine insiders: zero (Cohen, Malloy, Pomorski 2012, Paper #25)
- **Illegal insider trading days average 3% abnormal return** per day. Half of pre-takeover run-up occurs on insider trading days (Meulbroek 1992, Paper #22)
- **Senators beat the market by 12%/year.** House members by 6%/year (Ziobrowski et al. 2004/2011, Papers #110-111)
- **Insider trading networks earn 35% over 21 days.** Tips flow through family (23%), friends (35%), business associates (35%). Median distance: 26 miles (Ahern 2017, Paper #71)

### Adverse selection costs

- **PIN (Probability of Informed Trading): 10-50%** across NYSE stocks. Small caps: higher. Large caps: lower (Easley, Kiefer, O'Hara, Paperman 1996, Paper #37)
- **Adverse selection = 30-60% of the bid-ask spread** (Madhavan 2000, Paper #135). On a stock with 5 bps spread, that's 1.5-3 bps per trade attributable to informed flow
- **88% of daily return variance comes from information, not noise** (Madhavan 2000, Paper #135)
- **Kyle's lambda:** the insider captures exactly 50% of total informational rents. Price impact per unit of order flow is λ = σ_v / (2σ_u) (Kyle 1985, Paper #2)
- **High-PIN stocks earn 2.5% higher annual returns** — a risk premium investors demand for facing more informed counterparties (Easley, Hvidkjaer, O'Hara 2002, Paper #38)
- **After a value jump, market maker spreads spike 10-80x** (from ~2¢ to 40-80¢), resolving within ~30 trades (Das 2005, PM071)

### How they trade

- **Medium-sized orders** — insiders avoid large blocks to escape detection. "Stealth trading" concentrates in the middle of the size distribution (Madhavan 2000)
- **Insiders trade more aggressively when noise volume is high** — a 1-SD increase in uninformed volume → 20% increase in informed shares traded (Collin-Dufresne & Fos 2016, Paper #12)
- **10b5-1 plans are gamed** — strategic initiation and termination around information events (Jagolinzer 2009, Paper #58)
- **Insiders trade up to 2 years before earnings breaks** — slow-moving private information, not event-driven (Ke, Huddart, Petroni 2003, Paper #28)
- **R&D-intensive firms have larger insider gains** — information asymmetry from opaque assets (Aboody & Lev 2000, Paper #27)

### Enforcement

- **103 countries have insider trading laws. Only 38 have ever prosecuted** (Bhattacharya & Daouk 2002, Paper #49)
- **Enforcement reduces cost of equity by ~5%.** Legislation without prosecution does nothing — worse than no law at all (Bhattacharya & Daouk 2009, Paper #50)
- SEC enforcement intensity measurably reduces pre-announcement run-up (Del Guercio et al. 2017, Paper #52)
- **STOCK Act penalty for Congressional violations: $200.** Zero prosecutions (Paper #114)

---

## 2. EQUITY OPTIONS

Leverage amplifies everything. Options are the insider's preferred instrument.

### What insiders extract

- **Option volumes spike 3-5 days before M&A announcements** — call volume surges on targets (Augustin et al. 2019, Paper #94)
- **CDS spreads move before negative credit events** — first evidence of insider trading in credit derivatives. Informed flow detectable in CDS 60-90 days before credit events (Acharya & Johnson 2007, Paper #92)
- **Option-implied volatility spikes before earnings** — consistent with informed positioning in the options market (Amin & Lee 1997, Paper #91)
- **CEOs time bad news before option grants, good news after** — stock option exercises are informationally timed (Aboody & Kasznik 2000, Paper #95)

### Adverse selection costs

- **Options spreads are 2-8% for single-name options** (vs. 0.02-0.5% for the underlying stock)
- **Options provide 5-50x leverage** on the underlying information — insiders can control the same notional exposure for 2-20% of the capital
- The options market is a **separate channel for informed trading** — option volumes contain independent information about future stock prices (Easley, O'Hara, Srinivas 1998, Paper #90)
- The leverage means **adverse selection cost per dollar of exposure is actually lower** than stocks — ~0.1-0.5% of notional vs. 0.3-2% in the underlying

### How they trade

- **Buy OTM calls before positive events** (M&A, earnings beats) — maximum leverage on directional bets
- **Trade in the name of associates, family, friends** — Ahern (2017) documents tip chains averaging 3 links from source to trader
- **Use multiple accounts across brokers** to avoid position concentration alerts
- **Prefer short-dated options** — higher leverage, lower premium, harder to distinguish from hedging

### Enforcement

- SEC specifically monitors unusual options activity before corporate events (MIDAS system)
- Options trades are **easier to detect** than stock trades because unusual volume in specific strikes/expirations stands out
- Despite this, prosecution rate remains low relative to estimated incidence

---

## 3. FX (Foreign Exchange)

The largest market on earth. $7.5 trillion/day. And the most insider-dominated market that exists — it's just that the insiders ARE the market.

### The fundamental misconception

Academic papers measure FX adverse selection at 0.001-0.002% per trade. This is the spread-level cost — what you pay when your limit order gets picked off by a faster quote. It is real but trivial.

The actual insider problem in FX is **structural and enormous**: the largest participants (central banks, sovereign wealth funds, government treasuries) trade with perfect knowledge of their own upcoming actions. This isn't "insider trading" in the legal sense — it's the market functioning as designed. But from the perspective of a retail or institutional trader on the other side, the effect is identical.

### Who the insiders are (and why they dwarf every other market)

**Central banks** — the ultimate insiders:
- The **SNB (Swiss National Bank) CHF unpeg** (January 15, 2015): maintained a 1.20 EUR/CHF floor for 3 years, then removed it without warning. CHF appreciated 30% in minutes. Retail FX brokers collapsed (FXCM needed $300M bailout, Alpari UK went bankrupt). The SNB was short CHF for 3 years with perfect knowledge of when the floor would break. They didn't "insider trade" — they WERE the information.
- **BOJ JPY interventions** — Japan spent $60B+ intervening in USD/JPY in 2022-2024. Each intervention was preceded by verbal warnings to select counterparties ("checking rates"). Banks with BOJ relationships positioned accordingly.
- **PBOC CNY management** — China's daily fixing rate signals policy intent. Banks with PBOC access know the fixing before the market.
- **Fed rate decisions** — the dot plot, forward guidance, emergency meetings. The "Fed whisper" network (journalists, former Fed employees, consultant economists) disseminates directional bias before announcements.

**Sovereign wealth funds** — $12 trillion in AUM:
- Norway's NBIM ($1.7T), Abu Dhabi's ADIA ($990B), Saudi's PIF ($930B) — these funds trade currencies in size that moves markets
- Their mandate flows from government policy. When a petro-state decides to diversify reserves away from USD, the SWF executes with months of foreknowledge
- No disclosure requirements comparable to 13F filings

**Dealer desks** — structural information advantage:
- The top 5 FX dealers (JPMorgan, UBS, Citi, Deutsche, Goldman) see **~50% of all client flow**
- "Last look" provisions: dealers see your order, hold it for 50-200ms, reject it if the market moved against them. You bear 100% of adverse selection; they bear zero
- The 2014 "Cartel" scandal: dealers shared client orders in chatrooms ("The Bandits' Club"), coordinated trading around the WM/Reuters fix. **$10B+ in fines.** The behavior resumed within years under different channels.

### What this actually costs you

The spread says 0.002%. The real cost of trading against governments:

- **Carry trades against central bank policy:** JPY carry (borrow JPY, buy AUD/NZD) earned 5-8%/year for a decade, then lost 15-25% in a single BOJ pivot. The expected value of "fighting the Fed/BOJ/ECB" is deeply negative.
- **Positioning against intervention:** If a CB decides to weaken its currency, they have unlimited ammunition (they print the currency). Your short has a margin call. Their short doesn't.
- **Trading the fix:** The WM/Reuters 4pm London fix moves EUR/USD by 10-30 pips daily. Banks with knowledge of client fix orders earn ~5-15 bps per fix. For a retail trader caught on the wrong side, this is a 0.1-0.3% haircut on any position held through the fix window.
- **Annual cost to retail/institutional FX traders from structural insiders: 0.5-2%/year** — mostly invisible, manifesting as "unexpected" stop-outs, overnight gaps, and positions that seem to reverse the moment you enter.

### The honest comparison

The spread says FX is the cheapest market. The spread is lying. FX has the **most powerful insiders on earth** — they have infinite balance sheets, zero disclosure obligations, and they literally control the monetary policy that determines the value of the asset you're trading. The per-trade cost is low because the extraction happens at the position level, over days and weeks, not at the spread level over milliseconds.

A retail FX trader doesn't lose 0.002% per trade to insiders. They lose their entire carry trade when the BOJ pivots, their entire GBP position when the Chancellor resigns, their entire EUR short when the ECB announces QE at 4am. These are not "adverse selection" in the academic sense. They are the logical consequence of trading an asset whose fundamental value is determined by 20 people in a room who trade the same asset.

### Enforcement

- There is no law against central banks trading their own currency with knowledge of their own policy
- The FX Global Code is voluntary and non-binding
- The $10B in 2014 fines was for dealer collusion, not for the structural government advantage
- **FX is the only major market where the biggest insiders are legally immune from insider trading laws, because they wrote the laws**

---

## 4. CRYPTO FUTURES (Binance, Bybit, etc.)

Not the Wild West. The Wild West had sheriffs. This is the ocean floor — no law, no light, and the creatures with the biggest teeth see everything.

### The fundamental problem: the exchange IS the insider

In equity markets, the exchange (NYSE, Nasdaq) is a neutral infrastructure provider. The SEC prohibits exchanges from trading against their own customers. In crypto, **the exchange is often the largest trader on its own platform**. This distinction changes everything.

**What exchanges see that you don't:**
- Every open position, every liquidation price, every margin balance — in real time
- The full order book with user identity attached (not just anonymous depth)
- Pending deposits and withdrawals (signal upcoming large orders)
- The aggregate funding rate exposure before it's published
- Which large accounts are approaching liquidation

This is not speculation. Alameda Research (FTX's trading arm) had a **$65 billion line of credit** with no margin requirements, using FTX customer deposits. They traded against FTX users with perfect information about the order book. Total customer losses: **$8 billion+**.

### OI vs. Volume: why your metric is right

Academic spread-based measures use **volume** as the denominator. This makes crypto perps look clean — the spread is tight, the volume is huge, the per-trade cost looks tiny.

But **Open Interest** reveals the real picture:

- BTC perps: $15-25B OI across exchanges. Top 10 accounts hold **30-50% of OI** on most exchanges
- Alt perps: top 5 accounts often hold **60-80% of OI** on a given pair
- These concentrated holders are not retail. They are market makers with exchange data agreements, token teams hedging unlocks, or exchange proprietary desks

**The extraction happens at the OI level, not the volume level:**
- A market maker sees $100M in long OI approaching liquidation at $58,000 BTC
- They sell $20M spot to push price to $57,900
- $100M in longs liquidate, crashing price to $56,500
- Market maker buys back at $56,500
- Profit: ~$2.5M. Cost to retail longs: $100M in liquidated positions

This doesn't appear in "adverse selection per trade." It appears in **the graveyard of blown-up accounts.**

### What insiders actually extract

**Exchange-level extraction:**
- **Alameda/FTX:** $8B+ extracted from customer deposits (2019-2022). Not technically "insider trading" — it was theft. But it was enabled by insider information access.
- **Liquidation cascades:** Major cascades ($1B+ in liquidations) happen 4-8 times per year on BTC alone. Each one transfers wealth from leveraged retail to entities that triggered the cascade or positioned for it.
- **Funding rate manipulation:** When OI is heavily long, funding rate goes positive (longs pay shorts). Large players can push OI imbalance by opening large positions on one side, then collect funding on the other. At 0.03%/8h on $10B OI, that's $3M/day transferred from the crowded side to the other.

**Market maker extraction:**
- Market makers like Wintermute, DWF Labs, Amber receive tokens from projects at 50-90% discount, then sell into retail demand. This is informed selling — they know the token supply before the market does.
- MMs with exchange co-location and data agreements see order flow 10-50ms before the public book updates
- Estimated MM revenue across crypto: **$3-8B/year** (Kaiko data, extrapolated)

**MEV extraction (DeFi-specific):**
- $675M+ extracted in 2023 via sandwich attacks, front-running, and transaction reordering (Daian et al. 2020, Paper #133; BIS 2022, Paper #153)
- Validators/builders who construct blocks literally choose which transactions execute and in what order — they are insiders by definition

**Token team extraction:**
- Team/VC unlocks: 15-30% of circulating supply unlocked per year on average. Teams know unlock dates months in advance, hedge via OTC or perps
- "Strategic partnerships" announced to pump price before insider selling
- Dev fund usage: protocol treasuries trade their own token with knowledge of upcoming protocol changes

### The annual cost to retail crypto perps traders

The spread says 0.01-0.05%. The reality:

```
Explicit fees:           ~0.1%/year (low)
Funding rate drag:       ~5-15%/year (often overlooked — retail is usually on the crowded side)  
Liquidation risk:        ~10-30%/year for leveraged traders (the big one)
Adverse selection:       ~1-3%/year (spread-level, the only thing academics measure)
Exchange data leakage:   ~2-5%/year (unmeasurable, but reflected in systematic retail underperformance)

TOTAL REAL COST:         ~15-40%/year for a typical leveraged retail trader
```

This is **not** 0.01% per trade. That number is a lie told by tight spreads on a platform where the referee is also a player.

### Enforcement

- **DOJ crypto insider trading = wire fraud** (Chastain 2022, Wahi 2022) — but only for token listings, not for exchange-level data exploitation
- No regulator has jurisdiction over exchange proprietary trading against customers
- CFTC fined Binance $4.3B (2023) — for AML violations, not insider trading
- The structural information advantage of exchanges is **not illegal** because there is no law requiring exchanges to be neutral
- International enforcement: effectively zero. Most volume on offshore platforms

---

## 5. TRADITIONAL FUTURES (CME, ICE, Eurex)

Mature, regulated, but not immune.

### What insiders extract

- **CFTC Commitments of Traders reports** reveal commercial hedger vs. speculator positioning — but with a delay that reduces the information value
- **Agricultural insiders** (farm operators, grain elevator operators, USDA employees) historically traded on crop reports and weather information
- **Energy market insiders** — Enron's manipulation of California electricity markets, BP's propane cornering (2007)
- **No comprehensive study of futures insider returns** comparable to Seyhun (1986) for equities exists
- **Estimated informed trader return: 0.5-2 bps per trade** based on spread decomposition studies applied to futures

### Adverse selection costs

- **Spreads: 0.5-2 ticks** on liquid contracts (ES, NQ, CL). This translates to:
  - E-mini S&P: 0.25 point = ~$12.50 = ~0.005% of notional
  - Crude oil: 1 tick = $10 = ~0.01% of notional
- **Adverse selection component: ~30-50% of spread** (applying Madhavan's equity estimates)
- **Net adverse selection: ~0.002-0.005%** per trade on liquid contracts
- **At 10x leverage:** effective adverse selection becomes ~0.02-0.05% of equity per trade

### How they trade

- **Spoofing and layering:** placing large orders with intent to cancel — Navinder Singh Sarao's role in the 2010 Flash Crash ($40M in spoofed orders)
- **Crop report front-running:** USDA employees trading before official crop reports (historical, now monitored)
- **Spread trading on private information** — commercial hedgers know their own production/consumption, giving them structural information advantage on calendar spreads
- **Co-location and speed advantages** — HFT firms with sub-microsecond latency effectively "see the future" by reacting to order flow before other participants

### Enforcement

- **CFTC actively enforces** against manipulation and spoofing (Dodd-Frank Title VII)
- **Spoofing explicitly criminalized** since 2010 — multiple successful prosecutions (Sarao, JPMorgan precious metals desk)
- **No specific insider trading prohibition** for commodity futures comparable to SEC Rule 10b-5 — the CFTC relies on anti-manipulation provisions
- **Position limits** constrain concentrated informed positions but are easily circumvented via multiple accounts

---

## 6. PREDICTION MARKETS (Polymarket, Kalshi)

See MEGA_REPORT.md for the full 192-paper synthesis. Summary here for comparison.

### What insiders extract

- **Shin z: 2-4% of turnover** from insiders (Shin 1991; Vaughan Williams 1999), though possibly overstated by 2x (Whelan 2024)
- **LMSR worst-case extraction: b × ln(n)** = the maximum all informed traders collectively take from the market maker subsidy (Hanson 2003)
- **Per-trade adverse selection: 1-5%** depending on market depth and information concentration
- **Perfect insider return: 176%/bet.** Partial insider (1/10 advantage): 11%/bet. Professional (StarLizard): 1-3% (Whelan 2024)
- **Favorite-longshot bias gradient:** -5.5% on favorites to -61% on extreme longshots (Snowberg & Wolfers 2010)

### How they trade

- **Bet late** — in the final minutes to prevent counter-adjustment (Ottaviani & Sorensen 2003)
- **Bluff early, correct late** — mislead the market, then exploit (Chen et al. 2010)
- **Target thin markets** — where information edge is largest relative to liquidity
- **Top 1% of accounts = 67% of volume** (Rothschild & Sethi 2016 on Intrade)

### Enforcement

- **No established legal framework** — DOJ and CFTC exploring applicability in 2026
- **Polymarket "Poirot" system** — proprietary pattern recognition (announced, unverified effectiveness)
- **Blockchain transparency** creates theoretical detectability but pseudonymity defeats it in practice

---

## 7. THE CROSS-MARKET COMPARISON

### 7.1 The Two Costs: Per-Trade vs. Annual (They Tell Opposite Stories)

**Per-trade cost (what the spread tells you — the lie):**
```
FX Majors:              ~0.002%    
BTC Perpetuals:         ~0.05%     
ES Futures:             ~0.01%     
Large-cap US Stocks:    ~0.3%      
Equity Options:         ~1-3%      
Prediction Markets:     ~2-5%      
Horse Racing:           ~13-30%    
```

**Annual cost to a real trader (what your account balance tells you — the truth):**
```
ES Futures (no lev):    ~0.5-1%/year       (genuinely cheap, well-regulated)
Large-cap Stocks:       ~1-3%/year         (SEC enforcement compresses it)
FX Majors:              ~0.5-2%/year       (looks cheap per trade, govs take the rest at position level)
Equity Options:         ~5-15%/year        (leverage + event concentration)
Prediction Markets:     ~5-15%/year        (thin markets + concentrated info)
Crypto Perps (lev):     ~15-40%/year       (funding + liquidations + exchange data + MEV)
Horse Racing:           ~30-100%/year      (bookmaker overround eats everything)
```

**The inversion:** FX looks cheapest per trade but is middle-of-pack annually because governments extract at the position level. Crypto looks cheap per trade but is the most expensive annually because the exchange-level extraction (funding, liquidations, data leakage) dwarfs the spread cost.

### 7.2 Insider Edge Per Unit of Information

| Market | Who Extracts | Edge Per Event | Frequency | Annual Extraction |
|--------|-------------|---------------|-----------|-------------------|
| FX | Central banks, dealer desks | SNB unpeg: 30% in minutes. Fix: 5-15 bps/day | Continuous | $10-30B aggregate |
| Stocks | Corporate officers, tippers | 3%/event (Meulbroek). 82 bps/month (opportunistic) | Monthly | ~10% annualized |
| Options | Same insiders, leveraged | 35% over 21 days (Ahern 2017) | Per event | Unlimited per event |
| Crypto Perps | Exchanges, MMs, MEV | Liquidation cascades: 5-20%. Funding: 1-5%/week | Daily | $3-8B (MMs) + $675M (MEV) |
| Futures | Commercials, HFTs | 0.5-5 bps/trade | Thousands/year | Moderate |
| Prediction Markets | People who know outcomes | 10-176%/event (Whelan 2024) | Per event | Depth-limited |

### 7.3 Who Gets Caught (Almost Nobody)

| Market | Annual Prosecutions | Avg Penalty | vs. Estimated Annual Extraction | Enforcement as % of Extraction |
|--------|-------------------|------------|-------------------------------|-------------------------------|
| US Stocks | 40-60 SEC cases | $2-50M/case | ~$50B (all informed trading) | <0.5% |
| Options | 10-20 cases | Higher per case | Subset of equity | <1% |
| FX | 0-2 | $1-2B per scandal (rare) | $10-30B | <1% in normal years |
| Futures | 5-15 CFTC cases | $1-100M/case | ~$5B | ~1% |
| Crypto | 2-5 DOJ cases | $10-50M | ~$5-10B | <0.5% |
| Prediction Markets | 0 | N/A | ~$50-200M | 0% |

**The enforcement illusion:** Even in the most regulated market (US equities), enforcement captures less than 0.5% of estimated insider extraction. The SEC catches 50 cases a year in a market where Augustin et al. estimate 25% of M&A announcements are preceded by illegal insider trading. The deterrent effect is real (Paper #52) but modest. In every other market, it's negligible to nonexistent.

### 7.4 Information Structure: Who Knows What, and Can You Know They Know?

| Market | Information Type | Who Has It | Concentration | Edge Duration | Can You Detect It? |
|--------|-----------------|-----------|---------------|---------------|--------------------|
| **Stocks** | Corporate fundamentals | Officers, board, lawyers, bankers | 10-50 per event | Days to months | Sometimes (unusual volume, 13D filings) |
| **Options** | Same + vol surface shape | Same + vol desks, flow traders | 10-50 per event | Hours to days | Yes (options volume spikes are obvious) |
| **FX** | **Monetary policy, fiscal policy, intervention plans** | **Central bankers, treasury officials, SWF managers** | **5-20 per country** | **Hours to years** | **No. The insider IS the market maker.** |
| **Futures** | Supply/demand, crop data, energy reserves | Commercial hedgers, USDA, OPEC | Thousands | Hours to days | Somewhat (COT reports, delayed) |
| **Crypto** | **Exchange data, protocol changes, token unlocks, mempool** | **Exchange operators, validators, token teams, MMs** | **5-50 per platform** | **Milliseconds to weeks** | **Partially (on-chain), but pseudonymous** |
| **Prediction** | **Event outcomes — binary, certain** | **1-20 people who know what happened** | **Maximum concentration** | **Minutes to days** | **No (thin markets, pseudonymous)** |

### 7.5 The Real Ranking (honest version)

Not "which market has the lowest spread." Instead: **which market transfers the most wealth from uninformed to informed, as a percentage of uninformed capital per year?**

```
1. Crypto Perps (leveraged):     15-40%/year   — the exchange sees everything, you see the spread
2. Horse Racing / Sports:        30-100%/year   — the vig is explicit, the insider edge is on top
3. Equity Options (active):      5-15%/year     — leverage × concentrated events × informed flow
4. Prediction Markets:           5-15%/year     — concentrated info, no enforcement, thin markets
5. FX (with carry/directional):  2-10%/year     — governments extract at position level, invisible in spreads
6. US Stocks:                    1-3%/year      — most studied, most enforced, still bleeds
7. ES/NQ Futures (no leverage):  0.5-1%/year    — deep, regulated, HFTs take basis points not percent
```

**The corrected insight:** Crypto perps are the most expensive market for retail, not the cheapest. The spread is a misdirection. The extraction lives in funding rates, liquidation cascades, and exchange data asymmetry — costs that compound silently over weeks, invisible until your account is gone. FX is similarly deceptive: the spread says 0.002%, but governments with infinite balance sheets and perfect policy foreknowledge extract at the position level over months. 

Prediction markets are honestly expensive. The spread tells you the truth — 2-5% per trade, take it or leave it. There's a certain dignity in a market that doesn't pretend to be cheap before it takes your money.

---

## 8. WHAT THIS MEANS FOR A TRADER

### If you trade with no edge:

| Market | 100 Trades at 5% Sizing | Capital Lost | Verdict |
|--------|------------------------|-------------|---------|
| FX (no leverage) | 0.2% | Negligible | Cheapest place to be wrong |
| BTC perps (no leverage) | 5% | Minimal | Low friction |
| BTC perps (10x) | 50% | Ruin | Leverage is the real insider |
| US large-cap stocks | 30% | Painful | Death by a thousand spreads |
| Single-name options | 100-300% | Ruin in <50 trades | Options eat noise traders alive |
| Prediction markets | 15-30% | Significant | Survivable if you're selective |
| Horse racing | 1300-3000% | Instant ruin | The house always wins |

### If you trade with genuine edge:

| Market | Your Edge | Expected Return Per Trade | Barrier to Entry |
|--------|----------|--------------------------|-----------------|
| FX | Central bank policy intel | 1-3 bps (tiny but scalable) | Need to work at a bank/fund |
| Stocks | MNPI from corporate access | 3%/event (Meulbroek 1992) | SEC prosecution risk |
| Options | Same info, leveraged | 10-50%/event | Higher SEC scrutiny |
| Crypto | Exchange/protocol access | 0.1-2%/block (MEV) | Need technical infrastructure |
| Prediction markets | Know the outcome | 10-176%/event | No prosecution (yet) |

The asymmetry is stark. Prediction markets are simultaneously the worst market for uninformed traders (highest per-trade cost) and the best market for informed traders (highest return, zero enforcement). This is not a coincidence. It's the equilibrium that emerges when information is concentrated and regulation is absent.

---

## 9. THE SINGLE CHART

```
Per-Trade Adverse Selection Cost (log scale)

    10%  ─────────────────────────────── Horse Racing
     5%  ─────────────────── Prediction Markets (thin)
     3%  ──────────── Prediction Markets (liquid)
     1%  ──── Single-Name Options
   0.3%  ─── US Stocks (small cap)
   0.1%  ── Alt Crypto Perps
  0.05%  ── US Stocks (large cap) / Futures
  0.01%  ─ BTC Perps
 0.002%  FX Majors

← Less adverse selection              More adverse selection →
← More participants, more enforcement  Fewer participants, no enforcement →
```

The gradient is not random. It follows two variables: **number of participants** (more = cheaper) and **enforcement intensity** (more = cheaper). Every other variable — market structure, technology, asset class — is downstream of these two.

---

*Sources: 200 insider trading papers (papers.md), 192 prediction market papers, 130 cross-cited microstructure papers. All PDFs in ./pdfs/.*
