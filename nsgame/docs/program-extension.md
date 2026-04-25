# Option not chosen · 2026-04-25 · extending the program to support arbitrary asset_id

This is the path we considered and did not take. Preserved here so that a future reader knows it was weighed, not missed. The decision we did take lives in [`twenty-five-forever.md`](twenty-five-forever.md).

## The shape it would take

The `Market` PDA gains a fixed-size asset identifier as a seed:

```
seeds = [b"market", source_id, asset_id: [u8; 32], threshold_bps, close_time, settlement_time]
```

The oracle's close and resolve payloads gain a 32-byte `asset_id` field. The domain tags rotate — `nsgame.market.v2` instead of `v1` — so old signatures are not replayable against new accounts. Every signer re-keys, or at minimum re-signs against the new tag.

The data-node grows a query parameter. `GET /price?source=tubes_xv&asset_id=<32 bytes hex>&ts=<unix>` returns the price for one named subject, not a site aggregate. The collector keys its rows by `(source, asset_id, ts)`.

The market id, sketched:

```
market_id = hash(source_id, asset_id, threshold_bps, close_time, settlement_time)
```

The oracle signs `(source_id, asset_id, ts, price, tag)` instead of `(source_id, ts, price, tag)`. Every byte that crosses the wire is documented; nothing is implicit.

## Why we didn't pick it

Weeks of program work. A full re-deploy. Every existing market PDA reset to zero. Every signer re-keyed and re-registered. No working product during the transition. The product, mid-migration, would be a sequence of plausibly-correct artifacts pointing at each other through the wrong domain tag.

We had a smaller path that ships now. We took it.

## When this becomes the right call

Two signals, either one sufficient:

- We want more than 25 markets simultaneously. Not 30, not 50 — enough that hardcoding feels obviously wrong, where the catalog stops fitting on one screen.
- We want truly per-asset markets. "Star X gains 600M views in 24h" — single name, not pair. The current schema cannot encode that. This one can.

Until either signal arrives, the existing 25-pair catalog is enough. Cost exceeds value. We wait for the bet that proves the design wrong.

## The contract this would enable

A market is a subject and a question. Today a market is a source and a pair-index — the subject is implicit in the off-chain catalog. With `asset_id` on-chain, the subject becomes part of the bet's identity. New markets stop requiring redeploys. Programmatic catalog refresh becomes a worker, not a release.

That is the version of the system we will eventually want. It is not the version we ship today.
