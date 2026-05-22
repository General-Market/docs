# Phase 5a — Plan détaillé

Three main ideas. Each is a chapter. The shape maps the title's contradiction onto a three-act structure: the wrong question — the right question — the answer.

Target length: **20–22 minutes**, ≈ 3,000–3,300 spoken words, ≈ 35–40 paragraphs. Below that line, the body loses room for the six mechanisms to land. Above that line, the close gets crowded out by the diagnosis.

Each *basic idea* is one paragraph. Each paragraph has a rhythm tag — *slow* (explanation), *fast* (action), *silent* (emotion). Rhythm tags carry forward into the edit; the editor uses them to set the cut pace and the music's behaviour.

---

## Chapter 1 — The wrong question (≈ 5 min, 8 paragraphs)

The viewer sees themselves before they see the thesis. The cold open is testimony, not argument.

### 1.1 The cold open — one operator's voice

- **P1.** Open on the quote, read in full, no introduction. *"Dry run went great. 72.7% win rate, $1k to $1.96k in four days. Then I turned it live."* *(silent → slow)*
- **P2.** The numbers, said again. The win rate. The four days. The dollar amount. *(slow)*
- **P3.** Then live. The arrow turned. *(fast)*

### 1.2 The universality — this is not one operator

- **P4.** Four more voices from the targeting list, each saying the same thing in different words. The shape is identical. *(fast)*

### 1.3 The folk explanations

- **P5.** The first explanation everyone reaches for: overfit. The strategy was tuned too closely to past data. *(slow)*
- **P6.** The second: regime shift. The market changed. The third: slippage. The fills were worse than expected. *(slow)*

### 1.4 What the folk explanations share

- **P7.** All three diagnoses put the cause *inside* the strategy. The fix, in all three, is to write a better strategy. *(slow)*

### 1.5 The thesis sentence

- **P8.** A different framing, in one quoted line: *"Backtests don't fail in live. They just stop being protected by the assumptions you didn't model."* *(silent → slow)* — the chapter lands here.

---

## Chapter 2 — The right question (≈ 13 min, 24 paragraphs)

The venue was the assumption that wasn't modelled. Six mechanisms. Six receipts. One stack of basis points at the end.

### 2.1 The frame

- **P9.** A backtest models price, volume, time. It does not model who else is at the table. *(slow)*
- **P10.** The venue is a participant. *(slow)* — beat of silence after.

### 2.2 Mechanism 1 — PFOF (the universal one, opens the body)

- **P11.** When you place a market order at Robinhood, the order does not go to an exchange. *(slow)* — setup.
- **P12.** It is sold to a wholesaler. Citadel pays Robinhood over a billion dollars a year for the privilege. *(slow)* — receipt.
- **P13.** The wholesaler fills the order at a price marked up from the market — Schwarz et al. in the Journal of Finance measured seven to forty-six basis points round-trip. *(slow)* — the number.
- **P14.** Your backtest measured the market. Your trade was filled by the wholesaler. *(fast)* — landing.

### 2.3 Mechanism 2 — The internal book (the emotional turn)

- **P15.** At eToro, seventy-six percent of retail CFD accounts lose money. This is not an estimate. It is their own regulatory disclosure, at the bottom of every page. *(slow)* — receipt.
- **P16.** The reason it can be that high: the broker is the counterparty. Your loss is their profit-and-loss statement. *(slow)* — diagnosis.
- **P17.** The Kalshi class action of November 2025 named this directly — a wholly-owned market-maker affiliate trading against the platform's retail. *(slow)* — second receipt.

### 2.4 Mechanism 3 — VIP fee tiers (the systemic asymmetry)

- **P18.** Binance VIP 0 — the retail tier — pays ten basis points taker. Binance VIP 9 pays two-point-three. *(slow)* — receipt.
- **P19.** Your backtest used one fee number. The market is two fee numbers, and you used the wrong one. *(fast)* — landing.

### 2.5 Mechanism 4 — Order-flow visibility (the visceral image)

- **P20.** On Hyperliquid, every position is public. Coinglass, HyperStats, HyperTracker — three dashboards that publish your liquidation price the moment you open the trade. *(slow)*
- **P21.** The bots show up before you do. *(fast)*

### 2.6 Mechanism 5 — MEV / sandwich (the visceral and technical)

- **P22.** Helius measured one-point-five-five million sandwich transactions on Solana in thirty days. An 88.9 percent success rate. Sixteen of the top twenty sandwiched tokens lived on pump.fun. *(slow)* — receipt.
- **P23.** A sandwich works like this — a bot sees your transaction before it confirms, places a buy in front of it, sells right after. Peak four hundred basis points per round-trip. *(slow)* — mechanism.
- **P24.** Your backtest assumed the price. The price was a parameter the network rewrote between when you read it and when your trade landed. *(fast)*

### 2.7 Mechanism 6 — Listing front-running (the human story)

- **P25.** At Coinbase, a product manager named Ishan Wahi tipped his brother and a family friend about twenty-five unannounced token listings. Fourteen tips over ten months. *(slow)*
- **P26.** Two of three defendants went to federal prison. *(slow)*
- **P27.** The third fled. *(silent)* — single sentence, single paragraph, the beat the viewer holds.
- **P28.** At Binance, on December seventh of twenty-twenty-four, an employee posted the official Futures account's announcement of a new memecoin sixty seconds after the token was first created on-chain. *(slow)*
- **P29.** A 2022 study from the University of Technology Sydney measured run-up patterns on ten to twenty-five percent of Coinbase listings — patterns statisticians could not explain politely. *(slow)*

### 2.8 The stack — the number that anchors the chapter

- **P30.** A retail trader at a major venue, routed through PFOF, on a venue with an internal book, paying retail fees, on a transparent book — *(slow)*
- **P31.** Pays seventeen basis points to PFOF, fifteen to the internal book, eleven to the fee gap, two to order-flow visibility. Before slippage. Before commissions. Before MEV. Forty-five basis points per round-trip. *(slow)* — the number lands.
- **P32.** A strategy that earned fifty basis points per trade in backtest is breaking even live. A strategy that earned thirty is dead before the operator notices. *(fast)*

### 2.9 The dead-market bridge

- **P33.** None of this is an accident. Each mechanism was reinvested into more mechanisms. The market is the sum of those reinvestments, compounded. *(slow)* — the one-sentence honouring of the dead-market thesis, no longer the spine.

---

## Chapter 3 — The answer (≈ 4 min, 7 paragraphs)

The viewer has been shown what is wrong. The chapter answers a question they did not know they had: *what would a venue without these mechanisms look like?*

### 3.1 The shape of a venue that can't cheat

- **P34.** A different design exists. The venue cannot see your hand. The house cannot take from you. *(slow)*
- **P35.** Three properties make this true — sealed bets, parimutuel pools, oracle consensus signed by BLS aggregation. *(slow)*

### 3.2 What each mechanism becomes

- **P36.** No order book to peek at. No mempool to sandwich. No wholesaler to sell to. No internal book to internalise against. No VIP tier to subsidise. No listing pipeline to leak. *(fast)* — the anaphoric sequence the skill requires.
- **P37.** The thirteen mechanisms catalogued on the page reduce to zero. *(slow)*

### 3.3 The closing image

- **P38.** Imagine running the backtest. Then running it live. The two numbers match. *(silent)*
- **P39.** The strategy was right all along. *(slow)*
- **P40.** The venue was the lie. *(slow)* — the title sentence lands here, in the script, exactly once, near the end.

---

## Things cut from the plan (so they don't sneak back in during the script)

- The full thirteen mechanisms. Six is enough; seven was the seventh I removed (colocation latency edge — 0.5 bps, the smallest, and the most explained-already by mechanism 4).
- The full eleven venues as a tour. The named venues are Robinhood, Coinbase, Binance, eToro, Kalshi, Hyperliquid, Solana/pump.fun. Bybit, Deribit, Polymarket, IBKR are referenced only if the script needs a second receipt for a mechanism and the on-screen receipt didn't fit.
- The Polymarket insider-trading thread. Strong material, but it belongs to *"who used inside information"*, not *"how does the venue extract from retail"*. Different video.
- The full anti-cheat product walkthrough. Chapter 3 names the three properties and stops. The viewer who wants more clicks through to generalmarket.io.
- The dead-financial-market theory as a chapter. It survives as one sentence (P33), serving as a bridge.

## Rhythm summary

- *Slow:* 22 paragraphs — the diagnosis beats.
- *Fast:* 9 paragraphs — the landings, the consequences, the anaphora.
- *Silent:* 3 paragraphs — the thesis arrival (P8), the fled fugitive (P27), the closing image (P38).

Three silences in twenty minutes is restrained. The skill demands at least one per chapter; we have one in each chapter exactly.

## What the script will do next

5b takes each basic idea and writes it as one paragraph — intro, development, conclusion, transition. The introduction (P1–P3) and conclusion (P38–P40) get written last, when the body's voice is fixed.

## Checkpoint

Does this plan honour the title? Are the six mechanisms the right six, in the right order? Is the cold open the right one? Is the close enough?

If yes, the script begins.
