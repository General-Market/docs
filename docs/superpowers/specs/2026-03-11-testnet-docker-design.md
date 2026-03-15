# Testnet Docker Infrastructure Design

## Goal

Replace nohup/pgrep process management with Docker Compose for all testnet services. Each service gets its own Dockerfile + compose file. `testnet.sh` becomes a thin wrapper around `docker compose` commands.

## Architecture

Per-service Docker Compose stacks, one per service (oracles grouped since they form a P2P mesh):

```
docker/testnet/
├── sonic-proxy/     Dockerfile + docker-compose.yml
├── data-node/       Dockerfile + docker-compose.yml
├── oracle/          Dockerfile + docker-compose.yml  (3 oracles)
├── curator/         Dockerfile + docker-compose.yml
└── ap/              Dockerfile + docker-compose.yml
```

**VPS 1** runs: sonic-proxy, data-node, oracle (×3), curator
**VPS 2** runs: ap (L3 Orbit stays in its existing separate Docker setup)

## Image Strategy

Thin runtime images — no cargo build inside Docker. Binary pre-built on VPS via `cargo build --release`, Dockerfile just copies it in.

```dockerfile
# Rust services
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 libpq5 curl && rm -rf /var/lib/apt/lists/*
COPY target/release/<binary> /usr/local/bin/
ENTRYPOINT ["<binary>"]
```

- Rust services: `debian:bookworm-slim` (shared base layer)
- Sonic proxy: `python:3.11-slim`
- Build context: repo root (so `COPY target/release/...` works)

## Config & Secrets

Bind-mounted from VPS filesystem:

- `data-node/.env` (API keys) → mounted read-only
- `deployments/*.json` (contract addresses) → mounted read-only
- `data/symbol-map.json` → mounted read-only
- `/tmp/oracle-key-N.txt` (private keys) → mounted read-only
- `envs/testnet/.env` → not mounted (frontend only)

## Health Checks & Restart

Every service gets a health check and `restart: unless-stopped`:

| Service | Health Check |
|---------|-------------|
| data-node | `curl -sf http://localhost:8200/health` |
| oracle-N | `curl -sf http://localhost:1000N/health` |
| sonic-proxy | `curl -sf http://localhost:8547/` (POST eth_blockNumber) |
| curator | process alive (no HTTP endpoint) |
| ap | process alive (no HTTP endpoint) |

Interval: 30s, timeout: 5s, retries: 3.

## Logging

```yaml
logging:
  driver: json-file
  options:
    max-size: "8m"
    max-file: "3"
```

~24MB per service, ~150MB total across 6 services. Capped under 50MB budget per active log set.

## Networking

All services use `network_mode: host` — simplest migration, same ports as today, PostgreSQL accessible at localhost:5432. No Docker networking to debug.

## `testnet.sh` Changes

Becomes a thin wrapper:

| Command | Old | New |
|---------|-----|-----|
| `start` | `_remote_start` (nohup/setsid) | `docker compose up -d --build` per service |
| `stop` | `pkill` + `pkill -9` | `docker compose down` per service |
| `status` | `pgrep -f` | `docker compose ps` per service |
| `logs` | `tail -f logs/*.log` | `docker compose logs -f` |
| `update` | git pull + build + restart | git pull + build + `docker compose up -d --build` |
| `deploy` | unchanged (forge on Mac) | unchanged |

**Deleted:**
- `_remote_start()` helper
- All `pgrep`/`pkill` logic
- Old root `docker-compose.yml` (outdated local dev stack)

**Kept:**
- `deploy` command (forge on Mac)
- SSH helpers (`vps_be_ssh`, `vps_chain_ssh`)
- Config rsync logic
- `switch-env.sh`

## Dependencies

**VPS 1**: needs Docker + Docker Compose installed (VPS 2 already has it).

## Startup Order

`testnet.sh start` brings up services sequentially:
1. sonic-proxy (settlement RPC dependency)
2. data-node (price data dependency)
3. oracles (need data-node + sonic-proxy)
4. curator (needs oracles)
5. ap (on VPS 2, needs data-node reachable)

## Migration

No downtime needed:
1. Install Docker on VPS 1
2. `./testnet.sh stop` (old way)
3. Deploy new `testnet.sh` + Dockerfiles
4. `./testnet.sh start` (new way, Docker)
