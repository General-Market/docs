# /source/[sourceId] — Apple-style rebuild

Five slices, parallel agents, one final wiring pass.

## What we are doing

The current page (`SourceDetailV2.tsx`) is seven sections in a fight. We rebuild it in the spirit of apple.com's homepage: one rail on the left, a featured object in the hero, a small set of secondary rails, and tabs for everything that used to scream above the fold.

Underlying market data is not the headline anymore. **Vaults and bots are.** Markets, round history, and leaderboards retreat into tabs.

## Reference materials

- Apple style table: `docs/apple-style-table.md`
- Apple tokens CSS: `frontend/styles/apple-tokens.css`
- Existing source page: `frontend/app/[locale]/(app)/source/[sourceId]/page.tsx` and `frontend/components/domain/vision/detail/SourceDetailV2.tsx`
- Existing backtest visualization (the visual grammar to mimic): `frontend/components/domain/simulation/SimPerformanceChart.tsx`, `SimHoldingsTable.tsx`, `SimStatsGrid.tsx`
- Bot examples repo: `https://github.com/General-Market/vision-bot-examples/tree/main/<sourceId>`

## The five slices

### Slice 1 — Apple sidebar + source tab nav

**Owner files (build new):**
- `frontend/components/domain/vision/detail/SourceSidebarApple.tsx`
- `frontend/components/domain/vision/detail/SourceTabNav.tsx`

**Do NOT edit:** `SourceDetailV2.tsx` (the wiring pass owns it).

**Behavior:**
- Single left rail, flush to viewport edge, glassless, hairline border. Width 240px on lg+, collapses to icon-only on md, hidden on mobile (handled by `SourceSidebarMobile` already).
- Three groups in the rail: source identity at top (logo, name, category), then category-peer sources, then a "My data" group (bets / vaults / bots) and a "Build" group (bot, vault).
- Tab nav: pill-rounded, 980px radius, hairline divider beneath. Tabs: Overview · Vaults · Bots · Markets · Activity · Leaderboard. Active tab gets `text-text` and a 1px underline; inactive `text-text-secondary`.
- Reuse Apple tokens from `apple-tokens.css`. Body 17px, tracking `-0.022em`. Pill radius `--r-pill` (980px).

**Cioran voice on labels:** group headers in lowercase, terse. "for you", "build". No "Welcome!" anywhere.

### Slice 2 — Featured vault hero + Up Next rail

**Owner files (build new):**
- `frontend/components/domain/vision/detail/FeaturedVaultHero.tsx`
- `frontend/components/domain/vision/detail/UpNextRail.tsx`

**Behavior — Hero:**
- Replaces the existing SourceHero visually. Two-thirds width on lg+. Inside: vault name, one-line description, NAV sparkline (no per-trade markers — the vault has 1000 fills/block, markers would be unreadable), three stat pills (NAV, all-time return, depositors), one CTA `Deposit →` linking to `/source/[id]/vault/[vaultAddress]`.
- Existing data only. Hook into `useFeaturedVault(sourceId)` if it exists; otherwise stub the hook and read from `useVaults(sourceId)` taking the largest by NAV. Document the choice.

**Behavior — Up Next rail:**
- Four cards, 1/3-width column on lg+, stacked.
  1. **Round closes in Xm** — current betting round countdown, links to overview.
  2. **Newest vault** — most recently deployed vault on this source.
  3. **Top bot 7d** — top performing bot from GitHub manifest (Slice 4 owns the data; this slice imports the hook by name and stubs locally).
  4. **Your open round** — if wallet has a position, link to it; otherwise hide.

**Cioran voice on copy:** "round closes in 4m" not "Round closing soon!". No exclamation marks. No "exciting".

### Slice 3 — Vault portfolio panel (the deep one)

**Owner files (build new):**
- `frontend/app/[locale]/(app)/source/[sourceId]/vault/[vaultAddress]/page.tsx`
- `frontend/components/domain/vision/vault/VaultPortfolioView.tsx`
- `frontend/components/domain/vision/vault/VaultAssetRow.tsx`
- `frontend/components/domain/vision/vault/VaultAssetDetail.tsx`
- `frontend/app/api/vision/vault/[vaultAddress]/assets/route.ts`
- `frontend/app/api/vision/vault/[vaultAddress]/assets/[assetId]/fills/route.ts`

**Behavior — Page:**
- Route: `/source/[id]/vault/[addr]`. Header: vault name, NAV, all-time return, depositors, markets-touched count.
- Asset list (aggregated): one row per `(vault, asset_id)` the vault has touched, sortable by PnL / Volume / Recent. Each row: market name, fills count, avg entry, realized PnL, unrealized PnL, ↗/↘ trend pill.
- Click row → `VaultAssetDetail.tsx` slides in (same route, query param `?asset=<assetId>`, no full nav). Shows the asset's price/probability chart with the vault's fills as scatter overlay (buys triangles up, sells triangles down, marker size scaled to fill size). Time bucketing: if a single asset has > 500 fills, group fills into time-bucketed clusters (1m / 5m / 1h / 1d) per zoom level. Below the chart: a virtualized fills table.

**Indexer reality:**
- The data-node holds vault fills. Start there: `data-node/src/` and the existing `/api/vision/*` routes that already proxy data-node. Inspect schema with `psql` against the data-node Postgres if needed (env vars in `data-node/.env`-style files; on prod, see VPS 1).
- Confirm: are fills tagged with `vault_address`, or only `trader_address`? If vaults trade as their own wallet, group by `trader_address == vault_address`. If a router sits in front, find the tag the data-node already exposes.
- **If the tag is genuinely missing:** still ship the UI. Build the API route to return `{ assets: [], _stub: true, reason: "<exact reason>" }`. Document the gap under "Blockers" in this plan file. Do NOT touch the data-node schema in this slice — surface the requirement, do not implement it.

**Reuse:** the price chart should be the same component used on `frontend/app/[locale]/(app)/source/[sourceId]/market/[assetId]/page.tsx`. Find it, lift it into a shared place if needed, and overlay fills as a scatter series.

**Cioran voice on copy:** "847 markets touched" / "142 fills" / "realized +$1,240". No "Awesome performance!".

### Slice 4 — Trending bots from GitHub

**Owner files (build new):**
- `frontend/components/domain/vision/detail/TrendingBotsRail.tsx`
- `frontend/app/api/vision/bots/trending/route.ts`

**Behavior:**
- API route fetches `https://api.github.com/repos/General-Market/vision-bot-examples/contents/<sourceId>` once per hour (server-side cache: `revalidate = 3600`). Returns: `[{ name, path, lastCommitAt, htmlUrl, sparkline7d? }]`.
- For each top-level folder under the source path, treat as a bot. Read its `README.md` if present for description. (Optional: read a `meta.json` if the convention adopts one — but don't block on it.)
- Performance data: leave a stub field `sparkline7d: null` for now. The on-chain runner data is a follow-up.
- Card click → opens `htmlUrl` in a new tab. CTA reads `View on GitHub →`.
- Component: 4 cards in a 4-up grid on lg+, 2-up md, 1-up mobile. Use Apple card treatment (`--surface`, `--r-md`, hairline border, hover lifts brightness slightly).

**Resilience:** rate-limit fallback. If GitHub returns 403/429, return `{ bots: [], _stub: true }` and the rail renders a single "View on GitHub →" link to the source folder. Don't throw.

**Cioran voice on copy:** card title is bot name, second line is last commit date in plain prose ("last edited 3 days ago"), CTA is `View on GitHub →`.

### Slice 5 — Tab pages (markets, activity, leaderboard)

**Owner files (build new):**
- `frontend/app/[locale]/(app)/source/[sourceId]/markets/page.tsx`
- `frontend/app/[locale]/(app)/source/[sourceId]/activity/page.tsx`
- `frontend/app/[locale]/(app)/source/[sourceId]/leaderboard/page.tsx`

**Behavior:**
- Each page reuses the layout shell (Header, Footer, sidebar from Slice 1 — import by name; if the file does not exist yet, stub it locally with a div and TODO comment).
- `markets/page.tsx` mounts the existing `SubmarketsGrid` component, full-width.
- `activity/page.tsx` mounts the existing round history (extract from `SourceDashboard` if needed — copy, do not destructively cut, the wiring pass will dedupe). Below it: recent bets table (also from `SourceDashboard`).
- `leaderboard/page.tsx` mounts the existing `TopPlayers` component, full list (no truncation).
- Each page has the tab nav active at its tab. `generateMetadata` sets a per-tab title.

**Cioran voice on copy:** page H1 mirrors tab name. "Markets". "Activity". "Leaderboard". Nothing else.

## Final wiring (after all 5 agents complete)

The main session does this. Not the agents.

1. Read every new file each agent produced.
2. Refactor `SourceDetailV2.tsx` to: import the new sidebar, hero, up-next rail, trending bots rail, and tab nav. Remove the right sidebar. Remove the inline `SourceHero` import. Remove the `SourceDashboard` import (its content moved into the activity tab).
3. Delete or archive the old `SourceHero.tsx`. Wait — confirm no other page imports it.
4. Run `npx tsc --noEmit` in `frontend/`. Fix all errors.
5. Run `npx next lint --quiet` in `frontend/`. Fix all errors.
6. Open `http://localhost:3000/source/polymarket` in a real browser. Walk the flow: hero → click vault → asset list → click row → fills overlay → tabs → bots rail → GitHub link.
7. Commit on `main`. `git push mono main`. Dokploy redeploys.

## Voice — non-negotiable

All user-facing strings (labels, headers, CTAs, error messages) follow Cioran voice. Short. Declarative. No "Awesome!", "Exciting!", "Welcome to your dashboard!". Refer to `~/.claude/CLAUDE.md` voice section. The agents do not read that file — each agent prompt includes this rule explicitly.

## Verification gates per agent

Each slice agent must, before declaring done:
- `cd frontend && npx tsc --noEmit` — zero errors
- `cd frontend && npx next lint --quiet` — zero errors in files they touched
- Commit their slice with a descriptive message, then `git push mono main`. They are authorized to push.

## Blockers (filled in as discovered)

- *Slice 3:* indexer fill tagging — TBD by Slice 3 agent. Surface in this section.

## Out of scope for this pass

- Mobile redesign of the new layout — desktop first, mobile is a follow-up.
- Localization of new strings beyond English — translation files updated as a follow-up.
- Changes to the indexer — surfaced as a requirement, not implemented.
- Changes to `/sources` (the index page) — separate.
