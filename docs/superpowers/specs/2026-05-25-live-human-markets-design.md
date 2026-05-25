# Live human-trading markets — design

**Session:** 20260525-1640-l4v2
**Builds on:** `2026-05-25-human-sources-rollout-design.md` (which turned ~99 sources into the human-trading view). This spec adds the *live data* and *clearer cards* layer on top of that view.

**Goal:** Make the human-trading source pages read like a real trading screen and make the bet legible. Three things:
1. **Live candles.** The chart must move while you watch, instead of sitting frozen on a sparse server feed.
2. **A legible card.** A Polymarket-style card that states the proposition in words, answers it with YES / NO, and shows honest implied odds.
3. **A legible close.** The big chart must say, plainly, what price by what time wins.

Applies to the five named sources — **pumpfun, polymarket, hackernews, defillama (+ its 18 human subsources), twitch** — and generalises to every `audience: 'human'` source.

## The invariant that constrains everything

**The oracle is the only settlement authority. The client feed is for the eyes, never the money.**

- The price that resolves a round comes from oracle consensus on the server — unchanged.
- The browser-polled value drives only the *candles* and the *latest-price dot*.
- The entry and target lines stay anchored to the oracle's `openPrice` (server, frozen at round open).
- A small cosmetic gap between the live display price and the settlement price is acceptable. A gap in settlement authority is not. Never let a client value enter the bitmap, the stake, or the resolution.

## Why the candles are frozen today

Three layers stack (confirmed in code): server polls the upstream every 5–20 min (pumpfun 10 min, polymarket 20 min); the API route caches 60s; React Query holds `staleTime` 2 min with **no refetch interval**. Candles are bucketed on the frontend from that sparse series, so a 5-minute candle gets ~1 point → `open=high=low=close`, a flat tick. Nothing new arrives and nothing re-fetches.

## Architecture (frontend-only)

### 1. Client live display feed — per-source adapters

A small registry: `getLiveFeedAdapter(sourceId)` returns an adapter or `null`.

```
interface LiveFeedAdapter {
  // Returns latest numeric values keyed by Vision assetId, in the SAME units
  // as /api/market/history so candles stay continuous. Batches when the
  // upstream allows it.
  poll(assets: { assetId: string; apiRef?: string }[]): Promise<Map<string, number>>
}
```

| Source | Upstream (keyless, CORS to verify) | Upstream id from assetId | Batched? |
|---|---|---|---|
| pumpfun | `lite-api.jup.ag/price/v3?ids=…` | mint = `apiRef` (or strip `pf_`) | ✅ one call, many mints |
| hackernews | `hacker-news.firebaseio.com/v0/item/<id>.json` → `.score` / `.descendants` | id from `hn_<id>_<metric>` | ❌ one call per story |
| defillama | `api.llama.fi/tvl/<slug>` (bare number) | slug from `apiRef`/assetId | ❌ one call per protocol |
| polymarket | `gamma-api.polymarket.com` price/probability | market/token id from `apiRef`/assetId | depends on endpoint |
| **twitch** | — needs OAuth — **no adapter** (`null`) | — | — |

**Fallback chain:** adapter `null` or any failure → fall back to the existing server `/api/market/history`, polled at a modest interval. Twitch always uses this path; its server feed is already 60s, so its candles already move. On upstream error, show the last good candle — never a broken chart (no false hopes).

### 2. `useLiveValues` hook

`frontend/hooks/vision/useLiveValues.ts`:
- Polls the source adapter for the given assets on a per-source interval (pumpfun ~3–5s, polymarket ~10s, hackernews/defillama ~30s).
- **Page Visibility-gated** — stop polling when the tab is hidden.
- Polls only the assets actually on screen (visible cards + the focused token), capped.
- Exposes `{ values: Map<assetId, number>, lastUpdated, isLive }`.
- Because each browser uses its own IP, there is no central server rate-limit bottleneck. This is the point of doing it client-side.

### 3. Candle building

- History (older candles) seeds from `/api/market/history`, as today.
- Each new polled value appends to the **rightmost** candle of the active timeframe bucket: update `high`/`low`/`close`; roll a new candle when the bucket boundary passes.
- pumpfun price oscillates → frequent polling yields real wicks. Slow metrics (HN score) stay calm — honestly, because the data is calm.
- *Future, optional, pumpfun-only:* GeckoTerminal public OHLCV for true server-side wicks. Not a v1 dependency.

### 4. Polymarket-style card (`HumanMarketCard`)

Replaces the bare UP/DOWN buttons.

- **Proposition headline:** `{name} {above|below} {formattedTarget} by {closeTime}?` — target = `openPrice × (1 ± bps/10000)`, formatted in the source's units (`isPrice` / `valueLabel` / `valueUnit`). For pumpfun: "Fartcoin above $0.190 by 19:44?". For hackernews: "Story #123 above 450 pts by 19:44?".
- **YES / NO buttons**, mapped to the existing bitmap (UP=1/DOWN=0) by `resolutionType`:
  - `UP_*` (featured outcome Up): **YES → UP bit (1)**, NO → DOWN bit (0).
  - `DOWN_*` (featured outcome Down): **YES → DOWN bit (0)**, NO → UP bit (1).
  - This is the fix for "should press Yes if it's a DOWN_X": on a down-market, YES means yes-it-falls and correctly sets the DOWN bit. No contract change — only the label layer.
- **Implied odds + pool**, from `floorStore` per-market `upStake`/`downStake`:
  - `pUp = upStake / (upStake + downStake)`; YES-cents = the featured side's probability; show pool $ per side.
  - Both pools zero → render "—" / "no bets yet". Never fabricate odds.
- Mini-chart consumes `useLiveValues` so the sparkline moves too.

### 5. Big-chart close clarity (`MarketCandleChart`)

- A settlement marker at the intersection of (close time × target price), with a **countdown to close**.
- A plain-language line: **"Wins if {name} is {above|below} {target} at {closeTime}."**
- Live candle update + the fallback refetch interval.

## Non-goals

- No oracle / settlement / contract change.
- No new backend endpoint (odds from existing floor store; live values polled client-side direct).
- **FLAT_\* resolution types** (ternary Up/Down/Flat) would not map to YES/NO — but they are *never emitted*. The batch engine produces only `up_0` / `down_0` / `up_x` / `down_x` (`batch_engine.rs:267,730,1849`: "legacy `flat_x` … no longer emitted"). So YES/NO is a total, correct mapping. No 3-way control needed.
- Phase-2 of the human-sources-rollout (scoping the betting batch to top-N) is unrelated and stays gated.

## Files

New:
- `frontend/lib/vision/liveFeed/` — `index.ts` (registry + interface) + `pumpfun.ts`, `hackernews.ts`, `defillama.ts`, `polymarket.ts`.
- `frontend/hooks/vision/useLiveValues.ts`.
- `frontend/lib/vision/yesNo.ts` — `(resolutionType, 'yes'|'no') ↔ ('up'|'down')` mapping helper.

Edited:
- `frontend/components/domain/vision/detail/HumanMarketCard.tsx` — Polymarket card; live mini-chart; YES/NO mapping.
- `frontend/components/domain/vision/detail/MarketCandleChart.tsx` — live candle; close marker + countdown + sentence; fallback refetch.
- `frontend/components/domain/vision/detail/SourceDetailHumanTrading.tsx` — thread `resolutionType` + per-market `upStake`/`downStake` + live values to cards. `buildBets` stays UP/DOWN (mapping happens at the card).

## Phases (each ≤ 5 files, verify + commit + push between)

- **Phase 0 — Step-0 cleanup.** `HumanMarketCard` and `MarketCandleChart` are both >300 LOC; strip dead props/imports/logs first, separate commit.
- **Phase 1 — Live feed infra + pumpfun.** Adapter interface + pumpfun adapter + `useLiveValues` (visibility-gated, fallback). Wire into `MarketCandleChart` for pumpfun only. **First step: a real-browser CORS+limit probe of `lite-api.jup.ag`.** Verify the rightmost candle moves within the poll interval.
- **Phase 2 — Remaining adapters.** hackernews, defillama, polymarket (each gated by its own CORS probe); twitch fallback. Verify each source's candle moves or falls back cleanly.
- **Phase 3 — Polymarket card.** Proposition text + YES/NO mapping + odds/pool from floor store + live mini-chart.
- **Phase 4 — Close clarity.** Settlement marker, countdown, plain sentence on the big chart.

Each phase: `npx tsc --noEmit` + `npx eslint . --quiet` on the slice, then commit + `git push mono main`.

## Risks

- **R1 — CORS not actually open** for polymarket / defillama / HN. Mitigation: probe from a real browser as the first step of each adapter; on refusal, that source uses the server-feed fallback (still gets faster refetch).
- **R2 — Per-asset poll volume** for non-batchable upstreams (HN, llama, polymarket). Mitigation: visible cards only, gentle interval, visibility-gated, full live rebuild only for the focused token.
- **R3 — Unit mismatch** between an upstream value and our stored value (e.g. llama raw USD vs our TVL scaling). Mitigation: each adapter must return the value in the same units as `/api/market/history`; verify per adapter against a known asset.
- **R4 — Display vs settlement divergence.** Entry/target lines stay from the oracle `openPrice`; accept the cosmetic gap; label the levels as authoritative.
- **R5 — FLAT resolution types** break YES/NO. *Closed:* confirmed never emitted (`batch_engine.rs:267,730,1849`). Only `up_0`/`down_0`/`up_x`/`down_x` reach the card.

## Verification

Final pass: `tsc --noEmit` + `eslint` clean across the frontend; on pumpfun in a real browser the rightmost candle moves within the poll interval; a card shows truthful YES/NO odds from the floor store (and "—" when no bets); twitch falls back without error; entry/target lines unchanged from the oracle feed. Pass/fail per item with evidence.
