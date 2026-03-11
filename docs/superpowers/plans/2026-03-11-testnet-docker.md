# Testnet Docker Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace nohup/pgrep process management with per-service Docker Compose for all testnet services.

**Architecture:** Each service (sonic-proxy, data-node, issuer, curator, ap) gets its own Dockerfile + docker-compose.yml under `docker/testnet/<service>/`. Thin runtime images copy pre-built binaries — no cargo build inside Docker. `testnet.sh` becomes a thin wrapper calling `docker compose` commands via SSH. All containers use `network_mode: host` and run as non-root.

**Tech Stack:** Docker, Docker Compose, Bash, debian:bookworm-slim, python:3.11-slim

**Spec:** `docs/superpowers/specs/2026-03-11-testnet-docker-design.md`

**Security review fixes applied (v2):**
- PostgreSQL Unix socket mounted into containers that need DB access
- `.dockerignore` prevents multi-GB build context and secrets leaking
- Secrets passed via `.env` files (not embedded in YAML), cleaned up after deploy
- Non-root user in all Dockerfiles
- `restart: "no"` (services started via `testnet.sh`, not auto-restart with stale args)
- No `2>/dev/null` — errors are visible, exit codes checked
- Issuer stagger preserved (sequential start with 5s sleep)
- Old bare processes killed before first Docker deploy (mandatory)
- `DOCKER_BUILDKIT=1` for reliable cache invalidation on binary changes
- WAL cleanup only after issuers are stopped

**Security review fixes applied (v3 — round 2 audit):**
- Curator private key moved from CLI `--private-key` arg to mounted key file (was visible in `docker inspect` and `/proc`)
- AP private key moved from `environment:` to mounted key file (was visible in `docker inspect`)
- `/tmp/issuer-key-*.txt` cleanup added to `cmd_stop()`
- Override YAML cleanup on script exit via `trap`; stale overrides cleaned at start of each `_start_*_docker()`
- `.*-override.yml` added to `.gitignore` (prevents accidental commit of local temp files with secrets)
- Issuer startup verification: all 3 must be running or script aborts
- PostgreSQL: containers use TCP `localhost:5432` (not Unix socket) to avoid UID/peer-auth mismatch
- Known risk documented: `network_mode: host` exposes all ports (firewall rules are VPS-level concern)

**Security review fixes applied (v4 — round 3 audit):**
- `env_file:` is NOT a secret-hiding mechanism (values are baked into `docker inspect` same as `environment:`). All secrets now passed via mounted key files read by binaries at startup (`--private-key-file`, `*_KEY_PATH`) — never stored in container config.
- `vps1_compose`/`vps2_compose` simplified: no `printf '%q'` (all args are script-controlled). All call sites pass separate arguments (`"up" "-d" "--build"`, not `"up -d --build"`).
- Prerequisite Task 0: add `--private-key-file` to curator binary + `AP_PRIVATE_KEY_PATH` to AP binary (matching issuer's pattern)
- `trap` extended to clean remote key files on script exit (not just local overrides)

---

## File Structure

**Create:**
- `.dockerignore` — Excludes everything except binaries and proxy script
- `docker/testnet/sonic-proxy/Dockerfile`
- `docker/testnet/sonic-proxy/docker-compose.yml`
- `docker/testnet/data-node/Dockerfile`
- `docker/testnet/data-node/docker-compose.yml`
- `docker/testnet/issuer/Dockerfile`
- `docker/testnet/issuer/docker-compose.yml`
- `docker/testnet/curator/Dockerfile`
- `docker/testnet/curator/docker-compose.yml`
- `docker/testnet/ap/Dockerfile`
- `docker/testnet/ap/docker-compose.yml`

**Modify:**
- `testnet.sh` — Replace `_remote_start`/`pgrep`/`pkill` with `docker compose` commands

**Delete:**
- `docker-compose.yml` — Outdated local dev stack
- `Dockerfile.rust` — Outdated multi-stage build
- `Dockerfile.foundry` — Outdated foundry deployer

---

## Chunk 0: Binary Prerequisites

### Task 0: Add `--private-key-file` to curator + AP binaries

Before Docker migration, the curator and AP binaries need file-based key reading (matching issuer's `ISSUER_PRIVATE_KEY_PATH` pattern). Without this, keys must be passed as CLI args or env vars, both visible in `docker inspect`.

**Why:** Docker's `environment:` AND `env_file:` both bake values into container metadata (`docker inspect .Config.Env`). The ONLY way to hide secrets from `docker inspect` is to read them from mounted files at runtime inside the binary.

**Files:**
- Modify: `curator/src/config.rs` — add `--private-key-file` option
- Modify: `curator/src/main.rs` — read key from file if `--private-key-file` provided
- Modify: `ap/src/config.rs` — add `AP_PRIVATE_KEY_PATH` env var support
- Modify: `ap/src/main.rs` — read key from file path if `AP_PRIVATE_KEY_PATH` set
- Modify: `issuer/src/config.rs` — add `ISSUER_SETTLEMENT_PRIVATE_KEY_PATH` env var support (if not already present)

- [ ] **Step 1: Add `--private-key-file` to curator config**

Pattern from issuer's `effective_private_key()`:
```rust
// curator/src/config.rs
#[arg(long, conflicts_with = "private_key")]
pub private_key_file: Option<PathBuf>,

pub fn effective_private_key(&self) -> anyhow::Result<String> {
    if let Some(path) = &self.private_key_file {
        Ok(std::fs::read_to_string(path)?.trim().to_string())
    } else {
        Ok(self.private_key.clone())
    }
}
```

- [ ] **Step 2: Add `AP_PRIVATE_KEY_PATH` to AP config**

```rust
// ap/src/config.rs — in the config struct or env reading
let private_key = if let Ok(path) = std::env::var("AP_PRIVATE_KEY_PATH") {
    std::fs::read_to_string(&path)?.trim().to_string()
} else {
    std::env::var("AP_PRIVATE_KEY")?
};
```

- [ ] **Step 3: Test both binaries accept file-based keys**

```bash
echo "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" > /tmp/test-key.txt
cargo run -p curator -- --private-key-file /tmp/test-key.txt --help  # verify it parses
AP_PRIVATE_KEY_PATH=/tmp/test-key.txt cargo run -p ap -- --help      # verify it parses
rm /tmp/test-key.txt
```

- [ ] **Step 4: Commit**

```bash
git add curator/src/ ap/src/
git commit -m "feat(curator,ap): add file-based private key reading for Docker"
```

---

## Chunk 1: Dockerfiles + Compose Files

### Task 1: .dockerignore + Sonic Proxy Docker

**Files:**
- Create: `.dockerignore`
- Create: `docker/testnet/sonic-proxy/Dockerfile`
- Create: `docker/testnet/sonic-proxy/docker-compose.yml`

- [ ] **Step 1: Create .dockerignore at repo root**

This is critical — without it, `docker build` sends the entire repo (including multi-GB `target/` and `data-node/.env` with 100+ API keys) as build context.

```
# .dockerignore — Only allow binaries and proxy script into Docker context
*
!target/release/issuer
!target/release/data-node
!target/release/ap
!target/release/curator
!scripts/sonic-rpc-proxy.py
```

- [ ] **Step 1b: Add override YAML pattern to .gitignore**

Prevents accidental commit of temp files containing secrets (generated by testnet.sh during deploys):

```bash
echo '# Docker override YAMLs with secrets (generated by testnet.sh)' >> .gitignore
echo '.*-override.yml' >> .gitignore
```

- [ ] **Step 2: Create sonic-proxy Dockerfile**

```dockerfile
# docker/testnet/sonic-proxy/Dockerfile
FROM python:3.11-slim
RUN useradd -r -s /bin/false app
WORKDIR /app
COPY scripts/sonic-rpc-proxy.py /app/sonic-rpc-proxy.py
USER app
ENTRYPOINT ["python3", "/app/sonic-rpc-proxy.py"]
CMD ["8547", "https://rpc.testnet.soniclabs.com"]
```

- [ ] **Step 3: Create sonic-proxy docker-compose.yml**

```yaml
# docker/testnet/sonic-proxy/docker-compose.yml
services:
  sonic-proxy:
    build:
      context: ../../..
      dockerfile: docker/testnet/sonic-proxy/Dockerfile
    container_name: testnet-sonic-proxy
    network_mode: host
    restart: "no"
    healthcheck:
      test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8547/', timeout=3)"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s
    logging:
      driver: json-file
      options:
        max-size: "8m"
        max-file: "3"
```

- [ ] **Step 4: Commit**

```bash
git add .dockerignore docker/testnet/sonic-proxy/
git commit -m "feat(docker): add .dockerignore + sonic-proxy Dockerfile + compose"
```

---

### Task 2: Data-node Docker

**Files:**
- Create: `docker/testnet/data-node/Dockerfile`
- Create: `docker/testnet/data-node/docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
# docker/testnet/data-node/Dockerfile
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 libpq5 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app/logs && chown -R app:app /app
COPY target/release/data-node /usr/local/bin/
USER app
WORKDIR /app
ENTRYPOINT ["data-node"]
```

- [ ] **Step 2: Create docker-compose.yml**

With `network_mode: host`, the container can reach PostgreSQL at `localhost:5432` via TCP (no Unix socket needed, avoids UID/peer-auth mismatch). The `--database-url` in the override uses `postgres://max@localhost/index_prices`.

```yaml
# docker/testnet/data-node/docker-compose.yml
#
# testnet.sh generates docker-compose.override.yml with dynamic command
# (--index-address, --database-url from deployment JSON).

services:
  data-node:
    build:
      context: ../../..
      dockerfile: docker/testnet/data-node/Dockerfile
    container_name: testnet-data-node
    network_mode: host
    restart: "no"
    volumes:
      - ../../../data-node/.env:/app/data-node/.env:ro
      - ../../../deployments/active-deployment.json:/app/deployments/active-deployment.json:ro
      - ../../../deployments/vision-batches.json:/app/deployments/vision-batches.json:ro
      - ../../../deployments/morpho-e2e.json:/app/deployments/morpho-e2e.json:ro
      - ../../../data/symbol-map.json:/app/data/symbol-map.json:ro
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8200/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    logging:
      driver: json-file
      options:
        max-size: "8m"
        max-file: "3"
```

**Note:** The `data-node/.env` is mounted read-only (not `env_file:`) to avoid Docker Compose interpreting it. The binary reads it itself. The command with dynamic `--index-address` and `--database-url postgres://max@localhost/index_prices` is injected via override YAML by `testnet.sh` (see Task 6). PostgreSQL must have `pg_hba.conf` allowing TCP connections from localhost for user `max` (md5 or trust auth).

- [ ] **Step 3: Commit**

```bash
git add docker/testnet/data-node/
git commit -m "feat(docker): add data-node Dockerfile + compose"
```

---

### Task 3: Issuer Docker (3 nodes)

**Files:**
- Create: `docker/testnet/issuer/Dockerfile`
- Create: `docker/testnet/issuer/docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
# docker/testnet/issuer/Dockerfile
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 libpq5 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app/logs && chown -R app:app /app
COPY target/release/issuer /usr/local/bin/
USER app
WORKDIR /app
ENTRYPOINT ["issuer"]
```

- [ ] **Step 2: Create docker-compose.yml**

The base compose file has NO secrets. All dynamic values (keys, from-block, vision args) come from the override YAML generated by `testnet.sh`. The `.env` file on VPS provides the settlement key.

Issuers access PostgreSQL via TCP `localhost:5432` (network_mode: host makes this work). No Unix socket mount needed.

```yaml
# docker/testnet/issuer/docker-compose.yml
#
# testnet.sh generates docker-compose.override.yml with:
# - Full command per issuer (--from-block, --vision-*, --bridge-proxy)
# - Volumes (key files, deployment JSONs, WAL dir)
# - env_file pointing to issuer secrets
#
# This base file defines build + network + logging only.

x-issuer-base: &issuer-base
  build:
    context: ../../..
    dockerfile: docker/testnet/issuer/Dockerfile
  network_mode: host
  restart: "no"
  logging:
    driver: json-file
    options:
      max-size: "8m"
      max-file: "3"

services:
  issuer-1:
    <<: *issuer-base
    container_name: testnet-issuer-1
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:10001/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  issuer-2:
    <<: *issuer-base
    container_name: testnet-issuer-2
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:10002/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  issuer-3:
    <<: *issuer-base
    container_name: testnet-issuer-3
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:10003/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
```

- [ ] **Step 3: Commit**

```bash
git add docker/testnet/issuer/
git commit -m "feat(docker): add issuer Dockerfile + compose (3 nodes)"
```

---

### Task 4: Curator Docker

**Files:**
- Create: `docker/testnet/curator/Dockerfile`
- Create: `docker/testnet/curator/docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
# docker/testnet/curator/Dockerfile
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 libpq5 && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app && chown -R app:app /app
COPY target/release/curator /usr/local/bin/
USER app
WORKDIR /app
ENTRYPOINT ["curator"]
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
# docker/testnet/curator/docker-compose.yml
#
# testnet.sh generates docker-compose.override.yml with full command
# (morpho addresses, vault, oracle from deployment JSONs).

services:
  curator:
    build:
      context: ../../..
      dockerfile: docker/testnet/curator/Dockerfile
    container_name: testnet-curator
    network_mode: host
    restart: "no"
    logging:
      driver: json-file
      options:
        max-size: "8m"
        max-file: "3"
```

- [ ] **Step 3: Commit**

```bash
git add docker/testnet/curator/
git commit -m "feat(docker): add curator Dockerfile + compose"
```

---

### Task 5: AP Docker

**Files:**
- Create: `docker/testnet/ap/Dockerfile`
- Create: `docker/testnet/ap/docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
# docker/testnet/ap/Dockerfile
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 libpq5 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false app && mkdir -p /app && chown -R app:app /app
COPY target/release/ap /usr/local/bin/
USER app
WORKDIR /app
ENTRYPOINT ["ap"]
```

- [ ] **Step 2: Create docker-compose.yml**

No secrets in base file. AP key comes from override generated by `testnet.sh`.

```yaml
# docker/testnet/ap/docker-compose.yml
#
# testnet.sh generates docker-compose.override.yml with:
# - Full command (--index-contract, --bitget-vault from deployment JSON)
# - AP_PRIVATE_KEY environment variable

services:
  ap:
    build:
      context: ../../..
      dockerfile: docker/testnet/ap/Dockerfile
    container_name: testnet-ap
    network_mode: host
    restart: "no"
    volumes:
      - ../../../deployments/active-deployment.json:/app/deployments/active-deployment.json:ro
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:9100/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "8m"
        max-file: "3"
```

- [ ] **Step 3: Commit**

```bash
git add docker/testnet/ap/
git commit -m "feat(docker): add ap Dockerfile + compose"
```

---

## Chunk 2: Rewrite testnet.sh + Delete Old Files

### Task 6: Rewrite testnet.sh

**Files:**
- Modify: `testnet.sh`

Replace all process management with `docker compose`. Key security fixes vs v1 plan:
- No `2>/dev/null` on docker compose calls — errors are visible
- Exit code checks after `docker compose up`
- Secrets via env files (not baked into YAML), cleaned up after deploy
- Override YAMLs deleted from VPS after `docker compose up` succeeds
- `ISSUER_KEYS` array defined as global
- Data-node override YAML generated properly (with `--index-address`)
- Issuer stagger preserved (sequential `docker compose up issuer-N` with 5s sleep)
- `DOCKER_BUILDKIT=1` set for reliable layer cache invalidation
- Old bare processes killed before Docker containers started
- WAL cleanup only after issuer containers stopped

- [ ] **Step 1: Rewrite testnet.sh**

The full rewritten script. Key functions:

**Global additions** (near existing key definitions):

```bash
ISSUER_KEYS=("$ISSUER_1_KEY" "$ISSUER_2_KEY" "$ISSUER_3_KEY")
```

**New helpers:**

```bash
# Cleanup trap: remove local override YAMLs + remote key files on exit (prevents secrets on disk)
_cleanup() {
    rm -f "$SCRIPT_DIR"/.data-node-override.yml "$SCRIPT_DIR"/.issuer-override.yml "$SCRIPT_DIR"/.curator-override.yml "$SCRIPT_DIR"/.ap-override.yml
    # Also clean remote key files if script exits early (SSH failures are non-fatal here)
    vps_be_ssh "rm -f /tmp/issuer-key-{1,2,3}.txt /tmp/settlement-key.txt /tmp/curator-key.txt" 2>/dev/null || true
    vps_chain_ssh "rm -f /tmp/ap-key.txt" 2>/dev/null || true
}
trap _cleanup EXIT

# Run docker compose on a VPS. Errors are NOT suppressed.
# All arguments are script-controlled (no user input), so simple concatenation is safe.
# IMPORTANT: pass each docker compose arg separately, e.g. vps1_compose dir "up" "-d" "--build"
vps1_compose() {
    local service_dir="$1"; shift
    ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/$service_dir && DOCKER_BUILDKIT=1 docker compose $*" < /dev/null
}
vps2_compose() {
    local service_dir="$1"; shift
    ssh "$VPS_CHAIN_HOST" "cd $VPS_CHAIN_DIR/docker/testnet/$service_dir && DOCKER_BUILDKIT=1 docker compose $*" < /dev/null
}

check_docker_service() {
    local host="$1" dir="$2" service="$3" name="$4"
    local status
    status=$(ssh -o ConnectTimeout=5 "$host" \
        "cd $dir/docker/testnet/$service && docker compose ps --format '{{.Status}}' $name 2>/dev/null" \
        < /dev/null 2>/dev/null)
    if echo "$status" | grep -q "Up"; then
        echo -e "  ${GREEN}$name running ($status)${NC}"
        return 0
    else
        echo -e "  ${YELLOW}$name not running${NC}"
        return 1
    fi
}

_sync_docker_files() {
    rsync -az -e "$RSYNC_SSH_BE" \
        "$SCRIPT_DIR/docker/testnet/" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/docker/testnet/"
    rsync -az -e "$RSYNC_SSH_BE" \
        "$SCRIPT_DIR/.dockerignore" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/.dockerignore"
    rsync -az -e "$RSYNC_SSH_BE" \
        "$SCRIPT_DIR/scripts/sonic-rpc-proxy.py" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/scripts/sonic-rpc-proxy.py"
    rsync -az -e "ssh -o ProxyJump=bastion -p 3189" \
        "$SCRIPT_DIR/docker/testnet/ap/" "$VPS_CHAIN_USER@$VPS_CHAIN_IP:$VPS_CHAIN_DIR/docker/testnet/ap/"
    rsync -az -e "ssh -o ProxyJump=bastion -p 3189" \
        "$SCRIPT_DIR/.dockerignore" "$VPS_CHAIN_USER@$VPS_CHAIN_IP:$VPS_CHAIN_DIR/.dockerignore"
}

_sync_config_files() {
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/data-node/.env" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/data-node/.env"
    rsync -az -e "$RSYNC_SSH_BE" "$SCRIPT_DIR/data/symbol-map.json" "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/data/symbol-map.json" 2>/dev/null || true
}

# Kill any old bare-metal processes to prevent port conflicts
_kill_old_processes() {
    echo -e "  Cleaning up old bare processes..."
    vps_be_ssh "pkill -9 -x issuer 2>/dev/null; pkill -9 -x data-node 2>/dev/null; pkill -9 -x curator 2>/dev/null; pkill -9 -f sonic-rpc-proxy 2>/dev/null; true"
    vps_chain_ssh "pkill -9 -x ap 2>/dev/null; true"
    sleep 2
}
```

**`cmd_start()`:**

```bash
cmd_start() {
    echo -e "${CYAN}Starting all services on VPSes...${NC}"

    # Check L3
    echo -e "${BLUE}[1/6] Checking L3 chain...${NC}"
    VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    [ "$VPS_CHAIN_ID" = "$CHAIN_ID" ] || { echo -e "  ${RED}L3 not reachable${NC}"; exit 1; }
    echo -e "  ${GREEN}L3 OK${NC}"

    # Kill old bare processes (prevents port conflicts on migration)
    _kill_old_processes

    # Sync files
    echo -e "${BLUE}[2/6] Syncing files...${NC}"
    _sync_docker_files
    _sync_config_files

    # Write key files on VPS 1 (mounted into containers, never in env_file/environment)
    for i in 1 2 3; do
        vps_be_ssh "printf '%s' '${ISSUER_KEYS[$((i-1))]}' > /tmp/issuer-key-$i.txt && chmod 600 /tmp/issuer-key-$i.txt"
    done
    # Settlement key shared by all issuers (same deployer key)
    vps_be_ssh "printf '%s' '$DEPLOYER_KEY' > /tmp/settlement-key.txt && chmod 600 /tmp/settlement-key.txt"
    echo -e "  ${GREEN}Files synced${NC}"

    # Start sonic-proxy
    echo -e "${BLUE}[3/6] Starting sonic-proxy...${NC}"
    if ! vps1_compose sonic-proxy up -d --build; then
        echo -e "  ${RED}sonic-proxy failed to start${NC}"; exit 1
    fi
    sleep 2
    echo -e "  ${GREEN}sonic-proxy started${NC}"

    # Start data-node
    echo -e "${BLUE}[4/6] Starting data-node...${NC}"
    _start_data_node_docker
    echo -e "  ${GREEN}data-node started${NC}"

    # Start issuers (staggered)
    echo -e "${BLUE}[5/6] Starting issuers...${NC}"
    _start_issuers_docker
    echo -e "  ${GREEN}issuers started${NC}"

    # Start curator
    _start_curator_docker

    # Start AP on VPS 2
    echo -e "${BLUE}[6/6] Starting AP on VPS 2...${NC}"
    _start_ap_docker

    echo ""
    echo -e "${GREEN}All services started. Check status: ./testnet.sh status${NC}"
}
```

**`_start_data_node_docker()`:**

```bash
_start_data_node_docker() {
    # Clean up any stale override from previous failed run
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/data-node/docker-compose.override.yml"

    local INDEX_ADDR INDEX_FLAG DN_CMD
    INDEX_ADDR=$(read_deployment_addr "Index")
    INDEX_FLAG=""
    [ -n "$INDEX_ADDR" ] && INDEX_FLAG="--index-address $INDEX_ADDR"

    # Generate override with full command
    local OVERRIDE="$SCRIPT_DIR/.data-node-override.yml"
    cat > "$OVERRIDE" <<YEOF
services:
  data-node:
    command:
      - "serve"
      - "--database-url"
      - "postgres://max@localhost/index_prices"
      - "--symbol-map"
      - "/app/data/symbol-map.json"
      - "--rpc-url"
      - "$RPC_URL"
      - "--settlement-rpc-url"
      - "$SETTLEMENT_RPC_VPS"
      - "--deployment-file"
      - "/app/deployments/active-deployment.json"
      - "--morpho-deployment-file"
      - "/app/deployments/morpho-e2e.json"
      - "--ecb-enabled"
      - "--openmeteo-sync-interval"
      - "300"
$([ -n "$INDEX_FLAG" ] && echo '      - "--index-address"
      - "'"$INDEX_ADDR"'"')
YEOF

    rsync -az -e "$RSYNC_SSH_BE" "$OVERRIDE" \
        "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/docker/testnet/data-node/docker-compose.override.yml"
    rm -f "$OVERRIDE"

    if ! vps1_compose data-node up -d --build; then
        echo -e "  ${RED}data-node failed to start${NC}"; exit 1
    fi

    # Clean up override on VPS (secrets already consumed)
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/data-node/docker-compose.override.yml"
    sleep 3
}
```

**`_start_issuers_docker()`:**

Uses YAML list format for `command:` (not `>` folded scalar) to avoid YAML injection. Each argument is a separate list item — safe from special characters.

```bash
_start_issuers_docker() {
    # Clean up any stale override from previous failed run
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/issuer/docker-compose.override.yml"

    # Stop existing + clean WAL (safe — no race condition)
    vps1_compose issuer down || true
    vps_be_ssh "cd $VPS_BE_DIR && rm -f logs/consensus-*.wal"

    # Dynamic args
    L3_FROM_BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    echo -e "  L3 block: $L3_FROM_BLOCK (issuers start from here)"

    VISION_ADDR=$(python3 -c "import json; print(json.load(open('deployments/vision-batches.json'))['vision'])" 2>/dev/null || echo "")
    BRIDGE_PROXY=$(read_deployment_addr "SettlementBridgeProxy")
    [ -z "$BRIDGE_PROXY" ] && BRIDGE_PROXY=$(read_deployment_addr "BridgeProxy")
    VISION_SETTLEMENT_CUSTODY=$(read_deployment_addr "SettlementBridgeCustody")

    # Build per-issuer command as YAML list (safe from injection)
    _issuer_command_yaml() {
        local NODE_ID=$1 PORT=$2 BLS_IDX=$3 PEERS=$4
        cat <<CMD
      - "--node-id"
      - "$NODE_ID"
      - "--port"
      - "$PORT"
      - "--rpc"
      - "$RPC_URL"
      - "--cycle-duration-ms"
      - "1000"
      - "--min-cycle-gap-ms"
      - "50"
      - "--consensus-timeout-ms"
      - "800"
      - "--no-tls"
      - "--test-key-seeds"
      - "--bls-key-seed-index"
      - "$BLS_IDX"
      - "--num-issuers"
      - "3"
      - "--signature-threshold"
      - "2"
      - "--registry-sync"
      - "--data-node-url"
      - "http://localhost:$DATA_NODE_PORT"
      - "--deployment-file"
      - "/app/deployments/active-deployment.json"
      - "--symbol-map-file"
      - "/app/data/symbol-map.json"
      - "--wal-path"
      - "/app/logs/consensus-$NODE_ID.wal"
      - "--log-level"
      - "info"
      - "--from-block"
      - "$L3_FROM_BLOCK"
      - "--sign-timeout-ms"
      - "5000"
      - "--itp-id"
      - "0x0000000000000000000000000000000000000000000000000000000000000001"
CMD
        [ -n "$BRIDGE_PROXY" ] && cat <<CMD
      - "--bridge-proxy"
      - "$BRIDGE_PROXY"
CMD
        if [ -n "$VISION_ADDR" ]; then
            cat <<CMD
      - "--vision-enabled"
      - "--vision-address"
      - "$VISION_ADDR"
      - "--vision-database-url"
      - "postgres://max@localhost/index_prices"
      - "--vision-data-node-url"
      - "http://localhost:$DATA_NODE_PORT"
      - "--vision-rpc-ws-url"
      - "$RPC_URL"
      - "--vision-reveal-window-secs"
      - "60"
      - "--vision-tick-poll-interval-ms"
      - "500"
      - "--vision-settlement-bridge-custody"
      - "$VISION_SETTLEMENT_CUSTODY"
CMD
        fi
    }

    # No env_file: (env_file values are baked into docker inspect, same as environment:).
    # All secrets via mounted key files. Only non-secret config in environment:.
    local OVERRIDE="$SCRIPT_DIR/.issuer-override.yml"
    cat > "$OVERRIDE" <<YEOF
services:
  issuer-1:
    environment:
      ISSUER_PRIVATE_KEY_PATH: /tmp/issuer-key-1.txt
      ISSUER_SETTLEMENT_PRIVATE_KEY_PATH: /tmp/settlement-key.txt
      ISSUER_PEERS: "127.0.0.1:9002,127.0.0.1:9003"
      ISSUER_RPC_URL: "$RPC_URL"
      ISSUER_SETTLEMENT_RPC_URL: "$SETTLEMENT_RPC_VPS"
      ISSUER_SETTLEMENT_CHAIN_ID: "$SETTLEMENT_CHAIN_ID"
      DATA_NODE_URL: "http://localhost:$DATA_NODE_PORT"
      EXCHANGE_MODE: "mock"
    command:
$(_issuer_command_yaml 1 9001 0 "127.0.0.1:9002,127.0.0.1:9003")
    volumes:
      - $VPS_BE_DIR/deployments/active-deployment.json:/app/deployments/active-deployment.json:ro
      - $VPS_BE_DIR/data/symbol-map.json:/app/data/symbol-map.json:ro
      - /tmp/issuer-key-1.txt:/tmp/issuer-key-1.txt:ro
      - /tmp/settlement-key.txt:/tmp/settlement-key.txt:ro
      - $VPS_BE_DIR/logs:/app/logs

  issuer-2:
    environment:
      ISSUER_PRIVATE_KEY_PATH: /tmp/issuer-key-2.txt
      ISSUER_SETTLEMENT_PRIVATE_KEY_PATH: /tmp/settlement-key.txt
      ISSUER_PEERS: "127.0.0.1:9001,127.0.0.1:9003"
      ISSUER_RPC_URL: "$RPC_URL"
      ISSUER_SETTLEMENT_RPC_URL: "$SETTLEMENT_RPC_VPS"
      ISSUER_SETTLEMENT_CHAIN_ID: "$SETTLEMENT_CHAIN_ID"
      DATA_NODE_URL: "http://localhost:$DATA_NODE_PORT"
      EXCHANGE_MODE: "mock"
    command:
$(_issuer_command_yaml 2 9002 1 "127.0.0.1:9001,127.0.0.1:9003")
    volumes:
      - $VPS_BE_DIR/deployments/active-deployment.json:/app/deployments/active-deployment.json:ro
      - $VPS_BE_DIR/data/symbol-map.json:/app/data/symbol-map.json:ro
      - /tmp/issuer-key-2.txt:/tmp/issuer-key-2.txt:ro
      - /tmp/settlement-key.txt:/tmp/settlement-key.txt:ro
      - $VPS_BE_DIR/logs:/app/logs

  issuer-3:
    environment:
      ISSUER_PRIVATE_KEY_PATH: /tmp/issuer-key-3.txt
      ISSUER_SETTLEMENT_PRIVATE_KEY_PATH: /tmp/settlement-key.txt
      ISSUER_PEERS: "127.0.0.1:9001,127.0.0.1:9002"
      ISSUER_RPC_URL: "$RPC_URL"
      ISSUER_SETTLEMENT_RPC_URL: "$SETTLEMENT_RPC_VPS"
      ISSUER_SETTLEMENT_CHAIN_ID: "$SETTLEMENT_CHAIN_ID"
      DATA_NODE_URL: "http://localhost:$DATA_NODE_PORT"
      EXCHANGE_MODE: "mock"
    command:
$(_issuer_command_yaml 3 9003 2 "127.0.0.1:9001,127.0.0.1:9002")
    volumes:
      - $VPS_BE_DIR/deployments/active-deployment.json:/app/deployments/active-deployment.json:ro
      - $VPS_BE_DIR/data/symbol-map.json:/app/data/symbol-map.json:ro
      - /tmp/issuer-key-3.txt:/tmp/issuer-key-3.txt:ro
      - /tmp/settlement-key.txt:/tmp/settlement-key.txt:ro
      - $VPS_BE_DIR/logs:/app/logs
YEOF

    rsync -az -e "$RSYNC_SSH_BE" "$OVERRIDE" \
        "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/docker/testnet/issuer/docker-compose.override.yml"
    rm -f "$OVERRIDE"

    # Build image once
    vps1_compose issuer build

    # Start issuers sequentially with 5s stagger (P2P needs peers listening)
    for i in 1 2 3; do
        echo -e "  Issuer $i starting on port $((9000 + i))..."
        if ! vps1_compose issuer up -d issuer-$i; then
            echo -e "  ${RED}issuer-$i failed to start${NC}"
        fi
        [ $i -lt 3 ] && sleep 5
    done

    # Clean up override on VPS
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/issuer/docker-compose.override.yml"

    # Verify all 3 issuers are running (BLS threshold is 2/3 — all must be up)
    sleep 3
    local all_ok=true
    for i in 1 2 3; do
        if ! check_docker_service "$VPS_BE_HOST" "$VPS_BE_DIR" "issuer" "issuer-$i"; then
            echo -e "  ${RED}FATAL: issuer-$i not running after start${NC}"
            all_ok=false
        fi
    done
    if [ "$all_ok" = false ]; then
        echo -e "  ${RED}Not all issuers started — consensus impossible. Stopping all.${NC}"
        cmd_stop
        exit 1
    fi
}
```

**`_start_curator_docker()`:**

```bash
_start_curator_docker() {
    # Clean up any stale override from previous failed run
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/curator/docker-compose.override.yml"

    MORPHO_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['MORPHO'])" 2>/dev/null || echo "")
    VAULT_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['METAMORPHO_VAULT'])" 2>/dev/null || echo "")
    MARKET_ID=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['MARKET_ID'])" 2>/dev/null || echo "")
    ORACLE_ADDR=$(python3 -c "import json; print(json.load(open('deployments/morpho-e2e.json'))['contracts']['ITP_NAV_ORACLE'])" 2>/dev/null || echo "")
    ITP_ADDR=$(read_deployment_addr "BridgedITP")
    REGISTRY_ADDR=$(read_deployment_addr "IssuerRegistry")

    if [ -z "$MORPHO_ADDR" ] || [ -z "$VAULT_ADDR" ]; then
        echo -e "  ${YELLOW}Curator skipped — no Morpho deployment${NC}"
        return
    fi

    ISSUER_URLS="http://127.0.0.1:10001,http://127.0.0.1:10002,http://127.0.0.1:10003"

    # Write curator key file on VPS (same pattern as issuer keys — NOT in CLI args or environment)
    vps_be_ssh "printf '%s' '${DEPLOYER_KEY#0x}' > /tmp/curator-key.txt && chmod 600 /tmp/curator-key.txt"

    # Use YAML list format (safe from injection)
    # Private key via mounted file (not CLI arg — would be visible in docker inspect/proc)
    local OVERRIDE="$SCRIPT_DIR/.curator-override.yml"
    cat > "$OVERRIDE" <<YEOF
services:
  curator:
    volumes:
      - /tmp/curator-key.txt:/tmp/curator-key.txt:ro
    command:
      - "--unified-mode"
      - "--rpc-url"
      - "$RPC_URL"
      - "--private-key-file"
      - "/tmp/curator-key.txt"
      - "--morpho-address"
      - "$MORPHO_ADDR"
      - "--vault-address"
      - "$VAULT_ADDR"
      - "--market-ids"
      - "$MARKET_ID"
      - "--oracle-address"
      - "$ORACLE_ADDR"
      - "--itp-address"
      - "$ITP_ADDR"
      - "--issuer-urls"
      - "$ISSUER_URLS"
      - "--l3-rpc-url"
      - "$RPC_URL"
      - "--mirror-registry-address"
      - "$REGISTRY_ADDR"
      - "--l3-registry-address"
      - "$REGISTRY_ADDR"
      - "--oracle-addresses"
      - "$ORACLE_ADDR"
      - "--itp-addresses"
      - "$ITP_ADDR"
      - "--allocation-interval-secs"
      - "60"
      - "--update-interval-secs"
      - "300"
      - "--health-scan-interval-secs"
      - "300"
      - "--data-node-url"
      - "http://localhost:$DATA_NODE_PORT"
      - "--log-level"
      - "info"
YEOF

    rsync -az -e "$RSYNC_SSH_BE" "$OVERRIDE" \
        "$VPS_BE_USER@$VPS_BE_IP:$VPS_BE_DIR/docker/testnet/curator/docker-compose.override.yml"
    rm -f "$OVERRIDE"

    if vps1_compose curator up -d --build; then
        echo -e "  ${GREEN}Curator started${NC}"
    else
        echo -e "  ${RED}Curator failed — check: ./testnet.sh logs curator${NC}"
    fi

    # Clean up override (no secrets in it now, but clean up anyway)
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/curator/docker-compose.override.yml"
}
```

**`_start_ap_docker()`:**

```bash
_start_ap_docker() {
    # Clean up any stale override from previous failed run
    vps_chain_ssh "rm -f $VPS_CHAIN_DIR/docker/testnet/ap/docker-compose.override.yml"

    INDEX_ADDR=$(read_deployment_addr "Index")
    MOCK_VAULT=$(read_deployment_addr "MockBitgetVault")

    # Write AP key file on VPS 2 (NOT in environment: or CLI — visible in docker inspect)
    vps_chain_ssh "printf '%s' '$AP_KEY' > /tmp/ap-key.txt && chmod 600 /tmp/ap-key.txt"

    local OVERRIDE="$SCRIPT_DIR/.ap-override.yml"
    # AP reads key from file via AP_PRIVATE_KEY_PATH (Task 0 prerequisite).
    # Path is not secret — only the file content is. docker inspect shows the path, not the key.
    cat > "$OVERRIDE" <<YEOF
services:
  ap:
    environment:
      AP_PRIVATE_KEY_PATH: /tmp/ap-key.txt
    volumes:
      - /tmp/ap-key.txt:/tmp/ap-key.txt:ro
    command:
      - "--port"
      - "9100"
      - "--rpc"
      - "http://localhost/"
      - "--exchange-mode"
      - "mock"
      - "--settlement-rpc"
      - "$SETTLEMENT_RPC_URL"
      - "--settlement-chain-id"
      - "$SETTLEMENT_CHAIN_ID"
      - "--deployment-file"
      - "/app/deployments/active-deployment.json"
      - "--data-node-url"
      - "http://$VPS_BE_IP:$DATA_NODE_PORT"
      - "--log-level"
      - "info"
$([ -n "$INDEX_ADDR" ] && echo '      - "--index-contract"
      - "'"$INDEX_ADDR"'"')
$([ -n "$MOCK_VAULT" ] && echo '      - "--bitget-vault"
      - "'"$MOCK_VAULT"'"')
YEOF

    rsync -az -e "ssh -o ProxyJump=bastion -p 3189" "$OVERRIDE" \
        "$VPS_CHAIN_USER@$VPS_CHAIN_IP:$VPS_CHAIN_DIR/docker/testnet/ap/docker-compose.override.yml"
    rm -f "$OVERRIDE"

    if vps2_compose ap up -d --build; then
        echo -e "  ${GREEN}AP started${NC}"
    else
        echo -e "  ${RED}AP failed — check: ./testnet.sh logs ap${NC}"
    fi

    # Clean up override (no secrets in it now)
    vps_chain_ssh "rm -f $VPS_CHAIN_DIR/docker/testnet/ap/docker-compose.override.yml"
}
```

**`cmd_stop()`:**

```bash
cmd_stop() {
    echo -e "${CYAN}Stopping all services...${NC}"

    echo -e "${BLUE}VPS 1...${NC}"
    for svc in curator issuer data-node sonic-proxy; do
        ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/$svc && docker compose down 2>/dev/null; true" < /dev/null 2>/dev/null
    done
    # Clean up key files and stale overrides on VPS 1
    vps_be_ssh "rm -f /tmp/issuer-key-{1,2,3}.txt /tmp/settlement-key.txt /tmp/curator-key.txt"
    vps_be_ssh "rm -f $VPS_BE_DIR/docker/testnet/*/docker-compose.override.yml"
    echo -e "  ${GREEN}VPS 1 stopped + keys cleaned${NC}"

    echo -e "${BLUE}VPS 2...${NC}"
    ssh "$VPS_CHAIN_HOST" "cd $VPS_CHAIN_DIR/docker/testnet/ap && docker compose down 2>/dev/null; true" < /dev/null 2>/dev/null
    # Clean up key files on VPS 2
    vps_chain_ssh "rm -f /tmp/ap-key.txt"
    vps_chain_ssh "rm -f $VPS_CHAIN_DIR/docker/testnet/ap/docker-compose.override.yml"
    echo -e "  ${GREEN}VPS 2 stopped + keys cleaned${NC}"

    echo -e "${GREEN}All services stopped${NC}"
}
```

**`cmd_status()`:**

```bash
cmd_status() {
    echo -e "${CYAN}Service status:${NC}"
    echo ""
    echo -e "${BLUE}VPS 1 ($VPS_BE_IP):${NC}"
    for svc in sonic-proxy data-node; do
        check_docker_service "$VPS_BE_HOST" "$VPS_BE_DIR" "$svc" "$svc" || true
    done
    for i in 1 2 3; do
        check_docker_service "$VPS_BE_HOST" "$VPS_BE_DIR" "issuer" "issuer-$i" || true
    done
    check_docker_service "$VPS_BE_HOST" "$VPS_BE_DIR" "curator" "curator" || true

    echo ""
    echo -e "${BLUE}VPS 2 ($VPS_CHAIN_IP):${NC}"
    check_docker_service "$VPS_CHAIN_HOST" "$VPS_CHAIN_DIR" "ap" "ap" || true

    echo ""
    echo -e "${BLUE}L3 Chain:${NC}"
    VPS_CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null || echo "unreachable")
    if [ "$VPS_CHAIN_ID" = "$CHAIN_ID" ]; then
        BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "?")
        echo -e "  ${GREEN}L3 OK — chain $VPS_CHAIN_ID, block $BLOCK${NC}"
    else
        echo -e "  ${RED}L3 unreachable${NC}"
    fi

    echo ""
    echo -e "${BLUE}Settlement (Sonic):${NC}"
    SONIC_ID=$(cast chain-id --rpc-url "$SETTLEMENT_RPC_URL" 2>/dev/null || echo "unreachable")
    if [ "$SONIC_ID" = "$SETTLEMENT_CHAIN_ID" ]; then
        SBLOCK=$(cast block-number --rpc-url "$SETTLEMENT_RPC_URL" 2>/dev/null || echo "?")
        echo -e "  ${GREEN}Sonic OK — chain $SONIC_ID, block $SBLOCK${NC}"
    else
        echo -e "  ${RED}Sonic unreachable${NC}"
    fi

    echo ""
    echo -e "${BLUE}Data-node health:${NC}"
    HEALTH=$(curl -sf "http://$VPS_BE_IP:$DATA_NODE_PORT/health" 2>/dev/null || echo "unreachable")
    if echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  db={d[\"db_connected\"]}, symbols={d[\"symbols_tracked\"]}')" 2>/dev/null; then
        echo -e "  ${GREEN}Healthy${NC}"
    else
        echo -e "  ${YELLOW}$HEALTH${NC}"
    fi
}
```

**`cmd_logs()`:**

```bash
cmd_logs() {
    local service="${1:-all}"
    case $service in
        sonic-proxy)
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/sonic-proxy && docker compose logs -f" ;;
        data-node)
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/data-node && docker compose logs -f" ;;
        issuer-1|issuer-2|issuer-3)
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/issuer && docker compose logs -f $service" ;;
        curator)
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/curator && docker compose logs -f" ;;
        ap)
            ssh "$VPS_CHAIN_HOST" "cd $VPS_CHAIN_DIR/docker/testnet/ap && docker compose logs -f" ;;
        all)
            echo -e "${CYAN}Tailing issuer-1 + data-node...${NC}"
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/issuer && docker compose logs -f issuer-1" &
            PID1=$!
            ssh "$VPS_BE_HOST" "cd $VPS_BE_DIR/docker/testnet/data-node && docker compose logs -f" &
            PID2=$!
            trap "kill $PID1 $PID2 2>/dev/null" INT; wait ;;
        *) echo "Available: sonic-proxy, data-node, issuer-1..3, curator, ap, all"; exit 1 ;;
    esac
}
```

**`cmd_update()`:**

```bash
cmd_update() {
    echo -e "${CYAN}Updating both VPSes...${NC}"
    cmd_stop

    echo -e "${BLUE}[1/4] Pulling on VPS 1...${NC}"
    vps_be_ssh "cd $VPS_BE_DIR && git pull origin main 2>&1 | tail -5"
    echo -e "${BLUE}[2/4] Pulling on VPS 2...${NC}"
    vps_chain_ssh "cd $VPS_CHAIN_DIR && git pull origin main 2>&1 | tail -5"

    echo -e "${BLUE}[3/4] Building on VPS 1...${NC}"
    vps_be_ssh "cd $VPS_BE_DIR && source ~/.cargo/env 2>/dev/null && cargo build --release -p data-node -p issuer -p curator 2>&1 | tail -5"
    echo -e "${BLUE}[4/4] Building on VPS 2...${NC}"
    vps_chain_ssh "cd $VPS_CHAIN_DIR && source ~/.cargo/env 2>/dev/null && cargo build --release -p ap 2>&1 | tail -5"

    _sync_config_files
    cmd_start
}
```

**Add Docker check to `cmd_setup_be()`** (after PostgreSQL check):

```bash
echo -e "${BLUE}[3b/5] Checking Docker...${NC}"
if vps_be_ssh "command -v docker >/dev/null 2>&1"; then
    echo -e "  ${GREEN}Docker already installed${NC}"
else
    echo -e "  ${YELLOW}Docker not installed. Install manually:${NC}"
    echo -e "  ${CYAN}ssh $VPS_BE_HOST${NC}"
    echo -e "  ${CYAN}curl -fsSL https://get.docker.com | sh${NC}"
    echo -e "  ${CYAN}sudo usermod -aG docker max${NC}"
    exit 1
fi
```

**Delete from testnet.sh:**
- `_remote_start()` function
- `check_service()` function
- All `pgrep`/`pkill` code in old `_start_*` and `cmd_stop`
- Old `_start_sonic_proxy`, `_start_data_node`, `_start_issuers`, `_start_ap`, `_start_curator`

- [ ] **Step 2: Verify syntax**

```bash
bash -n testnet.sh
```

- [ ] **Step 3: Commit**

```bash
git add testnet.sh
git commit -m "feat(testnet): rewrite testnet.sh to use Docker Compose"
```

---

### Task 7: Delete Old Files

- [ ] **Step 1: Delete outdated files**

```bash
rm docker-compose.yml Dockerfile.rust Dockerfile.foundry
```

- [ ] **Step 2: Commit**

```bash
git add -A docker-compose.yml Dockerfile.rust Dockerfile.foundry
git commit -m "chore: delete outdated local dev Docker files"
```

---

## Chunk 3: Install Docker + First Deploy

### Task 8: Install Docker on VPS 1

- [ ] **Step 1: Check if Docker is already installed**

```bash
ssh index-maker/prod/be "docker --version" 2>&1
```

If not installed:

- [ ] **Step 2: Install Docker**

```bash
ssh index-maker/prod/be "curl -fsSL https://get.docker.com | sh"
ssh index-maker/prod/be "sudo usermod -aG docker max"
```

Reconnect SSH for group to take effect.

- [ ] **Step 3: Verify Docker Compose**

```bash
ssh index-maker/prod/be "docker compose version"
```
Expected: `Docker Compose version v2.x.x`

---

### Task 9: First Docker Deploy

- [ ] **Step 1: Push all changes**

```bash
git push mono main
```

- [ ] **Step 2: Pull on both VPSes**

```bash
ssh index-maker/prod/be "cd /home/max/index && git stash && git pull origin main"
ssh index-maker/prod/postgres "cd /home/max/index && git stash && git pull origin main"
```

- [ ] **Step 3: Kill old bare-metal processes (mandatory)**

```bash
ssh index-maker/prod/be "pkill -9 -x issuer; pkill -9 -x data-node; pkill -9 -x curator; pkill -9 -f sonic-rpc-proxy; true"
ssh index-maker/prod/postgres "pkill -9 -x ap; true"
sleep 3
# Verify ports are free
ssh index-maker/prod/be "ss -tlnp | grep -E '8200|8547|9001|9002|9003|10001|10002|10003' || echo 'all ports free'"
```

- [ ] **Step 4: Start with Docker**

```bash
./testnet.sh start
```

- [ ] **Step 5: Verify services**

```bash
./testnet.sh status
```
Expected: all services show "Up".

- [ ] **Step 6: Verify endpoints**

```bash
# confirmed_block (data-node + sonic-proxy working)
curl -s http://116.203.156.98/data-node/chain/settlement/confirmed-block
# Expected: {"confirmed_block": <non-zero>}

# Issuer health (consensus + P2P)
curl -s http://116.203.156.98/issuer1/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'peers={d[\"connected_peers\"]} leader={d[\"is_leader\"]}')"
# Expected: peers=2 leader=True/False

# AP health
curl -s http://142.132.164.24:9100/health
```

- [ ] **Step 7: E2E smoke test**

```bash
cd frontend && npx playwright test --config=e2e/playwright.config.ts --workers=2
```
