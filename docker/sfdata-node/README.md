# sfdata-node — VPS 3 deploy

Scrape-heavy data-node, isolated from the main one on VPS 1. Runs only the `tubes` and `chaturbate` sources; every other spawn is silently skipped by the SF_MODE gate in `data-node/src/helpers.rs`.

## Why it exists

A Cloudflare ban or an abuse report on the tube scraper stays on this host. VPS 1's oracles, nginx, and main data-node are untouched. Same Rust code, same Docker image build path, different entrypoint + different machine.

## One-time setup on VPS 3

```bash
# SSH to VPS 3 (host alias you already have configured)
ssh vps3

# Clone the mono repo (or rsync a subset if you prefer)
git clone git@github.com:General-Market/mono.git ~/index
cd ~/index

# Configure environment
cp docker/sfdata-node/sfdata-node.env.example docker/sfdata-node/sfdata-node.env
$EDITOR docker/sfdata-node/sfdata-node.env     # set CHATURBATE_WM

# Create a postgres password secret (not checked into git)
openssl rand -hex 32 > docker/sfdata-node/pg_password.secret
chmod 600 docker/sfdata-node/pg_password.secret

# Bring it up
cd docker/sfdata-node
docker compose up -d --build
docker logs -f sfdata-node
```

## First-run checks

1. Postgres should come up healthy first:
   ```bash
   docker exec sfdata-postgres pg_isready -U sfdata -d sfdata
   ```
2. sfdata-node should log `tubes source initialized`, `Chaturbate source initialized`, and nothing about finnhub/twse/npm/etc. Every non-allowed source should log exactly one line like:
   ```
   [finnhub] skipped (SF_MODE: not in allow-list)
   ```
3. Health endpoint:
   ```bash
   curl -sf http://localhost:8200/health
   ```

## Subsequent deploys

```bash
ssh vps3
cd ~/index
git pull
cd docker/sfdata-node
docker compose up -d --build
```

## Firewall policy

The 8200 port is already bound to `127.0.0.1` in docker-compose.yml. If VPS 1's main data-node needs to pull from here, either:

- **Preferred**: SSH tunnel `ssh -L 8201:localhost:8200 vps3` on VPS 1, or run a reverse proxy on VPS 3 that terminates TLS and allows only VPS 1's IP.
- **Alternative**: change the compose port binding to a private-network IP (e.g. the 10.x.x.x interface if VPS 3 is on a Hetzner/DO private network with VPS 1).

Never bind 8200 directly to 0.0.0.0 — the API exposes aggregate views by default.

## Changing which sources run

The allow-list lives in `data-node/src/helpers.rs`:

```rust
const SF_MODE_ALLOWED: &[&str] = &["tubes", "chaturbate"];
```

Add a source id here, rebuild, redeploy. No other file needs to change.

## Monitoring

Same endpoints as the main data-node:
- `GET /health` — liveness
- `GET /admin/sources/health` — per-source status (will show most sources as "not started" with reason "Skipped in SF_MODE")
- `GET /snapshot` — latest market prices

## Rolling back

If sfdata-node misbehaves, VPS 1 is unaffected — the two are wholly separate processes with separate databases. To stop:

```bash
cd ~/index/docker/sfdata-node
docker compose down
```

No cleanup required on VPS 1.

## Notes on source-IP reputation

Running from a fresh VPS 3 IP means no scraping history. Expected behaviour:

- Xvideos / Xnxx: tolerate 4 rps+ even from datacenter IPs (we measured 5 rps safe from residential; datacenter typically half)
- Pornhub: Cloudflare will probabilistically challenge; ~1 rps is safe from a new datacenter IP
- Eporner: similar to Pornhub

If the IP gets burnt, the main data-node on VPS 1 stays healthy. That's the point.
