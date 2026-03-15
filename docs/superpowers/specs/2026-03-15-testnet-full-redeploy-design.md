# Testnet Full-Redeploy Upgrade

**Date:** 2026-03-15
**Status:** Approved
**Goal:** Make `testnet.sh deploy` + `testnet.sh start` a complete from-scratch deployment — all 621 Bitget tokens, 96 ITPs with vaults, all services including vision swarm.

## Problem

Three gaps prevent a clean fresh redeploy:

1. **Token deployment assumes prior state.** `Deploy107ITPs_Tokens.s.sol` hardcodes 84 token addresses in `_setExisting()`. On a fresh chain, those addresses are void. Only 231 tokens are handled; `assets.json` has 621.
2. **ITP vault deployment never runs.** `testnet.sh` calls token deploy + ITP create but never calls `Deploy107ITPs_Vaults.s.sol`. ITPs exist on-chain but are untradeable.
3. **Vision swarm requires separate manual script.** The 10 bots need `deploy-swarm.sh` run independently with pre-generated `swarm.env`.

## Design

### 1. New script: `scripts/deploy-all-tokens.py`

Generates `contracts/script/DeployAllTokens.s.sol` from `assets.json`.

**Input:** `assets.json` (622 entries, 621 unique symbols — one ETH duplicate)
**Output:** Solidity forge script that:
- Deploys all 621 tokens as `MockERC20("Mock {SYM}", "{SYM}", 18)`
- Funds `MockBitgetVault` with 1M (1e24) of each token
- Exports `data/all-token-addresses.csv` — format: `index,symbol,address\n`
- 25 tokens per batch function → 25 `_deployBatch` functions
- No `_setExisting()` — everything deployed fresh

**Deduplication:** Skip the second ETH entry (ETHUSDC duplicate in `assets.json`).

### 2. Modify `scripts/deploy-107-itps.py`

- **Remove** `gen_tokens_script()` entirely — no more `Deploy107ITPs_Tokens.s.sol`
- **Remove** token-related code from `gen_shell_script()`
- `gen_create_script()` reads addresses from `data/all-token-addresses.csv` (symbol-based lookup instead of index-based)
- Token CSV parser changes: parse `index,symbol,address\n` format, build symbol→address mapping
- `gen_vaults_script()` unchanged
- Shell script becomes 2 phases: create ITPs → deploy vaults
- The `existing` vs `new` token distinction eliminated entirely

**Token resolution change:** Currently ITP creation references tokens by array index (`t[sym_idx[sym]]`). New approach: still use array indexing, but the index comes from symbol lookup against the CSV. The `sym_idx` map is built from the CSV's symbol column rather than from a hardcoded split of existing/new tokens.

### 3. Modify `testnet.sh` `cmd_deploy`

New deployment order (renumbered):

| Step | What | Script |
|------|------|--------|
| 1 | RPC check | existing |
| 2 | bls-tool check | existing |
| 3 | Core contracts | `DeployFullSystemE2E` |
| 3b | Settlement (Sonic) | `DeployFullSystemE2E` |
| 4 | Fund gas | existing cast sends |
| 5 | Morpho | `DeployMorphoE2E` |
| 6 | Vision + batches | `DeployVision` + `DeployAllVisionBatches` |
| 7 | Fund USDC | existing cast sends |
| **8** | **Generate token deploy script** | `python3 scripts/deploy-all-tokens.py` |
| **9** | **Deploy all 621 tokens + fund vault** | `DeployAllTokens` |
| **10** | **Generate ITP scripts** | `python3 scripts/deploy-107-itps.py` |
| **11** | **Create 96 ITPs** | `Deploy107ITPs_Create` |
| **12** | **Deploy 96 ITP vaults** | `Deploy107ITPs_Vaults` |
| 13 | Sync deployments + switch env | existing |
| 14 | Frontend to Vercel | existing |
| 15 | Sync token registries | existing |

Steps 8-9 replace old step 8. Steps 10-12 replace old step 9 and add the missing vault deploy.

**Key detail:** Steps 8 and 10 run Python generators before the forge scripts. This ensures the Solidity is always regenerated from current data — no stale generated code.

### 4. Modify `testnet.sh` `cmd_start` — add vision swarm

After all core services start, add:

```
[8/8] Deploying vision swarm...
```

Logic extracted from `deploy-swarm.sh`:
- Check if `docker/testnet/vision-swarm/swarm.env` exists — if not, print warning and skip (bots are optional)
- If present: sync files, build on VPS, fund 10 bot wallets, start swarm
- Same rsync + cast send + docker compose up flow as `deploy-swarm.sh`

`deploy-swarm.sh` remains as a standalone script for manual re-deployment of just the swarm.

### 5. Token registry sync

The existing `deployed-assets.json` + `symbol-map.json` regeneration at the end of `cmd_deploy` stays. The `DeployAllTokens` script also writes `deployed-assets.json` with fresh on-chain addresses, so the final sync step merges/overwrites correctly.

## Files Changed

| File | Change |
|------|--------|
| `scripts/deploy-all-tokens.py` | **New** — generates DeployAllTokens.s.sol |
| `scripts/deploy-107-itps.py` | Remove token generation, read CSV for addresses |
| `testnet.sh` | Add token deploy, vault deploy, swarm start |
| `contracts/script/DeployAllTokens.s.sol` | **New** (auto-generated) |
| `contracts/script/Deploy107ITPs_Tokens.s.sol` | **Deleted** (no longer needed) |

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
