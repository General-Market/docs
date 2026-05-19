# 04 · Crypto Extraction — Beyond MEV

File 03 already covers MEV totals. This file covers everything else: CEX insider prosecutions, perp DEX whale concentration, token-launch predation, MM tier subsidies, wash trading.

---

## A · CEX insider-trading prosecutions

### Coinbase — Ishan Wahi case (2022)
- Coinbase Product Manager Ishan Wahi tipped his brother (Nikhil Wahi) and friend (Sameer Ramani) about upcoming listings.
- Charged July 2022. SEC, DOJ parallel actions.
- ≥9 tokens involved. Approximately **$1.5M in trading profits**.
- Ishan Wahi sentenced May 2023 to 2 years; Nikhil sentenced January 2023 to 10 months; Ramani fled, default judgment 2024.
- SEC LR-25947: `https://www.sec.gov/enforcement-litigation/litigation-releases/lr-25947`

### Binance listings — Argus Research (2022)
- Argus identified ~46 wallets that bought tokens before Binance listings; aggregate ~$17.3M purchased pre-listing, ~$1.7M extracted on listing pops.
- CZ acknowledged the problem; firing of unspecified Binance employee announced.
- Source: Forbes, Fortune coverage May 2022.

### OpenSea — Nathaniel Chastain (2022)
- OpenSea Head of Product front-ran homepage NFT promotions.
- Sentenced August 2023 to 3 months prison + $50K fine.
- Source: DOJ press release.

### FTX / Alameda Research front-running
- Caroline Ellison's trial testimony (October 2023) included disclosure that **Alameda received early information about token listings on FTX**.
- This was part of broader fraud case; not separately prosecuted as insider trading because Alameda was the FTX-affiliated entity.
- Source: SDNY trial transcripts, October 2023.

### Binance.US — comingled flow allegations
- SEC v. Binance complaint (June 2023) alleged Zhao-owned Sigma Chain and Merit Peak received >$22B comingled flow from BAM Trading (Binance.US).
- Sigma Chain was described as Binance's "main market maker" — an example of broker-as-counterparty at the largest crypto venue.
- Source: SEC v. Binance complaint, June 2023 — `https://www.sec.gov/files/litigation/complaints/2023/comp-pr2023-101.pdf`

---

## B · Perp DEX whale concentration

### Hyperliquid (2024–2025)
- Public on-chain dashboards (Dune by @hagaetc and others) consistently show:
  - **<1% of addresses account for ~80% of profit**.
  - **>90% of addresses with 100+ trades are net negative**.
- The James Wynn saga (2024): a single trader with sustained outsized positions, public PnL swings of $30M+, became a market-moving event by himself.
- Source: Dune dashboards, on-chain analyst threads on X (Zerebro, Doppelganger).

### dYdX (v3 historical, 2021–2023)
- Similar pattern. Public Dune dashboards available.

### Pre-2020 BitMEX
- BitMEX (Arthur Hayes era) was the original perp venue. Estimated retail PnL distribution similarly skewed but data less public.
- BitMEX CFTC settlement August 2021 — $100M for unregistered operations.

---

## C · Token-launch predation — Pump.fun and serial-rug ecosystem

### Pump.fun (Solana, launched January 2024)
- By late 2025: **>7M tokens launched**.
- "Graduation" rate (tokens that reach Raydium listing): <2%.
- Of graduated tokens, the dominant outcome remains a fast post-launch drop.
- Sniper-bot ecosystem on Pump.fun (per `/anticheat-flags` `data-edge-matrix.ts`):
  - **4,600 sniper wallets**, >15,000 SOL extracted in a single month (Bitget 2025 study).
  - 87% sniper-wallet profitability rate.
  - Top serial deployer cluster: ~320 tokens each by 12 distinct clusters; one wallet alone launched 29,834 tokens with $3.8M extracted.
- Source: Bitget News, GitHub bundler repos, on-chain analyses by Bubblemaps and Solscan.

### Memecoin-launch insider clustering
- Multiple on-chain studies (Bubblemaps, Lookonchain, ZachXBT) have documented insider-wallet clustering at major token launches.
- Examples: TRUMP (January 2025), MOVE, ME, EIGEN.
- Pattern: insider wallets receive pre-launch allocations or front-run public sales via private RPC access; sell into early retail demand.

### LIBRA token (Argentina) — Feb 2025
- Argentine President Milei endorsed LIBRA token; insiders extracted ~$87M within hours; price collapsed.
- Class actions ongoing; presidential ethics inquiry pending.
- Cited as canonical case of memecoin insider extraction.

---

## D · Crypto MM tier subsidies (the rebate-for-the-big-guys pattern)

Recapping from `/anticheat-flags` `data-edge-matrix.ts` MM-subsidy data:

| Venue | Disclosed MM subsidy structure |
|-------|--------------------------------|
| Coinbase | "Liquidity Program" Tier 8 — 0% maker fee + 15× thin-pair multipliers. Top 3 named: Wintermute, Cumberland, Jump |
| Binance | Spot/USDS-M/Coin-M LP programs — rebates up to −0.01% + elevated API + low-latency endpoints |
| Bybit | MM Incentive Program — −0.01% rebates via bilateral contract |
| Hyperliquid | HLP socialized PnL backstop + Tier 6 maker rebate to top 3% market-share |
| Deribit | VIP 6 — 66.66% options + 55% futures discount at $5B+ 30-day volume |

The pattern: at the top tier, fees flip from positive to negative. Retail pays 10 bps taker; the top MM is *paid* 0.3 bps to provide quotes. **The fee schedule is regressive — the spread is funded by retail.**

---

## E · Crypto wash trading

### Bitwise 2019 SEC letter
- **95% of reported Bitcoin volume found to be fake** in a sample of 81 exchanges.
- 10 venues identified as having real volume.
- The other 71 reported synthetic flow to climb listing rankings.
- Source: `https://www.sec.gov/comments/sr-nysearca-2019-01/srnysearca201901-5164833-183434.pdf`

### Chainalysis 2023 / 2024 follow-ups
- Wash trading remains common on smaller CEXs and DEXs.
- Bitcoin wash trading estimated to have generated **$2B+ in fake volume in 2023** alone.
- Source: Chainalysis annual Crypto Crime Reports.

### NFT wash trading
- 2022 Chainalysis study found ~$8.7B in NFT wash trading globally on OpenSea-era markets.
- Pattern continued through 2024 in lower volumes post-NFT-bust.

---

## F · The crypto MM dominance ratio

Quick numbers for the article (status [ESTIMATE]):

- Top 5 crypto market makers (Wintermute, Jump, Cumberland, GSR, B2C2) provide ~70–80% of quoted liquidity on major CEXs.
- Wintermute alone disclosed >$5T cumulative volume since 2017 founding.
- These same firms also dominate DEX liquidity provision (Wintermute, Jump on Uniswap v3 / Hyperliquid HLP equivalents).

The crypto market-making industry consolidated to roughly 5 firms in 8 years.

---

## G · Source bibliography

- SEC complaints: v. Binance (2023), v. Wahi (2022), v. Coinbase (2023)
- DOJ press releases on Wahi, Chastain, MyForexFunds
- Bitwise 2019 SEC letter
- Chainalysis annual Crypto Crime Reports
- Bitget News studies on Pump.fun
- Helius MEV Report
- Bubblemaps, Solscan, Lookonchain, ZachXBT public analyses
- Dune dashboards for perp DEX PnL distributions

---

## H · What's missing

1. Aggregate annual wash-trading totals 2015 → 2024 — Chainalysis publishes annual estimates but methodology shifts.
2. Cumulative MM revenue from crypto venues — none of the major MMs disclose.
3. Pump.fun cumulative retail wipeout — multiple estimates ($1-3B+ range), no canonical number.

---

End of file.
