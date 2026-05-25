# Human sources rollout — design

**Session:** 20260525-1210-h7k3
**Goal:** Turn every non-human Vision source (e.g. `hackernews`) into a "human source" page like DefiLlama — showing the live top-10 most popular assets that re-rank in place while the user watches, betting on that top-10, with the vault content relocated to its own tab.

## Scope

99 conversion-target sources: 4 with `audience: 'bot'` (the `defillama-*-all` firehoses) + 95 with no `audience` field. The 18 existing `audience: 'human'` DefiLlama pages and the 1 `redirect` are left as-is (their curated allowlists keep working).

## Decisions (confirmed)

1. **Popularity metric.** Rank the top-10 by the best signal each source actually has: `marketCap` → `volume24h` → `value` (all already present on `SnapshotPrice`). Never rank a measurement source (temperature, delay minutes) by a popularity word.
2. **Honest label.** The list header reads `Top 10 by <valueLabel>` (e.g. "Top 10 by Score", "Top 10 by TVL"), pulled from the source's `valueLabel`. Never the bare word "popular".
3. **Live re-rank in place.** The snapshot is already polled. Re-sort the 10 cards with a FLIP reorder animation. The *display* set updates live; the *bettable* set stays frozen to the open round (the existing `tradableMarkets` distinction in `SourceDetailHumanTrading`). The UI marks which 10 are bettable this round vs trending-for-next.
4. **Vault on a tab.** Add a `Vault` entry to `SourceTabNav`; relocate `FeaturedVaultHero` + `VaultShowcase` there. Render the tab only when the source has a vault (`hasVaultForSource`).
5. **Phase 2 gated.** Scoping the *betting batch itself* to exactly the top-10 is deferred behind a consensus-determinism check, because it touches the BLS oracle.

## Architecture

### Phase 1 — Frontend (ships via push, no backend/oracle change)

The bettable set in Phase 1 is the existing full firehose batch, so every displayed top-10 market is bettable. The product looks and behaves complete.

- **A. Config flip** — `frontend/data/sources-display.json`: add `"audience": "human"` to all 99 conversion targets. No other field changes. (Grid stays correct: `/api/vision/sources` filters out `bot`/`redirect`, shows `human`. Human pages render pre-vault — the `notFound()` vault gate already exempts `audience === 'human'`.)

- **B. Human page generalization + popularity ranking** — `frontend/components/domain/vision/detail/SourceDetailHumanTrading.tsx` (+ a small ranking helper). Replace the `parseFloat(value)`-only fallback (lines ~225-229) with a popularity-aware comparator `marketCap → volume24h → value`, parsed defensively. Header label uses `valueLabel`. The DefiLlama allowlist path is unchanged (allowlist still wins when present). Confirm `marketCap`/`volume24h` flow through (they do).

- **C. Live re-rank** — same file as B (one owner). The polled snapshot drives a `useMemo` top-10; animate reorder with a FLIP technique (measure → reflow → transform transition) keyed by `assetId`, respecting `prefers-reduced-motion`. Keep `tradableMarkets` (intersection with active batch) distinct from the live display set; badge non-bettable cards.

- **D. Vault tab** — `frontend/components/domain/vision/detail/SourceTabNav.tsx` (add `vault` tab, gated on `hasVaultForSource`) + a vault index route `frontend/app/[locale]/(app)/source/[sourceId]/vault/page.tsx` that renders `FeaturedVaultHero` + `VaultShowcase`. Existing `/vault/[vaultAddress]` detail route is untouched.

**File ownership (no overlap):** A→`sources-display.json`; B+C→`SourceDetailHumanTrading.tsx` + ranking helper; D→`SourceTabNav.tsx` + vault index route. Agents make edits and run `npx tsc --noEmit` on their slice; the orchestrator does the single consolidated commit + `git push mono main` to avoid git-index races from concurrent agents.

### Phase 2 — Backend (serial, VPS, gated)

- `data-node/src/batch_engine.rs` `get_healthy_assets`: select top-N by the same popularity metric, `ORDER BY <metric> DESC, asset_id ASC` (deterministic tiebreak), `LIMIT N`.
- **Gate:** before flipping production, verify the oracle consensus path survives a rotating set — `batch_config_orchestrator.rs` follower tolerances (±30% count, <5% unknown assets) and the new-batch rate limit ("3/hour" — confirm per-source vs global). If a churning top-N would trip rejection/throttle, fix the determinism (compute top-N from a tick-boundary snapshot, not live-at-query) before deploy.
- Rebuild data-node + restart oracles on VPS 1 with monitoring (`nohup`, 8-12 min builds). Oracles only run on VPS — never locally.

## Verification

A final agent re-checks all of it: `tsc --noEmit` + `eslint` clean across the frontend; the 99 sources all carry `audience: 'human'`; a sample human page renders top-10 with the correct label and a working Vault tab; Phase 2 determinism analysis is sound. Reports a pass/fail per item with evidence.

## Risks

- **R1 — value≠popularity.** Mitigated by the metric cascade + honest label.
- **R2 — consensus/throttle on churning top-N.** Mitigated by the Phase 2 gate; Phase 1 carries no oracle risk.
- **R3 — 99 sources flip at once is a large product change.** Reversible by reverting the config commit.
