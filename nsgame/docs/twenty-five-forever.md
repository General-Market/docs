# Decision · 2026-04-25 · twenty-five hardcoded pairs forever (until they aren't)

Twenty-five fights. Fifty names. No rotation. The catalog ships as code.

## Why

The on-chain `Market` PDA is keyed on `(source_id, threshold_bps, close_time, settlement_time)`. There is no `asset_id` field. We had a constraint and a bag of names — so we encoded the pair into the only seed the program would let us bend. `threshold_bps` carries the pair index, 1 through 25. The catalog itself is frozen in `nsgame/lib/markets/pairs.ts`. Stars take indices 1..15 against `source_id = 1` (`tubes_xv`). Cams take 16..25 against `source_id = 4` (`tubes_cb`).

A name is a category. The catalog is a frozen list.

## What this costs

Rosters cannot rotate per cohort without a redeploy. New names mean a new program deploy and a fresh set of PDAs. The cohort-rotation worker writes resolution rows into `pvp_resolutions` for the historical record — the audit trail is real — but it cannot refresh the active pair set on its own. The set is what the program was deployed to know.

## What this defers

Three things, named so they aren't quietly forgotten:

- Per-asset markets in general. Today every market is keyed by source, not by subject.
- Three-way races — A vs B vs C. The schema is binary because the seeds are binary.
- Programmatic catalog refresh. Names will not rotate without human action.

## What this earns

Two things, both small:

- Shippable today. The product exists. The chain serves it. One signature proves the loop.
- Provable end-to-end. The catalog fits on one screen. The bug surface fits in one head.

## When we'd revisit

When a real bettor places a real bet AND wants a market that isn't on the 25. Not before. Pick a real signal, not a hypothetical one. Until that signal arrives, the cost of rebuilding the program exceeds its value.

The other path — adding `asset_id` to the seed and rotating the domain tags — is preserved as a one-pager at [`program-extension.md`](program-extension.md). It is the option we did not pick.

## How this reads in honest language

We chose the less ambitious path and we know it. The catalog is small enough to read in one screen. Twenty-five fights is enough to learn whether anyone wants to bet at all. If they don't, no schema would have saved us. If they do, we'll have earned the right to redesign.

For now, the names are the names.
