# Who Is Who on Polymarket — What On-Chain Data Can and Cannot Tell You

## The Honest Starting Point

We cannot identify insiders from transactions alone. We can define behavioral signatures that are **consistent with** each type. Consistent-with is not proof. A market maker that looks like an insider might just be a sharp bettor with a good model. An insider that looks like a market maker might be using multiple wallets.

Every classification below is probabilistic, not deterministic.

---

## 1. OBSERVABLE SIGNALS (what the chain gives you)

For each wallet, you can compute:

| Signal | Formula | What It Measures |
|--------|---------|------------------|
| **PnL/Volume** | total_profit / total_volume | Edge per dollar traded |
| **Win Rate** | winning_positions / total_positions | Accuracy |
| **Directional Purity** | \|buys - sells\| / (buys + sells) per market | One-sided = conviction/info. Two-sided = market making |
| **Trades Per Market** | avg(trades) per unique market | 1-3 = directional. 50+ = market making |
| **Timing Ratio** | avg(trade_time - market_open) / (resolution - market_open) | 0.0 = early. 1.0 = last second |
| **Account Age at First Profit** | first_profitable_trade - wallet_creation | New + winning = suspicious |
| **Funding Concentration** | unique_funding_sources / total_deposits | 1 source = fresh wallet |
| **Market Concentration** | herfindahl of PnL across market categories | High = specialist. Low = generalist |
| **Size vs Depth** | avg_position / avg_market_liquidity | >10% = moving the market |
| **Wallet Clustering** | shared funding source across profitable wallets | Sybil detection |

---

## 2. BEHAVIORAL SIGNATURES

### Market-Making Bot

```
PnL/Volume:          2-8%
Win Rate:            50-58%
Directional Purity:  0.0-0.3 (both sides)
Trades Per Market:   50-500+
Timing Ratio:        0.0-1.0 (uniform, always present)
Account Age:         >90 days (persistent infrastructure)
Market Concentration: LOW (trades everything)
Funding:             Continuous recycling, multiple deposits
```

**Why this signature:** MMs earn the spread. They must trade both sides frequently. Their PnL is a thin margin on large volume. They don't care about outcomes — they care about inventory.

**Confidence level:** HIGH. The two-sided + high-frequency + low PnL/Volume combination is hard to fake. If you see 500 trades per market and 3% PnL/Volume, it's a bot.

**From the Polymarket leaderboard:**
- Rank #6 RN1: $2.1M PnL / $68.9M volume = 3.1% → **MM signature**
- Rank #10: $1.5M PnL / $77M volume = 2.0% → **MM signature**

### Sharp Bettor (better model, no MNPI)

```
PnL/Volume:          10-25%
Win Rate:            55-70%
Directional Purity:  0.7-1.0 (one side per market)
Trades Per Market:   1-10
Timing Ratio:        0.1-0.6 (trades early, before info is priced)
Account Age:         >30 days
Market Concentration: MODERATE-HIGH (domain specialist)
Funding:             Gradual scaling over months
```

**Why this signature:** Sharps have a model edge. They enter early when the mispricing is largest. They pick one side. Their win rate is good but not impossible — 60% on coin-flip markets is achievable with a good model. They don't need to hide.

**Confidence level:** MODERATE. Hard to distinguish from a lucky retail trader over small samples. Need 50+ resolved positions to separate skill from variance.

**The Erikson-Wlezien test (PM168):** A poll-literate trader would pick the undervalued candidate 87% of the time on IEM. That's a sharp bettor — public info, better processing. PnL/Volume ~15%. No MNPI.

### Possible Insider (knows or likely knows the outcome)

```
PnL/Volume:          30-50%+
Win Rate:            75-95%
Directional Purity:  1.0 (never trades the other side)
Trades Per Market:   1-3 (in, maybe scale, out)
Timing Ratio:        0.8-1.0 (bets in final 20% of market life)
Account Age:         <30 days at first big win
Market Concentration: VERY HIGH (one sport, one event type)
Funding:             Single deposit, never refunded after cash-out
Size vs Depth:       >5% of market OI in a single position
```

**Why this signature:** Insiders know the answer. They don't need many trades. They don't need to trade early (early trading reveals info). They bet large, late, one-directional. They use fresh wallets because they know this looks suspicious. They cash out and disappear.

**Confidence level:** LOW-MODERATE. This signature is also consistent with:
- A lucky gambler who bet big on one game and won
- A bettor who watched the game live and traded faster than the market priced in events (not insider trading, just speed)
- A professional sports bettor (StarLizard-type) who has a better model than the market

**uzumiru's profile matches:** 80% win rate, $5K → $283K, 8-day old account, concentrated in baseball O/U, PnL/Volume = 46%. Consistent with insider. Also consistent with a professional bettor with a live-game model.

### Order Flow Front-Runner

```
PnL/Volume:          5-15%
Win Rate:            55-65%
Directional Purity:  0.6-0.9 (mostly one side, occasionally flips)
Trades Per Market:   10-50
Timing Ratio:        CLUSTERED (trades happen within seconds of large incoming orders)
Account Age:         >60 days (needs infrastructure time)
Market Concentration: LOW (follows flow, not events)
Trade Size:          Small relative to the incoming order they're front-running
Temporal Pattern:    Trades consistently execute 1-5 seconds before large market orders
```

**Why this signature:** Front-runners see pending orders (either via mempool monitoring or API latency advantage) and trade ahead of them. Their edge is speed, not information. They profit from the price impact of the large order they just front-ran.

**Confidence level:** MODERATE-HIGH if you can observe trade-level timestamps. The temporal clustering (their trade → large order → price move, repeatedly) is hard to produce by chance. But on Polymarket's CLOB, this is harder than on a DEX because there's no mempool to monitor — it requires API-level speed advantages or co-location with the matching engine.

**Key distinguisher from insider:** Front-runners trade MANY markets (wherever flow appears). Insiders trade FEW markets (wherever they have information). If a wallet profits across 50 unrelated markets with consistent small gains, it's flow-based. If it profits on 5 markets with massive gains, it's information-based.

---

## 3. THE CLASSIFICATION PROBLEM (why we can't know for sure)

### Problem 1: Sybils
One person can operate 100 wallets. An insider can:
- Fund 20 wallets from different sources via Tornado Cash or cross-chain bridges
- Spread bets across wallets to keep each below detection thresholds
- Use different timing patterns per wallet
- Cash out through different routes

On-chain clustering can detect shared funding sources, but sophisticated actors break the chain.

### Problem 2: Boundary Between Sharp and Insider
When does "I read the local newspaper and know the mayor will resign" become "insider trading"? When does "I have a statistically superior model" become "unfair advantage"?

The Polymarket terms of service don't define it. US law doesn't clearly apply to prediction markets (as of 2026). The line is philosophical, not technical.

### Problem 3: Live-Game Information
In sports markets that remain open during the game, someone watching on TV can trade faster than the market updates. Is that an insider? It's public information — but the speed of access creates asymmetry. This looks identical to insider trading on-chain (high win rate, late timing, one-directional) but isn't.

### Problem 4: The Base Rate
If 668 wallets captured 71% of profits, and we estimate 50-100 are "insiders," we're saying 7-15% of the top tier is insider-driven. But the base rate of insiders in the total population of 2.5M is ~0.002-0.004%. Any classifier with even 1% false positive rate would flag 25,000 wallets — 250x more than the true count.

---

## 4. WHAT WOULD ACTUALLY WORK

### 4.1 Cross-Reference With Event Participants
The only true detection: match wallet activity with people who had access to the information.
- Government decision → who was in the room?
- Sports outcome → who had injury/lineup information?
- Corporate event → who was on the deal team?

This requires off-chain data that no on-chain system can provide. The DOJ does this — it's how they caught the Coinbase and Polymarket cases. It requires subpoenas, not algorithms.

### 4.2 Statistical Anomaly Detection (what you CAN build)
Flag accounts for human review, don't auto-classify:

```python
# Pseudo-code for anomaly scoring
def insider_score(wallet):
    score = 0
    
    if pnl_volume_ratio > 0.30:          score += 3   # high extraction
    if win_rate > 0.75 and n_trades > 5: score += 3   # statistically improbable
    if account_age_days < 30:            score += 2   # fresh wallet
    if directional_purity > 0.95:        score += 1   # never hedges
    if timing_ratio > 0.80:             score += 2   # trades late
    if market_concentration > 0.80:      score += 1   # one domain
    if single_funding_source:            score += 1   # no history
    if position_pct_of_oi > 0.05:        score += 1   # large relative to market
    
    # Sybil bonus
    if shares_funding_with_other_winners: score += 3
    
    return score  # 0-17 scale
    
# Thresholds:
# 0-4:   Normal (retail, MM, sharp)
# 5-8:   Review (could be sharp or insider)
# 9-12:  High suspicion (consistent with insider)
# 13+:   Almost certainly informed or sybil ring
```

### 4.3 The Market-Level Signal
Instead of classifying individual wallets, classify MARKETS:

A market with insider activity should show:
- Late-stage volume spike (last 20% of market life has >50% of volume)
- Directional imbalance (one side accumulating rapidly)
- MM withdrawal (spreads widen as MMs detect toxic flow)
- Price discovery compression (price moves to 90¢+ or 10¢ before resolution)
- Concentration of winning positions in <5 wallets

This is easier than classifying wallets because you're measuring the aggregate effect, not individual intent.

---

## 5. THE ANSWER TO "HOW CAN I KNOW?"

You can't know with certainty from on-chain data alone. You can:

1. **Rank by anomaly score** — flag the statistically improbable winners
2. **Cluster by funding source** — detect sybil rings
3. **Measure market-level toxicity** — identify which markets attracted insiders
4. **Cross-reference timing** — late + large + one-directional + new account = consistent with insider
5. **Accept the uncertainty** — a 75% win rate over 10 trades could be luck, skill, or information. Over 100 trades, luck drops out. Over 1000 trades, skill and information remain.

The honest version of the leaderboard decomposition:

```
Top 668 wallets ($3.7B, 71% of profits):

  DEFINITELY market makers:     ~200-300    (identifiable by two-sided + high frequency)
  DEFINITELY NOT retail luck:   ~668        (the math excludes chance at this profit level)
  POSSIBLY insider:             ~50-150     (consistent with insider signals)
  PROVABLY insider:             ~5-10       (only the ones DOJ/CFTC has investigated)
  
  THE REST:                     Unknowable from chain data alone.
```

That is the honest answer. Everything else is storytelling.
