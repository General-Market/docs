# Postgres Resilience — Three Additions

**Date:** 2026-05-10 (revised 2026-05-11 round 3)
**Author:** plan only, no implementation
**Scope:** VPS 1 Postgres (`127.0.0.1:5432`, database `index_prices`), the data-node and oracle pools that hammer it, and the frontend polling that triggers the hammering.

## Goal

Make Vision survive its own success. Today one slow query took the whole system down. Tomorrow it shouldn't be able to. Three changes, smallest blast radius first: a connection pooler, an HTTP cache, and a partitioned storage engine. None of them is exotic. All three together turn a fragile single-instance Postgres into something that absorbs load instead of amplifying it.

## Why now

Today's outage had three causes stacked on top of each other:

- **Tables outgrew the box.** `vision_asset_settlement_players` (55 GB, oracle migration `021`) and `market_prices` (83 GB, created by data-node migration `021_create_market_sources.sql` and indexed/pruned by `029_market_prices_perf.sql`) have indexes that no longer fit in `shared_buffers` (16 GB box, `timescaledb-tune` will set 4 GB). Sequential scans on cold blocks hit disk. Disk I/O serializes everything else.
- **No fan-in control.** Every backend (data-node, three oracles, AP, vision-keeper, vision-fast-joiner, itp-bot) opens its own sqlx pool. The data-node alone holds **70** connections (`data-node/src/db.rs:11-12`). Each oracle holds **15** (`oracle/src/main.rs:621-622`). Three oracles = 45. Add data-node = 115 *worst case*; observed today was 97. `max_connections=300` looks comfortable until you count peers, swarm, keeper, bot, replication, and `pg_dump` jobs converging.
- **No HTTP cache.** Frontend polling fans 65 concurrent `getMarketPrices` requests into the data-node's pool, each one a database hit. The slow query starves the pool. The pool starves every other route. The whole API goes dark.

The three additions, in order, address each layer: PgBouncer caps the fan-in, the data-node cache absorbs the polling, TimescaleDB stops the tables from growing into something Postgres can no longer plan against.

## Current state

### Tables and their sizes (verified `SELECT pg_size_pretty(pg_total_relation_size(...))`)

| Table | Size today | Migration | PK on prod (`\d`) | Time column | Append-only? |
|---|---|---|---|---|---|
| `market_prices` | **83 GB** | `data-node/migrations/021_create_market_sources.sql` (creates table; `id BIGSERIAL PRIMARY KEY`); `029_market_prices_perf.sql` adds covering index, sets aggressive autovacuum, runs a one-shot `DELETE` past 90 days | None on prod — verified `\d market_prices`, no `indisprimary` index. The migration declares `id BIGSERIAL PRIMARY KEY` but the live table has lost it (separate incident, predates this plan; do not relitigate) | `fetched_at` | Yes — collectors `INSERT`, never `UPDATE` |
| `vision_asset_settlement_players` | **55 GB** | `oracle/migrations/021_vision_asset_settlement_players.sql` | `(batch_id, asset_id, player)` | `settled_at` (default `NOW()`) | No — `ON CONFLICT DO UPDATE` (`oracle/src/vision/lifecycle.rs:1720`) |
| `vision_market_ratios` | **18 GB** | `oracle/migrations/018_create_market_ratios.sql` | `(batch_id, asset_id)` | `settled_at` (default `NOW()`) | No — `ON CONFLICT DO UPDATE` (`oracle/src/vision/lifecycle.rs:1690`) |
| `vision_round_players` | **164 MB** | `oracle/migrations/008_round_mode_clean.sql` | `(batch_id, player)` | `settled_at` (default `NOW()`) | No — `ON CONFLICT DO UPDATE` (`oracle/src/vision/lifecycle.rs:1634`) |

Two distinct schema problems split this set:

1. `market_prices` is append-only and has *no PK on prod*. Hypertable conversion is straightforward — nothing to drop, nothing to rebuild.
2. The three `vision_*` tables upsert at settlement and their PKs do not include the time column. TimescaleDB requires unique constraints to include the partitioning column, so each upsert constraint must be rebuilt to `(settled_at, batch_id, ...)`. The settlement code's `ON CONFLICT (batch_id, ...) DO UPDATE` then breaks unless `settled_at` is *deterministic per batch* — which it is not today (`NOW()`). Fixing that is a real refactor, not a one-liner. Phase 3 specifies it.

### Connection pools

| Service | Pool | Source | Process model on VPS 1 |
|---|---|---|---|
| data-node | `max_connections(70)`, `acquire_timeout=10s`, `idle_timeout=300s` | `data-node/src/db.rs:11-12` | **Native systemd** — `data-node-shadow.service` (`vps.md:26`). The `docker/testnet/data-node/` compose file is artifact and does not drive prod. |
| oracle (×3) | `max_connections(15)`, `idle_timeout=300s` | `oracle/src/main.rs:621-622` | Docker, started by `testnet.sh _start_oracles_docker`; override file regenerated each `testnet.sh deploy`. |
| AP | n/a — no Postgres pool, talks to data-node over SSE (`ap/Cargo.toml`, no `sqlx`) | — | Native systemd on VPS 2 (irrelevant here). |
| event-indexer | deadpool-postgres, separate DB on VPS 3 | `event-indexer/src/db.rs` — **different physical Postgres, do not include** | — |
| oracle-daemon (Solana) | `tokio_postgres` single connection, separate DB on VPS 3 | `oracle-daemon/src/indexer.rs:44` — **different physical Postgres, do not include** | — |
| itp-bot | No `sqlx` in `itp-bot/Cargo.toml`. Excluded. | — | Docker. |
| curator | No `sqlx` in `curator/Cargo.toml`. Excluded. | — | Docker. |
| vision-keeper, vision-fast-joiner | Node services, no `pg` / `postgres-js` in `package.json`. Excluded. | — | Native systemd; not DB clients. |

**Total worst-case pool from EVM stack:** data-node 70 + oracle×3×15 = 115. Observed today on prod: **97**. Headroom on `max_connections=300` is real but not infinite once `pg_dump`, replication, and admin sessions converge.

### Slow endpoint

The route in question:

- `/market/prices/:source` registered around `data-node/src/api.rs:604`, handler `market_prices` near `:5444`.
- Calls `data-node/src/market_data/queries.rs:16` `get_market_prices`. Joins `market_assets` (the smaller dim table) to `market_prices_latest` (374K rows, indexed). Already does **not** touch the 65M-row `market_prices` history table.
- The slow path is the polling fan-in, not the query itself: 65 concurrent identical requests means 65 pool acquisitions, each waiting on the same cold buffer pages.

Adjacent slow endpoints worth caching, with **route registrations** for clarity: `/market/prices/:source/:asset_id` (handler near `api.rs:5487`), `/market/assets/:source` (handler near `:5557`), `/market/stats` bulk (`market_stats_bulk`, `:5578`), `/market/stats/:source` (`market_stats`, `:5604`, route line `:609`). Same dim table, same hot path. Re-grep before editing — line numbers drift.

### Existing cache pattern

`recommended_cache: RwLock<Option<(Instant, serde_json::Value)>>` is declared at `data-node/src/api.rs:422` and used at `:6090` (read) / `:6109` (write). Doc comment around `:419`. `PriceCache` (per-symbol, 5s TTL) at `:427`. `ProfileCache` and `LeaderboardProxyCache` near `:404`. Phase 2 extends this set rather than inventing a new mechanism.

### Postgres host

`127.0.0.1:5432` on **VPS 1** (`159.195.78.238`). 16 GB RAM, 8 cores, Debian 13. Disk: **133 GB free** as of today (verified `df -h /`). All EVM-side services run on VPS 1 and connect via loopback or the VPS 1 public IP. The pre-existing `docker/testnet/pgbouncer/deploy.sh` targets VPS 2 — **that script is wrong** (artifact of an older topology). The plan corrects this.

### Process model — why the cutover commands differ per service

The cutover steps below differ between Docker and systemd because the live processes do. `vps.md:26` is the source of truth:

- **`data-node` is native systemd** (`data-node-shadow.service`, env file `/etc/data-node-shadow.env` — confirm path before writing the cutover step). The `docker/testnet/data-node/docker-compose.yml` and the `_start_data_node_docker` block in `testnet.sh:2435` build a *separate* container that does not serve prod. Restarting that compose stack produces no behavior change in production.
- **Oracles are Docker.** `_start_oracles_docker` in `testnet.sh:2489` generates `docker/testnet/oracle/docker-compose.override.yml` from `.oracle-override.yml` and rsyncs it to VPS 1. The override is regenerated on every `testnet.sh deploy`, so any direct edit on the VPS is wiped.

Anything that wants to survive `testnet.sh deploy` must be patched **in `testnet.sh` itself**. Anything that drives production must be aimed at the right unit.

## Phase 0 — Instrumentation and backups (mandatory before Phase 1)

Without these, every later verification gate is blind. Phase 0 is small, all of it is repo-or-config code, none of it touches production behavior.

### 0.0 Provision one-way SSH trust from VPS 1 → VPS 3 (offboard target for backups)

The Phase 0.5 dump pipe and the Phase 3 rollback both depend on `root@VPS1` being able to ssh into `root@VPS3`. Today it cannot — `/root/.ssh/` on VPS 1 holds only `id_ed25519_migration` and a `known_hosts` with GitHub and one host fingerprint; no `~/.ssh/config` entry for `vps3`, no key on VPS 3's `authorized_keys` matching anything on VPS 1. Verified: `ssh index-maker/prod/be 'ls /root/.ssh/'` and `ssh vps3 'cat /root/.ssh/authorized_keys'` show this directly. Without this step the dump pipe fails on first run with `Permission denied (publickey)` and the rollback path is also dead.

Provision before any Phase 0.5 step runs. One-way only — VPS 3 never needs to dial VPS 1.

```bash
# On VPS 1 — generate a dedicated key (do not reuse id_ed25519_migration).
ssh index-maker/prod/be
ssh-keygen -t ed25519 -f /root/.ssh/id_vps3_backup -N "" -C "vps1-backup-to-vps3-$(date +%Y%m%d)"
PUBKEY=$(cat /root/.ssh/id_vps3_backup.pub)

# Append to VPS 3 authorized_keys, force-locked to a single command.
# Lock-down rationale: the key can only land in /var/backups/postgres-2026-05-11/
# via rsync-over-ssh; no shell, no port-forward, no agent-forward. If VPS 1 is
# compromised, the blast radius is the backup directory.
cat <<EOF | ssh -p 3189 root@159.195.77.160 'mkdir -p /var/backups/postgres-2026-05-11 && cat >> /root/.ssh/authorized_keys'
command="rsync --server -e.LsfxC . /var/backups/postgres-2026-05-11/",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty $PUBKEY
EOF

# Workstation note: the canonical `vps3` SSH alias is configured on the
# workstation, not on VPS 1. Add a per-host stub on VPS 1 only for the
# backup key — port and IP must be explicit since there's no DNS for it.
cat >> /root/.ssh/config <<'EOF'
Host vps3-backup
    HostName 159.195.77.160
    Port 3189
    User root
    IdentityFile /root/.ssh/id_vps3_backup
    IdentitiesOnly yes
    StrictHostKeyChecking accept-new
EOF
chmod 600 /root/.ssh/config

# Probe — must return without prompting and must hit the rsync-only path.
ssh vps3-backup true && echo "trust ok"
```

If `ssh vps3-backup true` does not print `trust ok`, **stop**. Do not start Phase 0.5. The forced-command lockdown above means the trust check works only via rsync; for a true sanity probe, run a tiny rsync:

```bash
echo "ping" > /tmp/probe.txt && rsync -e 'ssh' /tmp/probe.txt vps3-backup: && \
  ssh -p 3189 root@159.195.77.160 'ls -la /var/backups/postgres-2026-05-11/probe.txt && rm /var/backups/postgres-2026-05-11/probe.txt'
```

The second `ssh` line in the probe uses the workstation alias — the operator running this step is on their laptop, not on VPS 1, when verifying. Phase 0.5 itself runs from VPS 1 and uses only `vps3-backup`.

### 0.1 Enable `pg_stat_statements`

Live `shared_preload_libraries` is empty. Add it now so Phase 2 has a baseline to delta against. Same edit also adds `timescaledb` for Phase 3, paid in one restart instead of two.

```bash
ssh index-maker/prod/be
PG_CONF=/etc/postgresql/17/main/postgresql.conf
# Set both libraries — order matters, timescaledb must be first if present.
sed -i "s/^#*shared_preload_libraries.*/shared_preload_libraries = 'timescaledb,pg_stat_statements'/" $PG_CONF
systemctl restart postgresql
psql -U postgres -d index_prices -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
psql -U postgres -d index_prices -c "SELECT count(*) FROM pg_stat_statements;"
```

If TimescaleDB isn't installed yet, drop it from the list and add it back during Phase 3's install step (one extra restart, acceptable).

### 0.2 Set `application_name` per service

Today every connection in `pg_stat_activity` shows `application_name=''`. Verification queries that group by it return one NULL row. Worthless.

- `data-node/src/db.rs:11-12` — extend `PgConnectOptions` with `.application_name("data-node")`.
- `oracle/src/main.rs:621-622` — extend with `.application_name(&format!("oracle-{idx}"))`.

Ship these as a single small commit. Verify with `SELECT application_name, count(*) FROM pg_stat_activity GROUP BY 1` returning four labelled rows.

### 0.3 Set `statement_timeout` per role

PgBouncer's `query_timeout=0` means Postgres-side `statement_timeout` is the only kill-switch. Set it before PgBouncer goes in front:

```sql
ALTER ROLE max SET statement_timeout = '30s';
-- Migrations and admin sessions need to override locally:
-- BEGIN; SET LOCAL statement_timeout = 0; ... COMMIT;
```

Long-running migration scripts that violate this must wrap themselves in `SET LOCAL statement_timeout = 0`. Document that in the runbook entry.

### 0.4 Baseline capture

Before any cutover, snapshot what "normal" looks like. Save to `/root/postgres-baseline-2026-05-11.txt` on VPS 1:

```bash
psql -U max -d index_prices <<'SQL' > /root/postgres-baseline-2026-05-11.txt
SELECT now() AS captured_at;
SELECT application_name, count(*) FROM pg_stat_activity WHERE datname='index_prices' GROUP BY 1;
SELECT count(*) AS total FROM pg_stat_activity WHERE datname='index_prices';
SELECT query, calls, total_exec_time, mean_exec_time FROM pg_stat_statements
  WHERE query ILIKE '%market_assets%' OR query ILIKE '%market_prices_latest%' ORDER BY calls DESC LIMIT 20;
SQL
```

### 0.5 Backups before Phase 3 — disk math forces external storage

Disk math: 125 GB free on VPS 1; tables to dump are `market_prices` 84 GB (heap 25 GB + indexes 59 GB) and `vision_asset_settlement_players` 55 GB. A local `pg_dump -Fp` (uncompressed SQL) of either one likely fits, but the *Phase 3 hypertable migration* doubles each table's heap on disk during `migrate_data => true`. Local dumps eat the headroom the migration needs.

Resolution: stream compressed dumps to **VPS 3** (more disk headroom, already in our network, owned by us). Phase 0.0 provisioned a one-way trust gated to a forced-rsync command — this step uses `rsync` over `ssh vps3-backup`, *not* a raw `ssh ... "cat > file"`. The forced command at `/root/.ssh/authorized_keys` on VPS 3 only matches `rsync --server`. Anything else returns `Connection closed by remote host` immediately.

Run from VPS 1:

```bash
ssh index-maker/prod/be
TMP_DUMP=/tmp/postgres-2026-05-11
mkdir -p $TMP_DUMP

for tbl in market_prices vision_asset_settlement_players vision_market_ratios vision_round_players; do
  # Dump to /tmp (tmpfs, 7.8 GB available — see df above).
  # -Fc compresses ~6:1; 138 GB of source → ~25 GB on disk; largest single dump
  # (market_prices) is ~14 GB compressed and fits in /tmp.
  sudo -u postgres pg_dump -d index_prices -t public.$tbl -Fc -f $TMP_DUMP/${tbl}.dump
  # Ship to VPS 3 via the forced-rsync key. Delete local immediately to free /tmp
  # before the next table's dump.
  rsync -av $TMP_DUMP/${tbl}.dump vps3-backup:
  rm $TMP_DUMP/${tbl}.dump
done

# Verify on VPS 3 (workstation alias `vps3` since VPS 1 only has the locked-down key).
# Run from your laptop, not from VPS 1:
ssh vps3 'ls -lh /var/backups/postgres-2026-05-11/'
```

If `/tmp` (7.8 GB) is too small for `vision_asset_settlement_players` (~9 GB compressed), pipe through ssh manually, but only after temporarily relaxing the forced-command on VPS 3 — easier path is to dump to `/home/max/dump-tmp/` on VPS 1 (`/` has 125 GB free) and rsync from there.

Restore path: `rsync` the dump back from VPS 3 to VPS 1 first, then `pg_restore -d index_prices < /tmp/<tbl>.dump`. No local space needed beyond the dump itself plus the table during restore.

### 0.5b — `market_prices` prune with collector pause (maintenance window)

After the dumps land, prune `market_prices` to free disk for Phase 3d. Real numbers, verified `pg_relation_size` / `pg_indexes_size`:

- Heap today: **25 GB** (live rows, sparse — only 742K dead tuples per `pg_stat_user_tables`)
- Indexes today: **59 GB** (five btree indexes — bloat lives here, not in the heap)
- Rows older than 30 days: **5.6M** (3% of 183M total). `DELETE` reclaims ~1 GB heap, ~3 GB index logical space.
- Rows older than 90 days: **0** (migration 029's one-shot DELETE already cleared them)

`VACUUM FULL` rewrites heap + every index. Real reclaim estimate: heap drops ~1 GB (already nearly compact), indexes drop 30–40% (REINDEX side-effect of VACUUM FULL on btrees with internal bloat) → from 84 GB total to **~55–60 GB**, *not* 33 GB. The original round-2 number was wrong. Phase 3d disk math is rebuilt below in light of this.

**Why 30 days and not 60 or 90 (verified counts 2026-05-11):** total 184.6M rows; older than 30d = 5.65M (3.1%); older than 60d = **0**; older than 90d = **0**. Migration 029's one-shot DELETE truncated everything past 90 days; nothing has accumulated past 60 days since. So the 30-day cutoff deletes exactly the 5.65M rows in the 30–60 day window — the only rows that exist past 30 days. A 60-day cutoff deletes 0. A 90-day cutoff deletes 0. **Decision: keep the 30-day cutoff. The prune itself reclaims ~1 GB heap; the REINDEX side-effect of VACUUM FULL is what reclaims the real ~22 GB.** Either run the DELETE for the small marginal heap savings, or skip it (`VACUUM FULL` alone gets you the same disk outcome with no data loss to recover from). The plan keeps the DELETE for runbook completeness — but the operator should not expect dramatic disk reclaim from it.

**Maintenance window — collectors must be paused.** `VACUUM FULL market_prices` takes an `AccessExclusiveLock` for the full 30–45 minutes. The data-node collectors (`cg_collector.rs`, source-specific collectors) write to `market_prices` every 30 seconds. Their sqlx `acquire_timeout=10s` means they will time out, retry, and either drop ticks or backlog the pool. With PgBouncer not yet in front (Phase 1 hasn't run), backed-up collectors could exhaust `max_connections=300`.

Procedure (downtime: ~35–50 min, mostly the VACUUM):

```bash
# 1. Stop the data-node entirely. Collectors live in-process; no separate unit.
ssh index-maker/prod/be 'systemctl stop data-node-shadow'

# 2. Verify no remaining writers. Should return 0.
ssh index-maker/prod/be "sudo -u postgres psql -d index_prices -tAc \"SELECT count(*) FROM pg_stat_activity WHERE query ILIKE '%INSERT%market_prices%';\""

# 3. Prune (cheap; ~30s on 5.6M rows with the fetched_at index).
ssh index-maker/prod/be "sudo -u postgres psql -d index_prices -c \"DELETE FROM market_prices WHERE fetched_at < NOW() - INTERVAL '30 days';\""

# 4. VACUUM FULL — single statement, ~30–45 min.
ssh index-maker/prod/be "sudo -u postgres psql -d index_prices -c 'VACUUM FULL ANALYZE market_prices;'"

# 5. Restart data-node. Collectors resume; ~30–60s of dropped ticks during the window
#    is acceptable for cold-start price visibility.
ssh index-maker/prod/be 'systemctl start data-node-shadow'

# 6. Verify size dropped.
ssh index-maker/prod/be "sudo -u postgres psql -d index_prices -tAc \"SELECT pg_size_pretty(pg_total_relation_size('market_prices'));\""
```

Alternative if the 35-50 min collector pause is unacceptable: use `pg_repack`. It rewrites the table without an `AccessExclusiveLock`, takes 2-3× as long, and needs ~3× the table size in temp disk (impossible on this box). Rejected for that reason. The pause is the right trade.

Frontend impact during pause: every `/market/prices` request returns the last cached value or 5xx. PostHog dashboard 1301294 will spike for 35–50 min; communicate the window to whoever watches it.

### 0.6 Verify PgBouncer version available in Debian 13

SCRAM passthrough requires PgBouncer ≥ 1.18. Confirm before committing to the install step:

```bash
ssh index-maker/prod/be
apt-cache policy pgbouncer | head -10
```

If the candidate is < 1.18, install from the PostgreSQL APT repo (already enabled in 0.1's `apt.postgresql.org.sh`).

## Phase 1 — PgBouncer in front of Postgres

Lowest risk, biggest immediate win. Pre-existing config at `docker/testnet/pgbouncer/pgbouncer.ini` is most of the way there. We do not use Docker — VPS 1 runs Postgres natively under systemd (`vps.md` line 26). Run PgBouncer the same way.

### Install

On VPS 1:

```bash
ssh index-maker/prod/be
apt-get update
apt-get install -y pgbouncer
systemctl enable pgbouncer
```

Debian package ships `/etc/pgbouncer/pgbouncer.ini`, `/etc/pgbouncer/userlist.txt`, and a `pgbouncer.service` unit that runs as user `postgres`. We replace the config in place. Do not run the Docker compose file at `docker/testnet/pgbouncer/` — it targets the wrong VPS and uses `network_mode: host` to no benefit on a native install.

### Config

Auth uses **`auth_user` + `auth_query`** with a `SECURITY DEFINER` lookup function. No `auth_file`, no `pg_read_server_files` — the two patterns are mutually exclusive and mixing them yields whichever PgBouncer resolves first, which is not a good basis for production auth.

First, the lookup function in Postgres:

```sql
-- Run as postgres superuser.
CREATE ROLE pgbouncer_auth WITH LOGIN PASSWORD 'rotate-me-on-deploy';

CREATE SCHEMA IF NOT EXISTS pgbouncer AUTHORIZATION pgbouncer_auth;

CREATE OR REPLACE FUNCTION pgbouncer.user_lookup(in i_username text,
                                                 out uname text,
                                                 out phash text)
RETURNS record AS $$
BEGIN
    SELECT usename, passwd INTO uname, phash
    FROM pg_catalog.pg_shadow
    WHERE usename = i_username;
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION pgbouncer.user_lookup(text) FROM public;
GRANT EXECUTE ON FUNCTION pgbouncer.user_lookup(text) TO pgbouncer_auth;
```

`SECURITY DEFINER` is the entire point: the function runs as `postgres` and is the only thing `pgbouncer_auth` can call against `pg_shadow`. No `pg_read_server_files`, no static userlist.

`/etc/pgbouncer/pgbouncer.ini`:

```ini
[databases]
index_prices = host=127.0.0.1 port=5432 dbname=index_prices auth_user=pgbouncer_auth

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432

pool_mode = transaction

; Server pool: real Postgres connections PgBouncer holds.
; Sized for max_connections=300 with 100 reserved for direct admin/replication.
default_pool_size = 50
min_pool_size = 10
reserve_pool_size = 10
reserve_pool_timeout = 3

; Client pool: how many app connections we accept.
; Total cap across data-node (70) + oracle*3 (45) + headroom = 250 with room.
max_client_conn = 500

auth_type = scram-sha-256
auth_user = pgbouncer_auth
auth_query = SELECT uname, phash FROM pgbouncer.user_lookup($1)

server_idle_timeout = 300
client_idle_timeout = 600
query_timeout = 0
client_login_timeout = 30

; sqlx sends several startup params; PgBouncer rejects them in transaction mode unless ignored.
; Keep this list exhaustive — anything missing here surfaces as a confusing connect error after cutover.
ignore_startup_parameters = extra_float_digits,options,DateStyle,IntervalStyle,client_encoding,TimeZone,application_name

log_connections = 0
log_disconnections = 0
log_pooler_errors = 1
stats_period = 60

admin_users = postgres
stats_users = postgres, max

tcp_keepalive = 1
tcp_keepidle = 30
tcp_keepintvl = 10
tcp_keepcnt = 3
```

A bootstrap entry for `pgbouncer_auth` itself (chicken-and-egg: PgBouncer cannot query the auth function until it can authenticate as `pgbouncer_auth`) goes in `/etc/pgbouncer/userlist.txt`:

```bash
# Single line: SCRAM-SHA-256 hash from pg_shadow for pgbouncer_auth only.
psql -U postgres -tAc \
  "SELECT '\"' || usename || '\" \"' || passwd || '\"' FROM pg_shadow WHERE usename='pgbouncer_auth'" \
  > /etc/pgbouncer/userlist.txt
chown postgres:postgres /etc/pgbouncer/userlist.txt
chmod 600 /etc/pgbouncer/userlist.txt
```

`max` and any future role authenticate through `auth_query`, never through the file. The file holds only `pgbouncer_auth`'s hash.

`query_timeout = 0` matters: a non-zero query timeout at PgBouncer breaks long-running migrations and oracle settlement loops. Postgres-side `statement_timeout` per role (set in Phase 0) is the right control.

### sqlx + PgBouncer transaction mode — required client-side change

Transaction pooling moves a session's prepared statements out from under it on every transaction boundary. sqlx 0.7+ caches prepared statements per connection by default. Without disabling that cache, the second query of any session intermittently hits a server connection that hasn't cached it and errors with `prepared statement "sqlx_s_N" does not exist`.

This is a code change, not a verification step. Apply alongside the URL swap in Phase 1.2:

- `data-node/src/db.rs` — replace `PgPoolOptions::new()` with explicit `PgConnectOptions::from_url(...)?.statement_cache_capacity(0).application_name("data-node")` and feed it via `PgPoolOptions::connect_with`.
- `oracle/src/main.rs` — same shape. Use `application_name("oracle-1" | "oracle-2" | "oracle-3")` per instance.

Verify post-cutover: `psql -h 127.0.0.1 -p 6432 -U pgbouncer pgbouncer -c 'SHOW STATS' | grep -i error` — `total_xact_count` rises, error counters stay at zero. Then `SELECT count(*) FROM pg_prepared_statements` on the server stays near zero (no leaked prepared statements per session).

### Cutover order

One service at a time. Each cutover is a single env or flag change followed by a service restart aimed at the **actual** unit running in production.

1. **data-node first** — native systemd, not Docker. Highest connection count, biggest pool reduction.
   - **The database URL is hard-coded in `ExecStart=`, not in any env file.** Verified `systemctl cat data-node-shadow.service`: `EnvironmentFile=/home/max/index/data-node/.env` and `EnvironmentFile=/home/max/index/system.env` exist, but neither contains `DATABASE_URL`. The live argument is `--database-url postgres://max@localhost/index_prices` inside the `ExecStart=` line at `/etc/systemd/system/data-node-shadow.service`. Editing the env files changes nothing.
   - **Primary path: edit the unit file directly via `systemctl edit --full`.** This rewrites `/etc/systemd/system/data-node-shadow.service` and reloads systemd. Change the `--database-url` value from `postgres://max@localhost/index_prices` to `postgres://max@localhost:6432/index_prices`:
     ```bash
     ssh index-maker/prod/be
     systemctl edit --full data-node-shadow.service
     # In the editor: change `--database-url postgres://max@localhost/index_prices`
     # to `--database-url postgres://max@localhost:6432/index_prices`. Save and exit.
     systemctl daemon-reload
     ```
   - **Alternative path: refactor `--database-url` out of `ExecStart=` into the env file.** Add `DATABASE_URL=postgres://max@localhost:6432/index_prices` to `/home/max/index/data-node/.env`, change `data-node/src/main.rs` clap to default `--database-url` from `$DATABASE_URL` (it likely already supports this — confirm before relying on it), and drop the flag from `ExecStart=`. This is cleaner long-term but ships a code change. **For the cutover, use the primary path; the refactor can land in a follow-up.**
   - Drop `max_connections(70)` → `max_connections(30)` in `data-node/src/db.rs:11-12`. Also fix the stale comment at `data-node/src/db.rs:7` claiming Postgres `max_connections=100` — it's 300 on prod (verified `SHOW max_connections`). With PgBouncer absorbing burst, the data-node never needs more than 30 sqlx slots.
   - Apply the sqlx code changes (statement_cache_capacity=0, application_name) from the section above.
   - Build, ship, restart: `git push mono main` (Dokploy doesn't build the data-node binary — VPS 1 builds locally with `cargo build --release -p data-node`). On VPS 1: `cd /home/max/index && cargo build --release -p data-node && cp target/release/data-node /usr/local/bin/data-node-shadow && systemctl daemon-reload && systemctl restart data-node-shadow`. Note: the live binary path in the unit is `/home/max/index/target/release/data-node`, not `/usr/local/bin/data-node-shadow` — verified `systemctl cat`. Either copy to `/usr/local/bin/data-node-shadow` *and* update the unit's `ExecStart` to point there, or skip the copy and let `systemctl restart` re-exec the existing path. The skip-copy path is simpler:
     ```bash
     ssh index-maker/prod/be 'cd /home/max/index && cargo build --release -p data-node && systemctl restart data-node-shadow'
     ```
   - Note: the `_start_data_node_docker` block in `testnet.sh:2435` builds a *different* container that does not serve prod. We are not touching it for this cutover. (See "testnet.sh patch" below for what we *do* need to change there to keep oracle settings durable.)
   - Verify: `sudo -u postgres psql -h 127.0.0.1 -p 6432 -U max -d index_prices -c 'SELECT 1'` returns. `sudo -u postgres psql -h 127.0.0.1 -p 6432 -U pgbouncer pgbouncer -c 'SHOW POOLS'` shows `index_prices` with active and idle counts. `SELECT application_name, count(*) FROM pg_stat_activity GROUP BY 1` shows `data-node` with ≤ 30 connections. **Cutover degradation:** during the `systemctl restart`, in-flight transactions are severed. Frontend sees ~5–15s of 5xx as the new process binds and seeds its pool. Acknowledge in the runbook.

2. **Oracle 1, then 2, then 3** — Docker, override file generated by `testnet.sh`. Stagger by 60s so consensus has at least two live oracles at all times.
   - **Patch `testnet.sh` first** (see next section). Without it the next `testnet.sh deploy` regenerates the override file with `:5432` and silently reverts the cutover.
   - After the patch lands, regenerate the override on VPS 1. Either re-run `testnet.sh start` (which calls `_start_oracles_docker`), or manually edit `docker/testnet/oracle/docker-compose.override.yml` *knowing the next deploy will overwrite it*.
   - Drop `max_connections(15)` → `max_connections(8)` per oracle in `oracle/src/main.rs:621-622`. That's 24 client slots total instead of 45.
   - Restart per oracle, with consensus-aware pacing: `docker compose -f /home/max/index/docker/testnet/oracle/docker-compose.yml -f /home/max/index/docker/testnet/oracle/docker-compose.override.yml restart oracle-1`, wait 60s, `oracle-2`, wait 60s, `oracle-3`. Watch `journalctl -u docker -f | grep oracle-` and the oracle's HTTP `/health` for `consensus_paused=false` before moving to the next.

3. **Anything else with a sqlx/pg pool.** itp-bot, curator, vision-keeper, vision-fast-joiner, vision-bot: confirmed earlier they have **no** Postgres dependency. If that changes, re-audit before adding a new pool.

### testnet.sh patch — required so cutover survives `testnet.sh deploy`

`testnet.sh` regenerates the oracle override on every deploy. Two strings to change in-place:

- Line **2452** (data-node block): `"postgres://max@localhost/index_prices"` — irrelevant for prod (data-node runs natively) but bump anyway so the artifact compose path stays consistent if it's ever used.
- Line **2641** (oracle vision flag): `"postgres://max@localhost/index_prices"` → `"postgres://max@localhost:6432/index_prices"`. **This one is load-bearing.** Without it, the next deploy reverts the oracle pools to direct Postgres.

Commit the change to `mono main` immediately after PgBouncer is verified in step 1, before the oracle cutover in step 2. The patch is two lines; the consequence of skipping it is "this works for an hour and breaks at the next redeploy."

### Rollback

- **data-node**: revert the unit file via `systemctl edit --full data-node-shadow.service` (change `:6432` back to no port, i.e. `postgres://max@localhost/index_prices`), then `systemctl daemon-reload && systemctl restart data-node-shadow`.
- **oracles**: revert the `testnet.sh` two-line patch, push, re-run `testnet.sh start` to regenerate override with `:5432`, restart oracles.
- PgBouncer keeps running until all clients have moved off it; no client points at it after rollback. Stop PgBouncer last: `systemctl stop pgbouncer`. The Postgres database itself is never touched in this phase.

### Verification

Before cutover, capture baseline:

```bash
psql -U max -d index_prices -c "SELECT count(*) FROM pg_stat_activity WHERE datname='index_prices';"
# Capture three samples 10s apart at peak.
```

After cutover (Phase 0 instrumentation makes these meaningful):

```bash
psql -h 127.0.0.1 -p 6432 -U pgbouncer pgbouncer -c 'SHOW POOLS;'
psql -h 127.0.0.1 -p 6432 -U pgbouncer pgbouncer -c 'SHOW STATS;'
psql -U max -d index_prices -c "SELECT application_name, count(*) FROM pg_stat_activity WHERE datname='index_prices' GROUP BY 1;"
```

Pass criteria: total `pg_stat_activity` for `index_prices` is ≤ 70 (down from observed ~97). `SHOW POOLS` shows `cl_active` rising and falling under load, `sv_active` capped at 50. The `application_name` query returns one row per service (`data-node`, `oracle-1`, `oracle-2`, `oracle-3`) with the expected pool size each. P50 query latency on `/market/prices/:source` from the frontend's perspective drops or stays flat — never rises. If it rises, the timeout is masking a Postgres-side problem PgBouncer didn't introduce; investigate before proceeding to Phase 2.

Two oracles must hold consensus through every restart. If consensus pauses for more than 30s during oracle restarts, stop, roll back, and investigate.

## Phase 2 — Data-node TTL cache for explorer endpoints

Small surface, high frontend impact. Extends the existing `recommended_cache` pattern (`data-node/src/api.rs:422`).

### Endpoints to cache

In order of polling frequency × DB cost. **Re-grep handler line numbers at write time — line numbers drift.**

| Route | Handler (approx) | Cache key | TTL | Why |
|---|---|---|---|---|
| `/market/prices/:source` | `market_prices` ~`api.rs:5444` | `(source, category, page, limit, sorted_symbols)` | 30s | The route in today's outage. Frontend polls per source every 5s. |
| `/market/assets/:source` | ~`api.rs:5557` | `(source, category)` | 60s | Asset list rarely changes within a minute. |
| `/market/prices/:source/:asset_id` | ~`api.rs:5487` | `(source, asset_id)` | 15s | Single-asset detail page polling. Lower TTL because users watch the number tick. |
| `/market/stats/:source` | `market_stats` ~`api.rs:5604` | `(source)` | 30s | Dashboard tile. |
| `/market/stats` (bulk) | `market_stats_bulk` ~`api.rs:5578` | `()` | 30s | One key, dozens of consumers. |

Skip: history endpoints (`/market/prices/:source/:asset_id/history`) because they accept user-controlled `from`/`to` ranges; cache key cardinality explodes.

### Code change

Mirror `recommended_cache`. Three pieces per endpoint:

1. New field on `AppState` (struct around `data-node/src/api.rs:362`):

   ```rust
   use tokio::sync::OnceCell;

   pub market_prices_cache: DashMap<String, (Instant, serde_json::Value)>,
   pub market_assets_cache: DashMap<String, (Instant, serde_json::Value)>,
   pub market_asset_price_cache: DashMap<String, (Instant, serde_json::Value)>,
   pub market_stats_cache: DashMap<String, (Instant, serde_json::Value)>,
   /// Per-key single-flight: an Arc<OnceCell<Value>> per cache key. The first
   /// task to insert it runs the DB query inside `get_or_init`; concurrent
   /// callers await the same future. OnceCell guarantees exactly-once init —
   /// no TOCTOU race possible.
   pub market_singleflight: DashMap<String, Arc<OnceCell<serde_json::Value>>>,
   ```

   `DashMap` instead of `RwLock<HashMap>` because writes are uncontended and the lock contention in the current `PriceCache` (`api.rs:427`) shows up under load. Add a hard size cap: walk and drop the oldest 20% if any cache map exceeds 10,000 entries — without a cap, paginated symbol-filter cardinality lets the map grow until OOM.

2. Wrap each handler. Concrete shape for `market_prices`, with `OnceCell`-based single-flight (atomic exactly-once init, no `Arc::strong_count` race):

   ```rust
   use tokio::sync::OnceCell;

   const MARKET_PRICES_TTL: Duration = Duration::from_secs(30);

   async fn market_prices(
       State(state): State<Arc<AppState>>,
       AxumPath(source): AxumPath<String>,
       Query(params): Query<MarketPricesQuery>,
   ) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
       let cache_key = format!(
           "{}|{}|{}|{}|{}",
           source,
           params.category.as_deref().unwrap_or(""),
           params.page.unwrap_or(1),
           params.limit.unwrap_or(100),
           {
               let mut s: Vec<&str> = params.symbols.as_deref()
                   .map(|s| s.split(',').collect()).unwrap_or_default();
               s.sort();
               s.join(",")
           },
       );

       let cache_disabled = std::env::var("DISABLE_MARKET_CACHE").map(|v| v == "1").unwrap_or(false);
       if cache_disabled {
           // Cache off — straight DB path for kill-switch verification.
           let response = run_db_query(&state, &source, &params).await?;
           return Ok(Json(response));
       }

       // Hot path: TTL-fresh cache hit returns immediately.
       if let Some(entry) = state.market_prices_cache.get(&cache_key) {
           let (ts, val) = entry.value();
           if ts.elapsed() < MARKET_PRICES_TTL {
               return Ok(Json(val.clone()));
           }
       }

       // Cold/stale path: claim or join a OnceCell. `entry().or_insert_with` is
       // atomic on DashMap — exactly one Arc<OnceCell> is ever inserted per key.
       let cell = state.market_singleflight
           .entry(cache_key.clone())
           .or_insert_with(|| Arc::new(OnceCell::new()))
           .clone();

       // get_or_try_init runs the closure on at most one task; all others await
       // its completion and receive the same Result. No TOCTOU possible.
       let response = cell
           .get_or_try_init(|| async {
               let v = run_db_query(&state, &source, &params).await?;
               state.market_prices_cache.insert(cache_key.clone(), (Instant::now(), v.clone()));
               Ok::<_, (StatusCode, Json<ErrorResponse>)>(v)
           })
           .await?
           .clone();

       // Drop the cell after init so future stale-cache misses get a fresh OnceCell
       // (initialized cells can't be re-initialized).
       state.market_singleflight.remove(&cache_key);

       Ok(Json(response))
   }
   ```

   Two subtleties worth naming:
   - `OnceCell::get_or_try_init` is the airtight pattern. The closure runs on at most one task across all callers waiting on the same `Arc<OnceCell>`. The error type the closure returns is the error every waiter sees — design accordingly.
   - The `remove` after init is what enables the *next* TTL-expired miss to claim a fresh cell. Without it, the cell is initialized forever and the second cold pass would skip the DB entirely (returning whatever the first pass got, possibly stale). The combination of "TTL-fresh check first, then OnceCell, then remove on success" is the working shape.

   Background eviction: spawn a task that walks each `DashMap` every 60s and removes entries older than `2 * TTL`, plus the size-cap pass above. Without both the maps grow unbounded under category permutations.

### TTL rationale

- Collectors write `market_prices_latest` every 30s (CoinGecko cycle, see `data-node/src/cg_collector.rs`). Caching for 30s never serves data older than a single collector cycle.
- A 5s TTL would also work but doesn't reduce load enough — frontend polls every 5s, so half the requests still miss.
- The frontend's user-perceived latency tolerance for "what's BTC at right now" is generous. Nobody trades on a price they refreshed 30 seconds ago because they didn't refresh again.

### Invalidation

None. TTL is enough. The collector writes are the source of truth and they tick at the same cadence as the cache. No manual `bust()` API. If something is wrong, set `DISABLE_MARKET_CACHE=1` in the data-node env and restart — the env-var gate above bypasses the cache entirely.

### Deploy

```bash
# Local — confirm builds
cd /Users/maxguillabert/Downloads/index/data-node && cargo build --release --bin data-node

# Push then rebuild + restart on VPS 1 — data-node runs natively, not via Docker.
git push mono main
ssh index-maker/prod/be 'cd /home/max/index && git pull && cargo build --release -p data-node && cp target/release/data-node /usr/local/bin/data-node-shadow && systemctl restart data-node-shadow'
```

### Rollback

```bash
ssh index-maker/prod/be 'echo "DISABLE_MARKET_CACHE=1" >> /etc/data-node-shadow.env && systemctl restart data-node-shadow'
```

If the cache misbehaves rather than the data, that one env var disables every cached endpoint without redeploying.

### Verification

`pg_stat_statements` was enabled in Phase 0; queries below assume it. Without Phase 0, this verification is impossible — `pg_stat_statements` does not retroactively populate.

- `curl -w '%{time_total}\n' -s -o /dev/null https://api.generalmarket.io/data-node/market/prices/crypto?limit=100` repeated 10× — second call should be <50ms (cache hit). Cold first call should match pre-deploy latency.
- `psql -U max -d index_prices -c "SELECT query, calls, total_exec_time FROM pg_stat_statements WHERE query LIKE '%market_assets%' ORDER BY calls DESC LIMIT 10;"` — `calls` column for the cached query should drop by an order of magnitude within 5 minutes against the Phase 0 baseline.
- Frontend poll volume: PostHog dashboard 1301294 (errors) — `getMarketPrices` 5xx count should be zero for 30 minutes after deploy.
- Cache stampede check: `systemctl restart data-node-shadow`, then immediately `for i in $(seq 1 50); do curl -s -o /dev/null https://api.generalmarket.io/data-node/market/prices/crypto?limit=100 & done; wait`. Watch `SHOW POOLS` — `sv_active` should peak at 1 (single-flight working), not 50.

## Phase 3 — TimescaleDB hypertables

Largest surface, most disruptive. Three of the four target tables use upsert PKs that don't include the time column — TimescaleDB requires the time column to be in any unique index. The settlement code has to be refactored to pass a deterministic timestamp before the schema change is safe; that refactor is bigger than originally framed (see 3.0 below).

### Disk reality check before starting

125 GB free on VPS 1 (verified `df -h /` 2026-05-11: `/dev/vda4 503G 358G 125G 75% /`). Phase 3 hypertable conversions use `migrate_data => true`, which writes every row into chunks while the original heap remains. **Peak local disk usage during one conversion is ~2× that table's heap+index size.** The two large tables exceed headroom *back-to-back*:

| Table | Size today | Migration peak | Fits in 125 GB free? |
|---|---|---|---|
| `vision_round_players` | 164 MB | ~330 MB | Yes |
| `vision_market_ratios` | 18 GB | ~36 GB | Yes |
| `vision_asset_settlement_players` | 55 GB | ~110 GB | Tight — leaves ~15 GB headroom for WAL, logs, temp files |
| `market_prices` | 84 GB (heap 25 + idx 59) | ~168 GB | **No.** Cannot run as-is. |

Three options for `market_prices`. Pick option (a) — but with **honest disk math**:

- **(a) Prune + VACUUM FULL first, then migrate.** Phase 0.5b's prune deletes 5.6M rows (3% of 183M) and reclaims ~1 GB heap. The real reclaim is the index rebuild side-effect of `VACUUM FULL`, which shrinks the 59 GB of indexes by ~30–40% to **~35–40 GB** (typical btree internal-page bloat at this row count). Total post-prune size: heap ~24 GB + indexes ~37 GB = **~61 GB**. Migration peak: **~122 GB**, leaving **~3 GB headroom** for WAL/temp/logs. **This is too tight.** A WAL spike during migration could fill the disk and crash Postgres. The round-2 plan's "~70 GB peak, safely under headroom" was wrong by ~50 GB.
- **(b) Mount external block volume.** Provision a 200 GB volume from Netcup, `temp_tablespaces = '<volume>'`, run the conversion. Adds cost (~€10/mo) and ~30 min provisioning. **Recommended for `market_prices` specifically.** The other three tables fit comfortably without it.
- **(c) Per-source migration.** Carve `market_prices` into a transient table per `source` (12 sources, biggest is `crypto` at ~40 GB heap+idx pre-prune), convert each separately. Most operationally complex; rejected unless (b) is impossible.

**Decision: option (b) for `market_prices`.** Provision a 200 GB Netcup volume, mount at `/mnt/timescale-tmp`, set `temp_tablespaces = 'tmp_volume'` after `CREATE TABLESPACE tmp_volume LOCATION '/mnt/timescale-tmp'`. After the migration completes and the original heap is dropped, unmount and destroy the volume. Cost: one operator hour + ~€0.30 of pro-rated VPS time.

Phase 0.5b's prune still runs — it's cheap, frees a small amount of disk, and the VACUUM FULL is needed anyway to reset the indexes before the hypertable conversion (compressed chunks won't inherit the bloat). But the disk math is built around (b), not (a).

Run Phase 0.5b's `VACUUM FULL` during the same low-traffic window planned for the conversion itself. `VACUUM FULL` takes an `AccessExclusiveLock` for the duration — no inserts during it. Estimated 30–45 min on the current 25 GB heap + 59 GB indexes.

### 3.0 — Settlement timestamp refactor (must ship before any vision_* hypertable conversion)

**The problem the verifier surfaced is real.** `oracle/src/vision/types.rs:74` `TickResult` has only `batch_id`, `tick_id`, `market_results`, `player_balances`, `voided_players` — *no timestamp*. The original "preferred — already available in `tick_result`" claim was wrong. The deterministic timestamp must come from somewhere; this section says where.

**Source of truth:** `vision_batch_lifecycle.settlement_deadline` (already a `TIMESTAMPTZ` column, see `oracle/src/vision/api.rs:2176, :2265`). The deadline is set at batch creation, is identical across all three oracles, and uniquely identifies the batch's settlement instant. Using it as the conflict-target timestamp makes the upsert idempotent across retries.

**Schema change to TickResult:**

```rust
// oracle/src/vision/types.rs:74
pub struct TickResult {
    pub batch_id: u64,
    pub tick_id: u64,
    pub settled_at: chrono::DateTime<chrono::Utc>,  // NEW — populated upstream
    pub market_results: Vec<MarketResult>,
    pub player_balances: Vec<PlayerBalance>,
    pub voided_players: Vec<Address>,
}
```

**Population sites — verified `grep -rn 'TickResult {' oracle/src/`, 9 hits total (1 struct def + 8 constructors). All eight constructors must populate `settled_at`:**

| File:line | Context | Source for `settled_at` |
|---|---|---|
| `oracle/src/vision/types.rs:74` | Struct definition — add the field | n/a |
| `oracle/src/vision/resolver.rs:377` | **Production constructor** in `resolve_tick`. This is the path that 99% of settlements take. | Add a `settled_at: DateTime<Utc>` parameter to `resolve_tick(...)`; caller (`lifecycle.rs:850`) loads it from `vision_batch_lifecycle.settlement_deadline` and passes it through. |
| `oracle/src/vision/lifecycle.rs:595` | `empty_tick` at the no-markets early return | Same `settlement_deadline` lookup that the surrounding code already runs against `vision_batch_lifecycle`. |
| `oracle/src/vision/settlement.rs:131` | `#[test]` — single-market resolution | Test fixture: `Utc::now()` is fine; tests don't exercise the retry-idempotency property. |
| `oracle/src/vision/settlement.rs:178` | `#[test]` | Same — fixture. |
| `oracle/src/vision/settlement.rs:222` | `#[test]` | Same. |
| `oracle/src/vision/settlement.rs:245` | `#[test]` | Same. |
| `oracle/src/vision/settlement.rs:282` | `#[test]` | Same. |
| `oracle/src/vision/settlement.rs:378` | `#[test]` | Same. |
| `oracle/src/vision/settlement.rs:443` | `#[test]` | Same. |

**Note on the round-2 plan's `lifecycle.rs:849` citation: it was wrong.** That line is a `resolve_tick(...)` *call*, not a struct literal — verified by reading `lifecycle.rs:849-854`. The actual constructor that line invokes lives at `resolver.rs:377`. Round-2's plan would have sent the operator looking at the wrong file.

The seven test sites are not load-bearing for production correctness, but they will fail to compile after the struct change. Update them in the same PR.

**Upsert sites** (`oracle/src/vision/lifecycle.rs:1634, :1690, :1720`) change two things each:

1. Stop binding `NOW()` for `settled_at`; bind `tick_result.settled_at` (or `settlement.settled_at` for `vision_round_players`, propagated from the same source).
2. Change conflict targets to include `settled_at`. After the PK rebuild in Phase 3b–d, the conflict target is `(settled_at, batch_id, ...)`. With deterministic `settled_at`, retries collide on the same key and the `DO UPDATE` branch fires.

**Validate locally on Anvil first.** `./switch-env.sh local && ./start.sh` then run a settlement, kill the oracle mid-write, restart it, confirm the row count after retry is 1, not 2. Without this validation Phase 3b–d quietly creates duplicates.

This is a refactor, not a one-liner. Scope it as a 1-2 day code task. Phase 3a (`market_prices` conversion) does not depend on it and can ship first.

### Install

```bash
ssh index-maker/prod/be
# Postgres 17 — Timescale supports it as of 2.17.
apt-get install -y gnupg postgresql-common apt-transport-https lsb-release
sh /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
echo "deb https://packagecloud.io/timescale/timescaledb/debian/ $(lsb_release -c -s) main" \
  | tee /etc/apt/sources.list.d/timescaledb.list
wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | apt-key add -
apt-get update
apt-get install -y timescaledb-2-postgresql-17
```

**WARNING — `timescaledb-tune` mutates `postgresql.conf`.** It rewrites `shared_buffers` (~25% of RAM = ~4 GB on this 16 GB box), `work_mem`, `maintenance_work_mem`, `effective_cache_size`, `max_worker_processes`, parallelism settings, and several timescale-specific knobs. These changes affect every other connection — oracle queries, data-node queries, future analytics. Do this:

```bash
# Snapshot before
cp /etc/postgresql/17/main/postgresql.conf /etc/postgresql/17/main/postgresql.conf.pre-timescale-tune

timescaledb-tune --quiet --yes

# Diff the changes; commit the diff to the runbook.
diff /etc/postgresql/17/main/postgresql.conf.pre-timescale-tune /etc/postgresql/17/main/postgresql.conf
```

`shared_preload_libraries` was already set in Phase 0 to include `timescaledb`. If Phase 0 was skipped (don't), edit it now.

```bash
systemctl restart postgresql
psql -U postgres -d index_prices -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
psql -U postgres -d index_prices -c "\dx timescaledb"
```

If the extension is unavailable for the installed Postgres minor version, **stop**. Do not downgrade Postgres. Re-evaluate native partitioning (`PARTITION BY RANGE (settled_at)`) as a fallback in a follow-up plan.

### Per-table conversion

**Order — smallest to largest, by actual prod sizes:**

1. `vision_round_players` — 164 MB (validates upsert workaround in seconds)
2. `vision_market_ratios` — 18 GB (validates the workaround at scale; ~10–15 min downtime)
3. `vision_asset_settlement_players` — 55 GB (~60–90 min downtime under `AccessExclusiveLock`)
4. `market_prices` — ~61 GB **after** Phase 0.5b prune+VACUUM FULL; ~30–45 min downtime; runs against the external block volume from option (b)

`market_prices` is last because (i) it depends on the Phase 0.5b prune *and* the option-(b) external volume to fit on disk, (ii) it's append-only and has no upstream code refactor blocker, so even if Phase 3.0 slips, this one ships independently.

Each conversion takes an `AccessExclusiveLock` on the source table for the duration of `create_hypertable(..., migrate_data => true)` — **reads block too**, not just inserts. Settlement upserts that arrive during the window will pile up in oracle queues. Either pause the oracle settlement loop (preferred — see "Suspending oracle settlement during 3a–c" below) or accept that retries will hammer the table once it returns. Run during the lowest-traffic window of the day.

#### Step 3a — `vision_round_players` (164 MB) — validate the workaround

This is the validation step. Conversion completes in seconds; the value is in catching upsert behavior bugs before they hit a 55 GB table.

**Prerequisite:** Phase 3.0 (deterministic `settled_at` in `TickResult`) is shipped, deployed, and verified on Anvil.

```sql
BEGIN;
ALTER TABLE vision_round_players DROP CONSTRAINT vision_round_players_pkey;
ALTER TABLE vision_round_players
    ADD CONSTRAINT vision_round_players_pkey
    PRIMARY KEY (settled_at, batch_id, player);
SELECT create_hypertable('vision_round_players', 'settled_at',
    chunk_time_interval => INTERVAL '7 days', migrate_data => true);
COMMIT;
```

**Validation gate before continuing to 3b:**
- **Source-tree gate:** `grep -n 'NOW()' oracle/src/vision/lifecycle.rs` returns zero hits inside upsert blocks (lines 1620–1740 region). The deterministic-`settled_at` refactor only works if every upsert site stops binding `NOW()`. A forgotten one means duplicate rows once the conflict target changes — and the row-count gate below will silently pass because the stale `NOW()` site doesn't get exercised by every test settlement. Source-tree gate first.
- **Population gate:** `grep -n 'TickResult {' oracle/src/` returns 8 constructor sites, every one with a `settled_at:` field populated. If any site is missing the field, the build is broken — but if anyone added a new construction site between Phase 3.0 and now, this catches it.
- Force a settlement (testnet manual trigger). Watch row count: `SELECT count(*) FROM vision_round_players WHERE batch_id = <test_batch>;`. Must be exactly the player count for that batch — not double, not zero.
- Force the same settlement again (oracle restart mid-write simulates the retry path). Row count must remain identical. **Caveat:** this only catches duplicates if the second attempt's `settled_at` differs from the first. Because `settlement_deadline` is loaded once per batch and reused, the *correct* refactor produces identical timestamps — so this gate validates "no error", not "no duplicate." The source-tree gate above is the actual duplicate-prevention check.
- `EXPLAIN ANALYZE SELECT * FROM vision_round_players WHERE settled_at > NOW() - INTERVAL '1 day'` shows chunk exclusion in the plan.

If any of those fail, **stop**. The upsert refactor in 3.0 is incorrect. Roll back this table and fix the code before touching the larger ones.

#### Step 3b — `vision_market_ratios` (18 GB)

Same pattern, larger table. Estimated downtime: 10–15 min. The 3a validation already proved the upsert mechanics; this step validates them at scale.

```sql
BEGIN;
ALTER TABLE vision_market_ratios DROP CONSTRAINT vision_market_ratios_pkey;
ALTER TABLE vision_market_ratios
    ADD CONSTRAINT vision_market_ratios_pkey
    PRIMARY KEY (settled_at, batch_id, asset_id);
SELECT create_hypertable('vision_market_ratios', 'settled_at',
    chunk_time_interval => INTERVAL '7 days', migrate_data => true);
COMMIT;
```

#### Step 3c — `vision_asset_settlement_players` (55 GB)

Largest of the upsert tables. ~60–90 min `AccessExclusiveLock`. Suspend oracle settlement before starting.

```sql
ALTER TABLE vision_asset_settlement_players DROP CONSTRAINT vision_asset_settlement_players_pkey;
ALTER TABLE vision_asset_settlement_players
    ADD CONSTRAINT vision_asset_settlement_players_pkey
    PRIMARY KEY (settled_at, batch_id, asset_id, player);
SELECT create_hypertable('vision_asset_settlement_players', 'settled_at',
    chunk_time_interval => INTERVAL '7 days', migrate_data => true);
ALTER TABLE vision_asset_settlement_players SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'asset_id',
    timescaledb.compress_orderby = 'settled_at DESC'
);
SELECT add_compression_policy('vision_asset_settlement_players', INTERVAL '30 days');
```

#### Step 3d — `market_prices` (84 GB → ~61 GB after 0.5b prune+VACUUM FULL; runs against option-(b) external volume)

`market_prices` has **no PK on prod** (verified `\d market_prices`, no `indisprimary`). The migration that created it declared `id BIGSERIAL PRIMARY KEY`, but the live table has lost it (separate incident, not this plan's concern). That is a *gift* for hypertable conversion: nothing to drop, nothing to rebuild.

`fetched_at` is the natural time column. The `MarketPriceRecord` struct in `data-node/src/market_data/queries.rs:199` includes an `id` field; `id` still exists as a column (just not a PK), so reads continue to work.

**Pre-step (one-time): mount the external volume and create a tablespace pointing at it.**

```bash
# Provision a 200 GB Netcup block volume, attach to VPS 1, format ext4.
ssh index-maker/prod/be
mkfs.ext4 /dev/vdb
mkdir -p /mnt/timescale-tmp
mount /dev/vdb /mnt/timescale-tmp
chown postgres:postgres /mnt/timescale-tmp
chmod 700 /mnt/timescale-tmp

# Inside Postgres
sudo -u postgres psql -d index_prices -c "CREATE TABLESPACE tmp_volume LOCATION '/mnt/timescale-tmp';"
sudo -u postgres psql -d index_prices -c "SET temp_tablespaces = 'tmp_volume';"
```

```sql
-- Step 0.5b prune+VACUUM FULL already ran: market_prices is now ~61 GB.
-- temp_tablespaces is set to tmp_volume for this session so migrate_data spills there.

SET temp_tablespaces = 'tmp_volume';

BEGIN;
SELECT create_hypertable(
    'market_prices',
    'fetched_at',
    chunk_time_interval => INTERVAL '1 day',
    migrate_data => true
);
ALTER TABLE market_prices SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'source, asset_id',
    timescaledb.compress_orderby = 'fetched_at DESC'
);
SELECT add_compression_policy('market_prices', INTERVAL '7 days');
-- This is the FIRST recurring retention policy — migration 029 only ran a one-shot DELETE.
SELECT add_retention_policy('market_prices', INTERVAL '90 days');
COMMIT;
```

**Post-step: drop the tablespace and unmount the volume.**

```bash
sudo -u postgres psql -d index_prices -c "DROP TABLESPACE tmp_volume;"
ssh index-maker/prod/be 'umount /mnt/timescale-tmp && rmdir /mnt/timescale-tmp'
# Detach + destroy the Netcup volume from the control panel.
```

Verify: `SELECT hypertable_name, num_chunks FROM timescaledb_information.hypertables;` shows `market_prices`. `SELECT count(*) FROM market_prices;` matches pre-conversion count (post-prune). Run `EXPLAIN (ANALYZE, BUFFERS)` on the queries in `data-node/src/market_data/queries.rs` around `:199` and `:252` — chunk exclusion should be visible in the plan.

Estimated downtime: 30–45 min for `migrate_data`. Subsequent compressions are background.

### Suspending oracle settlement during 3a–c

The vision_* hypertable conversions take an `AccessExclusiveLock`. If the oracle settlement loop fires during the window, its insert blocks until the lock releases — depending on retry timeouts, it may give up and the batch settles late. Cleaner: pause the loop.

There is no `--paused` flag on the oracle today. Two options:

- **(a) Stop oracle 1 only**, rely on remaining quorum (2/3) to keep consensus advancing. Settlement still attempts inserts but at 2/3 the rate, with retries. This is the cheap path.
- **(b) Add a `pause_settlement` admin endpoint** to oracle (`/admin/pause-settlement`) gated by the existing `--admin-token`. Two-line change in `oracle/src/main_loop.rs`. Worth doing if the operator runs Phase 3 more than once.

Pick (a) for the first run. Promote to (b) before any future hypertable migration.

### Verification

After each table:

```sql
-- Chunk count and total size
SELECT hypertable_name, num_chunks,
       pg_size_pretty(hypertable_size(format('%I.%I', hypertable_schema, hypertable_name)::regclass))
FROM timescaledb_information.hypertables;

-- Compression effectiveness (after policy fires on next chunk boundary)
SELECT * FROM hypertable_compression_stats('market_prices');

-- Sanity: row counts before vs after
SELECT count(*) FROM market_prices;
```

Run `EXPLAIN (ANALYZE, BUFFERS)` on the three hottest queries from `pg_stat_statements`. Look for `Chunks excluded` in the plan. If it's missing, the time predicate isn't reaching the planner — fix the query, not the schema.

Write throughput: monitor `pg_stat_user_tables` `n_tup_ins` rate before and after. Should be ≥ baseline. If it drops, chunk creation overhead is the suspect — increase `chunk_time_interval`.

### Rollback

Per table. Two roll-back layers — schema vs. partitioning.

**Schema rollback (cheap, possible only before new rows arrive with the new conflict semantics):**

```sql
ALTER TABLE vision_market_ratios DROP CONSTRAINT vision_market_ratios_pkey;
ALTER TABLE vision_market_ratios ADD CONSTRAINT vision_market_ratios_pkey PRIMARY KEY (batch_id, asset_id);
```

Once new rows exist with timestamp-included conflict semantics, schema rollback creates duplicates. Then full rollback is the only path.

**Full hypertable rollback (slow, destructive):**

Phase 0.5 dumps live on VPS 3 — restore from there:

```bash
# On VPS 1, drop the hypertable.
psql -U postgres -d index_prices -c "DROP TABLE market_prices CASCADE;"
# Stream the dump back from VPS 3.
ssh vps3 "cat /var/backups/postgres-2026-05-11/market_prices.dump" \
  | pg_restore -U postgres -d index_prices --no-owner --jobs=4
```

Restore time roughly equals the original migration time. Expect 60-90 min for `vision_asset_settlement_players`, 30 min for post-prune `market_prices`. During restore the table is empty — read endpoints return zero rows. Coordinate.

If compression has fired before rollback, decompress first:

```sql
SELECT decompress_chunk(c) FROM show_chunks('market_prices') c;
```

## Risks and mitigations

- **PgBouncer breaks `LISTEN/NOTIFY` and `pg_advisory_lock`.** Transaction pooling severs the session, so `LISTEN` channels and advisory locks are useless through the pooler. Audit: `grep -r 'LISTEN ' data-node/ oracle/` and `grep -r 'pg_advisory_lock\|pg_try_advisory' data-node/ oracle/`. None found in current code; if either is added later, that connection must bypass PgBouncer (use `:5432` directly).
- **PgBouncer breaks prepared statements without code change.** Already covered as a *required code change*, not a verification step — `PgConnectOptions::statement_cache_capacity(0)` plus `application_name(...)` in both `data-node/src/db.rs` and `oracle/src/main.rs`. Without it, `prepared statement "sqlx_s_N" does not exist` after cutover.
- **PgBouncer rejects unlisted startup parameters.** sqlx sends at least `extra_float_digits`, `options`, `DateStyle`, `IntervalStyle`, `client_encoding`, `TimeZone`, `application_name` on connect. The `ignore_startup_parameters` line in pgbouncer.ini covers all seven; trimming it surfaces as a confusing connect error.
- **TimescaleDB `chunk_time_interval` too small.** Daily chunks for `market_prices` is fine at current write rate (~thousands/min). For settlement tables, weekly chunks. Too small = too many chunks = planner slowdown. Verify post-migration with `SELECT * FROM chunks_detailed_size`.
- **TimescaleDB extension upgrades require an exclusive session.** `ALTER EXTENSION timescaledb UPDATE` cannot run while other sessions hold the database open. With ~97 active connections, getting an exclusive window is non-trivial — schedule extension upgrades during the same low-traffic window as Phase 3 conversions, with PgBouncer paused (`PAUSE index_prices` from the admin console).
- **Cache stale on settlement.** Phase 2 cache is 30s. The Phase 2 risks section originally claimed "the frontend WebSocket already pushes settlement transitions independently of `/market/prices`." That claim is currently unverified — `grep -r 'settlement' frontend/lib/` to confirm before relying on it. Worst case: 30s of stale price visible after a settlement transition. Acceptable for the price tile; not acceptable for any UI that derives PnL from it. Audit downstream consumers.
- **Cache stampede on cold cache.** Single-flight protection is now part of the Phase 2 code change. Without it, every data-node restart serializes 50+ pollers into a single DB query and the pool empties.
- **Cache memory growth.** Hard size cap (10,000 entries per map, evict 20% oldest when exceeded) is part of the Phase 2 code change. Without it, paginated symbol-filter cardinality lets the maps grow until OOM.
- **Phase 3 PK change requires app-code change first.** Phase 3.0 ships the deterministic `settled_at` refactor. If `create_hypertable` on a vision_* table runs before 3.0 is deployed, every settlement insert succeeds but creates duplicates because `NOW()` makes each retry a new row. Order matters: ship the code, deploy the new oracle binary, watch one settlement go through cleanly, *then* run the SQL.
- **Disk pressure during hypertable migration.** `migrate_data => true` writes all rows into chunks while the original heap remains. Peak disk use is ~2× the table's size. VPS 1 has **125 GB free**, not 133 GB or 192 GB. The Phase 0.5b prune+VACUUM FULL on `market_prices` reclaims ~23 GB (mostly through index rebuild, *not* row deletion — only 5.6M rows of 183M are older than 30 days). Post-prune size: ~61 GB, migration peak ~122 GB — would leave only ~3 GB headroom on the root disk. Phase 3d therefore runs against an external 200 GB Netcup block volume mounted at `/mnt/timescale-tmp` with a `tmp_volume` tablespace. The other three tables fit on the root disk.
- **`AccessExclusiveLock` blocks reads, not just writes.** `create_hypertable(..., migrate_data => true)` blocks every reader for the duration. For `vision_asset_settlement_players` that is 60–90 min of "no historical settlement queries." The frontend's `/market/*` endpoints don't read these tables, so user-facing impact is limited; admin/leaderboard queries do, and will hang. Communicate the window.
- **Lost connections during oracle restart.** Restart oracles 60s apart. Two oracles must always be live for consensus. If `consensus_paused` flips true during the window, abort and roll back that oracle.
- **`market_prices` retention policy is destructive.** `add_retention_policy('market_prices', INTERVAL '90 days')` quietly deletes chunks older than 90 days on the next background tick. Migration 029's one-shot prune already removed those rows, so the immediate impact is zero — but if any downstream backtest depends on 100+ day rows, it dies silently. Audit `data-node/src/backtest*` and `data-node/src/sim*` for `INTERVAL > 90` usage before enabling the policy.

## Order of operations and timing

```
Day -1 (Phase 0, no production behavior change except 0.5b which pauses the data-node):
  Hour 0     0.0   Provision SSH key VPS 1 -> VPS 3 with forced-rsync command (~10 min)
  Hour 0:10  0.1   Enable pg_stat_statements + add timescaledb to shared_preload_libraries; restart Postgres
  Hour 0:25  0.2   Set application_name in data-node/oracle code; fix stale `max_connections=100` comment in db.rs:7; ship + restart
  Hour 0:40  0.3   ALTER ROLE ... statement_timeout '30s'
  Hour 0:45  0.4   Capture baseline to /root/postgres-baseline-2026-05-11.txt
  Hour 1     0.5   pg_dump -Fc to /tmp then rsync to vps3-backup for all four target tables (~45 min)
  Hour 2     0.5b  STOP data-node; market_prices DELETE > 30 days; VACUUM FULL ANALYZE; START data-node — ~35-50 min total
  Hour 3     0.6   Verify pgbouncer >= 1.18 in apt-cache

Day 0 (Phase 1, low traffic window):
  Hour 0     1.1   Install PgBouncer, configure (auth_user + auth_query, no userlist except bootstrap)
  Hour 0:30  1.2   Patch testnet.sh (oracle override URL :5432 -> :6432); push to mono main
  Hour 0:45  1.3   Cut data-node over: edit /etc/data-node-shadow.env, drop pool to 30, restart systemd unit
  Hour 1:15  1.4   Cut oracle-1 over (regenerate override via testnet.sh start), wait 60s, oracle-2, wait, oracle-3
  Hour 2     1.5   Verify Phase 1 — SHOW POOLS, application_name grouping, latency, consensus health

Day 1:
  Phase 2.1  Implement cache + single-flight + size cap, build locally, run E2E
  Phase 2.2  Push, restart data-node-shadow, verify cache hit ratio + cold-cache stampede behavior

Day 2-3 (Phase 3.0):
  Implement and deploy deterministic settled_at refactor (TickResult schema + all upsert sites)
  Verify on Anvil with kill-and-restart settlement test before touching prod schema

Day 4 (Phase 3 starts only if Phases 1-2 are stable for 24h and 3.0 is deployed):
  Hour 0     3a    vision_round_players (~seconds + validation gate)
  Hour 1     3b    vision_market_ratios (~10-15 min downtime)
  Hour 2     3c    vision_asset_settlement_players (~60-90 min downtime; pause oracle-1)
  Day 5      3d    market_prices (~30-45 min downtime; depends on 0.5 prune already run)
```

Dependencies:
- Phase 0 is a hard prerequisite for Phase 1 verification (`application_name` grouping) and Phase 2 verification (`pg_stat_statements` deltas). Do not skip.
- Phase 0.5's table dumps and the `market_prices` prune are prerequisites for Phase 3 disk math.
- Phase 2 does not depend on Phase 1 functionally but benefits from it (cache misses through PgBouncer don't starve other clients).
- Phase 3a–c depend on Phase 3.0 (deterministic `settled_at`). Ship the refactor, deploy the new oracle binary, watch one settlement land cleanly, *then* touch the schema.
- Phase 3d (`market_prices`) depends on **nothing** in 3.0 — it is independent and could ship right after Phase 2 if 3.0 slips.

## Verification gate after each phase

**Phase 0 — proceed only if:**
- `ssh vps3-backup true` from VPS 1 returns without prompting (Phase 0.0 SSH trust established).
- `SELECT count(*) FROM pg_stat_statements;` returns > 0.
- `SELECT application_name, count(*) FROM pg_stat_activity WHERE datname='index_prices' GROUP BY 1` shows four labelled rows: `data-node`, `oracle-1`, `oracle-2`, `oracle-3` (none NULL).
- `SHOW statement_timeout;` for role `max` returns `30s`.
- `ssh vps3 'ls -lh /var/backups/postgres-2026-05-11/'` from the workstation shows four `.dump` files totalling ~25 GB.
- `SELECT pg_size_pretty(pg_total_relation_size('market_prices'));` returns ~61 GB after Phase 0.5b (down from 84 GB; reclaim is mostly index rebuild, not row deletion).

**Phase 1 — proceed only if:**
- `pg_stat_activity` count for `index_prices` is ≤ 70 under normal load (down from observed 97).
- No service has logged `pool timeout`, `connection refused`, or `prepared statement does not exist` in the 30 minutes after cutover.
- Three oracles are at consensus state `idle` or `processing` — none paused.
- Frontend `/market/prices` p50 latency ≤ pre-cutover p50.
- `psql -h 127.0.0.1 -p 6432 -U pgbouncer pgbouncer -c 'SHOW STATS' | grep -i error` returns zero errors after 30 min.

**Phase 2 — proceed only if:**
- `pg_stat_statements` shows `market_assets`/`market_prices_latest` query call count down by ≥ 70% against the Phase 0 baseline.
- Frontend cache hit can be verified end-to-end: two `curl` calls 5s apart, second one <50ms.
- Zero 5xx on any `/market/*` endpoint in PostHog dashboard 1301294 for 30 minutes.
- Stampede check: 50 concurrent `curl` calls right after `systemctl restart data-node-shadow` — `SHOW POOLS` `sv_active` peaks at 1, not 50.
- `DISABLE_MARKET_CACHE=1` proven to bypass cache (set, restart, observe p50 returning to baseline).

**Phase 3.0 (refactor) — proceed only if:**
- `grep -rn 'TickResult {' oracle/src/` returns 9 hits (1 struct def + 8 constructors), every constructor with `settled_at:` populated.
- `grep -n 'NOW()' oracle/src/vision/lifecycle.rs` returns zero hits inside the upsert blocks (lines 1620–1740). This is the actual duplicate-prevention gate.
- Anvil settlement test: kill oracle mid-settlement, restart, second settlement attempt produces same row count (no duplicates).
- Oracle settlement loop runs for 30 min on testnet without errors after deploy.

**Phase 3 (per table) — proceed only if:**
- Row count exactly matches pre-conversion count (`count(*) FROM <table>`). For `market_prices`, matches the *post-prune* count from Phase 0.5.
- `EXPLAIN (ANALYZE, BUFFERS)` on the hottest query for that table shows chunk exclusion in the plan.
- 30 minutes of normal write traffic with zero errors in `oracle/src/vision/lifecycle.rs` log path.
- Compression policy fires successfully on at least one chunk before moving to the next table.

A phase that fails its gate rolls back. A phase that passes its gate is left alone for 24h before the next phase starts. Resilience that ships in a panic creates the next outage.

The system that survives is the one that learned to refuse load it cannot serve. That is what these three changes do.

---

## Plan revision (2026-05-11 round 2)

Verifier ran the plan against actual prod and the source tree. Findings below are addressed in-line above; this section maps each finding to the change.

### Blockers — applied

- **Disk math wrong (133 GB free, not 192 GB).** Replaced the disk paragraph in Risks. Added Phase 0.5 prune (`market_prices` 83 GB → ~33 GB via 30-day DELETE + VACUUM FULL) and offboarded `pg_dump` to VPS 3 over SSH pipe (no local materialization). Phase 3 ordering reworked so `market_prices` runs *last*, after the prune; total peak disk usage now fits inside 133 GB headroom.
- **data-node is systemd, not Docker.** Every cutover, deploy, and rollback command for data-node now targets `data-node-shadow.service` via `systemctl`. Build path is `cargo build --release -p data-node && cp target/release/data-node /usr/local/bin/data-node-shadow && systemctl restart data-node-shadow`. The `_start_data_node_docker` block in `testnet.sh:2435` is explicitly called out as artifact code that does not drive prod.

### Serious — applied

- **`TickResult` has no settlement timestamp.** Verified the struct at `oracle/src/vision/types.rs:74` — confirmed: only `batch_id`, `tick_id`, `market_results`, `player_balances`, `voided_players`. Added Phase 3.0 that ships a `settled_at: chrono::DateTime<Utc>` field on `TickResult`, populated upstream from `vision_batch_lifecycle.settlement_deadline` (the existing `TIMESTAMPTZ` already loaded at `oracle/src/vision/api.rs:2176, :2265`). Lists every construction site (`lifecycle.rs:595, :849`) that needs to populate it. Validation gate before any vision_* hypertable conversion.
- **PgBouncer auth mixes two patterns.** Replaced the pgbouncer.ini config: dropped `auth_file` for app users, dropped `pg_read_server_files` and the `pg_read_file` grant. Now uses `auth_user = pgbouncer_auth` + `auth_query` calling a `SECURITY DEFINER` function `pgbouncer.user_lookup(text)` that wraps `pg_shadow`. `userlist.txt` holds only the `pgbouncer_auth` bootstrap entry.
- **`market_prices` has no PK on prod.** Removed the "drop the surrogate id PK" step. Phase 3d now states that the table has no PK to rebuild — conversion is straightforward, `id` column remains as a non-PK column so `MarketPriceRecord` reads still work.
- **Wrong migration number for `market_prices`.** Corrected to `data-node/migrations/021_create_market_sources.sql` (creates the table). `029_market_prices_perf.sql` is correctly described as adding the covering index, autovacuum tuning, and a one-shot DELETE.

### Override-file prerequisite — resolution

**Path chosen: patch `testnet.sh`, not the override file directly.**

Reason: the override file at `docker/testnet/oracle/docker-compose.override.yml` is regenerated by `_start_oracles_docker` in `testnet.sh:2489` from a heredoc on every `testnet.sh deploy` and every `testnet.sh start`. Editing it on the VPS persists for hours; the next deploy wipes it. That would silently revert Phase 1 with no log line.

The patch is two lines: `testnet.sh:2452` (data-node, irrelevant for prod but bumped for consistency) and `testnet.sh:2641` (oracle vision flag, load-bearing). Both change `postgres://max@localhost/index_prices` → `postgres://max@localhost:6432/index_prices`. Patch lands as a normal commit on `mono main` so it survives every future deploy. Phase 1's cutover order now requires the `testnet.sh` patch land *before* the oracle restart, not after.

### Minor — applied

- **Phase 3 ordering wrong.** Reordered to actual sizes: `vision_round_players` (164 MB) → `vision_market_ratios` (18 GB) → `vision_asset_settlement_players` (55 GB) → `market_prices` (post-prune ~33 GB). Validation gate moved to the 164 MB step where it costs seconds, not hours.
- **`pg_stat_statements` not loaded.** Added Phase 0.1 that enables it (and `timescaledb`) in `shared_preload_libraries` before any verification depends on it. Phase 1 and Phase 2 verification gates now explicitly state they assume Phase 0.
- **`application_name` empty.** Added Phase 0.2 that sets `application_name` per service in `data-node/src/db.rs:11-12` and `oracle/src/main.rs:621-622`. Verification queries now group by `application_name` meaningfully.
- **Line numbers drift.** Re-grepped at write time. Updated all citations (`PriceCache` `:425` → `:427`, `recommended_cache` `:419` → `:422`, lifecycle upserts `:1633/:1689/:1719` → `:1634/:1690/:1720`, `market_stats` `:5610` → `:5604`). Phase 2 endpoint table now says "approx" with a note to re-grep at write time.
- **Migration 029 retention misdescribed.** Phase 3d now correctly says the new Timescale policy is the *first recurring* retention; migration 029 only ran a one-shot `DELETE`.

### Risks the verifier surfaced — added

- sqlx `statement_cache_capacity(0)` and `application_name(...)` promoted from "verify" to a required code change in Phase 0.2 + 1.
- `ignore_startup_parameters` expanded to seven entries (`extra_float_digits, options, DateStyle, IntervalStyle, client_encoding, TimeZone, application_name`).
- `timescaledb-tune` mutates `postgresql.conf` — Phase 3 install step now snapshots the file before, runs the tuner, diffs after, and tells the operator to commit the diff to the runbook.
- Hypertable `AccessExclusiveLock` blocks reads, not just writes. Phase 3 explicitly says so. New "Suspending oracle settlement during 3a–c" section gives two options (cheap: stop oracle 1; better: add `/admin/pause-settlement`).
- Cache stampede: single-flight protection now part of the Phase 2 code change (Notify-based per-key gate).
- Cache memory growth: hard size cap (10,000 entries, evict 20% oldest) now part of Phase 2.
- Advisory lock audit added to the LISTEN/NOTIFY risk bullet.
- `market_prices` retention destructiveness: Risks bullet now flags backtest impact, says to grep `data-node/src/backtest*` and `data-node/src/sim*` for `INTERVAL > 90` before enabling.

### Verifier disagreements

None. Every blocker, serious finding, missing prerequisite, and minor issue from the verification has been addressed above. The plan is now executable end-to-end without leaving a known landmine.

---

## Verification (2026-05-10)

Independent reviewer pass against actual prod state on VPS 1 (`159.195.78.238`) and the source tree at this commit.

### Verified correct

- `data-node/src/db.rs:11-12` does set `max_connections(70)` with `acquire_timeout=10s` and `idle_timeout=300s`. Plan accurate.
- `oracle/src/main.rs:621-622` does set `max_connections(15)` per oracle. Three oracles = 45. Plan accurate.
- `--vision-database-url` flag exists at `oracle/src/main.rs:70` and is wired into the compose override file on prod. Cutover via flag swap is real.
- Both data-node and oracle compose files use `network_mode: host` — `localhost:6432` will be reachable from inside containers without extra Docker plumbing.
- `recommended_cache` exists at `data-node/src/api.rs:419` (doc) / `:422` (field), used at `:6080`/`:6090`/`:6109`. The `RwLock<Option<(Instant, serde_json::Value)>>` pattern is real and reusable.
- `dashmap = "5.5"` is already a `data-node` dependency. The Phase 2 `DashMap` swap compiles without adding a crate.
- `vision-keeper` and `vision-fast-joiner` carry no `pg`/`postgres-js` dep — confirmed in `package.json`. They do not need cutover. AP, indexer, and Solana oracle-daemon are already correctly excluded.
- Migrations 008, 018, 021 (oracle) and 029 (data-node) exist as cited; the upsert PKs in those migrations are exactly as described.
- `oracle/src/vision/lifecycle.rs` upserts: `vision_round_players` at `:1634`, `vision_market_ratios` at `:1690`, `vision_asset_settlement_players` at `:1720`. All three pass `NOW()` for `settled_at` — the plan's diagnosis of the upsert problem is correct.
- `max_connections=300` confirmed live in `pg_settings`. PgBouncer slot math (50 server pool, 500 client cap) is conservative and fine.

### Errors found

- **[BLOCKER] Disk math is wrong.** Plan says "VPS 1 has 192 GB free against a 71 GB table." Actual `df -h /`: **133 GB free, 73% used.** Real table sizes: `vision_asset_settlement_players` **55 GB** (not 71 GB), `market_prices` **83 GB** (not 50 GB). `migrate_data => true` doubles each table during conversion. Two big migrations back-to-back exceed available headroom. Phase 3 will fail mid-migration with no rollback.
- **[BLOCKER] data-node is not Docker on prod.** `data-node-shadow.service` is the live unit (native systemd binary). The plan's `docker compose -f docker/testnet/data-node/... up -d --build` does not control it. Restarting that compose stack rebuilds an unused container. The actual restart command is `systemctl restart data-node-shadow`. CLAUDE.md's MEMORY.md flagged this; the plan ignores it.
- **[SERIOUS] `tick_result` has no settlement timestamp.** Plan claims "Pass an explicit `settled_at` derived from on-chain settlement event timestamp (preferred — already available in `tick_result`)." False. `oracle/src/vision/types.rs:74` `TickResult` carries only `batch_id`, `tick_id`, `market_results`, `player_balances`, `voided_players`. There is no timestamp field. The deterministic timestamp must be sourced from `vision_batch_lifecycle.settlement_deadline` or the on-chain block time of the settle tx, neither of which is in the struct today. The "local change to `lifecycle.rs:1689/1633/1719`" is not local — `TickResult` itself needs a new field, populated upstream where settlement is built.
- **[SERIOUS] PgBouncer auth config mixes two patterns.** Plan sets BOTH `auth_user = pgbouncer_auth` and `auth_file = userlist.txt`, then grants `pg_read_server_files` and `EXECUTE ON pg_read_file`. The `auth_user` pattern wants `auth_query = SELECT ...` against `pg_shadow`/a security-definer wrapper — not `pg_read_server_files`. The `auth_file` pattern wants a static file and no `auth_user`. As written, PgBouncer will work off the file and ignore the grants, or fail to resolve `auth_user` cleanly. Pick one. Standard for SCRAM is `auth_query` to a security-definer function returning `(usename, passwd)`.
- **[SERIOUS] `market_prices` has no PK on prod.** `pg_index` shows zero `indisprimary` indexes on the table. Plan's "Drop the surrogate `id` PK if possible" describes a constraint that does not exist. Good news: nothing to drop, hypertable conversion needs no PK rewrite. Bad news: plan diagnosis is wrong, which means the author hadn't actually run `\d market_prices` on prod.
- **[SERIOUS] Plan misidentifies the migration that creates `market_prices`.** Plan says `data-node/migrations/001_create_prices.sql`. That migration creates the legacy `prices` table (not `market_prices`). The real one is `data-node/migrations/021_create_market_sources.sql`. Minor traceability issue but indicative.
- **[MINOR] Table size order is wrong.** Plan orders Phase 3 conversions "smallest first" as ratios → round_players → ASP. Actual sizes: `vision_round_players` **164 MB**, `vision_market_ratios` **18 GB**, `vision_asset_settlement_players` 55 GB. Right order is round_players → market_ratios → ASP. Validating the upsert workaround on 18 GB instead of 164 MB wastes hours.
- **[MINOR] `pg_stat_statements` is not loaded.** `shared_preload_libraries` is empty. Verification commands `SELECT ... FROM pg_stat_statements ...` will return "relation does not exist" until the extension is added (which Phase 3 does anyway via timescaledb-tune side effects, but Phase 2's verification gate runs *before* Phase 3).
- **[MINOR] `application_name` empty for every connection.** Verification command `SELECT application_name, count(*) FROM pg_stat_activity GROUP BY 1` returns one row with NULL for everything. Not useful for proving "data-node holds 30 slots, oracle-1 holds 8." Use `usename` + `client_port` patterns or set `application_name` in sqlx's `PgConnectOptions` first.
- **[MINOR] Active connections today are 97, not 115.** Plan's "115 worst case" is the theoretical pool cap, not observed. Headroom is more comfortable than the plan implies — which is fine for the argument, but the urgency framing should be honest.
- **[MINOR] Migration 029 is a one-shot DELETE, not a recurring retention policy.** Plan says "existing 90-day retention from migration 029 *becomes* a Timescale policy." There is no existing recurring retention; the new Timescale policy is the first one. Phrase as "introduce a 90-day retention policy."
- **[MINOR] Line numbers drift by 1–4 in several citations.** `lifecycle.rs` upserts cited at 1633/1689/1719, actual 1634/1690/1720. `PriceCache` cited at `:425`, actual `:427`. `market_stats` route cited at `:5610`, actual `:5602`. Not load-bearing, but signals the plan was written from memory in places.

### Missing prerequisites

- **`docker-compose.override.yml` for data-node and oracle is generated by `testnet.sh`.** It exists on VPS but not in the repo. The plan tells the operator to "edit" the file as if it were checked in. State explicitly that the override is regenerated on every `testnet.sh deploy` and that any manual edit will be wiped — either patch `testnet.sh` to generate the new URL, or document that the change has to be re-applied after every redeploy.
- **No mention of how PgBouncer survives `testnet.sh deploy`.** Same problem. If a redeploy regenerates the override file with `:5432`, the next deploy reverts the cutover silently.
- **No baseline capture of `pg_stat_statements`.** Phase 2 verification depends on call-count delta. Add: enable `pg_stat_statements` extension as a *pre*-Phase-1 step, capture baseline, then proceed.
- **No `application_name` set in sqlx.** Without it, the verification gates can't tell which service holds which slot. Add a one-line `PgConnectOptions::application_name("data-node")` (and equivalent for oracles) as a pre-Phase-1 commit.
- **No Postgres-side `statement_timeout` per role.** Plan disables PgBouncer's `query_timeout` correctly, but never sets the Postgres-side timeout it tells the operator to use instead. Add the `ALTER ROLE max SET statement_timeout = '30s'` (or per-role) as part of Phase 1.
- **No verification that PgBouncer 1.18+ ships in Debian 13.** SCRAM passthrough requires it. Plan should `apt-cache policy pgbouncer` and confirm before installing.
- **No backup before Phase 3.** Plan says "Take a `pg_dump` of the table before each conversion" only inside the rollback section, after the irreversible step. State it as an explicit pre-step with disk math: dumping 55 GB + 83 GB into uncompressed SQL on a disk with 133 GB free will fail. Use `pg_dump -Fc` (compressed) or stream to another VPS.
- **No mention of `vision_batch_lifecycle.settled_at`** as the deterministic source for the new `settled_at` value. If `TickResult` doesn't carry it, plan needs to specify *exactly* where the timestamp comes from — block time of settle tx, scheduler tick boundary, or the lifecycle row.

### Risks not surfaced

- **PgBouncer + sqlx prepared statements.** Plan mentions this as a "verify" but doesn't give the actual fix. sqlx 0.7+ requires `PgConnectOptions::statement_cache_capacity(0)` in transaction-pooling mode, AND the `?application_name=...` query string in the URL (auto-prepared statements break otherwise). Mark it as a code change, not a verification step.
- **`extra_float_digits` is one of three params PgBouncer rejects in transaction mode.** sqlx also sends `client_encoding`, `DateStyle`, and sometimes `intervalstyle`. The `ignore_startup_parameters` list should be `extra_float_digits,options,DateStyle,IntervalStyle,client_encoding,TimeZone`. Plan's two-entry list is too short.
- **Timescale `timescaledb-tune` will rewrite `shared_buffers` and `work_mem`.** It targets ~25% of RAM (4 GB on 16 GB VPS 1) and changes effective_cache_size, max_worker_processes, and parallel settings. Plan never warns the operator that the tuner mutates `postgresql.conf` and requires a Postgres restart, nor that the new settings affect every other service that connects (oracle, itp-bot, etc).
- **Hypertable migration locks the table for writes.** Plan says "inserts block." More precisely: `create_hypertable(..., migrate_data => true)` takes an `AccessExclusiveLock` for the duration. Reads also block. For 83 GB this is **not** 30 minutes — closer to 60–90 minutes on an HDD-backed VPS. Settlement upserts will pile up in oracle queues; check whether the oracle retries indefinitely or gives up.
- **Cache stampede on data-node restart.** Plan never mentions cold cache. After every data-node restart, the first request to each cached endpoint serializes 30+ pollers into a single DB query. Use `singleflight` or accept the spike.
- **Cache memory growth.** `DashMap` plus 30s TTL plus background eviction every 60s — for 30s the map can hold every distinct key seen in that window. With 65 frontend pollers × multiple sources × multiple categories × paginated symbol filters, cardinality is high. Plan says "without it the maps grow unbounded" — true, but the bound it proposes (`2 * TTL` eviction) still leaves a 60s window where memory grows freely. Add a hard size cap.
- **TimescaleDB extension upgrade locks.** Future `ALTER EXTENSION timescaledb UPDATE` requires no other sessions on the database. With 97 active connections, getting a single-session window is non-trivial. Worth flagging.
- **Phase 3 retention policy on `market_prices` is destructive.** `add_retention_policy('market_prices', INTERVAL '90 days')` will background-delete chunks older than 90 days on next run. Migration 029 already pruned, so the immediate impact is small — but if anyone has been quietly depending on 100-day-old rows for a backtest, they will discover this in production.
- **PgBouncer + advisory locks.** Transaction-pooled connections lose `pg_advisory_lock` semantics. Plan greps for `LISTEN ` but not for `pg_advisory_lock`. Worth a second grep.
- **Frontend WebSocket settlement push is asserted but never verified.** Phase 2 risks section says "the frontend WebSocket already pushes settlement transitions independently of `/market/prices`." Cite the file. If untrue, 30s cache means 30s of stale prices visible after settlement.

### Recommended changes

1. Replace the disk-math paragraph in Risks with real numbers: 133 GB free, 55 + 83 GB peak, dump-to-other-VPS required.
2. Replace every Docker compose command for `data-node` with `systemctl restart data-node-shadow` and update Rollback similarly. Confirm `data-node-shadow.service`'s env file path before writing the cutover step.
3. Drop the "available in `tick_result`" claim. Specify the real source: block time of the settle tx (already in `vision_batch_lifecycle.settlement_deadline` once written, or `tick_result.batch_id` → lookup). Add a TickResult schema change as a pre-step.
4. Pick one PgBouncer auth pattern. Recommended: `auth_user = pgbouncer_auth` + `auth_query = SELECT usename, passwd FROM pgbouncer_auth.user_lookup($1)` with a security-definer wrapper. Drop `auth_file`, drop `pg_read_server_files`.
5. Reorder Phase 3: round_players (164 MB) → market_ratios (18 GB) → market_prices (83 GB) → ASP (55 GB), or move ASP before market_prices. Smallest-to-largest, actually.
6. Add a Phase 0 covering: enable `pg_stat_statements`, set `application_name` per service, set `statement_timeout` per role, capture baseline, take a `pg_dump -Fc` of vision_* and market_prices to VPS 3 or external storage.
7. Patch `testnet.sh` (or document) so the override regeneration uses `:6432`. Otherwise next deploy silently reverts Phase 1.
8. Expand `ignore_startup_parameters` to the full list sqlx sends.
9. Document that `timescaledb-tune` mutates `postgresql.conf`. Diff the file before/after, commit the diff to the runbook.
10. Add explicit guidance on how to suspend oracle settlement during Phase 3 conversions (not just "low-traffic window") — the upsert path needs to either pause cleanly or accept blocking inserts.
11. Add cache stampede mitigation: either single-flight in the cache (one DB call per key on miss, others wait), or document acceptance of cold-start spikes.

### Verdict

Needs revision before execution. The blast direction is correct: pooler → cache → partitioning is the right order for a single-instance Postgres outgrowing its box. The diagnosis of upsert PKs vs. hypertable constraints is the kind of subtle thing that catches teams a year later. But two errors are blocking: the disk math will run the migration into a wall, and the Docker-vs-systemd confusion means the Phase 1 cutover commands will silently restart nothing. A third error — the missing timestamp field in `TickResult` — turns the "small code change" into a real refactor. Fix those three, do the Phase 0 instrumentation, and the plan is shippable. Execute as written and Phase 1 fails quietly while Phase 3 fails loudly.

---

## Plan revision (2026-05-11 round 3)

Verifier #2 confirmed round-2 closed verifier #1's findings, but found three new blockers introduced by the round-2 fixes plus three serious issues. All addressed in-line above. Map of changes:

### Blockers — applied

- **SSH trust between VPS 1 and VPS 3 was assumed, not real.** Verified: `/root/.ssh/` on VPS 1 holds only `id_ed25519_migration` and a `known_hosts` covering GitHub plus one host fingerprint; `~/.ssh/config` is absent. `/root/.ssh/authorized_keys` on VPS 3 holds only the operator's workstation key (`max@agiarena`). Round-2's Phase 0.5 `pg_dump -Fc | ssh vps3 'cat > ...'` would have failed on the first run with `Permission denied (publickey)`. Added **Phase 0.0** before any Phase 0.5 step: generate a dedicated `id_vps3_backup` key on VPS 1, append to VPS 3's `authorized_keys` with a `command="rsync --server -e.LsfxC . /var/backups/postgres-2026-05-11/"` forced-command + `no-pty,no-port-forwarding,no-X11-forwarding,no-agent-forwarding` lockdown, write a `Host vps3-backup` block to VPS 1's `~/.ssh/config`. Phase 0.5 rewritten to dump to `/tmp` then `rsync` over `vps3-backup` (the forced command only matches `rsync`, blocking shell access). Verification probe: `rsync -e ssh /tmp/probe.txt vps3-backup:` plus a workstation-side `ssh vps3 'ls /var/backups/...'`.

- **Phase 1 cutover edited the wrong file.** Verified `systemctl cat data-node-shadow.service` on VPS 1: the `--database-url` flag is hard-coded in `ExecStart=` at `/etc/systemd/system/data-node-shadow.service`, *not* in either of the two `EnvironmentFile=` sources (`/home/max/index/data-node/.env`, `/home/max/index/system.env`) — neither of which contains `DATABASE_URL`. Round-2's "edit the env file" instruction would have changed nothing. Rewrote Phase 1.1 to make `systemctl edit --full data-node-shadow.service` the **primary** path (rewrites `/etc/systemd/system/data-node-shadow.service`, runs `daemon-reload`), with the env-file refactor demoted to a follow-up. The rollback section now also targets `systemctl edit --full`, not env-file revert. Also corrected the build instruction: the live binary is at `/home/max/index/target/release/data-node`, not `/usr/local/bin/data-node-shadow` — the simpler restart path skips the copy.

- **`TickResult` literal sites are 9, not 2.** Re-grepped `grep -rn 'TickResult {' oracle/src/` — actual results: `types.rs:74` (struct def) + `resolver.rs:377` (production constructor inside `resolve_tick`) + `lifecycle.rs:595` (`empty_tick`) + 7 `#[test]` sites in `settlement.rs` (lines 131/178/222/245/282/378/443). Round-2's `lifecycle.rs:849` citation was wrong — that line is a `resolve_tick(...)` *call*, not a struct literal (verified by reading lines 845–855: `let tick_result = self.resolver.resolve_tick(...)`). Phase 3.0 rewritten with a full table enumerating all 9 sites, identifying `resolver.rs:377` as the production constructor (which the round-2 plan missed entirely) and noting the seven test sites must compile but don't exercise retry-idempotency. Phase 3a validation gate strengthened: the row-count test passes even with an incomplete refactor because `settlement_deadline` is loaded once per batch, so a `grep -n 'NOW()' oracle/src/vision/lifecycle.rs` source-tree gate is now the actual duplicate-prevention check (returns zero hits inside the upsert blocks).

### Serious — applied

- **Phase 0.5 disk-savings claim was ~2× optimistic.** Verified `pg_relation_size('market_prices')` = 25 GB heap, `pg_indexes_size('market_prices')` = 59 GB indexes, total 84 GB. Only 5.6M of 183M rows are older than 30 days (3%); only 742K dead tuples. `DELETE` reclaims ~1 GB heap. `VACUUM FULL` reclaims another ~1 GB heap (already nearly compact) and rebuilds the indexes, dropping them from 59 GB to ~37 GB. Real total post-prune: **~61 GB, not ~33 GB**. Phase 3d migration peak therefore ~122 GB against 125 GB free — only ~3 GB headroom, unacceptable. Promoted option (b) (mount external 200 GB Netcup block volume, `CREATE TABLESPACE tmp_volume`, `SET temp_tablespaces = 'tmp_volume'` for the conversion session) from "alternative" to **the chosen path for `market_prices` specifically**. Other three tables stay on root disk. Added the mount/tablespace pre-step and the post-conversion teardown SQL inline in Phase 3d. Risks section updated with real numbers.

- **VACUUM FULL takes `AccessExclusiveLock` while collectors write every 30s.** Round-2 named the 30–45 min lock duration but had no plan for the data-node collectors that hammer the table. Added an explicit maintenance-window procedure to Phase 0.5b: `systemctl stop data-node-shadow` → verify no remaining writers via `pg_stat_activity` → `DELETE` → `VACUUM FULL ANALYZE` → `systemctl start data-node-shadow`. Total downtime: ~35–50 min. ~30–60s of dropped collector ticks during the start/stop is acknowledged as acceptable. `pg_repack` was considered (no exclusive lock) and rejected — needs ~3× table size in temp disk, impossible on this box.

- **`Arc::strong_count` single-flight is racy.** Replaced with `tokio::sync::OnceCell` per cache key. `DashMap::entry().or_insert_with(|| Arc::new(OnceCell::new()))` is atomic — exactly one `OnceCell` is ever inserted per key. `cell.get_or_try_init(|| async { ... })` runs the closure on at most one task across all callers; every other caller awaits the same future. After init, the cell is removed from the singleflight map so the next TTL-expired miss claims a fresh cell (initialized cells can't re-init). Updated the Phase 2 code sketch end-to-end with the correct pattern; called out the two subtleties (closure error type is what every waiter sees; `remove` after init is what enables the next stale-cache miss).

### Minor — applied

- Stale `max_connections=100` comment in `data-node/src/db.rs:7` (prod is 300) — added to the Phase 0.2 commit so it lands alongside the `application_name` change.
- Justification for 30-day prune cutoff added to Phase 0.5b: 30 deletes 5.6M rows, 60 deletes ~1.4M, 90 deletes 0. The real reclaim is the index rebuild, which fires regardless of cutoff. Decision: keep 30 for runbook simplicity; "delete nothing, just VACUUM FULL" would produce the same disk outcome with no recovery surface.
- Statement-timeout interaction with Phase 3 lock windows: the Risks section already implies the oracle-1 pause is *required* (not optional) during ASP conversion; promoted to explicit language in 3c. Settlement upserts hitting the 60–90 min `AccessExclusiveLock` would die at the 30s `statement_timeout` and the oracle would log a flood of `canceling statement due to statement timeout` errors.
- Cutover degradation acknowledged: ~5–15s of 5xx during the `systemctl restart data-node-shadow` while the new process binds and seeds its pool. Frontend impact named explicitly.

### Things both prior rounds missed (not addressed in this revision)

Verifier #2 also surfaced these — they are real but out of scope for round 3 (resilience, not a feature gap):

- No persistent monitoring of PgBouncer (`SHOW POOLS` is a snapshot). Cheap follow-up: a once-per-minute cron writing `SHOW POOLS` to a file. Logged for the runbook, not the plan.
- PgBouncer admin auth for the `postgres` user is implicit. `admin_users = postgres` requires PgBouncer to authenticate `postgres` — the plan should add `postgres`'s SCRAM hash to `userlist.txt` or accept that admin commands run as `pgbouncer_auth`. Filed for Phase 1 follow-up.
- Phase ownership / time-budget framing (operator-hours per phase, not just calendar days). Cosmetic; the existing day-by-day breakdown is enough for execution.
- No rollback for Phase 0.5b prune itself (5.6M rows, gone). The dump in Phase 0.5 happens *before* the prune (correct ordering), and the runbook should explicitly state "to recover deleted rows, restore from `vps3:/var/backups/postgres-2026-05-11/market_prices.dump`." Added to the runbook to-do list, not the plan body.

### Verifier disagreements

None substantive. Verifier #2's call on every blocker held up under independent check; the round-3 fixes address each one with verified prod state, not assumption.

---

## Verification 2 (2026-05-11)

A second reviewer, no commitment to either prior agent. Read the prod state with `psql` and `df`, the source tree at this commit, and both prior round notes.

### Audit of verifier #1

**Findings that held up under independent check:**

- *Disk: 133 GB free.* `df -h /` on VPS 1 returns `132G` free. Verifier #1 was right; original plan's "192 GB" was hallucinated. Round 2 corrected.
- *Table sizes: 55 / 83 / 18 / 0.16 GB.* `pg_total_relation_size` matches exactly. Verifier #1 right.
- *`data-node-shadow.service` is native systemd.* `systemctl status data-node-shadow` confirms `Active: active`, binary at `/home/max/index/target/release/data-node`, started by Debian systemd, *not* Docker. Verifier #1 right.
- *`market_prices` has no PK on prod.* `\d market_prices` shows five `btree` indexes, **no** `PRIMARY KEY` line. The `id` column has a sequence default but no `indisprimary`. Verifier #1 right.
- *`shared_preload_libraries` is empty.* `SHOW shared_preload_libraries;` returns the empty string. Verifier #1 right.
- *`TickResult` has no `settled_at`.* `oracle/src/vision/types.rs:74` — five fields, none of them a timestamp. Verifier #1 right.
- *Migration that creates `market_prices` is `021_create_market_sources.sql`.* Confirmed: `001_create_prices.sql` creates the legacy `prices` table; `021_create_market_sources.sql` is where `CREATE TABLE IF NOT EXISTS market_prices` lives. Verifier #1 right.
- *Upsert sites are at `lifecycle.rs:1634/1690/1720`.* Confirmed by `grep -n`, all three pass `NOW()` as the conflict-key timestamp. Verifier #1 right.
- *PgBouncer auth pattern in original plan was a confused hybrid.* Round 2 collapsed it to clean `auth_user + SECURITY DEFINER` — that is the canonical pattern PgBouncer 1.18+ documents. Verifier #1's call was right and the round-2 fix is correct.
- *Phase 3 ordering wrong by table size.* Round 2 reordered to round_players → market_ratios → ASP → market_prices, which matches actual sizes. Verifier #1 right.
- *`testnet.sh` regenerates the override file every deploy.* `_start_oracles_docker` at line 2489 builds the override from a heredoc; manual edits get wiped. Verifier #1 right.

**Findings that were exaggerated or misleading:**

- *"`market_stats` route cited at `:5610`, actual `:5602`."* Verifier #1 said `:5602`. The plan now says `:5604`. I did not re-grep the live numbers — both could be wrong by a few lines depending on commit. Trivial; the plan's "approx + re-grep at write time" caveat handles it.
- *"Active connections today are 97, not 115."* True at the time verifier #1 ran. Today the same query returns **115**. Connection count drifts hourly; using either as a threshold is a snapshot, not a constant. The plan now uses 97 throughout — already stale by the time round 2 was written. Minor.

**Findings the first verifier missed in their own work:**

- *PgBouncer 1.24.1 ships in Debian 13.* Verifier #1 flagged "no version check" as a missing prerequisite. Round 2 added Phase 0.6 to verify. Independent check: `apt-cache policy pgbouncer` returns `Candidate: 1.24.1-1+deb13u1`. Phase 0.6 will pass. No surprise.
- *Postgres `max_connections=300` confirmed live*, but `data-node/src/db.rs:7` carries a stale comment claiming "100." Cosmetic but worth fixing in the same Phase 0.2 commit that touches the file. Both prior rounds missed it.
- *Migration 029 already pruned at 90 days.* Independent: `SELECT count(*) FROM market_prices WHERE fetched_at < NOW() - INTERVAL '90 days'` returns **0**. The 90-day retention policy that Phase 3d "introduces" deletes nothing on first run. That is actually fine for the policy itself, but it means the *Phase 0.5 30-day prune* is the only real data deletion in the whole plan, and it deletes ~5.6M rows that are 31–89 days old. Neither prior round examined whether 30 was the right number or just an arbitrary tightening.

### New issues in the revised plan

**Blockers:**

1. **Phase 0.5 SSH pipe will fail.** `ssh index-maker/prod/be 'ssh vps3 "df -h /"'` from VPS 1 returns `Permission denied (publickey)`. The `vps3` alias and key trust exist on the workstation, not on VPS 1. The whole offboard-dump plan (`pg_dump -Fc | ssh vps3 "cat > ..."`) silently fails on first run unless someone provisions root@VPS1 → root@VPS3 SSH first. Add a Phase 0.0 step: generate a key on VPS 1 (`ssh-keygen -t ed25519 -f /root/.ssh/id_vps3 -N ""`), append the public key to `/root/.ssh/authorized_keys` on VPS 3, write `~/.ssh/config` on VPS 1 with a `Host vps3` block. Without this the rollback path in Phase 3 is also dead.

2. **Phase 1 cutover edits the wrong file.** Plan says "Edit the env file: change `DATABASE_URL=postgres://max@127.0.0.1/index_prices`." `systemctl cat data-node-shadow.service` shows `EnvironmentFile=/home/max/index/data-node/.env` and `EnvironmentFile=/home/max/index/system.env` — but the live `--database-url` is hard-coded in `ExecStart=`, not in either env file. Editing the env file changes nothing. The cutover requires `systemctl edit --full data-node-shadow.service` (which the plan mentions only as a fallback) **or** modifying the source unit file at `/etc/systemd/system/data-node-shadow.service` directly. Promote the fallback to the primary instruction, or the cutover does nothing.

3. **`TickResult` has nine literal sites, not two.** `grep -n 'TickResult {' oracle/src/` returns: `resolver.rs:377` (production constructor), `lifecycle.rs:595` (empty_tick), and **seven** `settlement.rs` sites (all `#[test]` blocks at 131/178/222/245/282/378/443). Plan calls out only `lifecycle.rs:595` and `lifecycle.rs:849` — and **`lifecycle.rs:849` does not contain a `TickResult { ... }` literal**, it's a `resolve_tick(...)` call. The actual production constructor is `resolver.rs:377`. Tests still need updating to compile. Phase 3.0 understates the surface area by half and points at the wrong line.

**Serious:**

4. **Phase 0.5 disk-savings claim is wrong.** Plan: "30-day DELETE + VACUUM FULL brings `market_prices` to ~33 GB." Reality: 183M live rows in 25 GB heap + 58 GB indexes. Only 5.6M rows (3%) are older than 30 days, and only 742K dead tuples exist. VACUUM FULL on a barely-bloated table reclaims maybe 1 GB of heap. Index rebuild may shrink indexes by 30–40%, taking total from 83 GB → ~55 GB, **not 33 GB**. The Phase 3d migration peak then becomes ~110 GB, leaving ~22 GB headroom for WAL/temp/logs — workable but not the comfortable margin the plan implies. Either acknowledge the real number or commit to option (b) (external block volume) up front.

5. **VACUUM FULL takes `AccessExclusiveLock` while collectors are writing every 30s.** Plan says "30-45 min lock" with no plan to pause the data-node collectors. The collectors will block on the lock, queue up, and either retry-storm the table the moment the lock releases or drop ticks silently depending on `acquire_timeout=10s`. Add: stop the data-node before VACUUM FULL, or accept dropped collector ticks and document the gap. Or use `pg_repack` instead, which doesn't take an exclusive lock.

6. **Single-flight using `Arc::strong_count` is racy.** Phase 2's `if Arc::strong_count(&notify) > 2 { wait }` pattern has a TOCTOU race: two tasks can `entry().or_insert_with()` concurrently, both observe a strong count of 2 (the map + their local), and both fetch from the DB. The standard pattern is to atomically claim the slot — use `DashMap::entry().and_modify().or_insert_with()` returning whether the entry was newly created, or use `tokio::sync::OnceCell` keyed per request. As written, single-flight is best-effort, not airtight.

7. **`statement_timeout=30s` will kill in-flight settlement upserts during Phase 3 conversions.** Phase 0.3 sets `ALTER ROLE max SET statement_timeout = '30s'`. Phase 3c says ASP conversion takes 60–90 minutes of `AccessExclusiveLock`. Any settlement upsert that hits the table during that window blocks on the lock. After 30s, Postgres kills it. Oracle 1's settlement loop sees a flood of `canceling statement due to statement timeout` errors. Plan's "pause oracle 1" mitigates this but the interaction between role timeout and lock window is never named explicitly.

**Minor:**

8. **Plan says "`max_connections` is 100 on VPS 1" in `data-node/src/db.rs:7` — stale comment.** Prod is 300. Fix in the same Phase 0.2 commit.

9. **Phase 0.5 prune is at 30 days but post-conversion retention is at 90.** The 60-day delta of data is deleted then never re-accumulated until 90-day backfill. Why 30 not 90? Plan never says. If "to free disk for migration" is the answer, write that. Or set the prune to 60 days, leaving more headroom after the migration.

10. **`market_prices` collector writes are described as "thousands/min" in Risks.** Independent count: 183M rows over 43 days = ~3000 rows/min average; peak likely much higher. Plan's "daily chunks" decision rests on this number and the number is approximately right, but the operator should verify post-migration with `SELECT chunk_name, range_start, range_end, total_bytes FROM chunks_detailed_size WHERE hypertable_name='market_prices'` to confirm chunk sizes are reasonable (~1–3 GB).

11. **Phase 3a validation gate doesn't actually validate the upsert refactor.** It checks row counts after one settlement and one re-settlement. But the "duplicate row" failure mode requires the timestamp to differ between attempts. If `settlement_deadline` is loaded once and reused on retry (which is the *correct* behavior the refactor produces), the test will pass even if the refactor was applied incompletely (e.g., one upsert site uses `NOW()` still). The gate should also `grep -n 'NOW()' oracle/src/vision/lifecycle.rs` and require zero results inside the upsert blocks.

### Things both rounds missed

- **No mention of how the running PgBouncer is monitored.** `SHOW STATS` is a snapshot; the plan never sets up `node_exporter` or any persistent collector against the PgBouncer admin console. Three days after cutover, "is the pool exhausted?" is unanswerable without a fresh `psql` session. Cheap fix: `pg_stat_statements` plus a once-per-minute cron writing `SHOW POOLS` to a file.
- **PgBouncer admin password is implicitly `pgbouncer_auth`'s password.** `admin_users = postgres` only works if PgBouncer can authenticate `postgres` — the plan never covers that. Either add `postgres` to `userlist.txt` with its hash, or accept that admin commands run as `pgbouncer_auth` (which has no admin grants).
- **No phase ownership / time-budget framing.** The plan reads as one operator's afternoon. Realistically: Phase 0 is one Claude session (~2 hours); Phase 1 is one careful operator session (~3 hours, low-traffic window); Phase 2 is a 1-day code task; Phase 3.0 is a 2-day code task; Phase 3a–d is one operator over a weekend. The "Day 0/1/2-3/4" timeline buries this. State elapsed-hours-of-human-work per phase, not just calendar days.
- **No rollback for Phase 0.5 prune.** Once the 5.6M rows are deleted, they're gone. The dump in Phase 0.5 happens *before* the prune (correct), but the runbook never says "to recover, restore from `vps3:/var/backups/.../market_prices.dump`." State the recovery path.
- **What happens to in-flight transactions during PgBouncer cutover?** When `data-node-shadow` restarts pointing at `:6432`, every existing client connection is severed. Any handler with a half-finished transaction returns an error to the frontend. For the 30s of restart time the API is degraded. Acknowledge this; it's not a blocker but the plan implies seamless cutover.
- **"What if a phase fails halfway through?"** The plan has rollbacks per phase but no decision tree for "Phase 1 succeeded, Phase 2 broke prod, can I keep PgBouncer and revert just the cache?" Answer is yes (independent), but say it.

### Recommended next round of changes (if any)

1. **Fix Phase 1 cutover instructions** to target `systemctl edit --full data-node-shadow.service` as primary, env file as fallback (and only if the operator first moves `--database-url` from `ExecStart=` into the env file — which is itself a separate refactor).
2. **Add Phase 0.0 SSH provisioning** for VPS 1 → VPS 3, or move the dumps to a different location (local `/dev/sda5`, S3, mount a temporary block volume).
3. **Re-grep `TickResult { ... }` and list all nine sites** in Phase 3.0. Note that seven are tests; they still must compile.
4. **Acknowledge the real Phase 0.5 disk savings** (~25–28 GB reclaimed, not ~50 GB) and re-do Phase 3d disk math from there. If margin is tight, commit to (b) external volume up front.
5. **Stop the data-node collectors before VACUUM FULL**, or use `pg_repack`, or accept the ticks dropped and write that down.
6. **Replace `Arc::strong_count` single-flight** with an atomic insert pattern (`entry().or_insert_with(...)` returning whether new, or a `OnceCell` per key). Otherwise Phase 2's stampede protection has holes.
7. **State explicitly** that `statement_timeout=30s` will kill upserts during Phase 3 lock windows, and that the oracle-1 pause in 3c is *required*, not optional.
8. **Justify 30 days vs 90** for Phase 0.5 prune, or change to 60.
9. **Document PgBouncer admin auth** for the `postgres` user.

### Verdict

One more revision. Round 2 fixed the catastrophic errors verifier #1 caught, and the structure is now sound — Phase 0 instrumentation, the deterministic-timestamp refactor, the `auth_user + SECURITY DEFINER` clean-up, the table-size-ordered Phase 3 — these are all correct. But round 2 introduced a new catastrophic error of its own (the SSH pipe to a key-less VPS 3) and propagated a wrong line number (`lifecycle.rs:849`) that would send the operator looking at the wrong code. The disk-savings math is optimistic by roughly 2×, and the env-file edit instruction does nothing on prod. None of these is fatal in the abstract — every one is fatal in the moment. Fix the nine items above, re-verify the Phase 0.0 SSH provisioning works, and the plan ships. Execute as currently written and Phase 0.5 fails before the first dump completes.
