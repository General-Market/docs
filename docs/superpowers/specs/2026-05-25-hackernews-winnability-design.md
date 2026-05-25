# HackerNews markets — winnability, log scale, threshold redesign

**Date:** 2026-05-25
**Status:** Approved, executing in phases.

## The problem

On `/source/hackernews`, `up_x%` markets are nearly impossible to win. Three
forces compound:

1. **Wrong stories.** Each tick the batch engine selects the top 10 markets by
   `value DESC` (`get_healthy_assets`, `batch_engine.rs:700`). For HackerNews
   `value` is the upvote count, so markets are always the *highest-scored*
   stories — the oldest, already-plateaued ones.
2. **Lagging threshold.** The `up_x%` line is an EMA of the last **10** settled
   moves (`ENGAGEMENT`, `ema_change_span: 10`, `traits.rs:216`). On a
   decelerating curve the EMA sits above where the curve is heading: target set
   by the past, bet settled by the future.
3. **Hidden deceleration.** A linear Y axis makes every late-stage story look
   like the same flattening hook.

(1) and (2) live in the Rust data-node (VPS-only; that box is ~121 commits
behind with local edits — patches must be small and surgical). (3) is frontend.

## Design

### Backend (data-node)

**B1 — Pick younger stories.** `hackernews/client.rs::fetch_assets`: cap the
tracked universe to stories below a max age (default **6h**, env override
`HN_MAX_STORY_AGE_SECS`). Starvation guard: if fewer than `HN_MIN_UNIVERSE`
(default 20) stories pass the cap, fall back to the youngest N by `time`. Old
stories drop out of `fetch_assets`; the sync engine deactivates them. Market
selection (top-10 by value) then runs over young, still-climbing stories.

**B2 — Threshold that chases the curve down.** New `BatchStrategy::ENGAGEMENT_CUMULATIVE`
in `traits.rs` (min 10 bps, max 10000 bps, `ema_change_span: 3`). HackerNews
`batch_strategy()` returns it. Short span tracks the *latest* deceleration
instead of last hour's heat. `ENGAGEMENT` (span 10) stays for twitch, whose
viewers go both up and down. Propagates automatically via the strategy registry
(`sync_engine.rs:60`) — no `batch_engine.rs` change.

Deploy: commit to mono (does NOT auto-deploy the data-node — only the frontend
Dokploy hook fires on push). Data-node deploy to VPS 1 is a separate, careful
step (box is commits-behind with local edits — reconcile first).

### Frontend (mono)

**F1 — Lin/Log toggle** on the main trading-view chart (`MarketCandleChart.tsx`,
lightweight-charts `rightPriceScale.mode`). Segmented control beside the
timeframe switch; choice in `localStorage`. Default **log for HackerNews**
(cumulative), linear elsewhere. Threshold line / square / runway zone stay in
data-space, so they map under log; guard the domain to stay positive. Small
sparkline cards (`HumanMarketCard`) stay linear.

**F2 — Threshold display redesign.** Replace the read-only `±X% band · reseeds
next tick` pill (`AssetDetailView.tsx::LatestBandPill`) with a plain target —
e.g. *"Score must reach 2,540 (+8%) by 16:22 — UP"* — and clean the green
line / square / zone into one legible Apple-system target band. No change to how
the threshold is computed, only how it reads.

## Phasing

- **Phase 1 — Backend:** `traits.rs`, `hackernews/client.rs`. Verify `cargo check`. Commit + push. (No VPS deploy in this phase.)
- **Phase 2 — Frontend:** `MarketCandleChart.tsx`, `AssetDetailView.tsx` (+ overlay components as needed). Verify `tsc --noEmit` + `eslint`. Commit + push (auto-deploys frontend).

## Honest notes

- The backend half is what changes the odds. The frontend half makes the bet
  legible and honest — it cannot make a rigged target winnable.
- The target should be set by where the curve is going, not where it has been.
