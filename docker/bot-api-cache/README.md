# bot-api-cache

Public HTTP cache + reverse proxy in front of the Vision data-node, using
Varnish 7. Retail users hit `https://generalmarket.io/bot-api/...`; it
serves from memory for hot reads and forwards only new / expired keys to
VPS 1 over a strict allowlist.

## Why Varnish

Varnish is the industry-standard HTTP reverse-proxy cache — Wikipedia,
The Guardian, Fastly-scale workloads. It is the library. This directory
is **only configuration**, not code.

- VCL (Varnish Configuration Language) for per-route TTL policy
- In-memory cache, 512 MB default, holds millions of small JSON payloads
- Stale-while-revalidate: serves stale entries briefly if origin flaps
- PURGE support for operational invalidation
- Health-probed backend (auto-detects origin failure)

## Topology

```
 internet → VPS 3 nginx :443 (TLS terminates)
                │
                └─ location /bot-api/
                        │  rate-limit: 60 req/min/IP burst 30
                        ▼
                    Varnish :6081 (localhost-only)
                        │  TTL policy per-endpoint (VCL)
                        ▼
                    VPS 1 nginx :80 /data-node/
                        │  allowlist: VPS 3 public IP + loopback
                        ▼
                    data-node :8200
```

## TTL policy (default.vcl)

| Endpoint | TTL | Grace | Rationale |
|---|---|---|---|
| `/health` | 10 s | 5 m | cheap liveness probe |
| `/vision/snapshot` | 45 s | 10 m | data-node polls sources every 10–60 s |
| `/batches/recommended` | 30 s | 10 m | batch config rotates per 60 s tick |
| `/market/batch-history` (historical `from=`) | **6 h** | 24 h | rows in the past are immutable |
| `/market/batch-history` (no `from=` / recent) | 2 m | 10 m | live data |
| 5xx responses | 10 s | 5 m | negative-cache but recover fast |

`grace` lets Varnish serve stale entries when the origin is unreachable —
up to the grace window past TTL expiry. Historical data-history can
survive a 24-hour data-node outage from cache alone.

## Endpoint whitelist

The VCL rejects anything outside this set with a 404 before it reaches
the origin:

- `/batches/recommended`
- `/vision/snapshot`
- `/market/batch-history`
- `/health`

`/data-node/admin/*` and `/data-node/explorer/*` are inaccessible at
the edge.

## Deployment

### On VPS 3

```bash
# Copy the files:
scp docker/bot-api-cache/{default.vcl,docker-compose.yml} vps3:~/bot-api-cache/

# On VPS 3:
ssh vps3
cd ~/bot-api-cache
docker compose up -d

# Wire into nginx:
#   - append contents of nginx-snippet.conf to the
#     generalmarket.io server block in /etc/nginx/sites-enabled/generalmarket-frontend
#   - add the limit_req_zone line from the snippet to /etc/nginx/nginx.conf
#     inside the http { } block
sudo nginx -t && sudo systemctl reload nginx
```

### On VPS 1

```bash
# Replace the existing /data-node/ location block with the content of
# vps1-datanode-allowlist.conf (keeps the proxy_pass, adds allow/deny).
# Then add the limit_req_zone line for oracles to nginx.conf.
sudo nginx -t && sudo systemctl reload nginx
```

## Smoke tests

```bash
# From any laptop — should hit the cache, return JSON:
curl -sI https://generalmarket.io/bot-api/batches/recommended | grep X-Cache
#   First request: X-Cache: MISS
#   Within 30 s:   X-Cache: HIT

# Public data-node access should now be denied:
curl -sv https://api.generalmarket.io/data-node/batches/recommended 2>&1 | grep "< HTTP"
#   < HTTP/1.1 403 Forbidden
```

## Operational notes

- **PURGE** from localhost on VPS 3 invalidates cache entries:
  `curl -X PURGE http://127.0.0.1:6081/batches/recommended`
- **Memory sizing** — bump `VARNISH_SIZE` in docker-compose if you see
  `nuked` counters climbing (`varnishstat -1 -f MAIN.n_lru_nuked`).
- **Hit rate** — `varnishstat -1 -f MAIN.cache_hit -f MAIN.cache_miss`.
  Aim for >80% on steady-state bot traffic.

## Rollback

```bash
docker compose -f docker/bot-api-cache/docker-compose.yml down
# Remove /bot-api/ location from nginx, reload.
# On VPS 1: revert /data-node/ allowlist to keep-open, reload.
```
