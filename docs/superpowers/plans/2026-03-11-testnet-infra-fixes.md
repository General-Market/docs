# Testnet Infrastructure Fixes — Full Bug List & Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all bugs discovered during the 2026-03-11 E2E testnet session — restore full ITP order processing, Vision tick resolution, data-node endpoints, and reduce operational noise.

**Architecture:** Three layers need fixes: Sonic RPC proxy (root cause of confirmed_block=0), oracles (consensus, settlement custody, logging), data-node (/aum-ranking), and deployment config (stale env vars, vision-batches.json). Full infra redeploy from contracts required on BOTH L3 and Settlement (Sonic).

**Tech Stack:** Rust (data-node, oracles), Solidity (contracts), TypeScript (E2E helpers), bash (deploy scripts), Python (sonic-rpc-proxy)

---

## Bug Inventory

### Critical — ITP Orders Broken

| ID | Bug | Impact | Root Cause |
|----|-----|--------|------------|
| **BUG-001** | `confirmed_block=0` — oracles never process ITP orders | ALL ITP buy/sell/rebalance broken since oracle restart | Data-node's `poll_settlement_state_once()` at `chain_pollers.rs:805-941` ALREADY correctly tracks Settlement confirmed_block — calls `settlement_provider.get_block_number()`, subtracts 10 for finality, stores to `AtomicU64`. BUT the Settlement provider hits `http://127.0.0.1:8547` (Sonic proxy), and **BUG-015 is the root cause**: the proxy silently fails, `get_block_number()` returns `Err`, the `?` operator exits early, `AtomicU64` stays at initialized value 0. **The data-node code is NOT broken — the Sonic proxy is.** |
| **BUG-002** | INFRA-007 consensus timeout — follower never gets leader response | ~50% of consensus rounds fail (800ms timeout, ~290ms elapsed) | When node is follower, sends PriceVote to leader, leader never responds within timeout. When node IS leader, consensus succeeds in 24-90ms. P2P message delivery issue. Prior sessions already bumped timeouts 4 times (50ms→100ms→500ms→800ms) with no improvement — this is NOT a timeout issue, it's a message routing/delivery issue. |
| **BUG-003** | Empty consensus rounds — cycles with no work produce noise | Log pollution, wasted CPU cycles | Oracles run full consensus rounds even when there are no orders to process, no prices to update, no ticks to resolve. Should skip or compress empty rounds. |

### Critical — Vision Broken

| ID | Bug | Impact | Root Cause |
|----|-----|--------|------------|
| **BUG-004** | Zeroed settlement custody address — Vision deposits never credited | Vision Settlement bridge deposits silently fail | `testnet.sh` `_start_oracles()` never passes `--vision-settlement-bridge-custody` CLI arg AND never sets `ORACLE_VISION_SETTLEMENT_BRIDGE_CUSTODY_ADDRESS` or `ORACLE_SETTLEMENT_CUSTODY` env vars. VisionConfig falls through all 3 sources → `unwrap_or_default()` → empty string → `Address::zero()`. The `SettlementBridgeCustody` address IS in `deployment.json` but only loaded into `OracleConfig.settlement_custody` (ITP bridge), NOT propagated to `VisionConfig.settlement_bridge_custody_address`. |
| **BUG-005** | Vision ticks don't resolve | Players join batches, bitmaps accepted, but `lastClaimedTick` stays at 0 | Downstream of BUG-001/BUG-002 — oracles can't reach consensus to resolve ticks. |

### Critical — Infrastructure (ROOT CAUSE)

| ID | Bug | Impact | Root Cause |
|----|-----|--------|------------|
| **BUG-015** | Sonic RPC proxy on port 8547 — settlement data not flowing | **ROOT CAUSE of BUG-001.** `confirmed_block` never updates because `settlement_provider.get_block_number()` fails through the proxy | Python `sonic-rpc-proxy.py` on port 8547. Rate limit was fixed in prior session (0.05s→20 req/s), but proxy still drops or misroutes responses. Data-node `poll_settlement_state_once` errors are logged as warn and swallowed — check data-node logs for Settlement poll errors. |

### High — Data-Node

| ID | Bug | Impact | Root Cause |
|----|-----|--------|------------|
| **BUG-006** | `/aum-ranking` endpoint hangs forever | ITP card rendering blocked on frontend, E2E tests timeout | Endpoint blocks on L3 RPC call that never returns. Need to diagnose WHY it hangs (bad query? missing contract? wrong address?) before adding timeout — a timeout alone masks the issue. |
| **BUG-007** | Data-node `.env` has wrong RPC URL | Manual restarts break (uses stale `https://index.rpc.zeeve.net` instead of `http://142.132.164.24/`) | `.env` file at `/home/max/index/data-node/.env` was never updated. `testnet.sh` overrides with CLI args but manual restarts don't. |

### High — E2E Test Performance (all downstream)

| ID | Bug | Impact | Root Cause |
|----|-----|--------|------------|
| **BUG-008** | Test 08 (settlement-bridge-buy) takes 11.1 min | E2E suite takes too long | Downstream of BUG-001/BUG-015. |
| **BUG-009** | Test 26 (rebalance-full-cycle) takes 8.1 min | E2E suite takes too long | Downstream of BUG-001/BUG-002. |
| **BUG-010** | Test 18 (multi-itp-orders) takes 6.1 min | E2E suite takes too long | Downstream of BUG-001. |
| **BUG-011** | Test 25 (vision-tick-resolution) takes 5.6 min | E2E suite takes too long | Downstream of BUG-005. |
| **BUG-012** | Test 20 (vision-settlement-withdraw) takes 5.3 min | E2E suite takes too long | Downstream of BUG-004. |

### Medium — Operational

| ID | Bug | Impact | Root Cause |
|----|-----|--------|------------|
| **BUG-013** | Oracle log volume: 5.2 GB/day | Disk fills up, hard to grep logs | 1s cycle interval with INFO-level logging for every cycle, even empty ones. |
| **BUG-014** | `vision-batches.json` has stale batch IDs (108-150) | E2E `findAvailableE2eBatch` tried invalid batches before fix | JSON from older contract deployment. **Partially fixed** — E2E helper now validates on-chain, but JSON itself is still stale. |

### Low — Config

| ID | Bug | Impact | Root Cause |
|----|-----|--------|------------|
| **BUG-016** | `testnet.sh` CLI args not in `.env` | Two sources of truth for same config | CLI args override `.env` values but this is fragile. |

---

## Fix Strategy

**Root cause chain:** BUG-015 (Sonic proxy) → BUG-001 (confirmed_block=0) → BUG-008/009/010 (ITP test timeouts). Fix the proxy and ITP orders work.

**Execution order:**
1. **Diagnose Sonic proxy WHILE services are still running** (BUG-015 diagnosis)
2. **Pre-deploy safety**: Check in-flight orders, custody balances, backup JSONs, then stop services
3. **Fix Sonic proxy** based on diagnosis (fixes BUG-015 → BUG-001 → BUG-008/009/010)
4. **Code fixes** (all done BEFORE deploy to minimize downtime):
   - Fix Vision custody address in `testnet.sh` (BUG-004 → BUG-005 → BUG-012)
   - Fix /aum-ranking (BUG-006) — diagnose root cause first
   - Fix data-node .env (BUG-007)
   - Add P2P message tracing for consensus (BUG-002)
5. **Full infra redeploy** via `testnet.sh deploy` — deploys BOTH L3 AND Settlement (fixes BUG-014)
6. **Build, restart all services** (both VPSes), verify BLS, verify confirmed_block
7. **Deploy frontend to Vercel** with new contract addresses
8. **Run full E2E** to verify
9. **LAST: Fix empty round logging** (BUG-003/BUG-013) — only after all other bugs verified fixed

**NOTE on downtime:** Services are stopped at step 2, code fixes happen at step 4, deploy at step 5, restart at step 6. Expected downtime: ~20 min (deploy + build + restart). Consensus tracing (BUG-002) is time-boxed: add tracing code in step 4, deploy it in step 5, observe after restart in step 6. Full diagnosis happens post-restart, not during downtime.

**Rollback plan:** If any deploy step fails:
1. Restore `deployments/active-deployment-backup.json` → `deployments/active-deployment.json`
2. Restore `envs/testnet/` from git (`git checkout -- envs/testnet/`)
3. Restart services with old config: `./testnet.sh start`

---

## Chunk 1: Diagnose, Safety, Proxy Fix, Code Fixes

### Task 1: Diagnose Sonic proxy WHILE services are still running

**Do this FIRST, before stopping anything.** The proxy must be alive to diagnose.

- [ ] **Step 1: Check if Sonic proxy is running and responding**

```bash
ssh index-maker/prod/be "ps aux | grep sonic-rpc-proxy"
ssh index-maker/prod/be "curl -s -X POST -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' http://127.0.0.1:8547"
```

If proxy returns a valid block number → proxy works, issue is in data-node polling code.
If proxy returns nothing/error/502 → proxy is the problem.

- [ ] **Step 2: Check data-node logs for Settlement poll errors**

```bash
ssh index-maker/prod/be "grep -i 'settlement.*poll\|settlement.*error\|settlement.*fail\|confirmed_block' /home/max/index/logs/data-node.log | tail -20"
```

This reveals whether `poll_settlement_state_once` returns `Err` (proxy issue) or succeeds but stores 0 (code bug).

- [ ] **Step 3: Test direct Sonic RPC (bypass proxy)**

```bash
ssh index-maker/prod/be "curl -s -X POST -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' https://rpc.testnet.soniclabs.com"
```

If direct works but proxy doesn't → fix/replace the proxy.
If direct also fails → Sonic testnet is down, nothing we can fix.

- [ ] **Step 4: Check what proxy actually returns on error**

The proxy code at `scripts/sonic-rpc-proxy.py` returns HTTP 502 with JSON error on upstream exceptions (lines 86-93). Check if the data-node Rust HTTP client treats 502 as a connection error or parses the body:

```bash
ssh index-maker/prod/be "grep -i '502\|status.*error\|response.*err' /home/max/index/logs/data-node.log | tail -10"
```

**Decision tree for Step 5 (based on diagnosis):**
- Proxy not running → restart it, verify confirmed_block updates
- Proxy running but returning errors → fix proxy error handling or bypass
- Proxy returning valid data but data-node not storing it → data-node code bug (unlikely per code review)
- Sonic RPC itself down → wait or use a different Sonic RPC endpoint

### Task 2: Pre-deploy safety checks & stop

- [ ] **Step 1: Backup current deployment files**

```bash
cp deployments/active-deployment.json deployments/active-deployment-pre-redeploy.json
cp deployments/vision-batches.json deployments/vision-batches-pre-redeploy.json
```

- [ ] **Step 2: Check custody contract USDC balances**

```bash
# Read addresses from deployment JSON (addresses nested under .contracts)
L3_CUSTODY=$(jq -r '.contracts.L3BridgeCustody // .contracts.BridgeCustody' deployments/active-deployment.json)
L3_USDC=$(jq -r '.contracts.USDC' deployments/active-deployment.json)
SETT_CUSTODY=$(jq -r '.contracts.SettlementBridgeCustody' deployments/active-deployment.json)
SETT_USDC=$(jq -r '.contracts.SETTLEMENT_USDC' deployments/active-deployment.json)

# Check USDC balances (call balanceOf on the TOKEN contract, not the custody)
cast call $L3_USDC "balanceOf(address)(uint256)" $L3_CUSTODY --rpc-url http://142.132.164.24/
cast call $SETT_USDC "balanceOf(address)(uint256)" $SETT_CUSTODY --rpc-url https://rpc.testnet.soniclabs.com
```

Document any locked funds. On testnet these are test funds — acceptable to abandon if non-zero.

- [ ] **Step 3: Check oracle logs for in-flight orders**

```bash
# The /api/in-flight-orders endpoint does NOT exist on oracles.
# Instead, grep logs for active bridge operations:
ssh index-maker/prod/be "grep -i 'in.flight\|buy_active\|sell_active\|SubmittedOnL3\|SellPending' /home/max/index/logs/oracle-1.log | tail -10"
```

If recent logs show active bridge operations: wait for pipeline to drain (or accept testnet fund loss).

- [ ] **Step 4: Stop all services on BOTH VPSes**

```bash
./testnet.sh stop
```

**NOT `./stop.sh`** — that's a local dev script. `testnet.sh stop` uses `pkill` for oracles, data-node, curator, sonic-rpc-proxy on VPS 1, and AP on VPS 2.

### Task 3: Fix Sonic proxy (BUG-015) + all code fixes before deploy

Apply the proxy fix based on Task 1 diagnosis, PLUS all other code fixes. Do everything before deploy to minimize downtime.

**Proxy fix (based on Task 1 diagnosis):**

- [ ] **Step 1: Apply proxy fix**

If proxy was broken: fix `scripts/sonic-rpc-proxy.py` or bypass it by changing `--settlement-rpc-url` in `testnet.sh` to point directly at `https://rpc.testnet.soniclabs.com`.

If bypassing the proxy: the data-node's Settlement poller runs every 2s. At 1 req/2s, direct Sonic RPC won't hit rate limits. BUT oracles' `SettlementChainWriter` also hits Sonic RPC through the proxy (port 8547). If bypassing for data-node only, update `testnet.sh _start_data_node` `--settlement-rpc-url` but keep the proxy alive for oracles. If bypassing entirely, update BOTH data-node and oracle `--settlement-rpc-url`.

Also add: data-node ERROR log if `confirmed_block` stays 0 for >30s after startup, so this failure is immediately visible.

- [ ] **Step 2: Fix Vision custody address in testnet.sh (BUG-004)**

Add to `VISION_ARGS` in `_start_oracles()`:
```bash
--vision-settlement-bridge-custody $(read_deployment_addr "SettlementBridgeCustody")
```

- [ ] **Step 3: Fix /aum-ranking (BUG-006)**

Diagnose: test the underlying contract call with `cast call` to determine if it's an RPC hang, a bad query, or a missing contract on the new deployment. Fix accordingly (timeout + proper error return, or fix the query).

- [ ] **Step 4: Fix data-node .env (BUG-007)**

Fix the LOCAL file — `testnet.sh start` rsyncs local `data-node/.env` to VPS, so fixing only the VPS copy gets overwritten on next restart.

```bash
# Fix LOCAL file (macOS sed syntax)
sed -i '' 's|INDEX_RPC_URL=.*|INDEX_RPC_URL=http://142.132.164.24/|' data-node/.env
```

This gets committed in Step 6 and rsynced to VPS automatically by `testnet.sh start`.

- [ ] **Step 5: Add P2P message tracing for consensus (BUG-002)**

Add log lines at 4 hops (follower send, leader receive, leader respond, follower receive). This is diagnostic — the actual fix comes after observing the tracing post-restart.

**Do NOT increase timeout to 2000ms** — `consensus/state.rs:224-229` asserts `total < cycle_duration_ms` (1000ms). Max safe timeout ≈ 950ms. If a timeout increase is needed as mitigation, bump BOTH `--consensus-timeout-ms 950` AND `--cycle-duration-ms 2000` (halves throughput — document this tradeoff).

- [ ] **Step 6: Commit all code fixes**

```bash
git add scripts/ data-node/ oracle/ testnet.sh
git commit -m "fix: proxy + custody + aum-ranking + consensus tracing"
```

---

## Chunk 2: Full Infrastructure Redeploy

### Task 4: Redeploy contracts on BOTH chains via testnet.sh

**IMPORTANT:** `testnet.sh deploy` handles the FULL lifecycle:
- L3 deploy (`DeployFullSystemE2E.s.sol` on chain 111222333)
- Settlement deploy (`DeployFullSystemE2E.s.sol` on Sonic chain 14601)
- Merge L3 + Settlement addresses into `active-deployment.json`
- BLS key registration (`_registerOracles()` — registers keys from seeds 0,1,2)
- Aggregated pubkey computation
- Oracle + AP funding (GM gas + USDC on both chains)
- Vision contract deploy + batch deploy
- Morpho deploy

**DO NOT run `forge script` manually.** Use `testnet.sh deploy`.

**WARNING:** `testnet.sh deploy` has a silent-failure bug on Sonic deploy. Line 291 uses `|| echo` which swallows the error and continues. The merge then produces L3-only addresses. **You MUST manually verify Settlement addresses in Step 2.** If missing, ABORT — do NOT proceed.

- [ ] **Step 1: Run full testnet deploy**

```bash
./testnet.sh deploy
```

This takes 5-10 minutes. Watch the output for yellow "Sonic forge script had errors" warnings — if you see this, the Settlement deploy failed.

- [ ] **Step 2: Verify BOTH chains deployed (CRITICAL gate)**

```bash
# Check active-deployment.json has BOTH L3 and Settlement addresses
grep -c "0x" deployments/active-deployment.json
# Should have 20+ addresses. If <10, Settlement deploy failed → ABORT.

# Verify Settlement-specific addresses exist:
grep "SettlementBridgeCustody\|SettlementBridgeProxy\|SETTLEMENT_USDC\|SettlementOracleRegistry" deployments/active-deployment.json
```

**If ANY Settlement address is missing:** ABORT. Restore backup:
```bash
cp deployments/active-deployment-pre-redeploy.json deployments/active-deployment.json
cp deployments/vision-batches-pre-redeploy.json deployments/vision-batches.json
```
Fix Sonic RPC first (go back to Task 1), then retry deploy.

- [ ] **Step 3: Verify BLS keys registered**

```bash
cast call $(jq -r '.OracleRegistry' deployments/active-deployment.json) "aggregatedPubkey()(bytes)" --rpc-url http://142.132.164.24/
```

Should return a non-empty bytes value. If empty: BLS registration failed in deploy — check deploy logs.

- [ ] **Step 4: Verify vision-batches.json has new batch IDs**

```bash
head -5 deployments/vision-batches.json
```

Batch IDs should be different from the old 108-150 range.

- [ ] **Step 5: Sync deployment JSONs to frontend + envs**

```bash
./switch-env.sh testnet
```

- [ ] **Step 6: Commit updated deployment files**

```bash
git add envs/testnet/ deployments/ frontend/lib/contracts/
git commit -m "chore: redeploy testnet contracts — fresh L3+Settlement+Vision"
```

- [ ] **Step 7: Push and sync to BOTH VPSes**

```bash
git push mono main
ssh index-maker/prod/be "cd /home/max/index && git pull origin main"
ssh index-maker/prod/postgres "cd /home/max/index && git pull origin main"
```

**Both VPSes must have the new deployment files.** VPSes use `origin` as remote name (not `mono`). AP on VPS 2 reads `deployment.json` directly.

---

## Chunk 3: Build, Restart, Verify, Frontend Deploy

### Task 5: Build on BOTH VPSes, restart, verify

- [ ] **Step 1: Build on VPS 1 (data-node + oracle)**

```bash
ssh index-maker/prod/be "cd /home/max/index && cargo build --release -p data-node -p oracle"
```

If build fails: fix compilation errors locally, push, pull, rebuild. Do NOT start services with old binaries.

- [ ] **Step 2: Build on VPS 2 (AP)**

```bash
ssh index-maker/prod/postgres "cd /home/max/index && cargo build --release -p ap"
```

- [ ] **Step 3: Start services**

```bash
./testnet.sh start
```

`testnet.sh start` handles correct ordering: sonic-rpc-proxy first, then data-node (2s wait), then oracles, then AP on VPS 2.

- [ ] **Step 4: Verify confirmed_block != 0 (retry loop, 2 min patience)**

Data-node loads 621 symbols at startup — give it time.

```bash
# Poll every 10s for up to 120s
for i in $(seq 1 12); do
  BLOCK=$(ssh index-maker/prod/be "curl -s http://localhost:8200/chain/settlement/confirmed-block 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"confirmed_block\",0))' 2>/dev/null || echo 0")
  echo "Attempt $i: confirmed_block=$BLOCK"
  if [ "$BLOCK" != "0" ] && [ -n "$BLOCK" ]; then echo "SUCCESS"; break; fi
  sleep 10
done
```

**NOTE:** The endpoint is `/chain/settlement/confirmed-block` (not `/settlement/confirmed-block`). Response is JSON `{"confirmed_block": N}`, not a bare number.

**If still 0 after 120s:** Check data-node logs for Settlement RPC errors:
```bash
ssh index-maker/prod/be "grep -i 'settlement\|confirmed_block' /home/max/index/logs/data-node.log | tail -20"
```
This is the canary for BUG-015. If proxy is still failing, go back to Task 1.

- [ ] **Step 5: Verify BLS signing works end-to-end**

```bash
ssh index-maker/prod/be "grep -i 'consensus.*success\|bls.*verify\|round.*complete' /home/max/index/logs/oracle-1.log | tail -5"
```

If BLS verification fails: verify key seeds match — deploy script uses `blsPubkey(0,1,2)`, oracles use `--bls-key-seed-index 0,1,2`.

- [ ] **Step 6: Verify Vision custody address is set**

```bash
ssh index-maker/prod/be "grep 'settlement_bridge_custody\|VisionDepositWatcher' /home/max/index/logs/oracle-1.log | tail -5"
```

Should NOT contain `zeroed address` or `Invalid`. Should show the actual `SettlementBridgeCustody` address.

- [ ] **Step 7: Verify oracle health**

```bash
ssh index-maker/prod/be "curl -s http://localhost:10001/health"
ssh index-maker/prod/be "curl -s http://localhost:10002/health"
ssh index-maker/prod/be "curl -s http://localhost:10003/health"
```

### Task 6: Deploy frontend to Vercel with new contract addresses

The frontend bakes `deployment.json` at build time (`import deployment from './deployment.json'` in `frontend/lib/contracts/addresses.ts`). After contract redeploy, the Vercel production build has stale addresses.

- [ ] **Step 1: Update NEXT_PUBLIC_VISION_ADDRESS if changed**

Check if Vision contract address changed:
```bash
grep NEXT_PUBLIC_VISION_ADDRESS envs/testnet/.env
```

If it changed, update the Vercel environment variable in the Vercel dashboard.

- [ ] **Step 2: Deploy to Vercel**

```bash
cd frontend && vercel --prod
```

- [ ] **Step 3: Verify deployment**

```bash
vercel inspect $(vercel ls --json 2>/dev/null | jq -r '.[0].url') --logs 2>/dev/null | tail -5
```

### Task 7: Run full E2E suite

- [ ] **Step 1: Run E2E**

```bash
cd frontend && npx playwright test --workers=2
```

- [ ] **Step 2: Verify all slow tests now complete in <2 min**

Check test 08, 18, 20, 25, 26 durations.

### Task 8: Fix empty round logging (BUG-003, BUG-013) — ONLY AFTER VERIFICATION

**IMPORTANT:** Only do this AFTER Task 7 E2E passes. Empty round logs are diagnostic signals for the bugs being fixed above. Suppressing them before verification hides evidence.

**Files:**
- Modify: oracle cycle loop logging

- [ ] **Step 1: Find the main cycle loop**

Search for cycle entry point in oracle source.

- [ ] **Step 2: Add counter-based log compression**

Do NOT suppress to TRACE — use a counter approach:
- Log first empty round at INFO
- Suppress subsequent empty rounds
- Log summary every 100 rounds: `"100 empty rounds in last 100s — no pending work"`
- Add monitoring metric: consecutive empty rounds counter

This preserves visibility while reducing volume from 5.2 GB/day to ~50 MB/day.

- [ ] **Step 3: Test**

```bash
cargo test -p oracle
```

- [ ] **Step 4: Commit, push, deploy**

```bash
git add oracle/
git commit -m "fix(oracle): compress empty round logging — counter-based summary"
git push mono main
ssh index-maker/prod/be "cd /home/max/index && git pull origin main && cargo build --release -p oracle"
```

Restart oracles only (not full redeploy).

---

## Rollback Plan

If any step fails:

| Failure Point | Recovery |
|---------------|----------|
| Sonic proxy fix fails | Bypass proxy: point `--settlement-rpc-url` directly at `https://rpc.testnet.soniclabs.com` |
| `testnet.sh deploy` fails on L3 | Restore `deployments/active-deployment-pre-redeploy.json`, restart with old config |
| `testnet.sh deploy` fails on Settlement | **ABORT.** Do NOT merge L3-only addresses. Restore backup, restart old. |
| Cargo build fails on VPS | Fix compilation errors locally, push, pull, rebuild. Old contracts are deployed but not used until services start. |
| `confirmed_block` stays 0 after restart | Go back to Task 1. Re-diagnose Sonic proxy. |
| BLS verification fails after redeploy | Verify key seeds match: deploy script uses `blsPubkey(0,1,2)`, oracles use `--bls-key-seed-index 0,1,2`. Re-register if mismatched. |
| E2E still fails | Check which tests fail. If ITP tests: BUG-001 not fixed. If Vision tests: BUG-004 not fixed. Diagnose individually. |

---

## Expected Outcomes

After all fixes:
- `confirmed_block` should be non-zero → ITP orders process normally
- Consensus rounds succeed >95% of the time (not ~50%)
- Vision settlement deposits are credited → tick resolution works
- `/aum-ranking` responds within 10s → ITP cards render
- All E2E tests pass in <2 min each
- `vision-batches.json` has correct batch IDs matching deployed contracts
- Empty rounds logged as summary every 100 rounds → log volume <50 MB/day
- Both VPSes have consistent deployment files
- BLS keys verified working end-to-end
