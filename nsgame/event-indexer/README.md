# prediction-market-indexer

A long-running daemon that subscribes to the Solana prediction-market
program's log stream, decodes the six Anchor events, and writes them to
Postgres. The frontend reads from those tables. Nothing else here is
clever.

## Prerequisites

- **Solana RPC** reachable over WebSocket (`logsSubscribe`). Public
  mainnet-beta endpoints rate-limit aggressively — use a dedicated
  provider or run your own validator.
- **Postgres 13+** with `CREATE SCHEMA` privileges for the user in
  `POSTGRES_URL`. The schema defaults to `prediction_market`.
- **Rust 1.93+** to build.

## Environment

| Variable           | Required | Default                                  | Purpose |
| ------------------ | -------- | ---------------------------------------- | ------- |
| `RPC_HTTP_URL`     | yes      | —                                        | HTTP RPC. Used to resolve block times. |
| `RPC_WS_URL`       | no       | derived from `RPC_HTTP_URL`              | WebSocket RPC. `http(s)://` → `ws(s)://`. |
| `PROGRAM_ID`       | no       | `DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA` | Program to watch. |
| `POSTGRES_URL`     | yes      | —                                        | libpq-style connection string. |
| `POSTGRES_SCHEMA`  | no       | `prediction_market`                      | Schema name. Must match `[A-Za-z0-9_]+`. |
| `RUST_LOG`         | no       | `info,prediction_market_indexer=debug`   | Log filter. |

## Running

```bash
export RPC_HTTP_URL="https://api.mainnet-beta.solana.com"
export POSTGRES_URL="postgres://indexer:secret@localhost:5432/solana"
cargo run --release
```

The schema is applied on every boot via `schema.sql`; every statement is
`IF NOT EXISTS` or `OR REPLACE`, so re-runs are no-ops.

## Writing is idempotent

Every event table has `signature TEXT PRIMARY KEY` with
`ON CONFLICT DO NOTHING`. Restarting the daemon against the same log
stream is safe. A proper backfill mechanism (periodic
`getSignaturesForAddress` sweep) is not implemented — during a long
disconnect, events may be missed. Add it if that matters more than the
current "best-effort near-realtime" posture.

## Systemd

A unit file is checked in at `deploy/systemd/prediction-indexer.service`.
Drop it at `/etc/systemd/system/`, edit `/etc/indexer.env` with the
variables above, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now prediction-indexer
sudo journalctl -u prediction-indexer -f
```

## Tables

All under `${POSTGRES_SCHEMA}`:

- `transactions(signature, slot, block_time, observed_at)` — one row per tx.
- `market_instantiated(signature, slot, block_time, log_index, market, source_id, close_time, settlement_time, threshold_bps, creator)`
- `bet_placed(signature, slot, block_time, log_index, market, owner, side, amount)`
- `bet_exited(signature, slot, block_time, log_index, market, owner, side, amount)`
- `market_closed(signature, slot, block_time, log_index, market, baseline_price)`
- `market_resolved(signature, slot, block_time, log_index, market, baseline_price, final_price, outcome_yes, force_resolved)`
- `claimed(signature, slot, block_time, log_index, market, owner, net, fee, stranded)`

`LISTEN/NOTIFY` channels: `pm_bet_placed`, `pm_market_resolved`,
`pm_claimed`. Each payload is the transaction signature — consumers
re-query for the row.

## What this is not

A historical backfill tool. A consensus oracle. A correction path for
corrupted rows. A replacement for reading the chain when you need
authoritative state. Everything here is a convenience projection for
the frontend — Postgres is a cache, the chain is truth.
