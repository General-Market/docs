# On-Chain Source-ID Mapping

The program registered three crypto pairs at bootstrap. The product no longer trades crypto. The PDAs remain — they cannot be unmade — so we rename them and move on.

## Today's on-chain state

These three Source PDAs were created at bootstrap. They are obsolete leftovers; the data-node never served them in earnest.

| source_id | name (current) | status | notes |
|---:|---|---|---|
| 1 | `BTC/USD` | enabled | bootstrap artifact |
| 2 | `ETH/USD` | enabled | bootstrap artifact |
| 3 | `SOL/USD` | enabled | bootstrap artifact |

## Proposed mapping

One source_id per tube site. Finer granularity buys nothing the data-node cannot handle on its own.

| source_id | name (proposed) | site | action |
|---:|---|---|---|
| 1 | `tubes_xv` | xvideos | repurpose |
| 2 | `tubes_xn` | xnxx | repurpose |
| 3 | `tubes_ph` | pornhub | repurpose |
| 4 | `tubes_cb` | chaturbate | new |
| 5 | `tubes_ep` | eporner | new |

Source accounts are PDAs seeded on `source_id`. You cannot delete a PDA, only toggle `enabled`. Repurposing 1–3 by changing the `name` is allowed — `upsert_source` is idempotent on id. The three crypto-named PDAs will live on devnet forever as artifacts; we just rewrite their names and enable state.

## Migration transactions

Five idempotent admin calls. The `name` argument is `[u8; 32]` — pad short strings with zero bytes.

```
upsert_source(1, b"tubes_xv" + zero-pad to 32, enabled = true)
upsert_source(2, b"tubes_xn" + zero-pad to 32, enabled = true)
upsert_source(3, b"tubes_ph" + zero-pad to 32, enabled = true)
upsert_source(4, b"tubes_cb" + zero-pad to 32, enabled = true)
upsert_source(5, b"tubes_ep" + zero-pad to 32, enabled = true)
```

Order does not matter. Each call mutates one PDA. Re-running them is harmless.

## Alternative considered

One source_id per market type — `xv-stars`, `xv-videos`, `xv-trending`, `xn-stars`, `ph-rank`, `cb-online`, `cb-viewers`, and so on. Maybe twenty ids in total.

Rejected. The program's resolution logic is per-source: one Source PDA, one price feed, one settlement. Splitting a site across many ids moves the dispatch table from the data-node — where it costs nothing to edit — onto the chain, where every change is a transaction. We would multiply admin work to gain a taxonomy nobody asked for.

Five sources. One per origin. The data-node decides the rest.

## How to apply

The bootstrap script lives at `programs-solana/prediction-market/deploy/bootstrap.sh`. Add the five `upsert_source` invocations there (or run them as a one-shot from a small TS script — the program client already exposes the instruction). The signer is the admin keypair: `~/.config/solana/id.json`, pubkey `FdmxwdK1nSGqp4r14YZyGjyxs6HgZ3opEdnLZBUQViQK`.

The same five ixs should land on each cluster the program targets (devnet now; mainnet eventually). Track which clusters have been migrated in a comment at the top of the bootstrap script — the chain will not remind you.

## Security note

`upsert_source` moves no funds. It writes a name string and a boolean. The admin-only check is the only gate. Safe to run.

But coordinate the rollout. Markets must not open against a source whose data-node has not yet shipped. See `docs/data-node-spec.md` for the serving contract; do not flip `enabled = true` on a source the data-node cannot answer for. An enabled source with no feed is a market that cannot resolve — and a market that cannot resolve is the cleanest way we know to lose users.
