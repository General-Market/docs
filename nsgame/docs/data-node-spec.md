# nsgame Data-Node — Operational Specification

A second instance of the existing `data-node` binary, restricted to tube sources, deployed on VPS 3, bound to localhost. The oracle on VPS 3 reads from it over loopback. Nothing else does, yet.

## 1. Objective

nsgame must be unable to die because generalmarket.io died. That is the whole point of giving it its own price feed. Today the Solana oracle on VPS 3 calls `https://api.generalmarket.io/v1/sources/{id}/price` — the financial data-node on VPS 1, fifty sources of cross-asset noise the tube product does not need and should not depend on. nsgame gets its own systemd unit, its own port, its own metrics, its own failure surface. Public HTTPS exposure waits — the oracle is already on the same host, and the frontend does not yet need a public price endpoint.

Decided 2026-04-25: no domain yet. The data-node binds to `127.0.0.1:8201`. When the frontend later needs direct access from the browser, an nginx vhost and an LE cert are a one-hour task; we will buy them then. Until then, the only client is the oracle, sitting two milliseconds away on loopback.

## 2. Architecture choice — (a) vs (b)

| Concern | (a) second `data-node` instance, allowlist-restricted | (b) forked `tube-data-node` crate |
|---|---|---|
| Time to ship | hours | days |
| Code surface | ~30 lines of Rust + systemd unit + nginx vhost | new crate, new build, new tests, new CI |
| Maintenance | one binary, two configs | two binaries diverging slowly until they hate each other |
| Tube collectors | already in `data-node/src/market_data/sources/{tubes,chaturbate}` | copy them out, retest, rebuild |
| Risk of regression | bounded — flag-gated allowlist | high — strip-down always misses something |
| Build size | irrelevant on a 4-core VPS | small win, paid for in maintenance |

**Recommendation: (a).** The allowlist is thirty lines of Rust and one hour of restraint. Forking a crate to remove fifty source registrations is the kind of decision that feels clean for a week and rots for a year.

## 3. Rust changes — `data-node` allowlist

### Env var

| Name | Default | Behavior |
|---|---|---|
| `SOURCE_ALLOWLIST` | empty (allow all) | Comma-separated list of literal `source_id` strings. If non-empty, only sources whose `source_id()` exactly matches an entry boot. Whitespace trimmed. Empty entries ignored. |

For the nsgame instance the value is:

```
SOURCE_ALLOWLIST=tubes,chaturbate
```

Each tube collector currently identifies itself via `MarketDataSource::source_id() -> &'static str` returning a single string for the whole collector — `"tubes"` (xvideos / xnxx / pornhub / eporner) and `"chaturbate"`. The allowlist is matched on those names, not on per-asset prefixes like `tubes_xv_*` (those live below the collector boundary).

### Code locations to patch

The current registration is a wall of `if std::env::var("…ENABLED").ok().as_deref() == Some("1")` blocks in `data-node/src/serve.rs`, one per source, each calling `spawn_resilient(...)` and constructing a `MarketDataSource`. Three changes, no refactor:

1. **`data-node/src/serve.rs`** — at the top of the registration section (around line 1500, before any `spawn_resilient` block), parse `SOURCE_ALLOWLIST` once into a `HashSet<String>` and stash it in a local variable. Below each `spawn_resilient(name, ...)` call site, gate with: if the allowlist is non-empty AND `name` is not in the set, skip the spawn entirely. This is roughly fifty `if allowed("name")` insertions — mechanical and trivial. The lines that today read `info!("Tubes video-views tracker started");` simply do not run on a non-tube instance.

2. **`data-node/src/api.rs`** — extend `source_id_to_symbol(source_id: u32)` (line 2490) to serve the tube source PDAs. Today it returns `BTCUSDT`/`ETHUSDT`/`SOLUSDT` for ids 1/2/3. The on-chain mapping (per `nsgame/docs/source-id-mapping.md`) reuses ids 1–5 for `tubes_xv` through `tubes_ep`. The route must dispatch off `source_id` to a tube-specific handler that resolves a per-asset price against the `prices`/`klines` tables filtered by `source = 'tubes'` or `source = 'chaturbate'`. The current handler maps `u32 → Bitget symbol`; the new path maps `u32 → (collector, query)` and reads from the data-node's own DB. This is the load-bearing change. Keep it tight; a few match arms.

3. **No change to `Cargo.toml`, no new crate, no new feature flag.** The allowlist is data, not architecture.

If `SOURCE_ALLOWLIST` is empty the binary behaves exactly as today. The financial data-node on VPS 1 will not notice it shipped.

## 4. Tube collectors — inventory

| Source family | Collector path | Status | Priority |
|---|---|---|---|
| Chaturbate (`tubes_cb_*`) | `data-node/src/market_data/sources/chaturbate/` | implemented; gated by `CHATURBATE_WM` | ship first — Type F/G markets land first |
| xvideos / xnxx / pornhub / eporner (`tubes_xv_*`, `tubes_xn_*`, `tubes_ph_*`, `tubes_ep_*`) | `data-node/src/market_data/sources/tubes/` | implemented; gated by `TUBES_ENABLED=1` | ship second — covers Type A, B, D, E, H |
| Pornhub rank scraping (`tubes_ph_rank_*`) | inside `tubes` collector | partially present (per MARKETS_LIST: "needs re-enabling (SSR back)") | implement after F/G/H land |
| eporner star pages (`tubes_ep_star_*`) | inside `tubes` collector | partially present (per MARKETS_LIST: "needs re-enabling (SSR back)") | implement after F/G/H land |
| Per-video raw-int reader (`tubes_xv_video_views_{vid}`) | new — feeds Type E and H | not implemented | implement before Type E/H markets list |
| Trending rank emitter (`tubes_xv_trend_rank{N}`) | new — feeds Type D | not implemented | implement after Type E/H |

Ship order matches MARKETS_LIST §"Ship order": F/G first (no new collector code), then H (smallest addition — single video page reader), then E (same data, different cadence), then A/B (existing), then C (PH re-enable), then D (rollover trigger). The data-node spec assumes the existing collectors as-is; new readers are out of scope for this document and tracked separately.

## 5. Deployment on VPS 3

### Filesystem layout

| Path | Purpose |
|---|---|
| `/usr/local/bin/nsgame-data-node` | binary (renamed copy of `data-node` artifact) |
| `/etc/nsgame-data-node.env` | env vars (mode 0600, root:root) |
| `/etc/systemd/system/nsgame-data-node.service` | unit |
| `/var/lib/nsgame-data-node/` | working dir for any scratch state |

### Build

VPS 3 already has a Rust toolchain — both `oracle-daemon` and `event-indexer` were built there. Same path:

```bash
ssh vps3
cd /root/index
git pull
cd data-node
cargo build --release --bin data-node
install -m 0755 target/release/data-node /usr/local/bin/nsgame-data-node
```

No cross-VPS scp dance. No Docker.

### Env file

```ini
# /etc/nsgame-data-node.env
SOURCE_ALLOWLIST=tubes,chaturbate
TUBES_ENABLED=1
CHATURBATE_WM=<affiliate-id>
DATABASE_URL=postgres://nsgame_dn:<password>@127.0.0.1:5432/nsgame_data_node
HTTP_BIND=127.0.0.1:8201
METRICS_PORT=9092
RUST_LOG=info
BITGET_READONLY_API_KEY=<unused-but-required-to-pass-startup-guard>
BITGET_READONLY_API_SECRET=<unused>
BITGET_READONLY_API_PASSPHRASE=<unused>
```

The Bitget keys are present only to satisfy the post-2026-04 startup guard added after the silent-mock-fallback outage. They are not exercised because the allowlist excludes every Bitget-backed source. A future cleanup separates the guard from the allowlist; for now, paying three lines of env to keep the binary alive is the smaller mistake.

The Postgres role/database for nsgame is local to VPS 3 and distinct from `prediction_market_indexer`. Two databases, one cluster.

### Systemd unit

```ini
# /etc/systemd/system/nsgame-data-node.service
[Unit]
Description=nsgame data-node (tube sources only)
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=root
EnvironmentFile=/etc/nsgame-data-node.env
ExecStart=/usr/local/bin/nsgame-data-node
Restart=on-failure
RestartSec=5
StateDirectory=nsgame-data-node
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

`User=root` matches the inline pattern already used by `prediction-oracle` and `prediction-indexer` on VPS 3 (per `vps3-receipt.md`). Hardened with the same flags.

### Port assignment

VPS 3 ports already in use, per `vps.md`:

| Port | Service |
|---|---|
| 3000 | Dokploy admin UI |
| 3001 | Orbit L3 RPC proxy |
| 8080 | Traefik (frontend) |
| 9091 | `prediction-oracle` Prometheus |

`8201` for HTTP, `9092` for Prometheus. Both verified free against `vps.md` and `vps3-receipt.md`. The data-node default `8200` is taken on VPS 1; using `8201` on VPS 3 keeps the mental model — "second data-node, second port".

## 6. Networking

Today: localhost only.

- Binds to `127.0.0.1:8201`. Never to `0.0.0.0`. The internet does not need to reach Rust directly.
- The oracle on VPS 3 reads via `http://127.0.0.1:8201` — same host, no nginx, no TLS, no CORS, no domain. Two-millisecond loopback.
- No nginx vhost. No Let's Encrypt cert. No Cloudflare zone. No domain registration. Skipped on purpose.

Tomorrow (deferred — track separately, do not implement now): when the frontend leaves local dev for production, the same data-node grows an nginx vhost + LE cert via DNS-01 (existing Cloudflare token at `/root/.secrets/cloudflare-dns.ini`). The candidate hostname will be picked at that time. The architecture below survives that change unchanged — only the front door gets installed.

## 7. Oracle integration

Two changes on VPS 3, one verification. The oracle reads over loopback.

```bash
# 1. Edit /etc/prediction-oracle.env
sed -i 's|^DATA_NODE_URL=.*|DATA_NODE_URL=http://127.0.0.1:8201|' /etc/prediction-oracle.env

# 2. Restart
systemctl restart prediction-oracle

# 3. Verify (from VPS 3)
curl -s http://127.0.0.1:8201/v1/sources/4/price
# expected: {"price":"<u128 decimal string>","ts":<epoch>}
```

`source_id=4` is `tubes_cb` per `nsgame/docs/source-id-mapping.md`. If that returns 503 with "No price observation available for source_id 4", the route is wired but the chaturbate collector has produced nothing yet — wait one sync cycle and retry. If it returns 404 with "Unknown source_id: 4", the patch in §3 step 2 was not applied.

## 8. Prometheus + metrics

The `data-node` binary exposes `/metrics` on the port set by `METRICS_PORT`. For the nsgame instance: `9092` (the oracle daemon already owns `9091`).

If/when a Prometheus or Grafana instance is added to VPS 3, scrape:

```
- job_name: nsgame-data-node
  static_configs:
    - targets: ['127.0.0.1:9092']
```

Until that exists, `curl localhost:9092/metrics` is the manual surface. Same shape as VPS 1's data-node metrics.

## 9. Ship sequence

| # | Step | Tag |
|---:|---|---|
| 1 | Implement `SOURCE_ALLOWLIST` parsing + per-source skip in `data-node/src/serve.rs` | [CODE] |
| 2 | Extend `source_id_to_symbol` and `source_price` in `data-node/src/api.rs` to dispatch tube ids 1–5 against the data-node's own DB rows | [CODE] |
| 3 | SSH `vps3`. `cd /root/index && git pull && cd data-node && cargo build --release` | [BUILD] |
| 4 | `install -m 0755 target/release/data-node /usr/local/bin/nsgame-data-node` | [DEPLOY] |
| 5 | Create Postgres role + database `nsgame_data_node` on VPS 3 | [DEPLOY] |
| 6 | Write `/etc/nsgame-data-node.env` (mode 0600) and `/etc/systemd/system/nsgame-data-node.service` | [DEPLOY] |
| 7 | `systemctl daemon-reload && systemctl enable --now nsgame-data-node` | [DEPLOY] |
| 8 | `curl -s http://127.0.0.1:8201/v1/sources/4/price` returns `{price, ts}` | [VERIFY] |
| 9 | Update `/etc/prediction-oracle.env` `DATA_NODE_URL` to `http://127.0.0.1:8201`; `systemctl restart prediction-oracle` | [DEPLOY] |
| 10 | Watch `journalctl -u prediction-oracle -f` for one full poll cycle without `data-node fetch failed` errors | [VERIFY] |

Ten steps. The DNS zone, the cert, and the nginx vhost will rejoin this list when the frontend leaves local dev. Until then, anything more is gold-plating.

## 10. Open questions

1. **Bitget env vars.** The startup guard added in 2026-04 forces `BITGET_READONLY_*` to be present even when Bitget sources are excluded. Cleanup: gate the guard on whether any Bitget source is actually allowlisted. Out of scope for this ship — paste placeholder values into `/etc/nsgame-data-node.env` and move on.

What was here and is now resolved: the domain question (deferred — no domain), the frontend-CORS question (deferred — no public exposure yet), and the Solana RPC question (Helius free tier, applied 2026-04-25, see `PLAN.md` §3).

## 11. Rollback

`systemctl disable --now nsgame-data-node`, and point `DATA_NODE_URL` in `/etc/prediction-oracle.env` back at `https://api.generalmarket.io` (which still returns 405 — but the oracle's bad-fetch behavior is the same as today's). No chain state to undo. No nginx vhost to remove. No DNS to flip. The blast radius shrinks with every piece of public infrastructure we did not yet build.
