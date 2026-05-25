# DeFi flow reels — the engine

One data shape drives two looks. Feed it numbers and logos; it draws the reel.

- **`FlowReel`** — horizontal diverging bars: gains right in gold, losses left
  in red. The full field, winners and losers.
- **`CrtBarReel`** — the RetailPnLMarketsReel cathode look: a light ruled screen
  bowed like a CRT, neon columns rising above backlit logo cards, **winners
  only**. This is the one that ships to Twitter.

Both read the same `FlowDataset`. You never touch the components.

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
