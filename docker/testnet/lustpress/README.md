# Lustpress — self-hosted tube scraper

Self-hosted RESTful API wrapping 8 tube sites (pornhub, xnxx, redtube, xvideos, xhamster, youporn, eporner, txxx). Single process, Redis cache. No public endpoint — author discontinued the public service because of abuse.

Repo: https://github.com/sinkaroid/lustpress

## Why it's here

The data-node `tubes` source hits lustpress, not the tube sites directly. Lustpress de-duplicates requests across sources, caches responses in Redis, and gives us one place to tune upstream politeness. Without lustpress every data-node sync round re-scrapes pornhub from scratch — a fast route to a Cloudflare ban.

## Where it runs

**VPS 2** (alias `index-maker/prod/postgres` until cutover; new box `vps2-new` at `159.195.79.153`). Never on VPS 1 — outbound tube scraping from the same IP that serves oracles and nginx would cross-contaminate reputation.

Exposed on `127.0.0.1:3131` (or `0.0.0.0:3131` post-Netcup, since UFW is the gatekeeper now — see CLAUDE.md "Netcup migration"). The data-node connects over the public network from VPS 1. The old `10.2.0.0/24` Hetzner private net is gone.

## Env vars (already set in docker-compose.yml)

| Var | Value | Why |
|---|---|---|
| `CACHE_TTL_SECONDS` | 90 | Data-node polls every 120s. Cache TTL < poll interval means every poll hits upstream once per URL. If too many tracked assets, increase to 180s and poll every 240s. |
| `MAX_CONCURRENT_REQUESTS` | 4 | Outbound parallelism. Pornhub tolerates more but this is safe across all 8 tubes. |
| `UPSTREAM_TIMEOUT_MS` | 15000 | Tube pages can be heavy. Short enough to surface stuck connections. |
| `RESPECT_RETRY_AFTER` | true | Cloudflare returns Retry-After on 429; honor it. |

## Bring it up (VPS 2)

```bash
ssh index-maker/prod/postgres
cd /home/max/index/docker/testnet/lustpress
docker compose up -d
docker logs -f testnet-lustpress
```

## Smoke test from VPS 1

```bash
# Pre-cutover (Hetzner): private net
curl -s 'http://10.2.0.2:3131/api/pornhub/video?id=ph000000000000001'
# Post-cutover (Netcup): public IP, UFW restricts who can reach it
curl -s 'http://159.195.79.153:3131/api/pornhub/video?id=ph000000000000001'
```

Expected: JSON with `views`, `title`, `duration`, or a structured error. If you get HTML, Cloudflare intervened — drop the request rate.

## Rate limits

Lustpress itself does not rate-limit. Upstream sites do. Run the empirical test first:

```
cargo run --release --example test_tube_scrape -- --site pornhub \
    --urls-file data-node/data/test-urls-pornhub.txt \
    --output data-node/data/tube-rate-test-pornhub.csv
```

The test ramps 0.5 → 10 req/sec and logs every 429 / 403 / CF challenge. Use the result to set `MAX_CONCURRENT_REQUESTS` and the data-node source's rate limit.

## When it breaks

- **429 everywhere** → drop `MAX_CONCURRENT_REQUESTS` to 2, increase `CACHE_TTL_SECONDS` to 300
- **Cloudflare challenge HTML** → the upstream has flagged this IP. Options: wait 24–72h, rotate VPS, or pay for residential proxies
- **Redis OOM** → bump `maxmemory` in `docker-compose.yml` (default: 512mb)

## What NOT to do

- Never expose port 3131 publicly. The service is undocumented and unauthenticated.
- Never run lustpress on VPS 1 — see above.
- Never set `CACHE_TTL_SECONDS` to 0 — every request hits upstream, bans arrive fast.
