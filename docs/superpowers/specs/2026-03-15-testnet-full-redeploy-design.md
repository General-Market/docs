# Testnet Full-Redeploy Upgrade

**Date:** 2026-03-15
**Status:** Approved
**Goal:** Make `testnet.sh deploy` + `testnet.sh start` a complete from-scratch deployment — all 621 Bitget tokens, 96 ITPs with vaults, all services including vision swarm.

## Problem

Six gaps prevent a clean fresh redeploy:

1. **Token deployment assumes prior state.** `Deploy107ITPs_Tokens.s.sol` hardcodes 84 token addresses in `_setExisting()`. On a fresh chain, those addresses are void. Only 231 tokens are handled; `assets.json` has 621.
2. **ITP vault deployment never runs.** `testnet.sh` calls token deploy + ITP create but never calls `Deploy107ITPs_Vaults.s.sol`. ITPs exist on-chain but are untradeable.
3. **Vision swarm requires separate manual script.** The 10 bots need `deploy-swarm.sh` run independently with pre-generated `swarm.env`.
4. **Database holds stale state.** On fresh deploy, PostgreSQL still has `vision_last_resolved`, `vision_reference_prices`, `signed_batch_configs`, `trades`, `itp_snapshots` from the previous deployment — batch IDs and contract addresses that no longer exist on-chain.
5. **No gas verification.** The deployer needs gas for ~1800+ txs (621 deploys + 621 mints + 96 ITP creates + 96 vault deploys + Vision batches). Current script sends 10 GM to issuers/AP but never checks deployer balance or whether 10 GM is sufficient for the expanded workload. Swarm bots get USDC but no GM for gas.
6. **`symbol-map.json` uses stale addresses.** Built from `assets.json` which has Bitget mainnet addresses — on fresh L3, the MockERC20 addresses differ. The issuers and data-node need the map to resolve symbols to on-chain tokens.

## Design

### 1. New script: `scripts/deploy-all-tokens.py`

Generates `contracts/script/DeployAllTokens.s.sol` from `assets.json`.

**Input:** `assets.json` (622 entries, 621 unique symbols — one ETH duplicate).
Note: `assets.json` has `address` and `bitget` fields (e.g. `BTCUSDT`). The symbol is derived by stripping the quote suffix (USDT/USDC) — same regex already used in `testnet.sh`'s token registry sync.

**Output:** Solidity forge script that:
- Deploys all 621 tokens as `MockERC20("Mock {SYM}", "{SYM}", 18)`
- Funds `MockBitgetVault` with 1M (1e24) of each token
- Exports `data/all-token-addresses.csv` — format: `index,address\n` (Solidity-compatible, same format as current `itp-107-token-addresses.csv`)
- ceil(621/25) = 25 `_deployBatch` functions (last batch has 21 tokens)
- No `_setExisting()` — everything deployed fresh

The Python generator also writes `data/all-token-symbols.json` — a `{symbol: index}` map for `deploy-107-itps.py` to resolve ITP token references. This keeps the Solidity CSV format simple (two columns) while giving Python the symbol mapping it needs.

**Deduplication:** Skip the second ETH entry (ETHUSDC duplicate in `assets.json`).

### 2. Modify `scripts/deploy-107-itps.py`

- **Remove** `gen_tokens_script()` entirely — no more `Deploy107ITPs_Tokens.s.sol`
- **Remove** token-related code from `gen_shell_script()`
- `gen_create_script()` reads `data/all-token-symbols.json` to build `sym_idx` map, then generates Solidity that reads `data/all-token-addresses.csv` (same `index,address` format — Solidity parser unchanged)
- `gen_vaults_script()` unchanged
- Shell script becomes 2 phases: create ITPs → deploy vaults
- The `existing` vs `new` token distinction eliminated entirely

**Token resolution:** Python reads `all-token-symbols.json` to get `sym_idx[symbol] → array_index`. The generated Solidity uses `t[index]` as before. The Solidity `_parseTokens` function stays identical — it still parses `index,address\n`.

### 3. Gas management

**Pre-deploy gas check (new step 1b):**

Before any contract deployment, check deployer balance on L3:
```bash
DEPLOYER_BAL=$(cast balance --rpc-url "$RPC_URL" "$DEPLOYER_ADDRESS")
# Require >= 100 GM (arbitrary safe margin for ~1800 txs)
```

If insufficient, print the deficit and exit. On Orbit L3, the deployer is the chain owner with genesis funds — should always have enough, but verify.

**Expanded gas distribution (step 4):**

Current: 10 GM to issuers + AP.
New: also fund the 10 swarm bot wallets with 1 GM each (read addresses from `docker/testnet/vision-swarm/addresses.json`). Bots need gas for Vision `placeBet` transactions, not just USDC.

**Post-funding verification:**
After funding, verify each recipient has a non-zero balance with `cast balance`. Log balances. If any funding tx failed silently (cast exits 0 on some RPC errors), catch it here rather than discovering it when a service can't send txs.

### 4. Database reset on fresh deploy

Add to `cmd_deploy`, after core contracts deploy but before Vision:

```bash
echo "[3c] Resetting data-node database..."
vps_be_ssh "psql -U max -d index_prices -c '
  TRUNCATE vision_last_resolved, vision_reference_prices,
           signed_batch_configs, batch_configs, batch_settlements CASCADE;
'"
```

This clears Vision-specific state that references old batch IDs and config hashes. General tables (`prices`, `klines`, `coingecko_*`) are fine to keep — they hold market data independent of contract addresses. `trades` and `itp_snapshots` reference old contract state but the data-node handles missing contracts gracefully (it re-polls from `--from-block`).

The `--from-block` arg in issuer startup already points to current block number (`cast block-number`), so issuers won't try to replay old events.

WAL cleanup already happens in `_start_issuers_docker` (`rm -f logs/consensus-*.wal`).

### 5. Modify `testnet.sh` `cmd_deploy`

New deployment order (renumbered):

| Step | What | Script |
|------|------|--------|
| 1 | RPC check | existing |
| **1b** | **Gas balance check** | `cast balance` |
| 2 | bls-tool check | existing |
| 3 | Core contracts | `DeployFullSystemE2E` |
| 3b | Settlement (Sonic) | `DeployFullSystemE2E` |
| **3c** | **DB reset (Vision tables)** | `psql TRUNCATE` via SSH |
| 4 | Fund gas (issuers + AP + **swarm bots**) | cast sends + **balance verify** |
| 5 | Morpho | `DeployMorphoE2E` |
| 6 | Vision + batches | `DeployVision` + `DeployAllVisionBatches` |
| 7 | Fund USDC | existing cast sends |
| **8** | **Generate token deploy script** | `python3 scripts/deploy-all-tokens.py` |
| **9** | **Deploy all 621 tokens + fund vault** | `DeployAllTokens` |
| **9b** | **Update assets.json + deployed-assets.json** | Python: read CSV, write fresh addresses |
| **10** | **Generate ITP scripts** | `python3 scripts/deploy-107-itps.py` |
| **11** | **Create 96 ITPs** | `Deploy107ITPs_Create` |
| **12** | **Deploy 96 ITP vaults** | `Deploy107ITPs_Vaults` |
| 13 | Sync deployments + switch env + **token registries** | existing (uses updated `assets.json`) |
| 14 | Frontend to Vercel | existing |

The current `testnet.sh` numbering is already inconsistent (steps 1-7 labeled `/7`, then 8-10 labeled `/10`). This spec renumbers everything cleanly.

Steps 8-9b replace old step `[8/10]` (token deploy). Steps 10-12 add ITP generation, ITP creation (old `[9/10]`), and the missing vault deploy. Token registry sync (old step 15) merges into step 13 since `assets.json` is now updated in 9b.

**Key detail:** Steps 8 and 10 run Python generators before the forge scripts. This ensures the Solidity is always regenerated from current data — no stale generated code. If the generator fails, `testnet.sh` exits before running forge on potentially stale `.sol` files.

**Address propagation order:** Deploy tokens (9) → update `assets.json` (9b) → deploy ITPs (10-12) → sync registries (13) → `_sync_config_files` pushes `active-deployment.json` + `symbol-map.json` to VPSes. Services read fresh addresses on startup.

### 7. Modify `testnet.sh` `cmd_start` — add vision swarm

After all core services start, add:

```
[8/8] Deploying vision swarm...
```

Logic extracted from `deploy-swarm.sh`:
- Check if `docker/testnet/vision-swarm/swarm.env` exists — if not, print warning and skip (bots are optional)
- If present: sync files, build on VPS, fund 10 bot wallets (USDC + GM gas), start swarm
- Same rsync + cast send + docker compose up flow as `deploy-swarm.sh`
- Gas funding: 1 GM per bot wallet (read from `addresses.json`) — already handled in step 4 of `cmd_deploy`, but verify here in case `cmd_start` runs standalone

`deploy-swarm.sh` remains as a standalone script for manual re-deployment of just the swarm.

Current `cmd_start` step numbering is also inconsistent (`[1/6]` through `[5/6]` then `[6/7]`, `[7/7]`). Renumber to `/8`.

### 8. Token registry sync

The existing `deployed-assets.json` + `symbol-map.json` regeneration at the end of `cmd_deploy` stays. It reads `assets.json` and populates both files. On a fresh deploy, the on-chain addresses from `DeployAllTokens` are in the CSV and symbol JSON — `deployed-assets.json` is regenerated by the Python sync step at the end using `assets.json` addresses (which are stale on fresh chain).

**Fix:** Step 9b (after token deploy) runs a Python step that reads `data/all-token-addresses.csv` + `data/all-token-symbols.json` and writes the fresh addresses back into `assets.json` and `frontend/public/deployed-assets.json`. This ensures the final sync step and `deploy-107-itps.py` both see correct addresses. `symbol-map.json` (which uses `assets.json` addresses as keys) is then regenerated correctly in step 13.

## Files Changed

| File | Change |
|------|--------|
| `scripts/deploy-all-tokens.py` | **New** — generates DeployAllTokens.s.sol |
| `scripts/deploy-107-itps.py` | Remove token generation, read CSV for addresses |
| `testnet.sh` | Add token deploy, vault deploy, swarm start |
| `contracts/script/DeployAllTokens.s.sol` | **New** (auto-generated) |
| `contracts/script/Deploy107ITPs_Tokens.s.sol` | **Deleted** (no longer needed) |
| `scripts/deploy-107-itps.sh` | Updated (2-phase: create + vaults, no token deploy) |

## Files NOT Changed

- `DeployFullSystemE2E.s.sol` — still deploys 3 system tokens (L3_WUSDC, SETTLEMENT_USDC, MOCK_USDT)
- `DeployVision.s.sol`, `DeployAllVisionBatches.s.sol` — untouched
- `itp-bot/manifest.json` — untouched
- `docs/itp-backtest-results.json` — untouched
- `deploy-swarm.sh` — kept as standalone, logic duplicated into testnet.sh

## Invariants

- Every symbol in `assets.json` gets an on-chain MockERC20 on fresh deploy
- Every ITP in the manifest (that has backtest data) gets created with a vault
- MockBitgetVault holds 1M of every token
- No hardcoded addresses survive a chain wipe
- Vision swarm starts automatically if `swarm.env` exists
- Deployer gas balance verified before any contract deployment
- All funded addresses verified after gas distribution
- Database Vision tables reset on fresh deploy (no stale batch IDs)
- `assets.json`, `deployed-assets.json`, and `symbol-map.json` all reflect fresh on-chain addresses before services start
- Swarm bots receive both USDC and GM gas
