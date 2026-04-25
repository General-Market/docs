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
