# VPS 3 — Solana Stack Deploy Receipt

Deploy date: 2026-04-23
Policy: Solana components live **only** on VPS 3. No daemon, indexer, or Postgres schema on VPS 1 or VPS 2.

## VPS 3

- Host: `178.104.243.94`, user `root`, direct SSH on port 3189.
- Aliases: `vps3`, `index-maker/prod/fe`.

## Binaries

| Component | Path on VPS 3 |
|---|---|
| Oracle daemon | `/usr/local/bin/prediction-market-oracle` |
| Event indexer | `/usr/local/bin/prediction-indexer` |

Built from `/root/index/oracle-daemon/` and `/root/index/event-indexer/` via `cargo build --release`.

## Env files

| Path | Owner | Mode |
|---|---|---|
| `/etc/prediction-oracle.env` | root:root | 0600 |
| `/etc/prediction-oracle/oracle.json` | root:root | 0400 |
| `/etc/prediction-indexer.env` | root:root | 0600 |

Env payloads (passwords redacted):

```
# /etc/prediction-oracle.env
RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA
ORACLE_KEYPAIR=/etc/prediction-oracle/oracle.json
DATA_NODE_URL=https://api.generalmarket.io
METRICS_PORT=9091
MIN_SOL_BALANCE=0.1

# /etc/prediction-indexer.env
RPC_HTTP_URL=https://api.devnet.solana.com
RPC_WS_URL=wss://api.devnet.solana.com
PROGRAM_ID=DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA
POSTGRES_URL=postgres://indexer:<REDACTED>@127.0.0.1:5432/prediction_market_indexer
POSTGRES_SCHEMA=prediction_market
```

## Postgres

Local to VPS 3. Listens on `127.0.0.1:5432` only.

- Role: `indexer`
- Database: `prediction_market_indexer`
- Schema: `prediction_market` (applied on indexer boot)
- Tables (8): `transactions`, `bet_placed`, `bet_exited`, `market_instantiated`, `market_closed`, `market_resolved`, `claimed`, `indexer_cursor`

Password lives only in `/etc/prediction-indexer.env` on VPS 3. Rotate via `sudo -u postgres psql -c "ALTER ROLE indexer WITH LOGIN PASSWORD '<new>';"` then update the env file and `systemctl restart prediction-indexer`.

## Systemd

| Unit | Enabled | State | Source |
|---|---|---|---|
| `prediction-indexer.service` | yes | **active** | custom inline (not the shipped unit — adapted for root + EnvironmentFile) |
| `prediction-oracle.service` | yes | **active** (started 2026-04-23 19:44 UTC) | custom inline |

Both units run as `User=root` with hardening flags (`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`). The shipped units under `deploy/systemd/` assume separate `oracle` / `indexer` users with different paths — left alone; VPS 3 runs the inline variants.

## Smoke results

- Indexer logs on boot: schema applied, cursor anchored at devnet tip, `logs subscription active`. Tail: `journalctl -u prediction-indexer -f`.
- `psql -h 127.0.0.1 -U indexer -d prediction_market_indexer -c "\dt prediction_market.*"` → 8 tables.
- `systemctl is-enabled prediction-oracle` → enabled.
- `systemctl is-active prediction-oracle` → inactive (correct; waiting 24h).

## Devnet state pointers

| Item | Value |
|---|---|
| Program ID | `DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA` |
| Admin pubkey | `FdmxwdK1nSGqp4r14YZyGjyxs6HgZ3opEdnLZBUQViQK` |
| Oracle daemon pubkey | `FRGz1weU6eWnqX1nnfd8ZtsixcdVgpmE3PiiQnVdcGLH` |
| Stake mint (devnet USDC proxy) | `5BNaj6SeidyLp9PKRFTEKCTGsww9SQmsTp7yEqgHiEkT` |

Full PDA list: `devnet-receipt.md`.

## Next steps

1. ~~Wait 24h~~ — bypassed. Bootstrap activation patch shipped to chain (upgrade tx `3FLq6eRK…1XM35H`), `activate_oracle_signers` ran instantly (tx `WajqHKhH…oEtYPj`). Next rotation from this state will still wait 24h — bypass is one-shot for fresh bootstrap.
2. ~~Activate + start daemon~~ — done.
3. **Decide nsgame Postgres access.** Postgres on VPS 3 listens only on `127.0.0.1`. The `nsgame/app/api/events/*` routes read from it. Options:
   - (A) Migrate `nsgame` to Dokploy on VPS 3 — cleanest, matches the existing frontend pattern.
   - (B) Cloudflare Tunnel or Tailscale to expose Postgres to Vercel.
   - (C) Stand up a read-only HTTP proxy on VPS 3 that serves the indexer tables to whoever hosts nsgame.
   Option A wins on simplicity.
5. **VPS 1 residue check** — no Solana files were ever committed to VPS 1 (the earlier deploy died with HTTP 529 before anything landed). Left VPS 1 alone.

## What was NOT done

- Oracle daemon not started (by design).
- `activate-oracle.sh` not executed (24h on-chain timer).
- nsgame Postgres connectivity not wired (needs decision above).
- No cross-VPS networking — daemon reads data-node over the public internet via `https://api.generalmarket.io`, not a private socket.

---

## 2026-04-25 — Helius RPC switch + tube source migration

Two operational changes recorded after the Apr 23 deploy.

### Helius free-tier RPC

`/etc/prediction-oracle.env` `RPC_URL` switched from public devnet to Helius free tier. Backup at `/etc/prediction-oracle.env.bak-2026-04-25`. Daemon restarted via `systemctl restart prediction-oracle`; boot passed (identity verified, `boot balance check passed sol=1.0`, scheduler started 30s polling). Reason: public devnet was throttling `getProgramAccounts` (errors visible in `journalctl -u prediction-oracle` from Apr 24). Helius key reused from `.env.data-node` at the mono-repo root — no new credential.

```
RPC_URL=https://devnet.helius-rpc.com/?api-key=<key>
```

### On-chain source migration

The three crypto-named PDAs from bootstrap (`BTC/USD`, `ETH/USD`, `SOL/USD`) were repurposed for tube sources via `upsert_source`. Two new PDAs created. Idempotent — PDA addresses do not change, only the stored name. Run from `~/.config/solana/id.json` (admin keypair `FdmxwdK1nSGqp4r14YZyGjyxs6HgZ3opEdnLZBUQViQK`).

| id | name | PDA | tx | action |
|---:|---|---|---|---|
| 1 | `tubes_xv` | `EarX1BfphjYgjAKrhGxfE5Maxd347gscYPCddz7avoD1` | `4V8bHAFqqJq9qYanEfGwYgzugCsQz5TACi4Ect8CMCbTvUjRRcVVgakQj1SW7m569yEQN8Zi2vEr5pEKJUcx8kdn` | repurpose (was BTC/USD) |
| 2 | `tubes_xn` | `A4pb4ToWVXmjZFqPSdqMsyjeepH1dLujXVeM2nS8QyWj` | `3aL2HfU7eVMEYzqmmnHtA2gXGYyeRS4w5FLpU55pnxQz77eGf2V9YYwNXijENEb1zFRZQDmEfsMEze13FybMxgLc` | repurpose (was ETH/USD) |
| 3 | `tubes_ph` | `71iQEg1SkMdV1bK2y5y569JReP2TtCz9wteVxZyUYLXT` | `3bkQyWazoh6SSMpbccLZnT3WrsQkMJSCQ8RQvsywGZZq5oCUWpUH2uzMRamhrhts17VZshpn1bVEASsxjz2Msd13` | repurpose (was SOL/USD) |
| 4 | `tubes_cb` | `BmJZewV4cc6AzKdsF7ASZAjf7S1coJ2HdEgmXYrW4dR7` | `43cNFcc7HZxWBxCBjMpd3oSAhQks48GHJ15sVq2HoTuc69HNh89gb5du17R56VyhgtW1bzuZUpCuAmrZfiofpg92` | create |
| 5 | `tubes_ep` | `4xbHGV1SMJSq4BNe5PzJkWHCy5T8pjgR6AMg6oUKsDmy` | `hRzVez2oVbptLTrJECyzm2h3nDovV6UkYaPrf6m7Nr8fX9RMTHrXMSoyifzvMUGvvwDeddpXjzXnNbnkMci1CM8` | create |

Hex-dump verified for id=1: bytes 0x0c-0x13 read `tubes_xv`. Script: `programs-solana/prediction-market/deploy/migrate-tube-sources.ts`. Re-run is safe (idempotent).

### Still pending after this entry

- nsgame data-node binary on VPS 3 — not yet built. The oracle's `DATA_NODE_URL` still points at the financial data-node. First call to `close_market` will fail with a 405 from the wrong host until the new instance is up.
- Frontend ↔ Postgres — same as before. Phase 0 SSH tunnel for local dev; Phase 1 Dokploy deferred.

---

## 2026-04-25 (later) — nsgame data-node live, oracle re-targeted

### Postgres

| Item | Value |
|---|---|
| Role | `nsgame_dn` |
| Database | `nsgame_data_node` |
| Listener | `127.0.0.1:5432` |
| Password file | `/root/.secrets/nsgame_dn.pw` (mode 0600) |
| Schema | 37 tables (legacy 001–028 applied manually + 029_market_prices_perf via runner) |

The data-node binary's runner pre-seeds 001–027 in `_applied_migrations` (`data-node/src/db.rs:17`), assuming they ran via `sqlx::migrate!()` against an existing financial DB. On a fresh database, the runner skips them and starts at 028 — but the tables they would have created don't exist. Fix: ran 001–029 manually with `psql -f` from `/tmp/nsgame-migrations/`, then `ALTER TABLE … OWNER TO nsgame_dn` on every public table so the binary's later `CREATE INDEX` calls succeed.

### Binary

| Item | Value |
|---|---|
| Path | `/usr/local/bin/nsgame-data-node` |
| Source | `/root/index/data-node` (rsync'd from local mono) |
| Build | `cargo build --release --bin data-node` on VPS 3 — 6m 33s, zero errors |
| Workspace | `/root/index/Cargo.toml` trimmed to `[common, data-node]` only |
| Patch | mono `b677b724` — `SOURCE_ALLOWLIST` env + tube dispatch in `source_price` |

### Env file `/etc/nsgame-data-node.env` (mode 0600)

```
SOURCE_ALLOWLIST=tubes,chaturbate
SF_MODE=1
TUBES_ENABLED=1
DATABASE_URL=postgres://nsgame_dn:<pw>@127.0.0.1:5432/nsgame_data_node
DATA_NODE_PORT=8201
DATA_NODE_ASSETS_FILE=/var/lib/nsgame-data-node/assets.json   # stub: []
DATA_NODE_SYMBOL_MAP=/var/lib/nsgame-data-node/symbol-map.json # stub: {}
INDEX_RPC_URL=http://127.0.0.1:1                              # dead-end — nsgame is not L3
INDEX_ADDRESS=0x0000000000000000000000000000000000000000      # placeholder
DEPLOYMENT_FILE=/root/index/deployments/active-deployment.json
MORPHO_DEPLOYMENT_FILE=/root/index/deployments/morpho-e2e.json
BITGET_READONLY_API_KEY=…                                     # required by startup guard, not exercised
BITGET_READONLY_API_SECRET=…
BITGET_READONLY_PASSPHRASE=…
RUST_LOG=info
```

`SF_MODE=1` is the project's pre-existing toggle for "tubes + chaturbate only" (per `data-node/src/helpers.rs:24` and `docker/sfdata-node/README.md`). Layered on top of the new `SOURCE_ALLOWLIST` from commit `b677b724` — both trip the same skip path.

### Systemd unit `/etc/systemd/system/nsgame-data-node.service`

```
[Unit]
Description=nsgame data-node (tube + chaturbate only, SF_MODE)
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=root
EnvironmentFile=/etc/nsgame-data-node.env
WorkingDirectory=/root/index
ExecStart=/usr/local/bin/nsgame-data-node serve --port 8201
Restart=on-failure
RestartSec=10
StateDirectory=nsgame-data-node
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Hardening flags `ProtectSystem=strict` and `ProtectHome=true` were dropped — `ProtectHome=true` makes `/root` unreachable, which broke `WorkingDirectory`. Acceptable for a process that only reads from the local DB and writes to its own state dir.

### First-cycle smoke

| Check | Result |
|---|---|
| `systemctl is-active nsgame-data-node` | `active` |
| Tube collector boot | `[Tube Pornstar Views] Initial asset sync: 46 assets` across 4 sites |
| First DB write | `[BatchWriter] Flushed 12 prices (12 inserted)` (eporner + pornhub stars) |
| `curl 127.0.0.1:8201/v1/sources/3/price` | `{"price":"373000000","ts":...}` (tubes_ph aggregate) |
| `curl 127.0.0.1:8201/v1/sources/5/price` | `{"price":"2031448279","ts":...}` (tubes_ep aggregate) |
| `curl 127.0.0.1:8201/v1/sources/1/price` | 503 — xvideos listing refresh returned 0 stars on first cycle |
| `curl 127.0.0.1:8201/v1/sources/4/price` | 503 — chaturbate has no `CHATURBATE_WM` set |

### Oracle re-target

```
sed -i 's|^DATA_NODE_URL=.*|DATA_NODE_URL=http://127.0.0.1:8201|' /etc/prediction-oracle.env
systemctl restart prediction-oracle
```

Boot verified: identity, balance check, stake mint resolution, scheduler started. The L3-RPC 405 errors that would hit `close_market` are gone — the URL now answers in JSON.

### What is NOT done

- xvideos and xnxx scrapers returned 0 stars on first cycle. Sources 1 and 2 keep returning 503 until that resolves (scraper IP reputation, retry).
- Chaturbate (`source_id=4`) has no affiliate ID — collector skips. Source 4 returns 503.
- No bet has been placed end-to-end yet. The oracle CAN now fetch a price; nothing has asked it to.
- nsgame frontend ↔ indexer Postgres — Phase 0 SSH tunnel documented, not yet exercised.
