# Phase 2 — Recherches

The article is the research. Eleven venues with sourced incident cards, thirteen mechanisms with peer-reviewed footnotes, and a targeting list of twenty-two handles whose first-person quotes already say what the opening of angle B needs to say. This file consolidates what serves angle B and notes the only real open question.

## What angle B actually needs

The video has three movements:

1. **The opening (3–4 min):** the universal experience — *you backtested it, it worked, you went live, it died, you blamed yourself*. This is supplied by the **22-handle targeting list**, which is exactly this confession in twenty-two different voices.
2. **The body (12–16 min):** six or seven mechanisms, each tied to a receipt, each ending on *that is why yours died*. This is supplied by the **thirteen mechanisms** and the **eleven venues**.
3. **The close (2–4 min):** anti-cheat as the answer to the question the viewer didn't know to ask. This is supplied by the **hero line** of the page and the standing narrative memory.

The research below maps each on-disk source onto these three movements.

---

## Source 1 — The targeting list (the confession)

`marketing/anticheat-flags-targets.tsv` — twenty-two operators who already wrote the opening of this video on their own timelines, in their own voices. These are the raw quotes for the cold open and the script's *"that is why yours died"* refrain.

**The six most usable, ranked by signal density:**

| Handle | The line |
|---|---|
| @bettersystrader (13.8k) | *"parameter set with best backtest results is exactly the wrong approach"* (channeling Perry Kaufman) — opens the door to *the venue was a hidden parameter*. |
| @m_schouten (560) | *"Backtests don't fail in live. They just stop being protected by the assumptions you didn't model."* — gold. This *is* the thesis of the video in one sentence. ★ |
| @0xQuaza (237) | *"dry run went great. 72.7% WR, $1k → $1.96k in 4 days. Then I turned it live…"* — the most cinematic single quote for the cold open. ★ |
| @kieran__duff (5.3k) | *"In-sample backtests almost always exceed out-of-sample live results"* — the explanation the operator gave themselves; the explanation the video improves on. |
| @DarwinexZero (11.8k) | *"2.5%/mo backtest collapses to 0.8-1.2% live"* — concrete number. Useful as a midstream anchor — *"this is the collapse, in numbers"*. |
| @BettysTrades (402) | *"Killer backtest → real money. One regime shift and it blows up."* — *regime shift* is the wrong explanation. Useful as the explanation the script then dismantles. |

**Notes for the script:**

- Open with @0xQuaza's quote or one like it — the dollar amounts and the timeline are what make it feel real.
- @m_schouten's line is the *thesis sentence*. It earns a beat of silence in the edit.
- @bettersystrader's Kaufman-paraphrase ("the parameter set with best backtest results is exactly the wrong approach") is useful for the bridge from the cold open into the mechanism walk — but the script will rotate the meaning. Operators read it as *overfit warning*. The video reads it as *the parameter you were not modelling was the venue itself*.
- @BettysTrades and most of the targeting list reach for the wrong explanation (overfit, regime shift, walk-forward fail). That mismatch *is* the video's space — *you were given the wrong language for what happened to you*.

★ = gold, single-source, irreplaceable phrasing.

## Source 2 — The thirteen mechanisms (the body's anchors)

`frontend/app/[locale]/(marketing)/anticheat-flags/data-edge-ways.ts` — peakBps × frequency = effective per-round-trip cost, ranked descending. Every entry has a peer-reviewed source.

**The seven that touch the largest share of retail (the candidate body for the script):**

| # | Mechanism | Effective bps | The receipt to pair |
|---|---|---:|---|
| 1 | **Jito-bundle MEV (Solana)** | 60 bps | Helius report: 1.55M sandwich txs in 30 days, 88.9% success rate, 16 of top 20 sandwiched tokens on pump.fun. Pair with the pump.fun TRUMP / Hawk Tuah / Iggy Azalea cards. |
| 2 | **PFOF wholesaler markup** | 17 bps | Schwarz et al. (JF 2025) measured 7–46 bps round-trip across six brokers. Robinhood: $1B+/yr to Citadel. SEC 2020 — $34.1M misled retail. |
| 3 | **Internal book (b-book)** | 15 bps | eToro 76% retail losing disclosure. Kalshi class action 2025-11-28 — wholly-owned MM affiliate trades against retail. |
| 4 | **VIP fee-tier subsidy** | 11 bps | Binance VIP 0 pays 10 bps taker; VIP 9 pays 2.3 bps. The institutional rate the retail trader cannot reach. |
| 5 | **Order-flow visibility** | 2 bps | Hyperliquid's public liquidation map (Coinglass, HyperStats). The chain shows your liquidation price; the bots show up before you do. |
| 6 | **Listing front-running** | 1.6 bps | Coinbase Wahi case — 25 assets, 14 tips, two prison terms, one fugitive. The original BCH listing in 2017. The Binance "Yellow Fruit" 60-second front-run. UTS study: run-ups in 10–25% of Coinbase listings. |
| 7 | **Colocation latency edge** | 0.5 bps | Aquilina–Budish–O'Neill (QJE 2022): the global latency-arbitrage tax at ~0.5 bps of trading volume — about $5B/year on world equities. The Hyperliquid Tokyo–Ashburn 195ms gap is the crypto-native receipt. |

**The math that sells:** if you stack #1 PFOF (17) + #2 b-book (15) + #3 VIP gap (11) + #4 order-flow visibility (2) for a retail PFOF-routed perp trader, you are paying **~45 bps per round-trip** before slippage, before fees, before MEV. That's the cumulative bleed the *Venue Bleed Section* on the page already plots at 100, 1K, and 100K trades.

**Why these seven, not the other six:** the four dropped (#8 maker rebate, #9 oracle peek, #10 colocation in detail, #11 API rate ceiling) are either niche, double-counted with #7, or measured at sub-1-bps levels. The remaining two (#12 last-look, #13 ADL visibility) are interesting but tail events — keep them in reserve for a sidebar, not the main spine.

## Source 3 — The eleven venues (the receipts to anchor each mechanism)

The data files supply enough material for the entire body of the script without ever leaving the page. Two patterns worth naming:

**Pattern A — the venue's *knife* line is often more useful than the summary.** The knife is the line written for screen and ear; the summary is the line written for the legal department. Example (Binance, MOVE token): *"They listed the token, watched the dump, kept the fees, named the culprit three months later."* Twenty-two words, four beats, one image. The script should pull knife lines as direct quotes wherever the receipt is on screen.

**Pattern B — the strongest receipts repeat across mechanisms.** Coinbase Wahi shows up as both *listing front-running* (mechanism 6) and *insider-runup* (a venue-level mechanism class). Binance's Sigma Chain shows up as both *wash-trading* and *b-book mirror*. The script picks each receipt once, anchors it to the strongest mechanism, and lets the others do without.

**The shortlist of receipts the script should reach for first:**

| Venue | Receipt | Mechanism it anchors |
|---|---|---|
| Robinhood | $65M SEC fine, "commission-free" PFOF | PFOF |
| Robinhood | Jan 28 2021 GameStop buy button freeze | b-book / PFOF asymmetry |
| Coinbase | Ishan Wahi, 25 assets, 14 tips, two prison terms, third fugitive | Listing front-running |
| Coinbase | UTS study — run-ups in 10–25% of listings | Listing front-running (the structural version) |
| Binance | "Year of the Yellow Fruit" — employee front-runs official Futures tweet by 60 seconds | Listing front-running (the comedy version) |
| Binance | Sigma Chain — $190M, the yacht, the CZ-owned undisclosed MM | b-book / wash-trading |
| Binance | VIP 0 pays 10 bps taker; VIP 9 pays 2.3 bps | VIP fee-tier subsidy |
| Hyperliquid | Public liquidation map — Coinglass, HyperStats, HyperTracker | Order-flow visibility |
| Hyperliquid | JELLY oracle override by validator vote | Counter-receipt: decentralised was a marketing term |
| Polymarket | Columbia study — 25% of volume is wash trading, 90% in some sports weeks | Wash-trading (the prediction-market version) |
| Polymarket | Khamenei "Magamyman" $87K → $553K in hours before strike | Insider-runup at venue scale |
| Kalshi | Khamenei $54M death-carveout suit | The fine print as edge |
| Kalshi | Class action 2025-11-28 — wholly-owned MM affiliate trades against retail | b-book at a "peer-to-peer" venue |
| eToro | 76% of retail CFD accounts lose money — their own disclosure | b-book at industrial scale |
| IBKR | WTI -$37 negative-oil; engine clamped at $0; $82.57M restitution | Oracle override at the broker level |
| pump.fun | Solidus 98% rug rate; TRUMP $4.3B retail losses / $600M insider take | Listing-dump at velocity |
| pump.fun | $600M lifetime platform fees | The house always wins; here it has a P&L statement |

Seventeen receipts for seven mechanisms — more than enough material. Phase 5 will pick which one gets paired with which.

## Source 4 — The frame (the close)

The hero line on the page: *"The first exchange to publish how rigged this industry is. And the first to fix it."*

The standing narrative memory: *"Trading is easy with an Anti-Cheat."* Sealed bets, parimutuel pools, BLS oracles — three mechanisms that collapse into one consumer-legible promise: *the market can't see your hand and the house can't take it*.

These two lines are the close. The script doesn't have to invent the fix — it has to *introduce* the fix as the answer to a question the viewer has now spent twenty minutes wanting an answer to.

## Open questions (one only)

**Saturation check.** Are there already 4–8 long-form YouTube essays in this exact space — *why retail loses to venues* — and what specifically do they argue, name, and miss? This shapes phase 3 (angle differentiation) and phase 4 (title). It's the one external pass worth doing, but it can wait until we lock the title-draft list. Not blocking phase 3.

## What we did *not* research

- Fresh first-person stories beyond the 22 handles. The cohort is already deep enough for the opening; expanding it adds quotes, not new substance.
- Academic record beyond the page's footnotes. Every mechanism cites a paper; cross-checking each citation is editorial fact-check work for phase 5, not Phase-2 expansion.
- Regulatory filings beyond the SEC/FCA/CFTC/ASIC sources already on cards.
- Reddit threads in r/algotrading, r/quant, r/options. Useful as colour for the script if a specific beat needs it; not a blocker now.

## The shape this points to

Six mechanisms, six receipts, six *"that is why yours died"* beats. The number lands somewhere between B-list of seven and a tighter cut of six — phase 5 makes the final pick. The cold open is one of the targeting-list quotes; the close is the *anti-cheat* hero line and the introduction of the fix.

The page already did most of the reading. The script's job is to turn it into a voice.
