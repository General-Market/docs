# Where to hedge the CRX FX book — venue survey + execution quality

**Last verified:** 2026-06-13 (Saturday, ~16:50 UTC). Pair lists, leverage, OI caps, fee models, and market hours are read live from each venue's API / on-chain contracts. **Spreads and current open interest are a weekend snapshot — spot FX was closed, so books are thin and wide; the structural numbers (caps, fees, funding model, hours) are valid, but re-pull spreads during London/NY hours before sizing a trade.**

---

## TL;DR

- **Best on-chain venue for the EM book: Avantis (Base).** 17 live forex pairs read straight from its on-chain `PairStorage`. The only on-chain venue listing **INR, BRL, IDR, TWD** at all, plus **MXN, CNH, TRY, ZAR** live. But EM per-pair OI caps are tiny: **$187k–$468k** each. Fine for small hedges, not institutional size.
- **Best execution on EUR/USD and majors: Extended and Hyperliquid (trade.xyz).** Both run ~0.86 bps spreads and ~$10M open interest on EUR/USD — tighter and deeper than anywhere else in crypto. But they are **majors-only** (EUR, JPY, +GBP on Hyperliquid). No EM.
- **Hyperliquid: EUR, GBP, JPY only — but tradeable directly in the app.** FX is HIP-3 builder-deployed (trade.xyz, dex `xyz`) and surfaces in the normal Hyperliquid UI with the same wallet and USDC margin — so "directly on Hyperliquid" is fair; the core team just doesn't operate the FX book. EUR is genuinely deep ($10.2M OI). **No EM, no CNH** — confirmed across all 8 builder dexes; KRW/NOK/DXY are delisted.
- **The crypto CEXes are mostly a dead end.** Binance, Bybit, OKX, Coinbase, KuCoin, Deribit have **no fiat FX**. **MEXC** is the one genuinely liquid CEX FX venue (6 majors, sub-1–7 bps, 100x). **Kraken's** 5 FX perps are a ghost town (only EUR/USD quotes). **Bitget** and **Gate** are CFDs — real FX down to TRY/ZAR/CNH/MXN but API-gated, no public per-pair data.
- **Four currencies trade nowhere in crypto: PHP, COP, PEN, CLP.** TradFi NDF only. PEN is the hardest — bank OTC, no CME contract.
- **Funding is cheap and flat right now.** On-chain borrowing/funding sits at floors (5% APR on Avantis, ~0 on the order-book venues over the weekend). The binding constraint is **depth, not carry**.

**Therefore:** for convertible EM (MXN, ZAR, TRY, CNH) you have real choice — Avantis, gTrade, Bitget, Gate, CME, brokers. For non-convertible EM (INR, BRL, IDR, TWD, KRW) Avantis + Lighter are the only on-chain options and they are *thin*; deep size needs CME cash-settled futures or bank NDFs. For PHP, COP, PEN, CLP there is no crypto venue at all.

---

## Execution leaderboard — where to actually trade each pair

Best venue by **depth × spread**, weekday-normalized judgement (weekend spreads inflated). "Cap" = max OI a single pair can hold.

| Pair | Best execution venue | Spread (snapshot) | Depth / OI cap | Funding | Backup |
|---|---|---|---|---|---|
| **EUR/USD** | Extended ≈ Hyperliquid | 0.87 / 0.86 bps | $10.6M / $10.2M OI | +3.5% / ~0 | Ostium ($50M cap), gTrade ($3.5M) |
| **USD/JPY** | Hyperliquid (tightest) | 0.63 bps | ~$73k OI | ~0 | Ostium ($40M cap), Avantis ($9.4M cap), MEXC |
| **GBP/USD** | Ostium (biggest cap) | weekend-wide | $30M cap | rollover only | gTrade ($2.9M), Avantis ($6.6M), MEXC |
| **USD/CHF, USD/CAD, AUD, NZD** | Ostium / MEXC / Avantis | 1.6–7 bps (MEXC) | $20–30M cap (Ostium) | small | Lighter, Vest |
| **NOK** | Vest (only real listing) | 25 bps | ~$6M OI | +5% | gTrade EUR/NOK disabled; CME, brokers |
| **SEK** | Avantis / gTrade | 0.2% / 0.015% | $0.94M / $0.9M cap | 5% | Gate, CME, brokers |
| **CNH** | gTrade ≈ Avantis | 0.015% / 0.5% | $1.0M / $0.94M cap | low / 5% | Flash Trade, Bitget, Gate, MEXC(no), CME |
| **ZAR** | gTrade ≈ Avantis | 0.05% / 0.5% | $0.6M / $0.47M cap | 22%@max / 5% | Bitget, Gate, CME, brokers |
| **TRY** | Avantis | 0.5% | $0.47M cap (long full) | **12% long / 5% short** | Bitget, Gate, CME, brokers |
| **MXN** | Avantis (best) | 0.5% | $0.47M cap | 5% | Ostium ($0.25M, ~dead), Gate, CME |
| **INR** | **Avantis (only on-chain)** | 0.5% | **$187k cap** | 5% | CME cash-settled, Saxo/IG NDF |
| **BRL** | **Avantis (only on-chain)** | 0.5% | $468k cap | 5% | CME cash-settled, Saxo/IG NDF |
| **IDR** | **Avantis (only on-chain)** | 0.5% | $468k cap | 5% | CME cash-settled, IG NDF (voice) |
| **TWD** | **Avantis (only on-chain)** | 1.0% | **$187k cap** | 5% | bank NDF (no CME future) |
| **KRW** | **Lighter (only trading)** | weekend-wide | ~$1.3k OI (thin) | 0 | CME cash-settled, Saxo/IG NDF |
| **PHP, COP, PEN, CLP** | **none in crypto** | — | — | — | NDF (banks); CME for CLP/COP/PHP cleared NDF |

The shape of it: **majors execute beautifully on-chain** (Extended/Hyperliquid/Ostium), **EM is Avantis-or-TradFi** with sub-$500k on-chain depth, and **four currencies have no crypto home at all**.

---

## US access via API — the gating filter

**A venue you can't legally touch from the US is not a hedge.** The answer splits entirely on the hedging entity. None of the crypto venues — on-chain or CEX — is legally usable for FX from the US. The real US path is CME futures via an FCM plus bank NDFs via institutional FIX APIs.

| Hedging entity | Reachable via API | Off-limits |
|---|---|---|
| **US retail** (<$10M) | OANDA / FOREX.com (v20 REST: majors + convertible EM MXN/ZAR/TRY/CNH, ~50:1 cap) · **CME futures via FCM** (incl. cash-settled INR/BRL/KRW/CLP/COP/IDR) | **All NDFs**, all offshore crypto, leveraged FX at IBKR, non-convertible spot |
| **US institutional / ECP** (>$10M) | **CME futures via FCM** (CQG/Rithmic/TT/IBKR FIX) · **bank NDFs** (360T / FXall / Bloomberg FXGO / single-dealer FIX) | Offshore crypto DEXes + CEXes (ToS + CFTC) |
| **Offshore entity** | Every crypto venue (Avantis/Hyperliquid SDKs, gTrade/Ostium/Lighter APIs, MEXC/Bitget/Gate) **+** all TradFi channels | Jurisdiction-specific (most also ban UK/Canada) |

### On-chain DEXes — permissionless ≠ permitted

All eight prohibit US persons in their ToS. The smart contracts are callable from any wallet + RPC with no KYC, and every venue's **data API answered from a US IP**. But the ToS ban is a legal wall, not a technical one: a US person routing around the geofence removes the *operator's* defense while keeping their own CFTC exposure. No enforcement has hit these protocols yet, but CME/ICE are lobbying the CFTC over Hyperliquid and the FCA has warned on it. The clean US route for perp exposure is a CFTC-regulated venue, not a geofenced DEX behind a VPN.

| Venue | US in ToS? | VPN ban | Frontend from US | Data API from US | Trading |
|---|---|---|---|---|---|
| Avantis | Prohibited (Reg S) | No clause | Loads | 200 | Wallet + SDK, no KYC |
| gTrade | Prohibited | **Yes** | Perps load | 200 | Wallet + backend, no KYC |
| Ostium | Prohibited ("no exceptions") | **Yes** | **Redirect/blocked** | — | Wallet, no KYC |
| Hyperliquid | Prohibited (§1.5) | implied | **Geofenced** | 200 | SDK, wallet-signed, no KYC |
| Lighter | Prohibited | No clause | Soft gate (JS) | 200 | API + wallet, no KYC |
| Extended | Prohibited | **Yes** | **403** | 200 | API keys + KYT, wallet |
| Pacifica | Prohibited | — | Soft gate | 200 (live data) | API + wallet, no KYC |
| Flash Trade | Prohibited | **Yes** | Redirect | 200 | Open-source program, wallet |
| Vest | **ToS not locatable** — treat as unverified, not permitted | — | Loads | host down | API + wallet |

### Crypto CEXes — zero legal US FX

No crypto CEX lets a US person trade FX via API legally — every FX product is on an offshore entity that bans US.

- **MEXC, Bitget, Gate** — ban US entirely (KYC fails + IP block).
- **Kraken** — spot serves US, but FX perps live on the **offshore** Kraken Derivatives platform; Kraken Derivatives US is crypto futures only.
- **Coinbase** — US CFTC perps are BTC/ETH only; the only FX-like product (EURC perp) is on Coinbase International (Bermuda), US barred.

### US-regulated TradFi — the actual answer

| Venue | US retail | US ECP | EM covered | API | NDF? |
|---|---|---|---|---|---|
| **CME FX futures** (via FCM) | Yes (no ECP gate) | Yes | MXN, ZAR, CNH, TRY (deliv.) + BRL, INR, KRW, CLP, COP, IDR (cash). **No PHP/TWD/PEN** | CQG, Rithmic, TT, IBKR; iLink/FIX | Futures (cash-settled = NDF-equivalent, but exchange-listed) |
| **Interactive Brokers** | Spot **unleveraged** only (<$10M) | Leveraged FX = ECP-only (since 2016) | ~27 ccys incl. MXN, BRL, CNH, KRW, TWD, TRY, ZAR. No onshore INR | TWS API, Client Portal, FIX | No OTC NDF to retail |
| **OANDA (US)** | Yes (NFA) | retail entity | ~68 pairs: MXN, ZAR, TRY, CNH, PLN, HUF, CZK (convertible only) | v20 REST + streaming | No |
| **FOREX.com / StoneX** | Yes (NFA) | StoneX institutional arm | ~80 pairs incl. exotics | REST (retail), FIX (institutional) | No (retail) |
| **Institutional NDF** (360T, FXall, Bloomberg FXGO, bank SDPs) | **Barred** | **Yes — the EM channel** | Full non-deliverable set: INR, KRW, BRL, IDR, **PHP, TWD, COP, CLP, PEN**, CNY-NDF | FIX, REST, EMS/OMS; bank single-dealer FIX | **Yes** (ISDA, on/off SEF) |
| **Coinbase Derivatives** | Crypto only | Crypto only | None | API | No FX |

**Per-currency US-institutional API path:** MXN/ZAR/TRY/CNH → CME deliverable future or IBKR/OANDA spot. INR/BRL/KRW/IDR/CLP/COP → CME cash-settled future via FCM, *or* bank NDF. **PHP/TWD/PEN → bank NDF only** (no CME future). Two tools cover everything: an FCM account + an ISDA/bank NDF FIX channel.

**What US retail simply cannot do:** OTC NDFs (so PEN/PHP/TWD as forwards are out entirely), leveraged FX at IBKR, offshore crypto perps, non-convertible spot. Retail's one EM path is **CME cash-settled futures via an FCM** — the only place retail and institutional overlap.

**Therefore:** if CRX hedges through an **offshore** entity, the Avantis EM book and the rest of the crypto venues are on the table (subject to depth). If it hedges through a **US** entity, crypto FX is off the table and the answer is **CME-futures-via-FCM for the listed currencies + bank-NDF-via-FIX for PHP/TWD/PEN and deep EM size**.

---

## Coverage matrix — 23 CRX currencies × venues

Legend: **●** live & tradeable · **◐** listed but inactive / dormant / provisioned-not-listed · blank = absent. *(Hyperliquid and MEXC columns corrected against live API — Hyperliquid is EUR/JPY/GBP only; MEXC has no CNH.)*

| Currency | Avantis | gTrade | Ostium | Hyper­liquid | Lighter | Extended | Bitget | Gate | Kraken | MEXC | CME fut. | FX broker |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| USD (quote) | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| EUR | ● | ● | ● | ● | ● | ● | ● | ● | ●◐ | ● | ● | ● |
| JPY | ● | ● | ● | ● | ● | ● | ● | ● | ◐ | ● | ● | ● |
| GBP | ● | ● | ● | ● | ● | | ● | ● | ◐ | ● | ● | ● |
| CHF | ● | ◐ | ● | | ● | | ● | ● | ◐ | ● | ● | ● |
| CAD | ● | ● | ● | | ● | | ● | ● | | ● | ● | ● |
| AUD | ● | ◐ | ● | | ● | | ● | ● | ◐ | ● | ● | ● |
| NZD | ● | ◐ | ● | | ● | | | ● | | | ● | ● |
| NOK | | ◐ | | | | | | ● | | | ● | ● |
| SEK | ● | ● | | | | | | ● | | | ● | ● |
| **INR** | **●** | ◐ | | | | | | | | | ● (cash) | NDF |
| **BRL** | **●** | ◐ | | | | | | | | | ● (cash) | NDF |
| **MXN** | **●** | ◐ | ◐² | | | | | ● | | | ● (phys) | ● spot |
| **CNH** | **●** | **●** | | | | | ● | ● | | | ● | ● spot |
| **KRW** | ◐³ | ◐ | ◐⁴ | | **●** | | | | | | ● (cash) | NDF |
| **IDR** | **●** | | | | | | | | | | ● (cash) | NDF |
| **PHP** | | | | | | | | | | | (NDF only) | NDF |
| **TWD** | **●** | ◐ | | | | | | | | | | NDF |
| **TRY** | **●** | | | | | | ● | ● | | | ● | ● spot |
| **ZAR** | **●** | **●** | | | | | ● | ● | | | ● (phys) | ● spot |
| **COP** | | | | | | | | | | | (NDF only) | NDF |
| **PEN** | | | | | | | | | | | | NDF (bank) |
| **CLP** | | | | | | | | | | | ● (cash) | NDF |

² Ostium USD/MXN is live but trades ~$8/24h and caps at $0.25M — nominal, not a real market.
³ Avantis USD/KRW is provisioned on-chain (index 68) but `isPairListed:false`, no feed — not tradeable.
⁴ Ostium USD/KRW is configured (pair 53) but has zero OI cap, no oracle feed, zero open trades — listed-not-trading, confirmed three ways.

**The orphans:** PHP, COP, PEN, CLP appear in zero crypto venues. PEN is the hardest of all — no CME contract, bank OTC NDF only.

---

## Per-pair venue comparison — side by side

Every venue that lists a pair, on the four dimensions that decide a hedge: **spread**, **liquidity** (live OI, or the per-pair OI cap — the ceiling on size), **funding** (annualized; **+ = longs pay shorts**), and **market hours**. Spreads are the 2026-06-13 weekend snapshot (wide — re-pull on a weekday); caps, funding model, and hours are structural and valid. "Wknd-closed" = follows FX sessions; "24/7" = synthetic, trades through the weekend (oracle may freeze to Friday's close).

### EUR/USD

| Venue | Spread | Liquidity | Funding (APR) | Hours | Lev |
|---|---|---|---|---|---|
| Extended | 0.87 bps | $10.6M OI | +3.5% | 24/7 | 100x |
| Hyperliquid (xyz) | 0.86 bps | $10.2M OI | ~0% | 24/7 (oracle frozen wknd) | 50x |
| Ostium | 3 bps fee | **$50M cap** | 0.99% rollover | Wknd-closed | 200x |
| Avantis | 0% | $6.55M cap | 5% | Wknd-closed | 100x |
| gTrade | 0.01% | $3.5M cap | ~0 (balanced) | Wknd-closed | 1000x |
| Lighter | 4.75 bps | $3.5M OI | 0% | 24/7 | 50x |
| Vest | 4 bps | $1.0M OI | +5% | 24/7 | 100x |
| Pacifica | 4.3 bps | $481k OI | +11% | 24/7 | 50x |
| MEXC (CEX) | 0.86 bps | very deep | +13.1% | 24/7 | 100x |
| Kraken (CEX) | 0.086 bps | ~$0 (1-deep, dead) | ~0 | 24/7 | 50x |

### USD/JPY

| Venue | Spread | Liquidity | Funding | Hours | Lev |
|---|---|---|---|---|---|
| Hyperliquid | 0.63 bps | ~$73k OI | ~0% | 24/7 (frozen wknd) | 50x |
| Ostium | 3 bps | **$40M cap** | 0.85% | Wknd-closed | 200x |
| Avantis | 0% | $9.36M cap | 5% | Wknd-closed | 50x |
| gTrade | 0.01% | $3.0M cap | ~0 | Wknd-closed | 1000x |
| Vest | 3.2 bps | $0.21M OI | +5% | 24/7 | 100x |
| Extended | 12 bps | $182k OI | +3.5% | 24/7 | 25x |
| MEXC | 16 bps* | very deep | −32% | 24/7 | 100x |
| Lighter / Pacifica | 8 / 34 bps | thin | 0 / +11% | 24/7 | 50x |

\* tick-granularity artifact, not real cost.

### GBP/USD

| Venue | Spread | Liquidity | Funding | Hours | Lev |
|---|---|---|---|---|---|
| Vest | 2 bps | $1.64M OI | +5% | 24/7 | 100x |
| Ostium | 3 bps | **$30M cap** | 1.31% | Wknd-closed | 200x |
| Avantis | 0% | $6.55M cap | 5% | Wknd-closed | 100x |
| gTrade | 0.01% | $2.9M cap | ~0 | Wknd-closed | 1000x |
| MEXC | 2.24 bps | very deep | −13.8% | 24/7 | 100x |
| Hyperliquid | 12.6 bps | $214k OI | −38% to −66% | 24/7 (frozen wknd) | 50x |
| Lighter | 25.7 bps | $116k OI | 0% | 24/7 | 25x |

### USD/CHF · USD/CAD · AUD/USD · NZD/USD

| Pair | Venue | Spread | Liquidity | Funding | Hours | Lev |
|---|---|---|---|---|---|---|
| **CHF** | Ostium | 3 bps | $30M cap | 3.48% | Wknd | 200x |
| | Avantis | 0.01% | $4.68M cap | 5% | Wknd | 50x |
| | MEXC | 1.6 bps | deep | +18.8% | 24/7 | 100x |
| | Lighter | 38 bps | $459k OI | 0% | 24/7 | 25x |
| **CAD** | Ostium | 3 bps | $25M cap | 2.12% | Wknd | 200x |
| | gTrade | 0.01% | $2.5M cap | ~0 | Wknd | 1000x |
| | Vest | 2 bps | $0.85M OI | +5% | 24/7 | 100x |
| | MEXC | 6.99 bps | deep | +11% | 24/7 | 100x |
| | Avantis / Lighter | 0.01% / 25 bps | $4.68M cap / $72k | 5% / 0 | Wknd / 24/7 | 50x / 25x |
| **AUD** | Ostium | 3 bps | $20M cap | 2.32% | Wknd | 200x |
| | Vest | 4 bps | $2.83M OI | +5% | 24/7 | 100x |
| | Avantis | 0.01% | $2.81M cap | 5% | Wknd | 50x |
| | MEXC | 4.26 bps | deep | ~0 | 24/7 | 100x |
| **NZD** | Ostium | 3 bps | $20M cap | 1.38% | Wknd | 200x |
| | Vest | 4 bps | $3.06M OI | +5% | 24/7 | 100x |
| | Avantis | 0.01% | $2.81M cap | 5% | Wknd | 50x |
| | Lighter | 64 bps | $111k OI | 0% | 24/7 | 25x |

### Managed & minor — EUR/JPY, SGD, SEK, NOK

| Pair | Venue | Spread | Liquidity | Funding | Hours | Lev |
|---|---|---|---|---|---|---|
| **EUR/JPY** | gTrade | 0.01% | $3.0M cap | ~0 | Wknd | 1000x |
| **SGD** | gTrade | 0.01% | $1.0M cap | ~0 | Wknd | 500x |
| | Avantis | 0.2% | $0.94M cap | 5% | Wknd | 50x |
| **SEK** | gTrade (EUR/SEK) | 0.015% | $0.9M cap | ~0 | Wknd | 500x |
| | Avantis (USD/SEK) | 0.2% | $0.94M cap | 5% | Wknd | 20x |
| **NOK** | Vest (only live) | 25 bps | $6.0M OI | +5% | 24/7 | 100x |

### Emerging markets — the hard book

| Pair | Venue | Spread | Liquidity (cap) | Funding | Hours | Lev |
|---|---|---|---|---|---|---|
| **CNH** | gTrade | 0.015% | $1.0M | 12%@max | Wknd | 500x |
| | Avantis | 0.5% | $0.94M | 5% | Wknd | 20x |
| | Flash Trade | 0 (synthetic) | $654k pool | borrow rate | Wknd | 20x |
| **ZAR** | gTrade | 0.05% | $0.6M | 22%@max | Wknd | 500x |
| | Avantis | 0.5% | $0.47M | 5% | Wknd | 20x |
| **TRY** | Avantis | 0.5% | $0.47M | **12% long / 5% short** | Wknd | 20x |
| **MXN** | Avantis | 0.5% | $0.47M | 5% | Wknd | 20x |
| | Ostium | 5 bps | $0.25M (~dead) | 2.36% | Wknd | 200x |
| **INR** | Avantis *(only)* | 0.5% | **$0.19M** | 5% | Wknd | 20x |
| **BRL** | Avantis *(only)* | 0.5% | $0.47M | 5% | Wknd | 20x |
| **IDR** | Avantis *(only)* | 0.5% | $0.47M | 5% | Wknd | 20x |
| **TWD** | Avantis *(only)* | 1.0% | **$0.19M** | 5% | Wknd | 20x |
| **KRW** | Lighter *(only live)* | 26 bps | ~$1.3k OI | 0% | 24/7 | 25x |

CEX EM (Bitget/Gate — CFD, ≤500x, overnight-swap financing, weekend-closed): CNH/ZAR/TRY on both, +MXN on Gate. Per-pair spread/swap not public (account-gated).

**Two reads:** for **majors**, Ostium owns the deep caps ($20–50M), Extended/Hyperliquid the tightest spreads, MEXC if a CEX is acceptable, gTrade for leverage. For **EM**, Avantis is the only real on-chain home — capped $0.19–0.94M per pair, so it hedges small; beyond that it's CME futures or bank NDFs.

---

## On-chain venues — full pairs + execution

### Avantis — Base · the EM workhorse

- **Chain:** Base. **Oracle:** Pyth (Lazer real-time + classic pull; FX pairs have no backup feed). **Settlement:** USDC vault. **TVL:** ~$104M implied (90% cap = $93.6M). **Max FX leverage:** 100x (majors).
- **Caps:** global $93.6M · **FX group cap $9.36M (9% of global), current FX OI $1.41M (15% utilized)** · per-wallet FX $14.0M.
- **Fees:** open 0.03% majors (AUD/NZD 0.09%, TWD 0.045%), close 0% (TWD 0.045%). Price-impact engine off on FX.
- **Funding:** no funding rate — a **borrowing fee** in `marginFee`, %/hour. FX floor = **5.0% APR**, both sides, dynamic up to 100%. **USD/TRY long is the lone exception at 12.06% APR** (book is fully one-sided long).
- **Hours:** closed weekends. Majors reopen Sun ~21:03 UTC, exotics ~22:03, USD/BRL Mon ~12:03 (Brazil hours).

| Pair | Spread | Pair OI cap | Util | Funding (APR) | Max lev |
|---|---|---|---|---|---|
| EUR/USD | 0% | $6.55M | 0.04% | 5.0% | 100x |
| USD/JPY | 0% | $9.36M | 13.8% | 5.0% | 50x |
| GBP/USD | 0% | $6.55M | 0.17% | 5.0% | 100x |
| USD/CAD | 0.01% | $4.68M | 0.01% | 5.0% | 50x |
| USD/CHF | 0.01% | $4.68M | 0.10% | 5.0% | 50x |
| USD/SEK | 0.2% | $0.94M | 0% | 5.0% | 20x |
| AUD/USD | 0.01% | $2.81M | 0% | 5.0% | 50x |
| NZD/USD | 0.01% | $2.81M | 0% | 5.0% | 50x |
| USD/SGD | 0.2% | $0.94M | 0.10% | 5.0% | 50x |
| **USD/TRY** | 0.5% | $0.47M | 21.2% | **12.1% long / 5.0% short** | 20x |
| **USD/CNH** | 0.5% | $0.94M | 0.03% | 5.0% | 20x |
| **USD/INR** | 0.5% | **$0.19M** | 0.37% | 5.0% | 20x |
| **USD/MXN** | 0.5% | $0.47M | 0% | 5.0% | 20x |
| **USD/ZAR** | 0.5% | $0.47M | 0% | 5.0% | 20x |
| **USD/BRL** | 0.5% | $0.47M | 0% | 5.0% | 20x |
| **USD/IDR** | 0.5% | $0.47M | 0% | 5.0% | 20x |
| **USD/TWD** | 1.0% | **$0.19M** | 0.02% | 5.0% | 20x |
| USD/KRW | — | $0 | — | — | unlisted |

- **EM live (8):** MXN, ZAR, CNH, BRL, IDR, TWD, INR, TRY. **Absent:** PHP, COP, PEN, CLP, NOK, KRW (provisioned only).

### gTrade (Gains Network) — Arbitrum · widest book, highest leverage, smaller-than-advertised live set

- **Chain:** Arbitrum (primary), Base, Polygon. **Oracle:** own decentralized network; FX gated by `isForexOpen`. **Settlement:** USDC (primary), DAI (legacy), GNS, WETH vaults. **Max FX leverage:** majors 1000x, minors 750x, exotics 500x.
- **Fees:** open+close 0.012%×2 majors, 0.016%×2 minors, 0.02%×2 exotics. **Spread fixed** per pair (no size component on FX).
- **Funding:** replaced by a **borrowing fee paid only by the heavier OI side**; balanced/empty book ≈ 0. Annualized ceiling at full imbalance ~10–29% per pair.
- **Reality check:** the live FX universe is **smaller than the docs imply.** Confirmed `maxOI = 0` (untradeable) on USD/CHF, AUD/USD, NZD/USD, EUR/CHF, EUR/GBP and all the minor-cross tail — plus the disabled exotics USD/KRW, USD/INR, USD/MXN, USD/TWD, USD/BRL, EUR/NOK.

| Pair | Spread | Max OI (USDC) | Borrow @max | Max lev |
|---|---|---|---|---|
| EUR/USD | 0.01% | $3.50M | 21% | 1000x |
| USD/JPY | 0.01% | $3.00M | 21% | 1000x |
| GBP/USD | 0.01% | $2.90M | 13% | 1000x |
| USD/CAD | 0.01% | $2.50M | 17% | 1000x |
| EUR/JPY | 0.01% | $3.00M | 25% | 1000x |
| **USD/CNH** | 0.015% | $1.00M | 12% | 500x |
| **USD/ZAR** | 0.05% | $0.60M | 22% | 500x |
| USD/SGD | 0.01% | $1.00M | 12% | 500x |
| EUR/SEK | 0.015% | $0.90M | 10% | 500x |
| + live minor crosses | 0.01% | $1.5–3.0M | 12–29% | 750x |

(Live minors: EUR/AUD, EUR/CAD, GBP/CAD, GBP/JPY, AUD/CAD, AUD/JPY, NZD/JPY, CAD/JPY.) **EM live:** CNH, ZAR only.

### Ostium — Arbitrum · RWA oracle, biggest caps on majors, no funding on FX

- **Chain:** Arbitrum, USDC. **Oracle:** Stork RWA (market-hours aware; bid/ask execution). **TVL:** ~$55M. **Max FX leverage: 200x on ALL FX** (the docs' 150x for MXN/KRW is overridden by the group setting — confirmed on-chain).
- **Fees:** open 3 bps majors / 5 bps MXN+KRW; **close 0%**; ongoing cost = **rollover fee only (0.85–3.5% APR), NO funding** (funding is crypto-only here). You pay rollover, never receive it.
- **Hours:** weekdays ~24h, closed weekends + 1h daily maintenance. Limit orders queue while closed.

| Pair | Open fee | OI cap | Current OI | Rollover APR | Max lev | Trading? |
|---|---|---|---|---|---|---|
| EUR/USD | 3 bps | **$50M** | $5.7M | 0.99% | 200x | Yes |
| USD/JPY | 3 bps | $40M | $22.2M | 0.85% | 200x | Yes |
| GBP/USD | 3 bps | $30M | $0.74M | 1.31% | 200x | Yes |
| USD/CHF | 3 bps | $30M | ~$0 | 3.48% | 200x | Yes |
| USD/CAD | 3 bps | $25M | $2.9M | 2.12% | 200x | Yes |
| AUD/USD | 3 bps | $20M | $0.95M | 2.32% | 200x | Yes |
| NZD/USD | 3 bps | $20M | ~$0 | 1.38% | 200x | Yes |
| **USD/MXN** | 5 bps | **$0.25M** | ~$0 | 2.36% | 200x | Yes (thin) |
| USD/KRW | — | $0 | $0 | — | — | **No (no feed)** |

Ostium has the **deepest major-FX caps in crypto** ($50M EUR/USD, $40M JPY) — the venue to size a *major* hedge. EM is just MXN, and barely.

### Hyperliquid — majors only, but tradeable directly in the app

- **You trade it directly in the Hyperliquid app.** FX is HIP-3 *builder-deployed* (by **trade.xyz**, dex `xyz`), not a core Hyperliquid market — but builder markets surface in the normal Hyperliquid UI, use the same wallet, USDC margin, and settle on Hyperliquid L1. So "directly on Hyperliquid" is accurate; the core team simply doesn't operate the FX book itself.
- **Chain:** Hyperliquid L1, USDC, isolated margin. **Oracle:** Pyth FX (freezes to Friday close over weekends). **Funding:** hourly, 0.5× multiplier. **Max lev:** 50x.
- **3 live FX (single-currency index contracts, not crosses):** **EUR** (0.86 bps, **$10.2M OI** — rivals Extended for the deepest crypto FX book), **JPY** (0.63 bps, ~$73k OI, inverted listing), **GBP** (12.6 bps weekend, ~$214k OI, funding −38% to −66% from one-sided longs). A second builder (**Kinetiq**, dex `km`) runs its own **EUR** market (~$440k OI, +54% funding).
- **Delisted (zero OI):** DXY, KRW, NOK. **No EM, no CNH** — confirmed across all 8 builder dexes (`xyz, flx, vntl, hyna, km, abcd, cash, para`) via the API. The CNH from secondary sources is not live.
- **US caveat:** geofenced — the ToS bars US persons, so direct access needs an offshore entity.
- **Strategic note:** HIP-3 lets any staked builder deploy an EM-FX perp permissionlessly. None has yet — this is the most likely place a deep USD/INR or USD/BRL perp appears next.

### Lighter — own ZK-rollup · the only trading KRW

- **Chain:** Plonky2 ZK-rollup. **Fees:** 0 maker/taker. **Funding:** hourly, 0 over weekend. **Max lev:** 50x (EUR/JPY), 25x (rest).
- **8 FX:** EUR/USD (4.75 bps weekend, $3.5M OI), USD/JPY, GBP/USD, AUD/USD, NZD/USD, USD/CHF, USD/CAD, **USD/KRW** (26 bps, ~$1.3k OI — thin, but the only genuine on-chain KRW). Minor crosses sit at 25–64 bps on the weekend.

### Extended — Starknet · tightest EUR/USD

- **Chain:** Starknet, USD-collateralized. **Funding:** hourly, +3.5% annualized. **2 FX only:** **EUR/USD** (0.87 bps, **$10.6M OI**, 100x — the single deepest/tightest FX book in crypto) and USD/JPY (12 bps, $182k OI, 25x). The rest of its TradFi book is metals, oil, indices, US stocks. **No EM.**

### Smaller on-chain venues

| Venue | Chain | FX pairs | Weekend? | Funding | Max lev | Note |
|---|---|---|---|---|---|---|
| **Vest** | own rollup | EUR, GBP, JPY, AUD, NZD, CAD, **NOK** /USD | **24/7** | +5% | 100x | Only on-chain NOK ($6M OI); GBP/CAD 2 bps |
| **Pacifica** | Solana | EUR/USD, USD/JPY | **24/7** | +11% | 50x | EUR/USD 4.3 bps deep; JPY thin |
| **Hibachi** | ZK chain | EUR, GBP, AUD, NZD /USDT | No (CME hrs) | hourly | 20–25x | Closed Sat; only EUR liquid ($2.4M/24h) |
| **Helix** | Injective | EUR, GBP, JPY, AUD /USDC | No (dormant) | +3.65% | ~101x | Closed weekends; OI not in REST |
| **Flash Trade** | Solana | EUR, GBP, USD/JPY, **USD/CNH** | No (CME hrs) | borrow rate | 20x | Zero trade-spread synthetic; closed Sat; $654k pool |

### Watch list (configured, not trading)

- **Synthetix** — forex perps scheduled June 2026, not yet live. Legacy forex synths deprecated/frozen. Most likely new FX entrant this month — re-check.
- **edgeX** — 4 FX majors at contract level, `enableDisplay:false`, zero volume.
- **Aster** — docs describe a Forex Market (EUR/USDT, GBP/USDT, 200–500x); live API returns "Invalid symbol." Built, not switched on.
- **dYdX v4** — no FX. RWA roadmap = equities.

### Checked, no live fiat FX

Jupiter, Drift, GMX, Vertex, Myx, SynFutures, Perennial, Bluefin, Orderly, APX/ApeX, MUX, Vela, Level, Rollbit, Paradex, Reya, Mummy/Navigator, Adrena, Holdstation.

---

## Centralized exchanges — full pairs + execution

The 2026 "TradFi perpetuals" wave was real (~$30B+/week) but went into **metals, oil, and US stocks**, not currencies. Only four venues touch fiat FX, and only one (MEXC) is liquid + API-readable.

### MEXC — the one liquid, fully-measured CEX FX

Crypto-native perps, USDT-settled, **funding every 4h**, 24/7 (no weekend close), 100x. No CNH (searched — absent).

| Pair | Spread | OI (contracts) | Funding (4h / annualized) | Max lev |
|---|---|---|---|---|
| EUR/USDT | 0.86 bps | 4.36M | +0.006% / +13.1% | 100x |
| GBP/USDT | 2.24 bps | 10.66M | −0.0063% / −13.8% | 100x |
| AUD/USDT | 4.26 bps | 3.33M | ~0 | 100x |
| JPY/USDT | 16 bps* | 13.38M | −0.0147% / −32% | 100x |
| CHF/USDT | 1.60 bps | 7.77M | +0.0086% / +18.8% | 100x |
| CAD/USDT | 6.99 bps | 21.47M | +0.005% / +11% | 100x |

\* JPY bps wide because of tick granularity, not real cost. Funding swings sign intraday — snapshot only.

### Kraken Futures — listed but dead

5 FX perps (`PF_*`), USD-collateralized, 24/7, 20–50x. **Only EUR/USD quotes** (0.086 bps top-of-book but one-deep — next bid 1.4% away). GBP/AUD/CHF/JPY have no quotes, zero volume, ~zero OI. API-measurable, **not executable.**

### Bitget — CFD, documented-only

MT5/CFD, USDT margin, up to 500x, **overnight swap** financing (not funding), weekend close. ~$6/lot. FX leg **not in the crypto API** — per-pair spread/swap unpublished.
- **Pairs:** EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF; crosses EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY, AUD/CHF; **exotics USD/TRY, USD/ZAR, USD/CNH, USD/SGD, USD/HUF.**
- **EM:** TRY, ZAR, CNH.

### Gate (gate.com/tradfi) — CFD, API key-gated

48 forex pairs, USDx margin, up to 500x, **overnight swap** financing, weekend close, ~$5.4/lot. Web Akamai-blocked; API requires a funded-account key — **no public per-pair data.**
- **USD pairs:** EUR, GBP, AUD, NZD, JPY, CHF, CAD, SGD, HKD, NOK, SEK, DKK, **MXN, ZAR, TRY, CNH, CZK.**
- **Crosses:** ~30 (EUR/x, GBP/x, AUD/x incl. **AUD/CNH**, NZD/x, CAD/x, CHF/JPY, SGD/JPY, **EUR/CZK, EUR/TRY**).
- **EM:** MXN, ZAR, TRY, CNH (most EM coverage of any CEX).

### No fiat FX at all

| Exchange | What they list instead |
|---|---|
| **Binance** | Gold, silver, oil, tokenized stocks. EURI euro-stablecoin spot only. FX "planned," not live. |
| **Bybit** | ~20 US stock perps, 3 commodities, 3 ETFs (EWJ/EWY = equity beta, not JPY/KRW FX). |
| **OKX** | Equity perps, ICE Brent/WTI, X-Perps. BUIDL Treasury RWA. No FX. |
| **Coinbase / KuCoin / Deribit / Crypto.com** | Crypto + equity/index perps. No FX. |

---

## TradFi — where the rest of the book hedges

For non-convertible EM, this is the deep market. Three instrument types: **spot/CFD** (deliverable), **FX futures** (CME, physical or cash-settled), **NDF** (cash-settled OTC, default under capital controls).

| Currency | CME futures | Major broker | Form | Note |
|---|---|---|---|---|
| G10 + NOK, SEK | Yes | Yes | Spot/CFD + futures | Hedge anywhere |
| CNH | Yes | Yes | Deliverable offshore | RMB proxy (CNY onshore is NDF) |
| **MXN** | Yes (physical) | Yes | Spot/CFD + futures | Best-hedged EM — convertible |
| **ZAR** | Yes (physical) | Yes | Spot/CFD + futures | Convertible |
| **TRY** | Yes | Yes (OANDA, IG, Saxo) | Deliverable, thin | Convertible but volatile |
| **BRL** | Yes (cash) | Yes (Saxo, IG) | NDF | Non-convertible |
| **INR** | Yes (cash) | Yes (Saxo, IG, IBKR) | NDF | Non-convertible; India-resident restricted |
| **KRW** | Yes (cash) | Yes (Saxo, IG) | NDF | Non-convertible; NDF is the real liquidity |
| **IDR** | Yes (cash) | Yes (IG voice) | NDF | Non-convertible |
| **CLP** | Yes (cash) + cleared NDF | Yes (Saxo, banks) | NDF | Non-convertible |
| **COP** | No future (cleared NDF) | Yes (banks, Saxo) | NDF | No screen-traded contract |
| **PHP** | No future (cleared NDF) | Yes (IG voice, banks) | NDF | No screen-traded contract |
| **PEN** | No | Yes (banks) | NDF (bank OTC) | Hardest — thin even OTC |
| **TWD** | No | Yes (banks, IG-EMFX) | NDF | No CME future |

**The convertibility line — why this matters for CRX.** INR, KRW, TWD, PHP, BRL, COP, CLP, PEN, IDR are non-deliverable by capital control. Every venue that touches them *cash-settles* against an NDF fixing — there is no deliverable spot. MXN, ZAR, TRY are the EM exceptions: freely convertible, so they trade as ordinary spot/CFD and (MXN, ZAR) physically-delivered futures. This is the structural reason your hardest currencies are absent from crypto, and why Avantis can only list the few it does — a permissionless perp needs a price feed, and cash-settlement against an NDF fixing is exactly what it does.

**Broker EM depth:** IG and Saxo are broadest for NDFs (Saxo: KRW, INR, BRL + Asian/LatAm NDFs, ~$500k minimum). IBKR: BRL, MXN, KRW, TWD, TRY, ZAR, CNH as spot/futures. OANDA: convertible EM (MXN, ZAR, TRY) only.

---

## The four orphans: PHP, COP, PEN, CLP

No on-chain venue. No CEX. The complete picture:

- **CLP** — CME cash-settled future + CME-cleared NDF + bank NDF. Most hedgeable of the four.
- **COP** — CME-cleared OTC NDF (no screen-traded future) + bank NDF.
- **PHP** — CME-cleared OTC NDF (no screen-traded future) + bank NDF (IG voice).
- **PEN** — bank OTC NDF only. No CME contract. The single hardest currency in the CRX book.

**Therefore:** to lay off PHP, COP, PEN, or CLP risk the only counterparties are NDF desks at banks/brokers. Budget for it being slow, voice-brokered, large-minimum, and — for PEN — barely there.

---

## What to verify before trading

1. **Re-pull spreads on a weekday.** Everything above is a Saturday snapshot — spot FX closed, books thin. Structural data (caps, fees, funding model, hours) holds; spreads will tighten materially during London/NY.
2. **Avantis EM depth is the binding constraint.** Per-pair OI caps are $187k–$468k for EM. Read `socket-api-pub.avantisfi.com` live before sizing INR/TWD ($187k each).
3. **Ostium for major size.** $50M EUR/USD and $40M JPY caps dwarf everything else — the venue for a large *major* hedge.
4. **Hyperliquid HIP-3.** No EM FX today; watch for a builder to deploy one. Oracle freezes weekends — don't read weekend marks as live.
5. **Synthetix forex** — scheduled this month; re-check.
6. **Bitget/Gate** per-pair spread + swap are only visible inside a funded account.

---

## Glossary

- **Perp / perpetual** — futures with no expiry; price tracks spot via a funding rate.
- **CFD** — contract for difference; cash-settled bet, charges an overnight swap (not funding). Bitget/Gate FX are CFDs.
- **NDF** — non-deliverable forward; cash-settled in USD against an official fixing. Standard for INR, KRW, BRL, etc.
- **Funding vs borrowing/rollover** — a funding rate is peer-to-peer (longs pay shorts or vice-versa). Avantis/gTrade charge a *borrowing fee* (heavier side pays); Ostium charges a *rollover fee* (you always pay). Different mechanics, same "cost of carry" role.
- **OI cap** — the max open interest a pair can hold; the hard limit on how much you can hedge. The binding constraint on every on-chain EM pair.
- **Physical vs cash-settled** — a delivered future hands over the currency; a cash-settled one pays the difference. Non-convertible currencies are always cash-settled.
- **HIP-3** — Hyperliquid's mechanism letting any staked builder deploy a new perp market permissionlessly.
- **CNH vs CNY** — CNH is the freely-tradeable offshore yuan; CNY the controlled onshore. Crypto and brokers trade CNH.

---

## Sources & APIs used (live, 2026-06-13)

**On-chain (API-measured):**
- Avantis — `socket-api-pub.avantisfi.com/socket-api/v1/data` (mirrors `PairStorage` `0x5db3772136e5557EFE028Db05EE95C84D76faEC4`, Base)
- gTrade — `backend-arbitrum.gains.trade/trading-variables` + on-chain `getAllBorrowingPairs`/`getPairMaxOi` (diamond `0xFF162c694eAA571f685030649814282eA457f169`, Arbitrum)
- Ostium — subgraph `api.subgraph.ormilabs.com/.../ost-prod/live/gn` (GraphQL `getPairs`) + `metadata-backend.ostium.io/PricePublish/latest-prices`
- Hyperliquid — `api.hyperliquid.xyz/info` (`perpDexs`, `meta`/`metaAndAssetCtxs` dex=`xyz`, `l2Book`, `fundingHistory`, `candleSnapshot`)
- Lighter — `mainnet.zklighter.elliot.ai/api/v1/` (`orderBooks`, `orderBookDetails`, `orderBookOrders`, `funding-rates`, `fundings`)
- Extended — `api.starknet.extended.exchange/api/v1/info/markets` + `/orderbook` + `/funding`
- Vest — `server-prod.hz.vestmarkets.com/v2` (`/depth`, `/ticker/latest`, `/oi`, `/funding/history`)
- Pacifica — `api.pacifica.fi/api/v1/` (`info`, `info/prices`, `book`, `funding_rate/history`)
- Hibachi — `data-api.hibachi.xyz/market/` (`exchange-info`, `data/orderbook`, `data/funding-rates`, `data/prices`)
- Helix — `sentry.exchange.grpc-web.injective.network/api/exchange/derivative/...`
- Flash Trade — `flashapi.trade` (`/prices`, `/pool-data`, `/v2/raw/markets`, `/v2/raw/custodies`)

**CEX:**
- MEXC — `contract.mexc.com/api/v1/contract/` (`detail`, `ticker`, `depth`, `funding_rate`) — API-measured
- Kraken — `futures.kraken.com/derivatives/api/v3/` (`instruments`, `tickers`, `orderbook`) — API-measured
- Bitget — documented (FX not in crypto API); bitget.com/academy
- Gate — documented (TradFi API key-gated); gate.com/announcements, CoinGecko learn

**TradFi:**
- CME — cmegroup.com/markets/fx/emerging-markets.html · /fx-delivery.html · LATAM FX FAQ · USD/CNH RMB futures · TRY/USD specs
- Brokers — interactivebrokers.com · ig.com forex CFD · Saxo NDF (Finance Magnates) · oanda.com
- NDF reference — Wikipedia NDF · BIS NDF quarterly · EMTA market practices

All figures captured 2026-06-13. On-chain spreads/OI are a weekend snapshot; re-pull on a weekday before trading.
