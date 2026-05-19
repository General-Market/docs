# Sports Source — High-Frequency Live Boxscore Markets

**Date:** 2026-05-20
**Owner:** Max
**Scope:** `data-node/src/market_data/sources/sports/client.rs` only.
**Status:** Plan. No code until explicit go.

## Goal

The current sports source emits one flat market per game (home/away/total score) and leaves it active even before kickoff. Pre-game markets stay 0–0. Post-game markets stay frozen at the final. The chart in the screenshot is a perfect horizontal line because the underlying data is, in fact, perfectly flat.

This plan does two things:

1. **Gate** market activation on live state. No markets exist outside `state == "in"`.
2. **Fan out** during live play into high-frequency boxscore stats from ESPN's `summary?event=<id>` endpoint, keeping only the metrics that move meaningfully inside a 5-minute window.

Slow stats (red cards, penalty kicks, blocked shots) are dropped on purpose. The user has been explicit: prefer many fast markets over a complete enumeration. Niche is welcome; static is not.

## Constants

- `sync_interval`: **300s** (was 120s).
- ESPN rate limit cap: **30 req/min** (unchanged).
- Per-cycle worst case at peak: 12 scoreboard fetches + ~40 summary fetches = 52 requests per 300s ≈ 10.4 req/min. Well below cap.
- Per-sync in-memory cache `(sport_path, event_id) -> Summary` so `fetch_prices` reuses the response from `fetch_assets`.

## Catalog — what we keep per sport

Selection rule: expected number of value changes per 5-minute window during live play **≥ ~1**. Below that, the chart is mostly flat and the market is dead weight in the registry. Score (`home`, `away`, `total`) stays in every sport regardless — it's the canonical asset and the user expects to see it.

### Soccer (eng.1, esp.1, ger.1, ita.1, fra.1, usa.1, uefa.champions)

Per team (home + away), 13 stats:
- `possessionPct` — continuous, recalculated every possession swap
- `accuratePasses`
- `totalPasses`
- `passPct`
- `accurateLongBalls`
- `totalLongBalls`
- `accurateCrosses`
- `totalCrosses`
- `effectiveClearance`
- `totalClearance`
- `effectiveTackles`
- `totalTackles`
- `interceptions`

**Dropped** (move <1× per 5 min on average): `foulsCommitted`, `wonCorners`, `totalShots`, `shotsOnTarget`, `saves`, `offsides`, `yellowCards`, `redCards`, `blockedShots`, `penaltyKickGoals`, `penaltyKickShots`, `shotPct`, `crossPct`, `longballPct`, `tacklePct`.

Total per match: 3 score assets + 26 stat assets = **29 markets**.

### NBA / WNBA

Per team, 9 stats:
- `points` (already covered by score asset)
- `fieldGoalsAttempted`
- `fieldGoalsMade`
- `threePointFieldGoalsAttempted`
- `threePointFieldGoalsMade`
- `rebounds`
- `assists`
- `turnovers`
- `fouls`

NBA boxscore field names need verification against the live API before catalog freeze — ESPN names differ from soccer.

Total: 3 + 18 = **21 markets**.

### NFL

Per team, 8 stats:
- `totalYards`
- `netPassingYards`
- `rushingYards`
- `firstDowns`
- `thirdDownEff` (X-Y format, needs normalization)
- `turnovers`
- `sacksYardsLost` (parse first number)
- `possessionTime` (parse mm:ss → seconds)

Total: 3 + 16 = **19 markets**.

### NHL

Per team, 6 stats:
- `shotsTotal`
- `hits`
- `faceoffsWon`
- `powerPlayGoals`
- `powerPlayOpportunities`
- `penaltyMinutes`

Total: 3 + 12 = **15 markets**.

### MLB

Last to ship — slowest cadence. Per team, 6 stats:
- `hits`
- `runs`
- `errors`
- `leftOnBase`
- `strikeouts`
- `walks`

Total: 3 + 12 = **15 markets**.

## Architecture changes

### Asset ID format

Existing: `sport_{league}_{event_id}_{home|away|total}`
New stat assets: `sport_{league}_{event_id}_{statName}_{home|away}`

`statName` is camelCase (no underscores, no hyphens) so the parser stays single-pass:

```
sport_epl_740958_possessionPct_home
sport_nba_401766123_threePointFieldGoalsMade_away
```

Parser strategy: split on `_`. Pattern is always `["sport", league, eventId, ...statTokens, side]`. If second-to-last token is alphanumeric and last token is in `{home, away}`, join the stat tokens — but since stats are camelCase there's always exactly one stat token. The parser becomes:

```
sport_{league}_{eventId}_{lastTokens...}
```
- 1 trailing token in {home, away, total} → score asset, metric = lastToken
- 2 trailing tokens, last in {home, away}, second-to-last camelCase → stat asset

`league` and `eventId` are fixed positions 1 and 2 after the `sport_` prefix; `eventId` is purely numeric, so the boundary is unambiguous.

### `fetch_assets`

Per league scoreboard, for each event:
1. Read `state`. Skip the event entirely if not `"in"`.
2. Emit the 3 score assets with `active: true`.
3. Fetch `summary?event=<event_id>` for that league's `sport_path`. Cache in a `HashMap<(String, String), Summary>` keyed by `(sport_path, event_id)` for the duration of this `fetch_assets` call.
4. For each stat in the sport's catalog, emit `home` and `away` assets.

All other previously-registered sports assets vanish from this cycle's output → sync engine flips them to `is_active = false`. When the same event later transitions to `state == "post"`, it stops appearing and gets deactivated. When a new event hits `"in"`, it re-registers with a full asset set.

This means: settlement of pre-game and post-game markets is handled by the sync engine's normal deactivation path. The Vision batch system already tolerates assets that go inactive — last published value is used, batches close naturally.

### `fetch_prices`

Two paths now:

1. **Score path** (existing): asset ID matches `*_{home|away|total}` only. Group by league, fetch scoreboard, emit score values.
2. **Stat path** (new): asset ID matches `*_{statName}_{home|away}`. Group by `(league, event_id)`, fetch summary per event, look up stat value in boxscore.

Both paths share the per-sync summary cache so `fetch_assets` priming the cache means `fetch_prices` reuses it. Cache TTL = single sync cycle (cleared between cycles).

If the summary fetch fails for an event mid-cycle, score path still works (uses scoreboard). Stat assets for that event are skipped — sync engine will leave their last value as-is, no fake zeros.

### Normalization

ESPN's boxscore returns `displayValue` (string) and sometimes `value` (number). Rules:

- Plain integer (`"16"`): parse as `Decimal`.
- Decimal (`"45.1"`): parse as `Decimal`.
- Percentage as fraction (`"0.8"`) — confirmed for soccer `passPct`: multiply by 100 (publish as 80, not 0.8). Apply to every `*Pct` field.
- Time format (`"32:14"` for NFL `possessionTime`): convert to seconds.
- X-Y format (`"4-12"` for NFL `thirdDownEff`): keep numerator only as the asset (publish `4`, not `4/12`).
- Negative or missing: skip the price update for this tick (don't publish 0; that's a lie).

Each sport's normalizer lives in its own small function so a broken rule for soccer can't poison NBA.

### Rate limit

Stay at 30/min. Worst-case observed in plan math is 10.4/min. If we hit 429s in prod, bump to 60/min — ESPN's site tolerates it.

## Phasing

Each phase is one commit, one file (`client.rs`), no frontend changes (the line-map already prefix-matches `sport_`).

| Phase | Scope | Risk |
|-------|-------|------|
| 1 | Gate (`state == "in"` only) + sync_interval 120s → 300s | Low. One match-statement. Pre-game markets disappear immediately. |
| 2 | Soccer stat catalog + summary fetch + parser update + per-sync cache | Medium. New code path, asset ID format change. Test on EPL live match before rollout. |
| 3 | NBA + WNBA stat catalog | Low after Phase 2. New field names only. |
| 4 | NFL stat catalog (includes time + X-Y parsers) | Medium. Normalizer surface. |
| 5 | NHL + MLB | Low. Smaller catalogs. |

Phase 1 ships first and stands alone — it removes the symptom in the screenshot without depending on the rest.

## Open questions before code

1. **Should `state == "post"` markets stay active for one final cycle to publish the final score, or deactivate immediately?** Current proposal: deactivate immediately. Vision batches already settle on last seen value. Confirm.
2. **What happens to in-progress Vision batches when an asset deactivates mid-batch?** Need to confirm the batch poller drops it cleanly or holds the last seen value. (Behaviour exists in `sync_engine.rs` but not verified end-to-end for sports specifically.)
3. **Halftime — `state` flips briefly to `"halftime"` for soccer.** ESPN may report it as `"in"` with a halftime status name, or as a distinct state. Need to grep an actual halftime payload before freezing the gate. Default: treat halftime as `"in"` so markets stay live.
4. **Source-page URL changes.** `generalmarket.io/source/sports/market/sport_bundesliga_747019_away` is the current URL form. New stat assets get URLs like `sport_bundesliga_747019_possessionPct_away`. Frontend resolves on prefix, so this should just work, but worth a single sanity click in dev before declaring victory.

## Rollback

Phase 1 rollback: revert one branch in `fetch_assets`. Stats re-register, pre-game markets reappear.
Phase 2+ rollback: revert the per-phase commit. Sync engine deactivates the orphaned stat assets in one cycle; chart shows them flat-lining at last value until they age out of the UI.

No DB migration. No frontend change. No on-chain change. This is purely a data-node concern.

## Acceptance

- Open `generalmarket.io/source/sports` during a live EPL or Bundesliga match.
- Confirm: pre-game and finished matches no longer appear as live markets.
- Confirm: at least one match shows ~29 markets, of which ≥ 10 changed in the last 5 minutes.
- No 429s in data-node logs over a full match weekend.
- No `Too many open files` or similar regression — this source is one fetch loop, no new connections.
