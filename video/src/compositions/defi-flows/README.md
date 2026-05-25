# DeFi flow reels — the engine

One data shape drives two looks. Feed it numbers and logos; it draws the reel.

- **`FlowReel`** — horizontal diverging bars: gains right in gold, losses left
  in red. The full field, winners and losers.
- **`CrtBarReel`** — the RetailPnLMarketsReel cathode look: a light ruled screen
  bowed like a CRT, neon columns rising above backlit logo cards, **winners
  only**. This is the one that ships to Twitter.

Both read the same `FlowDataset`. You never touch the components.

## Choosing the right data (do this before you write numbers)

A reel is only as good as the metric it ranks. Work it in this order.

**1 — Find the roster.** The categories are the data-node's curated batches in
`data-node/src/config/dl-curated.json` (`defillama-lending`, `-derivatives`,
`-prediction-market`, `-privacy`, `-rwa`, `-risk-curators`, …). Each lists ~10
DefiLlama slugs. That list is your row set.

**2 — Pull the real numbers from the data-node, not from a guess.** The series
live under source **`defi`** on VPS 1 (`ssh index-maker/prod/be`,
`localhost:8200`) — not `defillama`/`defillama-lending`, which return empty.
Per protocol: `GET /market/prices/defi/protocol_<slug>/history?from=&to=`.
Read `value` (USD) + `fetchedAt`; the change over a window is `value_now` vs the
point closest to `now − window`. Config asset_ids drift from live (`protocol_morpho`
is dead; the live key is `protocol_morpho-blue`) — confirm against
`/market/assets/defi` first. Other metrics exist as `fees_<slug>`, `rev_<slug>`,
`dex_24h_<slug>`; **`perp_24h_` is empty**, so perp *volume* isn't available —
that's why perps rank by TVL growth, not volume.

**3 — Pick the framing that makes growth land — `%` or `$`.** They disagree,
and the disagreement is the whole game:

- **percent** rewards the small fast-mover. Use it where an explosive challenger
  is the story (Privacy Cash +18.7%, Derive +12.9%). Set `mode: "pct"`.
- **dollars** rewards the giant. Use it where scale is the story and a percent
  bar would crown a $1M nobody over a $7B leader (Polymarket +$6.3M; RWA's
  nine-figure swings). Set `mode: "usd"`.

Compute both leaderboards, look at which top three feel like a "wow," choose
that mode. The losing metric still rides each row's sublabel, so nothing is hidden.

**4 — Pick the window for drama.** Blue-chip TVL barely moves in 24h; 7 days
opens the bars up. Longer window → bigger spread. Set it in `eyebrow` + `source`.

**5 — The reel is a photograph, not a feed.** The numbers you write are frozen
at the `asof` you stamp. Re-pull and re-render when you want fresh figures.

> The metric chooses the winner before the chart does. Choose it on purpose.

## Add a reel in three steps

**1 — Get the logos.** Each row needs one image at
`public/defi-flows/logos/<id>.jpg`. For DefiLlama protocols, one command pulls
them by slug:

```bash
node scripts/fetch-defillama-logos.mjs aave-v3 morpho-blue compound-v3
```

For anything else, drop a square-ish PNG/JPG there yourself, named by the `id`.

**2 — Write the dataset.** Add one object to `REELS` in `datasets.ts`. Two ways
to give numbers:

```ts
// Manual — you already know the growth number. Type it in `value`.
export const STABLES_FLOW: FlowDataset = {
  id: "StablesFlowReel",            // must end in "FlowReel"
  eyebrow: "7-DAY GROWTH",
  title: "Stablecoins",
  subtitle: "",                      // CrtBarReel writes its own
  source: "…",
  asof: "2026-05-25",
  logoBase: "defi-flows/logos",
  mode: "pct",                       // "pct" → +12.9% bars · "usd" → +$62M bars
  rows: [
    { id: "usde", name: "USDe", value: 12.9, level: 5_900_000_000 },
    { id: "usds", name: "USDS", value: 4.2 },
    { id: "pyusd", name: "PYUSD", value: -1.1 }, // a loser — dropped by CrtBarReel
  ],
};
```

```ts
// Live — give now + prior; the bar is the change, and the percent/dollar
// complement fills the sublabel automatically.
rows: [{ id: "morpho-blue", name: "Morpho", now: 7_379_000_000, prior: 7_333_000_000 }];
```

Then register the dataset in the array:

```ts
export const REELS: FlowDataset[] = [PERPS_FLOW, …, STABLES_FLOW];
```

**3 — That's it.** Both `StablesFlowReel` and `StablesWinnersReel` appear in the
studio under **DefiFlows**. No imports, no `Root.tsx` edits.

## Render for Twitter

```bash
npx remotion render src/index.ts StablesWinnersReel \
  ~/Downloads/twitter/stables-winners-2026-05-25.mp4
```

## Knobs on the dataset

| field        | effect |
|--------------|--------|
| `mode`       | `"pct"` ranks/labels by percent growth; `"usd"` by dollars |
| `metricNoun` | sublabel noun for the level — `"TVL"` (default), `"AUM"`, … |
| `brand`      | optional corner lockup (logo + label) — used by the lending reel |
| `tagLabel` / `tagColor` | pill on rows with `tag: true` (FlowReel only) |
| `value`      | bar height, used verbatim — skips the now/prior math |
| `level`      | size shown in the sublabel (defaults to `now`) |

The winner is whichever row scores highest; it wears the crown. Decliners
(`metric ≤ 0`) never appear in the cathode reel.
