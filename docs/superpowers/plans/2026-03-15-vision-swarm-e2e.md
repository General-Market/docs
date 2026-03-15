# Vision Swarm E2E — Full-Stack Integration Test

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy 10 vision-bots on VPS testnet, let them join all 45 batches with random predictions, then verify the entire pipeline — data-node → oracles → BLS consensus → tick resolution → frontend display → economic invariants.

**Architecture:** Docker Compose on VPS with 10 Python bot instances sharing a config but using unique private keys. A new Playwright E2E test (`40-vision-swarm.spec.ts`) SSHes into VPS to fund wallets, deploy the swarm, then polls on-chain state and verifies frontend rendering + protocol solvency. Testnet only — no local Anvil path.

**Tech Stack:** Python (vision-bot), Docker Compose, Playwright (E2E), viem typed ABI decoding, Foundry `cast` for funding, SSH via `child_process.execFileSync`

---

## Security Review Findings (applied)

This plan was reviewed by 3 independent security reviewers. All critical and high findings have been addressed:

1. **Python bot ABI stale** — Task 0 fixes both `getPosition` (9-field) and `getBatch` (12-field) ABIs
2. **TOML parsing silent failure** — `tomllib` (stdlib since 3.11) used; `STAKE_PER_TICK` set as integer in env
3. **SSH command injection** — `execFileSync` with argument array, no shell interpolation
4. **Solvency check incomplete** — Now includes active position balances from swarm bots
5. **Per-batch conservation unsound for subset** — Changed to soft warning, not hard assertion
6. **Private keys in git** — `swarm.env` gitignored, keys+addresses generated together locally
7. **Key/address mismatch** — Single generation script produces both files; deploy uploads local keys to VPS
8. **Nonce race in funding** — Explicit nonce management
9. **PnL files lost on restart** — Volume mount added
10. **Stage 3 sequential RPC** — Parallelized with `Promise.allSettled` + error tolerance
11. **NDJSON parsing** — `docker compose ps --format json` returns NDJSON, parsed line-by-line
12. **Deploy script validation** — Address regex validation, funding failure threshold

---

## File Structure

| File | Responsibility |
|------|---------------|
| `vision-bot/framework/chain.py` | **FIX**: Update VISION_ABI PlayerPosition struct |
| `vision-bot/requirements.txt` | **FIX**: Ensure `tomllib` compatibility note |
| `docker/testnet/vision-swarm/Dockerfile` | Python 3.12 image for vision-bot |
| `docker/testnet/vision-swarm/.dockerignore` | Exclude .venv, __pycache__, tests from image |
| `docker/testnet/vision-swarm/docker-compose.yml` | 10 bot services with staggered starts + PnL volume |
| `docker/testnet/vision-swarm/swarm.env.example` | Template for key generation (committed) |
| `docker/testnet/vision-swarm/addresses.json` | 10 bot addresses (committed, no secrets) |
| `docker/testnet/vision-swarm/config.toml` | Shared bot config: random strategy, all batches |
| `scripts/deploy-swarm.sh` | Build, sync to VPS, generate keys, fund wallets, start |
| `frontend/e2e/helpers/swarm-api.ts` | SSH helpers, funding, health checks, invariant verification |
| `frontend/e2e/tests/40-vision-swarm.spec.ts` | 6-stage swarm E2E test |
| `frontend/e2e/playwright.config.ts` | Add `swarm` project (testnet only) |

---

## Chunk 1: Prerequisites — Fix Bot ABI

### Task 0: Fix Python Bot PlayerPosition ABI

The Python bot's `VISION_ABI` declares an 8-field `PlayerPosition` with `totalClaimed` (removed from contract) and missing `configHash` + `isVirtual`. This causes field misalignment — `joinTimestamp` reads `totalDeposited`, etc. All 10 bots would malfunction.

**Files:**
- Modify: `vision-bot/framework/chain.py:56-77` (VISION_ABI getPosition components)
- Modify: `vision-bot/framework/chain.py:273-285` (get_position dict mapping)

- [ ] **Step 1: Read the current VISION_ABI in chain.py**

Read `vision-bot/framework/chain.py` lines 56-77 to see the stale ABI.

- [ ] **Step 2: Read the actual Solidity struct**

Read `contracts/src/interfaces/IVision.sol` lines 35-47 to confirm the 9-field struct:
```solidity
struct PlayerPosition {
    bytes32 bitmapHash;
    bytes32 configHash;       // was missing from bot ABI
    uint256 stakePerTick;
    uint256 startTick;
    uint256 balance;
    uint256 lastClaimedTick;
    uint256 joinTimestamp;
    uint256 totalDeposited;
    bool isVirtual;           // was missing from bot ABI
}
```

- [ ] **Step 3: Update VISION_ABI components to match 9-field struct**

Replace the `getPosition` output components in `chain.py`:

```python
"components": [
    {"name": "bitmapHash", "type": "bytes32"},
    {"name": "configHash", "type": "bytes32"},
    {"name": "stakePerTick", "type": "uint256"},
    {"name": "startTick", "type": "uint256"},
    {"name": "balance", "type": "uint256"},
    {"name": "lastClaimedTick", "type": "uint256"},
    {"name": "joinTimestamp", "type": "uint256"},
    {"name": "totalDeposited", "type": "uint256"},
    {"name": "isVirtual", "type": "bool"},
],
```

- [ ] **Step 4: Update get_position dict mapping**

```python
def get_position(self, batch_id: int, player: str) -> dict:
    result = self.vision.functions.getPosition(batch_id, player).call()
    return {
        "bitmapHash": result[0],
        "configHash": result[1],
        "stakePerTick": result[2],
        "startTick": result[3],
        "balance": result[4],
        "lastClaimedTick": result[5],
        "joinTimestamp": result[6],
        "totalDeposited": result[7],
        "isVirtual": result[8],
    }
```

- [ ] **Step 5: Also fix getBatch ABI (12-field Batch struct)**

The `getBatch` ABI is also stale — declares 10 fields but the Solidity `Batch` struct now has 12 (added `nextTickDuration` and `epochOffset`). This causes `paused` (field 11) to read `createdAtTick` (a nonzero uint256), making every batch appear paused in the on-chain fallback scanner. The bots use `vision-batches.json` as primary source so this is not critical for the swarm, but fix it for correctness.

Read `contracts/src/interfaces/IVision.sol` for the actual Batch struct, then update the `getBatch` ABI components and `get_batch_info` mapping in `chain.py` accordingly.

- [ ] **Step 6: Verify TOML parsing works with Python 3.12**

Python 3.11+ includes `tomllib` in stdlib. Check if `core.py` imports `tomli` (third-party) or `tomllib` (stdlib). If it uses `tomli`, update the import fallback:

```python
try:
    import tomllib
except ImportError:
    import tomli as tomllib
```

- [ ] **Step 7: Run bot tests**

```bash
cd /Users/maxguillabert/Downloads/index/vision-bot
python -m pytest tests/ -v
```

Expected: all tests pass with updated ABI.

- [ ] **Step 8: Commit**

```bash
git add vision-bot/framework/chain.py
git commit -m "fix: sync vision-bot PlayerPosition ABI with contract (add configHash, isVirtual, remove totalClaimed)"
```

---

## Chunk 2: Docker Infrastructure

### Task 1: Vision Bot Dockerfile

**Files:**
- Create: `docker/testnet/vision-swarm/.dockerignore`
- Create: `docker/testnet/vision-swarm/Dockerfile`

- [ ] **Step 1: Create .dockerignore**

```
vision-bot/.venv/
vision-bot/__pycache__/
vision-bot/tests/
vision-bot/*.pyc
**/.git
**/node_modules
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false bot && mkdir -p /app/deployments /app/pnl-data && chown -R bot:bot /app

WORKDIR /app
COPY vision-bot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY vision-bot/bot.py vision-bot/markets.json ./
COPY vision-bot/framework/ ./framework/
COPY vision-bot/strategies/ ./strategies/
COPY deployments/active-deployment.json deployments/active-deployment.json
COPY deployments/vision-batches.json deployments/vision-batches.json

USER bot
ENTRYPOINT ["python", "bot.py", "--config", "/app/config.toml"]
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/maxguillabert/Downloads/index
docker build -f docker/testnet/vision-swarm/Dockerfile -t vision-swarm-bot .
```

- [ ] **Step 4: Commit**

```bash
git add docker/testnet/vision-swarm/Dockerfile docker/testnet/vision-swarm/.dockerignore
git commit -m "feat: Dockerfile for vision-bot swarm"
```

---

### Task 2: Generate Bot Keys (on VPS, not in git)

**Files:**
- Create: `docker/testnet/vision-swarm/swarm.env.example` (committed, no secrets)
- Create: `docker/testnet/vision-swarm/addresses.json` (committed, public addresses only)

Private keys are NEVER committed. They are generated on the VPS by the deploy script.

- [ ] **Step 1: Create swarm.env.example**

```env
# ── Bot Private Keys (generated by deploy-swarm.sh on VPS) ──
SWARM_BOT_0_KEY=0x...
SWARM_BOT_1_KEY=0x...
SWARM_BOT_2_KEY=0x...
SWARM_BOT_3_KEY=0x...
SWARM_BOT_4_KEY=0x...
SWARM_BOT_5_KEY=0x...
SWARM_BOT_6_KEY=0x...
SWARM_BOT_7_KEY=0x...
SWARM_BOT_8_KEY=0x...
SWARM_BOT_9_KEY=0x...

# ── Shared Config ──
L3_RPC_URL=http://142.132.164.24/
VISION_API_URL=http://localhost:10001
DATA_NODE_URL=http://localhost:8200
STRATEGY=random
DEPOSIT_AMOUNT=100
STAKE_PER_TICK=1
MAX_BATCHES=50
MAX_EXPOSURE=5000
POLL_INTERVAL=30
ORACLE_DISCOVERY=static
ORACLE_URLS=http://localhost:10001,http://localhost:10002,http://localhost:10003
```

Note: `STAKE_PER_TICK=1` (integer, not `0.1`) to avoid `ValueError` in `core.py` env var parsing when TOML fallback fails. The config.toml sets `stake = 0.1` as float, which is used when TOML parsing succeeds.

- [ ] **Step 2: Generate keys + addresses together (single source of truth)**

This script generates both `swarm.env` (keys) and `addresses.json` (addresses) from the same wallets. The env file stays local and is uploaded to VPS by the deploy script. Keys are NEVER committed to git.

```bash
node -e "
const { Wallet } = require('ethers');
const addrs = [];
const lines = [];
for (let i = 0; i < 10; i++) {
  const w = Wallet.createRandom();
  addrs.push(w.address);
  lines.push('SWARM_BOT_' + i + '_KEY=' + w.privateKey);
}
// Write addresses (committed)
require('fs').writeFileSync(
  'docker/testnet/vision-swarm/addresses.json',
  JSON.stringify(addrs, null, 2) + '\n'
);
// Write keys (NOT committed, uploaded to VPS by deploy script)
const shared = [
  '# Shared Config',
  'L3_RPC_URL=http://142.132.164.24/',
  'VISION_API_URL=http://localhost:10001',
  'DATA_NODE_URL=http://localhost:8200',
  'STRATEGY=random',
  'DEPOSIT_AMOUNT=100',
  'STAKE_PER_TICK=1',
  'MAX_BATCHES=50',
  'MAX_EXPOSURE=5000',
  'POLL_INTERVAL=30',
  'ORACLE_DISCOVERY=static',
  'ORACLE_URLS=http://localhost:10001,http://localhost:10002,http://localhost:10003',
].join('\n');
require('fs').writeFileSync(
  'docker/testnet/vision-swarm/swarm.env',
  lines.join('\n') + '\n\n' + shared + '\n'
);
console.log('Generated ' + addrs.length + ' wallets');
console.log('Keys: docker/testnet/vision-swarm/swarm.env (DO NOT COMMIT)');
console.log('Addresses: docker/testnet/vision-swarm/addresses.json');
"
```

**Critical**: `addresses.json` and `swarm.env` MUST be generated by the same script invocation. If you regenerate one without the other, keys and addresses will mismatch and the entire pipeline silently fails.

- [ ] **Step 3: Add swarm.env to .gitignore**

Add to the project root `.gitignore`:
```
docker/testnet/vision-swarm/swarm.env
```

- [ ] **Step 4: Commit**

```bash
git add docker/testnet/vision-swarm/swarm.env.example docker/testnet/vision-swarm/addresses.json .gitignore
git commit -m "feat: swarm bot addresses + env template (keys generated on VPS, not committed)"
```

---

### Task 3: Shared Bot Config

**Files:**
- Create: `docker/testnet/vision-swarm/config.toml`

- [ ] **Step 1: Create config.toml**

```toml
# Vision Swarm Bot — shared config (keys via BOT_PRIVATE_KEY env)
strategy = "random"
deposit = 100
stake = 0.1
max_batches = 50
max_exposure = 5000
poll_interval = 30

auto_claim = true
auto_withdraw = false
claim_above = 5
withdraw_below = 0

rpc_url = "http://142.132.164.24/"
vision_api = "http://localhost:10001"
data_node = "http://localhost:8200"

oracle_discovery = "static"
oracle_urls = ["http://localhost:10001", "http://localhost:10002", "http://localhost:10003"]

batch_ids = []
```

- [ ] **Step 2: Commit**

```bash
git add docker/testnet/vision-swarm/config.toml
git commit -m "feat: shared config for vision swarm bots"
```

---

### Task 4: Docker Compose (staggered starts, PnL volumes)

**Files:**
- Create: `docker/testnet/vision-swarm/docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

Key design decisions:
- `swarm.env` sourced before `docker compose up` (deploy script handles this)
- PnL files persisted in `./pnl-data/` volume (survives container recreation)
- Bots staggered via `depends_on` chain + `start_period` to avoid 1350-tx burst
- `read_only: true` + `no-new-privileges` for defense-in-depth

```yaml
# ╔════════════════════════════════════════════════════════╗
# ║  Vision Swarm — 10 random-strategy bots                ║
# ╠════════════════════════════════════════════════════════╣
# ║  Deploy:   scripts/deploy-swarm.sh                     ║
# ║  Start:    source swarm.env && docker compose up -d     ║
# ║  Stop:     docker compose down                          ║
# ║  Logs:     docker compose logs -f swarm-bot-0           ║
# ║  E2E test: npx playwright test --project=swarm          ║
# ╚════════════════════════════════════════════════════════╝

x-bot-common: &bot-common
  build:
    context: ../../..
    dockerfile: docker/testnet/vision-swarm/Dockerfile
  network_mode: host
  restart: unless-stopped
  read_only: true
  security_opt:
    - no-new-privileges:true
  volumes:
    - ./config.toml:/app/config.toml:ro
    - ./pnl-data:/app/pnl-data
  tmpfs:
    - /tmp
  env_file:
    - swarm.env
  deploy:
    resources:
      limits:
        memory: 256m
        cpus: "0.25"

services:
  swarm-bot-0:
    <<: *bot-common
    container_name: swarm-bot-0
    environment:
      BOT_PRIVATE_KEY: ${SWARM_BOT_0_KEY}
      PNL_FILE: /app/pnl-data/pnl-0.json

  swarm-bot-1:
    <<: *bot-common
    container_name: swarm-bot-1
    depends_on:
      swarm-bot-0:
        condition: service_started
    environment:
      BOT_PRIVATE_KEY: ${SWARM_BOT_1_KEY}
      PNL_FILE: /app/pnl-data/pnl-1.json

  swarm-bot-2:
    <<: *bot-common
    container_name: swarm-bot-2
    depends_on:
      swarm-bot-1:
        condition: service_started
    environment:
      BOT_PRIVATE_KEY: ${SWARM_BOT_2_KEY}
      PNL_FILE: /app/pnl-data/pnl-2.json

  swarm-bot-3:
    <<: *bot-common
    container_name: swarm-bot-3
    depends_on:
      swarm-bot-2:
        condition: service_started
    environment:
      BOT_PRIVATE_KEY: ${SWARM_BOT_3_KEY}
      PNL_FILE: /app/pnl-data/pnl-3.json

  swarm-bot-4:
    <<: *bot-common
    container_name: swarm-bot-4
    depends_on:
      swarm-bot-3:
        condition: service_started
    environment:
      BOT_PRIVATE_KEY: ${SWARM_BOT_4_KEY}
      PNL_FILE: /app/pnl-data/pnl-4.json

  swarm-bot-5:
    <<: *bot-common
    container_name: swarm-bot-5
    depends_on:
      swarm-bot-4:
        condition: service_started
    environment:
      BOT_PRIVATE_KEY: ${SWARM_BOT_5_KEY}
      PNL_FILE: /app/pnl-data/pnl-5.json

  swarm-bot-6:
    <<: *bot-common
    container_name: swarm-bot-6
    depends_on:
      swarm-bot-5:
        condition: service_started
    environment:
      BOT_PRIVATE_KEY: ${SWARM_BOT_6_KEY}
      PNL_FILE: /app/pnl-data/pnl-6.json

  swarm-bot-7:
    <<: *bot-common
    container_name: swarm-bot-7
    depends_on:
      swarm-bot-6:
        condition: service_started
    environment:
      BOT_PRIVATE_KEY: ${SWARM_BOT_7_KEY}
      PNL_FILE: /app/pnl-data/pnl-7.json

  swarm-bot-8:
    <<: *bot-common
    container_name: swarm-bot-8
    depends_on:
      swarm-bot-7:
        condition: service_started
    environment:
      BOT_PRIVATE_KEY: ${SWARM_BOT_8_KEY}
      PNL_FILE: /app/pnl-data/pnl-8.json

  swarm-bot-9:
    <<: *bot-common
    container_name: swarm-bot-9
    depends_on:
      swarm-bot-8:
        condition: service_started
    environment:
      BOT_PRIVATE_KEY: ${SWARM_BOT_9_KEY}
      PNL_FILE: /app/pnl-data/pnl-9.json
```

- [ ] **Step 2: Create pnl-data directory**

```bash
mkdir -p docker/testnet/vision-swarm/pnl-data
touch docker/testnet/vision-swarm/pnl-data/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add docker/testnet/vision-swarm/docker-compose.yml docker/testnet/vision-swarm/pnl-data/.gitkeep
git commit -m "feat: docker compose with 10 staggered bots + persistent PnL"
```

---

### Task 5: Deploy Script (with key generation + address validation)

**Files:**
- Create: `scripts/deploy-swarm.sh`

- [ ] **Step 1: Create deploy-swarm.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

VPS="index-maker/prod/be"
REMOTE_DIR="/home/max/index"
COMPOSE_DIR="docker/testnet/vision-swarm"
L3_RPC="http://142.132.164.24/"
ADDR_RE='^0x[0-9a-fA-F]{40}$'

echo "=== Vision Swarm Deploy ==="

# 0. Validate USDC address
USDC_ADDR=$(jq -r '.contracts.L3_WUSDC' deployments/active-deployment.json)
[[ "$USDC_ADDR" =~ $ADDR_RE ]] || { echo "ERROR: Invalid L3_WUSDC address: $USDC_ADDR"; exit 1; }

# 1. Sync code to VPS
echo "[1/5] Syncing to VPS..."
rsync -az --delete \
  --exclude='.venv' --exclude='__pycache__' --exclude='tests' \
  vision-bot/ \
  "$VPS:$REMOTE_DIR/vision-bot/"

rsync -az --delete \
  "$COMPOSE_DIR/" \
  "$VPS:$REMOTE_DIR/$COMPOSE_DIR/"

rsync -az \
  deployments/active-deployment.json \
  deployments/vision-batches.json \
  "$VPS:$REMOTE_DIR/deployments/"

# 2. Upload swarm.env (generated locally by Task 2 Step 2, contains keys matching addresses.json)
echo "[2/5] Uploading swarm.env to VPS..."
if [ ! -f "$COMPOSE_DIR/swarm.env" ]; then
  echo "ERROR: $COMPOSE_DIR/swarm.env not found. Run Task 2 Step 2 first to generate keys + addresses."
  exit 1
fi
# swarm.env is already synced by rsync in step 1, but verify it arrived
ssh "$VPS" "test -f $REMOTE_DIR/$COMPOSE_DIR/swarm.env" || {
  echo "ERROR: swarm.env not found on VPS after sync"
  exit 1
}

# 3. Build on VPS
echo "[3/5] Building docker images..."
ssh "$VPS" "cd $REMOTE_DIR && docker compose -f $COMPOSE_DIR/docker-compose.yml build"

# 4. Fund bot wallets via cast
echo "[4/5] Funding bot wallets..."
AMOUNT="100000000000000000000000"  # 100k USDC, 18 decimals
FUND_FAILURES=0

while IFS= read -r addr; do
  addr=$(echo "$addr" | tr -d '", ')
  [[ -z "$addr" || "$addr" == "[" || "$addr" == "]" ]] && continue
  [[ "$addr" =~ $ADDR_RE ]] || { echo "  SKIP invalid address: $addr"; continue; }

  echo "  Funding $addr..."
  if ! ssh "$VPS" "source $REMOTE_DIR/.env && cast send \
    --rpc-url '$L3_RPC' \
    --private-key \"\$DEPLOYER_KEY\" \
    '$USDC_ADDR' \
    'mint(address,uint256)' \
    '$addr' '$AMOUNT' 2>&1"; then
    echo "  WARNING: funding $addr failed"
    FUND_FAILURES=$((FUND_FAILURES + 1))
  fi
done < "$COMPOSE_DIR/addresses.json"

if [ "$FUND_FAILURES" -gt 2 ]; then
  echo "ERROR: $FUND_FAILURES wallets failed to fund. Aborting."
  exit 1
fi

# 5. Start swarm (source env for ${KEY} substitution)
echo "[5/5] Starting swarm..."
ssh "$VPS" "cd $REMOTE_DIR/$COMPOSE_DIR && set -a && source swarm.env && set +a && docker compose up -d"

echo "=== Swarm deployed ==="
echo "  Logs: ssh $VPS 'cd $REMOTE_DIR/$COMPOSE_DIR && docker compose logs -f'"
echo "  Stop: ssh $VPS 'cd $REMOTE_DIR/$COMPOSE_DIR && docker compose down'"
```

- [ ] **Step 2: Make executable and commit**

```bash
chmod +x scripts/deploy-swarm.sh
git add scripts/deploy-swarm.sh
git commit -m "feat: deploy script with key generation + address validation"
```

---

## Chunk 3: E2E Test Helpers

### Task 6: Swarm API Helpers

**Files:**
- Create: `frontend/e2e/helpers/swarm-api.ts`

Key security fixes applied:
- `execFileSync` instead of `execSync` (no shell injection)
- `getPosition` uses viem `decodeFunctionResult` with typed ABI (no manual hex slicing)
- `fundAllBots` uses explicit nonce management
- Solvency check includes active position balances
- Per-batch checks are soft warnings, not hard assertions

- [ ] **Step 1: Create swarm-api.ts**

```typescript
/**
 * Vision Swarm E2E Helpers
 *
 * SSH into VPS to manage the 10-bot swarm,
 * fund wallets, read on-chain state, verify invariants.
 */
import { execFileSync } from "child_process";
import {
  parseUnits,
  formatUnits,
  keccak256,
  toBytes,
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  decodeFunctionResult,
  encodeFunctionData,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  L3_RPC,
  DEPLOYER_KEY,
  CONTRACTS,
} from "../env";

// ── Constants ──

const VPS = "index-maker/prod/be";
const REMOTE_DIR = "/home/max/index";
const DECIMALS = 18;
const FUND_AMOUNT = parseUnits("100000", DECIMALS);

const L3_CHAIN = {
  id: 111222333,
  name: "L3" as const,
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [L3_RPC] } },
} as const;

// Load swarm bot addresses
import swarmAddresses from "../../../docker/testnet/vision-swarm/addresses.json";
export const SWARM_ADDRESSES: string[] = swarmAddresses;
export const SWARM_COUNT = SWARM_ADDRESSES.length;

// ── ABI Definitions (typed, matching IVision.sol exactly) ──

const VISION_ABI = parseAbi([
  "function getPosition(uint256 batchId, address player) view returns ((bytes32 bitmapHash, bytes32 configHash, uint256 stakePerTick, uint256 startTick, uint256 balance, uint256 lastClaimedTick, uint256 joinTimestamp, uint256 totalDeposited, bool isVirtual))",
  "function currentTickId(uint256 batchId) view returns (uint256)",
  "function balanceOf(address user) view returns (uint256)",
  "function realBalance(address user) view returns (uint256)",
  "function virtualBalance(address user) view returns (uint256)",
  "function totalRealBalance() view returns (uint256)",
  "function totalVirtualBalance() view returns (uint256)",
  "function accumulatedRealFees() view returns (uint256)",
  "function accumulatedVirtualFees() view returns (uint256)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function mint(address to, uint256 amount) external",
]);

// ── SSH Helpers (no shell injection via execFileSync) ──

export function sshExec(cmd: string, timeoutMs = 30_000): string {
  return execFileSync("ssh", [VPS, cmd], {
    timeout: timeoutMs,
    encoding: "utf-8",
  }).trim();
}

export function startSwarm(): void {
  sshExec(
    `cd ${REMOTE_DIR}/docker/testnet/vision-swarm && set -a && source swarm.env && set +a && docker compose up -d`,
    120_000
  );
}

export function stopSwarm(): void {
  sshExec(
    `cd ${REMOTE_DIR}/docker/testnet/vision-swarm && docker compose down`,
    30_000
  );
}

export function swarmHealthy(): boolean {
  try {
    const out = sshExec(
      `cd ${REMOTE_DIR}/docker/testnet/vision-swarm && docker compose ps --format json 2>/dev/null || echo ""`
    );
    // docker compose v2 outputs NDJSON (one JSON object per line), not a JSON array
    const containers = out
      .split("\n")
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
    const running = containers.filter((c: any) => c.State === "running").length;
    return running >= SWARM_COUNT;
  } catch {
    return false;
  }
}

export function botLogs(botIndex: number, tail = 50): string {
  return sshExec(
    `docker logs swarm-bot-${botIndex} --tail ${tail} 2>&1`,
    10_000
  );
}

// ── RPC Client ──

const publicClient = createPublicClient({
  chain: L3_CHAIN,
  transport: http(L3_RPC),
});

// ── Funding (explicit nonce management) ──

export async function fundAllBots(): Promise<void> {
  const account = privateKeyToAccount(DEPLOYER_KEY as Hex);
  const client = createWalletClient({
    account,
    chain: L3_CHAIN,
    transport: http(L3_RPC),
  });

  let nonce = await publicClient.getTransactionCount({ address: account.address });
  let funded = 0;

  for (const addr of SWARM_ADDRESSES) {
    try {
      await client.writeContract({
        address: CONTRACTS.L3_WUSDC as Hex,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [addr as Hex, FUND_AMOUNT],
        nonce: nonce++,
      });
      funded++;
    } catch (e: any) {
      console.warn(`  Fund ${addr.slice(0, 10)} failed: ${e.message}`);
    }
  }
  if (funded < 8) throw new Error(`Only funded ${funded}/10 bots. Aborting.`);
}

/** Check L3 USDC balance (not Vision balance — bots need wallet USDC first). */
export async function getL3UsdcBalance(player: string): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.L3_WUSDC as Hex,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [player as Hex],
  });
}

// ── On-Chain State Reads (typed ABI, no manual hex slicing) ──

export async function getPosition(batchId: number, player: string) {
  return publicClient.readContract({
    address: CONTRACTS.Vision as Hex,
    abi: VISION_ABI,
    functionName: "getPosition",
    args: [BigInt(batchId), player as Hex],
  });
}

export async function getCurrentTick(batchId: number): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.Vision as Hex,
    abi: VISION_ABI,
    functionName: "currentTickId",
    args: [BigInt(batchId)],
  });
}

export async function getVisionBalance(player: string): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.Vision as Hex,
    abi: VISION_ABI,
    functionName: "balanceOf",
    args: [player as Hex],
  });
}

export async function getTotalRealBalance(): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.Vision as Hex,
    abi: VISION_ABI,
    functionName: "totalRealBalance",
  });
}

export async function getAccumulatedRealFees(): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.Vision as Hex,
    abi: VISION_ABI,
    functionName: "accumulatedRealFees",
  });
}

export async function getVisionContractUsdc(): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.L3_WUSDC as Hex,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [CONTRACTS.Vision as Hex],
  });
}

// ── Health Checks ──

const VPS_IP = "142.132.164.24";

export async function checkDataNodeHealth(): Promise<boolean> {
  try {
    const res = await fetch(`http://${VPS_IP}:8200/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export function checkOracleHealthViaSSH(port: number): boolean {
  try {
    sshExec(`curl -sf http://localhost:${port}/health`, 5_000);
    return true;
  } catch {
    return false;
  }
}

export async function checkL3Rpc(): Promise<boolean> {
  try {
    await publicClient.getBlockNumber();
    return true;
  } catch {
    return false;
  }
}

// ── Economic Invariants ──

export interface InvariantResult {
  passed: boolean;
  name: string;
  detail: string;
  expected?: string;
  actual?: string;
}

/**
 * Verify Vision contract solvency:
 * USDC.balanceOf(Vision) >= totalRealBalance + accumulatedRealFees
 *
 * Note: totalRealBalance tracks UNALLOCATED real balance only.
 * Active position balances are funded from totalRealBalance via _debitBalance(),
 * so the USDC stays in the contract but moves out of totalRealBalance.
 * The invariant USDC >= totalRealBalance + fees is the contract's own check.
 *
 * We ALSO sum active real position balances for swarm bots as an additional
 * lower-bound check. This catches over-crediting bugs in claimRewards.
 */
export async function verifySolvency(
  batchIds: number[]
): Promise<InvariantResult> {
  const [contractUsdc, totalReal, realFees] = await Promise.all([
    getVisionContractUsdc(),
    getTotalRealBalance(),
    getAccumulatedRealFees(),
  ]);

  // Contract's own invariant (necessary condition)
  const contractInvariant = contractUsdc >= totalReal + realFees;

  // Additional check: sum swarm bots' active position balances (real only)
  let swarmActiveReal = 0n;
  for (const batchId of batchIds.slice(0, 10)) {
    const results = await Promise.allSettled(
      SWARM_ADDRESSES.map((addr) => getPosition(batchId, addr))
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const pos = r.value;
      if (pos.bitmapHash === ("0x" + "0".repeat(64)) as Hex) continue;
      if (!pos.isVirtual) {
        swarmActiveReal += pos.balance;
      }
    }
  }

  // Swarm active balances + unallocated should not exceed contract USDC
  const totalAccountedFor = totalReal + swarmActiveReal + realFees;
  const passed = contractInvariant && contractUsdc >= totalAccountedFor;

  return {
    passed,
    name: "Solvency",
    detail: `USDC.balanceOf(Vision) >= totalRealBalance + swarmActivePositions + fees`,
    expected: `>= ${formatUnits(totalAccountedFor, DECIMALS)} USDC`,
    actual: `${formatUnits(contractUsdc, DECIMALS)} USDC`,
  };
}

/**
 * Verify per-batch conservation for swarm bots only (SOFT CHECK).
 *
 * In parimutuel, sum(all_player_balances) = sum(all_deposits) - fees.
 * But we only check SWARM bots. If swarm bots won from non-swarm players,
 * sum(swarm_balances) > sum(swarm_deposits) — which is correct behavior,
 * not a protocol violation. So this is a WARNING, not an assertion.
 */
export async function verifyBatchConservation(
  batchId: number,
  players: string[]
): Promise<InvariantResult> {
  let totalBalance = 0n;
  let totalDeposited = 0n;
  let positionCount = 0;

  const results = await Promise.allSettled(
    players.map((p) => getPosition(batchId, p))
  );

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const pos = r.value;
    if (pos.bitmapHash === ("0x" + "0".repeat(64)) as Hex) continue;
    totalBalance += pos.balance;
    totalDeposited += pos.totalDeposited;
    positionCount++;
  }

  // Soft check: log but don't fail (subset invariant is not guaranteed)
  const diff = totalBalance - totalDeposited;
  const passed = true; // Always passes — this is informational

  return {
    passed,
    name: `Pool Info (batch ${batchId}, ${positionCount} swarm positions)`,
    detail: diff > 0n
      ? `Swarm bots net +${formatUnits(diff, DECIMALS)} (winning from non-swarm players)`
      : `Swarm bots net ${formatUnits(diff, DECIMALS)} (fees extracted or losing)`,
    expected: "informational",
    actual: `balance=${formatUnits(totalBalance, DECIMALS)}, deposited=${formatUnits(totalDeposited, DECIMALS)}`,
  };
}

// ── Polling ──

export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (val: T) => boolean,
  timeoutMs: number,
  intervalMs = 5_000,
  label = "condition"
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T;
  while (Date.now() < deadline) {
    try {
      last = await fn();
      if (predicate(last)) return last;
    } catch (e: any) {
      console.warn(`  Poll error (${label}): ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout waiting for ${label} after ${timeoutMs}ms`);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/e2e/helpers/swarm-api.ts
git commit -m "feat: swarm E2E helpers — typed ABI, execFileSync, soft invariant checks"
```

---

## Chunk 4: E2E Test Spec

### Task 7: Swarm E2E Test

**Files:**
- Create: `frontend/e2e/tests/40-vision-swarm.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
/**
 * 40-vision-swarm.spec.ts
 *
 * Full-stack Vision E2E: deploy 10 bots, let them join all batches,
 * wait for tick resolution, verify frontend + economic invariants.
 *
 * Testnet only. Total timeout: 20 minutes.
 */
import { test, expect } from "@playwright/test";
import {
  SWARM_ADDRESSES,
  SWARM_COUNT,
  startSwarm,
  stopSwarm,
  swarmHealthy,
  fundAllBots,
  getPosition,
  getCurrentTick,
  getL3UsdcBalance,
  verifySolvency,
  verifyBatchConservation,
  checkDataNodeHealth,
  checkOracleHealthViaSSH,
  checkL3Rpc,
  pollUntil,
  botLogs,
} from "../helpers/swarm-api";
import { FRONTEND_URL } from "../env";
import type { Hex } from "viem";

// Batch IDs from vision-batches.json (object: { batches: { name: { batchId, ... } } })
import visionBatchesDeploy from "../../../deployments/vision-batches.json";
const BATCH_ENTRIES = Object.values(
  (visionBatchesDeploy as any).batches || {}
) as Array<{ batchId: number; tickDuration: number }>;
const BATCH_IDS: number[] = BATCH_ENTRIES.map((b) => b.batchId);

const FAST_BATCHES = BATCH_ENTRIES
  .filter((b) => b.tickDuration <= 300)
  .map((b) => b.batchId);

const ORACLE_PORTS = [10001, 10002, 10003];
const ZERO_HASH = ("0x" + "0".repeat(64)) as Hex;

test.describe.configure({ mode: "serial" });
test.setTimeout(20 * 60 * 1000);

// ── Stage 1: Pre-flight ──

test("Stage 1: infrastructure health", async () => {
  const [l3, dataNode] = await Promise.all([checkL3Rpc(), checkDataNodeHealth()]);
  expect(l3, "L3 RPC unreachable").toBe(true);
  expect(dataNode, "Data node unreachable").toBe(true);

  for (const port of ORACLE_PORTS) {
    expect(checkOracleHealthViaSSH(port), `Oracle :${port} unreachable`).toBe(true);
  }
});

// ── Stage 2: Fund + Deploy ──

test("Stage 2: fund and deploy swarm", async () => {
  // Stop any existing swarm first (idempotent)
  try { stopSwarm(); } catch { /* not running */ }

  await fundAllBots();

  // Verify at least first bot has L3 USDC (not Vision balance — bots need wallet USDC)
  const bal = await getL3UsdcBalance(SWARM_ADDRESSES[0]);
  expect(bal > 0n, `Bot 0 has no L3 USDC after funding`).toBe(true);

  startSwarm();

  await pollUntil(
    async () => swarmHealthy(),
    (ok) => ok,
    120_000,
    5_000,
    "swarm containers running"
  );
});

// ── Stage 3: Wait for joins (parallelized RPC with error tolerance) ──

test("Stage 3: bots join batches", async () => {
  const SAMPLE_SIZE = 10;
  const MIN_BOTS_PER_BATCH = 5;
  const MIN_BATCHES_WITH_BOTS = Math.floor(SAMPLE_SIZE * 0.8);

  await pollUntil(
    async () => {
      let batchesOk = 0;
      const sample = BATCH_IDS.slice(0, SAMPLE_SIZE);

      // Parallelize: check all bots in all sampled batches at once
      const checks = sample.map(async (batchId) => {
        const results = await Promise.allSettled(
          SWARM_ADDRESSES.map((addr) => getPosition(batchId, addr))
        );
        const joined = results.filter(
          (r) => r.status === "fulfilled" && r.value.bitmapHash !== ZERO_HASH
        ).length;
        return joined >= MIN_BOTS_PER_BATCH;
      });

      const outcomes = await Promise.all(checks);
      batchesOk = outcomes.filter(Boolean).length;
      return batchesOk;
    },
    (count) => count >= MIN_BATCHES_WITH_BOTS,
    5 * 60 * 1000,
    15_000,
    "bots joining batches"
  );

  // Log sample positions
  for (const batchId of BATCH_IDS.slice(0, 2)) {
    const pos = await getPosition(batchId, SWARM_ADDRESSES[0]);
    if (pos.bitmapHash !== ZERO_HASH) {
      console.log(
        `  Bot 0 in batch ${batchId}: stake=${pos.stakePerTick}, balance=${pos.balance}`
      );
    }
  }
});

// ── Stage 4: Tick resolution ──

test("Stage 4: tick resolution via BLS consensus", async () => {
  if (FAST_BATCHES.length === 0) {
    console.log("No fast-ticking batches. Skipping.");
    return;
  }

  const initialTicks = new Map<number, bigint>();
  for (const batchId of FAST_BATCHES.slice(0, 5)) {
    initialTicks.set(batchId, await getCurrentTick(batchId));
  }

  const THRESHOLD = Math.min(3, FAST_BATCHES.length);

  await pollUntil(
    async () => {
      let resolved = 0;
      for (const [batchId, initial] of initialTicks) {
        const current = await getCurrentTick(batchId);
        if (current > initial) {
          resolved++;
          console.log(`  Batch ${batchId}: tick ${initial} → ${current}`);
        }
      }
      return resolved;
    },
    (n) => n >= THRESHOLD,
    10 * 60 * 1000,
    15_000,
    "tick resolution"
  );

  // Verify balances changed after resolution
  for (const [batchId, initial] of initialTicks) {
    if ((await getCurrentTick(batchId)) <= initial) continue;

    const results = await Promise.allSettled(
      SWARM_ADDRESSES.map((addr) => getPosition(batchId, addr))
    );
    const changed = results.filter(
      (r) => r.status === "fulfilled" &&
        r.value.bitmapHash !== ZERO_HASH &&
        r.value.balance !== r.value.totalDeposited
    ).length;
    console.log(`  Batch ${batchId}: ${changed}/${SWARM_COUNT} balances changed`);
    expect(changed).toBeGreaterThan(0);
  }
});

// ── Stage 5: Frontend ──

test("Stage 5: frontend displays swarm data", async ({ page }) => {
  await page.goto(`${FRONTEND_URL}/vision`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="source-card"]').first()).toBeVisible({
    timeout: 30_000,
  });

  // Navigate to detail page
  await page.locator('[data-testid="source-card"]').first().click();
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });

  // Check leaderboard
  await page.goto(`${FRONTEND_URL}/vision/leaderboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5_000);

  const content = await page.textContent("body");
  const visible = SWARM_ADDRESSES.filter((a) =>
    content?.toLowerCase().includes(a.toLowerCase().slice(2, 10))
  );
  console.log(`  ${visible.length}/${SWARM_COUNT} bots on leaderboard`);
});

// ── Stage 6: Economic invariants ──

test("Stage 6: economic invariants hold", async () => {
  // 6a. Solvency (HARD assertion)
  const solvency = await verifySolvency(BATCH_IDS);
  console.log(`  Solvency: ${solvency.passed ? "PASS" : "FAIL"} (${solvency.actual} vs ${solvency.expected})`);
  expect(solvency.passed, solvency.detail).toBe(true);

  // 6b. Per-batch conservation (SOFT — informational only, no assertion)
  for (const batchId of FAST_BATCHES.slice(0, 5)) {
    const info = await verifyBatchConservation(batchId, SWARM_ADDRESSES);
    console.log(`  ${info.name}: ${info.detail}`);
    // No expect — subset invariant is not guaranteed
  }
});

// ── Teardown ──

test.afterAll(async () => {
  try {
    for (let i = 0; i < 3; i++) {
      console.log(`\n=== Bot ${i} ===\n${botLogs(i, 15)}`);
    }
  } catch { /* VPS unreachable */ }
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/e2e/tests/40-vision-swarm.spec.ts
git commit -m "feat: vision swarm E2E — 6 stages, typed ABI, soft invariants"
```

---

### Task 8: Update Playwright Config

**Files:**
- Modify: `frontend/e2e/playwright.config.ts`

- [ ] **Step 1: Add swarm project (testnet only)**

```typescript
...(IS_ANVIL ? [] : [{
  name: "swarm",
  testMatch: /40-/,
  dependencies: ["vision-data"],
  use: {
    ...devices["Desktop Chrome"],
  },
}]),
```

- [ ] **Step 2: Commit**

```bash
git add frontend/e2e/playwright.config.ts
git commit -m "feat: add swarm project to playwright config (testnet only)"
```

---

## Chunk 5: Smoke Run

### Task 9: Manual Smoke Run

- [ ] **Step 1: Switch to testnet**

```bash
./switch-env.sh testnet
```

- [ ] **Step 2: Deploy the swarm**

```bash
./scripts/deploy-swarm.sh
```

- [ ] **Step 3: Verify bots are running**

```bash
ssh index-maker/prod/be 'docker logs swarm-bot-0 --tail 30 2>&1'
```

- [ ] **Step 4: Run E2E test**

```bash
cd frontend && npx playwright test --project=swarm --reporter=line
```

- [ ] **Step 5: Fix + commit any issues**

- [ ] **Step 6: Push**

```bash
git push mono main
```
