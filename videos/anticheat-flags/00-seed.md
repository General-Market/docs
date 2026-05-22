# Seed

**Date:** 2026-05-21
**Source:** the apprentice
**Form:** "do a video on this https://generalmarket.io/anticheat-flags"

## The page in one paragraph

A long-form marketing page on generalmarket.io with the hero claim *"The first exchange to publish how rigged this industry is. And the first to fix it."* The subhead frames it as the *dead financial market theory* — a sibling to the dead internet theory, where most trading volume on every venue is predatory actors extracting from retail and small firms. The page enumerates **thirteen mechanisms** (peer-reviewed peakBps × frequency = effective per-trade cost, ranked descending) and walks through **eleven venues** — Binance, Coinbase, Bybit, Hyperliquid, Deribit, Polymarket, Kalshi, Robinhood, IBKR, eToro, Pumpfun — each with a slate of incident cards, ribbon stats, and a *knife* line per receipt. The proposition at the end is anti-cheat as a venue property — sealed bets, parimutuel pools, BLS-verified oracles — making the listed mechanisms structurally impossible.

## Adjacent assets already on disk

- Page source: `frontend/app/[locale]/(marketing)/anticheat-flags/`
  - `page.tsx` — hero, six sections, eleven venues
  - `data-edge-ways.ts` — thirteen mechanisms with peer-reviewed sources
  - `data-binance.ts`, `data-crypto-1.ts`, `data-crypto-2.ts`, `data-prediction.ts`, `data-brokers.ts`, `data-misc.ts` — venue payloads
- Existing case study: `frontend/public/case-studies/anticheat/index.html` + paste articles
- Targeting work: `marketing/anticheat-flags-targets.tsv` (22 PRIME+STRONG handles) + `marketing/anticheat-flags-targeting.md`
- Memory: the canonical hero line *"Trading is easy with an Anti-Cheat"* and the standing answer to *why Vision and not Polymarket?*

## What this is not

Not a Vision product walkthrough. Not a feature tour. Not a launch announcement. The seed points at the *diagnosis* page — the receipts, not the cure. The cure shows up at the end, but the page's centre of gravity is what is wrong with the market today.
